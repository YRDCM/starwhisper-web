const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('path')
const { ref } = require('vue')

// 运行 BaguaView 的真实 <script setup>，API 用桩替换
function setup(api = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/BaguaView.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const context = {
    ref,
    onMounted: () => {},
    onUnmounted: () => {},
    fetchBaguaDaily: api.fetchBaguaDaily || (async () => null),
    castBagua: api.castBagua || (async () => { throw new Error('未配置') }),
    fetchHexagrams: api.fetchHexagrams || (async () => []),
    fetchBaguaReading: api.fetchBaguaReading,
    setInterval, clearInterval, setTimeout, clearTimeout
  }
  vm.runInNewContext(source + '\nthis.page = { castResult, showResult, doCast, resetCast, readWithAi, aiQuestion, aiLoading, aiResult, aiError, aiExpanded };', context)
  return context.page
}

const CAST = {
  primary: { seqNumber: 24, name: '地雷复', lines: '100000', upperTrigram: '坤', lowerTrigram: '震', fortuneLevel: '中吉', judgment: '亨。', meaning: '一阳来复' },
  changed: { seqNumber: 2, name: '坤为地', lines: '000000', upperTrigram: '坤', lowerTrigram: '坤', fortuneLevel: '上上', judgment: '元亨', meaning: '厚德载物' },
  changingLines: [1],
  linesDetail: Array.from({ length: 6 }, (_, i) => ({ position: i + 1, label: i ? '少阴' : '老阳', yang: i === 0, changing: i === 0 }))
}

test('AI 解卦：未起卦不请求；起卦后请求带卦面身份与问题；成功后不重复请求', async () => {
  let sent, calls = 0
  const page = setup({
    castBagua: async () => CAST,
    fetchBaguaReading: async (payload) => { calls++; sent = payload; return { summary: '总览', detail: '详情' } }
  })
  await page.readWithAi()
  assert.equal(calls, 0)

  await page.doCast()
  page.showResult.value = true // 跳过逐爻动画，直接到结果态
  page.aiQuestion.value = '  事业如何？  '
  await page.readWithAi()
  assert.equal(JSON.stringify(sent), JSON.stringify({ primarySeq: 24, changedSeq: 2, changingLines: [1], question: "事业如何？" }))
  assert.equal(page.aiResult.value.summary, '总览')
  await page.readWithAi()
  assert.equal(calls, 1)
  page.aiExpanded.value = !page.aiExpanded.value
  assert.equal(page.aiExpanded.value, true)
})

test('AI 解卦：限额报错透传、卦面保留可重试，重新起卦清空 AI 态', async () => {
  let calls = 0
  const page = setup({
    castBagua: async () => CAST,
    fetchBaguaReading: async () => { if (++calls === 1) throw new Error('当前网络今日 AI 解读次数已用完，明天再来看看'); return { summary: '总览', detail: '详情' } }
  })
  await page.doCast()
  page.showResult.value = true
  await page.readWithAi()
  assert.equal(page.aiError.value, '当前网络今日 AI 解读次数已用完，明天再来看看')
  assert.ok(page.castResult.value)
  await page.readWithAi()
  assert.equal(calls, 2)
  assert.equal(page.aiResult.value.summary, '总览')
  page.resetCast()
  assert.equal(page.aiResult.value, null)
  assert.equal(page.aiError.value, '')
  assert.equal(page.aiQuestion.value, '')
})

test('AI 解卦：重新起卦后忽略旧卦的迟到响应', async () => {
  let resolveOld
  const page = setup({
    castBagua: async () => CAST,
    fetchBaguaReading: () => new Promise((resolve) => { resolveOld = resolve })
  })
  await page.doCast()
  page.showResult.value = true
  const pending = page.readWithAi()
  assert.equal(page.aiLoading.value, true)
  page.resetCast()
  resolveOld({ summary: '旧卦总览', detail: '旧卦详情' })
  await pending
  assert.equal(page.aiResult.value, null)
  assert.equal(page.aiLoading.value, false)
})

test('无变爻时起卦请求不带之卦', async () => {
  let sent
  const stillCast = { ...CAST, changed: null, changingLines: [] }
  const page = setup({
    castBagua: async () => stillCast,
    fetchBaguaReading: async (payload) => { sent = payload; return { summary: '总览', detail: '详情' } }
  })
  await page.doCast()
  page.showResult.value = true
  await page.readWithAi()
  assert.equal(JSON.stringify(sent), JSON.stringify({ primarySeq: 24, changedSeq: null, changingLines: [], question: "" }))
})
