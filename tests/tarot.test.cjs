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
      getItem: key => key.includes('tarot-session') ? storage.session ?? null : storage.value ?? null,
      removeItem: () => { if (storage.fail) throw new Error('quota'); delete storage.session },
      setItem: (key, value) => { if (storage.fail) throw new Error('quota'); if (key.includes('tarot-session')) storage.session = value; else storage.value = value }
    }
  }
  vm.runInNewContext(source + '\nthis.page = { drawn, revealedCount, nextCard, revealNext, revealAll, resetDraw, doDraw, daily, lessonOpen, markLearned, todayLearned, learnedCards, studyError, readLearnedCards, picking, drawError, selectDetail, detailCard, detailIndex, drawId, readWithAi, aiLoading, aiResult, aiError, aiQuestion, saveSnapshot, restoreSnapshot, snapshotError, spread };', context)
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
