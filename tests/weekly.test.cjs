// 本周运势（Web 端）测试：timeRange 格式化纯函数 + App.vue 周运数据流
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

// src/weekly.js 是 ESM，这里用 vm 以 CommonJS 方式加载纯函数
function loadFormatWeekRange() {
  const source = fs.readFileSync(path.join(__dirname, '../src/weekly.js'), 'utf8')
    .replace('export function formatWeekRange', 'function formatWeekRange')
  const context = {}
  vm.runInNewContext(source + '\nthis.formatWeekRange = formatWeekRange;', context)
  return context.formatWeekRange
}
const formatWeekRange = loadFormatWeekRange()

/* ===== formatWeekRange 纯函数 ===== */

test('formatWeekRange：标准区间格式化为可读形式', () => {
  assert.equal(formatWeekRange('20261011-20261018'), '10.11 – 10.18')
  assert.equal(formatWeekRange('20260913-20260920'), '09.13 – 09.20') // 前导零保留
  assert.equal(formatWeekRange('20261228-20270103'), '12.28 – 01.03') // 跨年
})

test('formatWeekRange：异常输入一律返回空串', () => {
  assert.equal(formatWeekRange(null), '')
  assert.equal(formatWeekRange(undefined), '')
  assert.equal(formatWeekRange(''), '')
  assert.equal(formatWeekRange('20261011'), '')
  assert.equal(formatWeekRange('10.11-10.18'), '')
  assert.equal(formatWeekRange('2026-10-11~2026-10-18'), '')
})

/* ===== App.vue 周运数据流 ===== */

const { ref, computed } = require('vue')

function setup() {
  const pending = {}
  const calls = []
  const source = fs.readFileSync(path.join(__dirname, '../src/App.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const context = {
    ref, computed, onMounted: () => {}, location: { hash: '' },
    window: { addEventListener: () => {} }, localStorage: { getItem: () => null, setItem: () => {} },
    fetchTodayFortune: async (sign) => ({ signNameEn: sign }),
    fetchWeekFortune: async (sign) => [sign],
    fetchWeeklyFortune: (sign) => {
      calls.push(sign)
      return new Promise((resolve, reject) => { pending[sign] = { resolve, reject } })
    }
  }
  vm.runInNewContext(source + '\nthis.page = { loadFortune, loadWeekly, setMode, retryWeekly, mode, weekly, weeklyLoading, weeklyError, error, signs, currentSignId, currentSign };', context)
  return { page: context.page, pending, calls }
}

test('周运失败显示专属错误态，今日数据不受影响', async () => {
  const { page, pending } = setup()
  const req = page.loadWeekly({ nameEn: 'leo' })
  assert.equal(page.weeklyLoading.value, true)
  pending.leo.reject(new Error('ShowAPI 调用失败'))
  await req
  assert.equal(page.weekly.value, null)
  assert.equal(page.weeklyLoading.value, false)
  assert.ok(page.weeklyError.value.includes('本周运势'))
  assert.equal(page.error.value, '') // 今日错误态独立，不受周运失败影响
})

test('同星座周运命中缓存，force 才重新请求', async () => {
  const { page, pending, calls } = setup()
  const first = page.loadWeekly({ nameEn: 'leo' })
  pending.leo.resolve({ signNameEn: 'leo', timeRange: '20261011-20261018' })
  await first
  assert.deepEqual(calls, ['leo'])
  await page.loadWeekly({ nameEn: 'leo' })
  assert.deepEqual(calls, ['leo']) // 缓存命中，不重复请求
  const forced = page.loadWeekly({ nameEn: 'leo' }, true)
  pending.leo.resolve({ signNameEn: 'leo' })
  await forced
  assert.deepEqual(calls, ['leo', 'leo'])
})

test('快速切换星座，晚到的旧周运不能覆盖新结果', async () => {
  const { page, pending } = setup()
  const first = page.loadWeekly({ nameEn: 'aries' })
  const second = page.loadWeekly({ nameEn: 'leo' })
  pending.leo.resolve({ signNameEn: 'leo' })
  await second
  pending.aries.resolve({ signNameEn: 'aries' })
  await first
  assert.equal(page.weekly.value.signNameEn, 'leo')
  assert.equal(page.weeklyLoading.value, false)
  assert.equal(page.weeklyError.value, '')
})

test('切到本周 tab 且无数据时才触发加载', async () => {
  const { page, pending, calls } = setup()
  page.signs.value = [{ id: 5, nameEn: 'leo' }]
  page.currentSignId.value = 5
  page.setMode('week')
  assert.equal(page.mode.value, 'week')
  assert.deepEqual(calls, ['leo'])
  pending.leo.resolve({ signNameEn: 'leo' })
  await Promise.resolve(); await Promise.resolve()
  page.setMode('today')
  page.setMode('week')
  assert.deepEqual(calls, ['leo']) // 有数据后切回不再请求
})
