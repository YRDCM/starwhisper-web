const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { ref, computed } = require('vue')

// Run the actual page setup with Vue reactivity and isolated API/storage adapters.
function setup(storage = {}, api = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/TarotView.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const context = { ref, computed, onMounted: () => {}, onUnmounted: () => {},
    drawTarot: api.drawTarot || (async () => ({ cards: [] })),
    fetchTarotReading: api.fetchTarotReading,
    localStorage: {
      getItem: key => key.includes('tarot-session') ? storage.session ?? null : key.includes('daily-moods') ? storage.moods ?? null : storage.value ?? null,
      removeItem: () => { if (storage.fail) throw new Error('quota'); delete storage.session },
      setItem: (key, value) => { if (storage.fail) throw new Error('quota'); if (key.includes('tarot-session')) storage.session = value; else if (key.includes('daily-moods')) storage.moods = value; else storage.value = value }
    }
  }
  vm.runInNewContext(source + '\nthis.page = { drawn, revealedCount, nextCard, revealNext, revealAll, resetDraw, doDraw, daily, lessonOpen, markLearned, todayLearned, learnedCards, studyError, readLearnedCards, picking, drawError, selectDetail, detailCard, detailIndex, drawId, readWithAi, aiLoading, aiResult, aiError, aiQuestion, saveSnapshot, restoreSnapshot, snapshotError, spread, moodRecords, todayMood, moodHistoryOpen, moodError, moodCurve, moodDist, selectMood, refreshMood, toggleMoodHistory, moodScore, buildMoodCurve, buildMoodDist };', context)
  return context.page
}

test('逐张揭晓、全部揭晓和重新抽牌不会泄露下一张解读', async () => {
  const cards = Array.from({ length: 10 }, (_, i) => ({ card: { id: i + 1 }, position: `位置${i + 1}` }))
  const page = setup({}, { drawTarot: async () => ({ cards }) })
  await page.doDraw()
  assert.equal(page.revealedCount.value, 0)
  assert.equal(page.nextCard.value.position, '位置1')
  page.revealNext()
  assert.equal(page.revealedCount.value, 1)
  assert.equal(page.nextCard.value.position, '位置2')
  page.revealAll()
  page.revealNext()
  assert.equal(page.revealedCount.value, 10)
  page.resetDraw()
  assert.equal(page.revealedCount.value, 0)
  assert.equal(page.drawn.value.length, 0)
})

test('损坏学习缓存可恢复，学习记录去重，保存失败不显示成功', () => {
  const storage = { value: 'broken json' }
  const page = setup(storage)
  assert.equal(page.readLearnedCards().length, 0)
  page.daily.value = { card: { arcanaGroup: 'WANDS', cardNumber: 1 } }
  page.markLearned()
  assert.equal(page.todayLearned.value, false)
  page.lessonOpen.value = true
  storage.fail = true
  page.markLearned()
  assert.equal(page.todayLearned.value, false)
  assert.match(page.studyError.value, /未能保存/)
  storage.fail = false
  page.markLearned()
  page.markLearned()
  assert.deepEqual(JSON.parse(storage.value), [23])
  assert.equal(page.todayLearned.value, true)
})

test('空抽牌结果保留选牌并提示错误', async () => {
  const page = setup()
  page.picking.value = true
  await page.doDraw('1')
  assert.equal(page.picking.value, true)
  assert.match(page.drawError.value, /完整牌面/)
})

test('AI 仅在完全揭晓后请求，重复点击与重抽后的旧响应被忽略', async () => {
  let resolveReading, calls = 0
  const page = setup({}, {
    drawTarot: async () => ({ drawId: 'a', cards: [{ card: { id: 1 } }, { card: { id: 2 } }] }),
    fetchTarotReading: () => { calls++; return new Promise(resolve => { resolveReading = resolve }) }
  })
  await page.doDraw()
  await page.readWithAi()
  assert.equal(calls, 0)
  page.revealAll()
  page.selectDetail(1)
  assert.equal(page.detailCard.value.card.id, 2)
  page.selectDetail(99)
  assert.equal(page.detailIndex.value, 1)
  const pending = page.readWithAi()
  await page.readWithAi()
  assert.equal(calls, 1)
  page.resetDraw()
  resolveReading({ summary: '旧总览', detail: '旧详情' })
  await pending
  assert.equal(page.aiResult.value, null)
  assert.equal(page.aiLoading.value, false)
})

