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
    localStorage: {
      getItem: () => storage.value ?? null,
      setItem: (_, value) => { if (storage.fail) throw new Error('quota'); storage.value = value }
    }
  }
  vm.runInNewContext(source + '\nthis.page = { drawn, revealedCount, nextCard, revealNext, revealAll, resetDraw, doDraw, daily, lessonOpen, markLearned, todayLearned, learnedCards, studyError, readLearnedCards, picking, drawError };', context)
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
