const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { ref, computed } = require('vue')

function setup() {
  const pending = {}
  const source = fs.readFileSync(path.join(__dirname, '../src/App.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const context = {
    ref, computed, onMounted: () => {}, location: { hash: '' },
    window: { addEventListener: () => {} }, localStorage: { getItem: () => null },
    fetchTodayFortune: (sign) => new Promise((resolve, reject) => { pending[sign] = { resolve, reject } }),
    fetchWeekFortune: async (sign) => [sign]
  }
  vm.runInNewContext(source + '\nthis.page = { loadFortune, fortune, week, loading, error, signs, currentSignId, displayedSign };', context)
  return { page: context.page, pending }
}

test('快速切换星座，晚到的旧结果不能覆盖新结果', async () => {
  const { page, pending } = setup()
  const first = page.loadFortune({ nameEn: 'aries' })
  const second = page.loadFortune({ nameEn: 'leo' })
  pending.leo.resolve({ signNameEn: 'leo' })
  await second
  pending.aries.resolve({ signNameEn: 'aries' })
  await first
  assert.equal(page.fortune.value.signNameEn, 'leo')
  assert.equal(page.week.value[0], 'leo')
})

test('旧请求报错不清除新星座的加载状态', async () => {
  const { page, pending } = setup()
  const first = page.loadFortune({ nameEn: 'aries' })
  const second = page.loadFortune({ nameEn: 'leo' })
  pending.aries.reject(new Error('旧请求超时'))
  await first
  assert.equal(page.error.value, '')
  assert.equal(page.loading.value, true)
  pending.leo.resolve({ signNameEn: 'leo' })
  await second
  assert.equal(page.loading.value, false)
})

test('点击当前星座不会重复触发运势加载', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/SignWheel.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const events = []
  const context = { computed, defineProps: () => ({ signs: [], modelValue: 1 }), defineEmits: () => (...event) => events.push(event) }
  vm.runInNewContext(source + '\nthis.select = selectSign;', context)
  context.select({ id: 1 })
  assert.equal(events.length, 0)
  context.select({ id: 2 })
  assert.equal(events.length, 2)
  assert.equal(events[0][1], 2)
})

test('新星座加载期间，旧运势仍展示旧星座的日期与资料', () => {
  const { page } = setup()
  page.signs.value = [{ id: 1, nameEn: 'aries' }, { id: 2, nameEn: 'leo' }]
  page.fortune.value = { signNameEn: 'aries' }
  page.currentSignId.value = 2
  assert.equal(page.displayedSign.value.id, 1)
  page.fortune.value = { signNameEn: 'leo' }
  assert.equal(page.displayedSign.value.id, 2)
})
