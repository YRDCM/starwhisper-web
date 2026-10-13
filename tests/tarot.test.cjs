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
      getItem: () => storage.value ?? null,
      setItem: (_, value) => { if (storage.fail) throw new Error('quota'); storage.value = value }
    }
  }
  vm.runInNewContext(source + '\nthis.page = { drawn, revealedCount, nextCard, revealNext, revealAll, resetDraw, doDraw, daily, lessonOpen, markLearned, todayLearned, learnedCards, studyError, readLearnedCards, picking, drawError, selectDetail, detailCard, detailIndex, drawId, readWithAi, aiLoading, aiResult, aiError };', context)
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