test('AI 失败保留原牌面并允许重试，成功后不重复生成', async () => {
  let calls = 0
  const page = setup({}, {
    drawTarot: async () => ({ drawId: 'a', cards: [{ card: { id: 1 } }] }),
    fetchTarotReading: async () => { if (++calls === 1) throw new Error('暂不可用'); return { summary: '总览', detail: '详情' } }
  })
  await page.doDraw(); page.revealAll()
  await page.readWithAi()
  assert.equal(page.drawn.value.length, 1)
  assert.equal(page.aiError.value, '暂不可用')
  await page.readWithAi(); await page.readWithAi()
  assert.equal(calls, 2)
  assert.equal(page.aiResult.value.summary, '总览')
})

for (const [spread, count] of Object.entries({single:1, three:3, choice:3, love:5, celtic:10, hexagram:7})) {
  test(`${spread} 本地恢复牌序、揭晓进度、问题与解读`, async () => {
    const storage = {}
    const cards = Array.from({length:count}, (_,i) => ({card:{id:i+1,name:'牌'+i},orientation:'upright',position:'位置'+i}))
    const first = setup(storage, {drawTarot: async () => ({cards,drawId:'draw'})})
    first.spread.value = spread
    await first.doDraw(); first.revealNext()
    first.aiQuestion.value = '我该如何规划？'
    first.saveSnapshot()
    const restored = setup(storage); restored.restoreSnapshot()
    assert.equal(restored.drawn.value.length, count)
    assert.equal(restored.revealedCount.value, 1)
    assert.equal(restored.aiQuestion.value, '我该如何规划？')
    restored.selectDetail(count)
    assert.equal(restored.detailIndex.value, 0)
    restored.resetDraw()
    assert.equal(storage.session, undefined)
  })
}
test('过期牌阵保留已生成的 AI 内容，禁用旧凭证；损坏缓存可恢复', () => {
  const storage = {session:JSON.stringify({version:1,spread:'single',createdAt:Date.now()-3*3600000,cards:[{card:{name:'愚人'},orientation:'upright'}],revealedCount:1,drawId:'expired',reading:{summary:'总览',detail:'详情'}})}
  const page = setup(storage); page.restoreSnapshot()
  assert.equal(page.drawId.value, '')
  assert.equal(page.aiResult.value.detail, '详情')
  storage.session = '{broken'
  const broken = setup(storage); broken.restoreSnapshot()
  assert.equal(broken.drawn.value.length, 0)
  assert.equal(storage.session, undefined)
})
test('本地保存失败不会打断抽牌和揭晓', async () => {
  const page=setup({fail:true},{drawTarot:async()=>({cards:[{card:{name:'愚人'}}]})})
  await page.doDraw(); page.revealAll()
  assert.equal(page.drawn.value.length,1)
  assert.match(page.snapshotError.value,/未能保存/)
})

// 心情曲线/分布数组产自 vm 沙箱（Array 原型不同），统一 JSON 化后再比较
const j = (v) => JSON.parse(JSON.stringify(v))

test('心情分数映射：6 档分值与未知心情（与小程序端一致）', () => {
  const page = setup()
  assert.equal(page.moodScore('开心'), 5)
  assert.equal(page.moodScore('期待'), 4)
  assert.equal(page.moodScore('平静'), 3)
  assert.equal(page.moodScore('纠结'), 2)
  assert.equal(page.moodScore('疲惫'), 1.5) // 精力状态而非情绪谷底，不与低落并列
  assert.equal(page.moodScore('低落'), 1)
  assert.equal(page.moodScore('兴奋'), null)
  assert.equal(page.moodScore(''), null)
  assert.equal(page.moodScore(undefined), null)
})

test('心情曲线：非法项跳过、按日期升序、空/单条不产出曲线', () => {
  const page = setup()
  assert.deepEqual(j(page.buildMoodCurve([])), [])
  assert.deepEqual(j(page.buildMoodCurve(null)), [])
  assert.equal(j(page.buildMoodCurve([{ date: '2026-01-01', mood: '开心' }])).length, 1)
  const curve = j(page.buildMoodCurve([
    { date: '2026-01-03', mood: '低落' },
    { date: '2026-01-01', mood: '开心' },
    { date: 'bad', mood: '开心' },
    { date: '2026-01-02', mood: '无效心情' }
  ]))
  assert.deepEqual(curve.map((p) => p.day), ['01-01', '01-03'])
  assert.deepEqual(curve.map((p) => p.score), [5, 1])
  assert.deepEqual(curve.map((p) => p.mood), ['开心', '低落'])
})

test('心情分布：按分数降序、计数正确、pct 相对最多项、未出现的心情不列出', () => {
  const page = setup()
  assert.deepEqual(j(page.buildMoodDist(null)), [])
  assert.deepEqual(j(page.buildMoodDist([])), [])
  const dist = j(page.buildMoodDist([
    { date: '2026-01-01', mood: '开心' },
    { date: '2026-01-02', mood: '开心' },
    { date: '2026-01-03', mood: '低落' },
    { date: '2026-01-04', mood: '无效心情' }
  ]))
  assert.deepEqual(dist, [
    { mood: '开心', score: 5, count: 2, pct: 100 },
    { mood: '低落', score: 1, count: 1, pct: 50 }
  ])
})

test('每日心情：当天修改不重复，重新进入恢复，损坏缓存可恢复，独立于学习记录', () => {
  const storage = { value: '[1,2]' }
  const page = setup(storage)
  page.refreshMood()
  page.selectMood('平静')
  page.selectMood('期待')
  assert.equal(JSON.parse(storage.moods).length, 1)
  assert.equal(page.todayMood.value, '期待')
  assert.equal(storage.value, '[1,2]') // 学习记录 key 不受影响
  const reopened = setup(storage)
  reopened.refreshMood()
  assert.equal(reopened.todayMood.value, '期待')
  assert.equal(j(reopened.moodCurve.value).length, 1) // 单条记录 → 空态（模板据此不画曲线）
  page.selectMood('无效心情')
  assert.equal(JSON.parse(storage.moods).length, 1)
  // 损坏缓存 → 空记录而不是抛错
  const broken = setup({ moods: '{broken' })
  broken.refreshMood()
  assert.equal(broken.moodRecords.value.length, 0)
  assert.equal(broken.moodError.value, '')
})

test('每日心情：写入失败不显示保存成功，重试可更新；历史驱动曲线与分布', () => {
  const storage = {}
  const page = setup(storage)
  page.refreshMood()
  page.selectMood('平静')
  storage.fail = true
  page.selectMood('疲惫')
  assert.equal(page.todayMood.value, '平静')
  assert.match(page.moodError.value, /未保存/)
  storage.fail = false
  page.selectMood('疲惫')
  assert.equal(page.todayMood.value, '疲惫')
  assert.equal(page.moodError.value, '')
  // 已有 2 天历史 → 曲线 2 个点（升序），分布计数正确
  const withHistory = setup({ moods: JSON.stringify([
    { date: '2026-01-02', mood: '期待' },
    { date: '2026-01-01', mood: '平静' }
  ]) })
  withHistory.refreshMood()
  assert.deepEqual(j(withHistory.moodCurve.value).map((p) => p.date), ['2026-01-01', '2026-01-02'])
  assert.deepEqual(j(withHistory.moodCurve.value).map((p) => p.score), [3, 4])
  assert.equal(j(withHistory.moodDist.value).length, 2)
})
