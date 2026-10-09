<template>
  <div class="admin-view">
    <!-- 头部：词标 + 返回首页 -->
    <header class="a-header">
      <div>
        <p class="eyebrow mono">STARWHISPER · CONSOLE</p>
        <h1 class="a-title">星语后台 <span class="a-title-en">ADMIN</span></h1>
      </div>
      <button type="button" class="a-link mono" @click="goHome">← 返回首页</button>
    </header>
    <div class="header-divider"><i></i><span>✦</span><i></i></div>

    <!-- ===== Key 门禁：未存 key 或 key 被 401 拒绝时展示 ===== -->
    <section v-if="gated" class="glass-card gate">
      <p class="gate-icon">✧</p>
      <p class="gate-text">请输入管理 Key 查看运营数据</p>
      <p v-if="gateError" class="error-line">{{ gateError }}</p>
      <form class="gate-form" @submit.prevent="submitKey">
        <input
          v-model.trim="keyInput"
          class="gate-input mono"
          type="password"
          placeholder="ADMIN KEY"
          autocomplete="off"
        />
        <button type="submit" class="a-btn" :disabled="!keyInput">进入</button>
      </form>
    </section>

    <template v-else>
      <!-- 加载 / 错误 -->
      <div v-if="loading && !stats" class="glass-card a-state"><div class="spinner"></div></div>
      <template v-else-if="stats">
        <p v-if="demo" class="demo-line mono">⚠ 后台接口暂不可用，当前为演示数据 <button class="a-link mono" @click="reload">重试接口</button></p>

        <!-- ===== 核心数字卡片 ===== -->
        <section class="stat-grid">
          <div v-for="c in cards" :key="c.label" class="glass-card stat-card">
            <p class="stat-label mono">{{ c.label }}</p>
            <p class="stat-value" :class="{ gold: c.gold }">{{ c.value }}</p>
            <p class="stat-en mono">{{ c.en }}</p>
          </div>
        </section>

        <!-- ===== 图表：近7日新增用户折线 + 牌阵分布饼图 ===== -->
        <section class="chart-row">
          <div class="glass-card chart-card">
            <h3 class="sec-title">近 7 日新增用户 <span class="sec-title-en mono">NEW USERS</span></h3>
            <div ref="lineRef" class="chart"></div>
          </div>
          <div class="glass-card chart-card">
            <h3 class="sec-title">牌阵分布 <span class="sec-title-en mono">SPREADS</span></h3>
            <div ref="pieRef" class="chart"></div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'
import { fetchAdminStats } from '../api'

const KEY_STORE = 'starwhisper:adminkey'
const MONO = '"Space Mono", "Noto Sans SC", monospace'

/* ===== Key 门禁 ===== */
const adminKey = ref(localStorage.getItem(KEY_STORE) || '')
const gated = ref(!adminKey.value)
const keyInput = ref('')
const gateError = ref('')

function submitKey() {
  adminKey.value = keyInput.value
  localStorage.setItem(KEY_STORE, adminKey.value)
  gated.value = false
  gateError.value = ''
  load()
}

/* ===== 统计数据 ===== */
const stats = ref(null)
const demo = ref(false)
const loading = ref(false)

// 接口未上线时的演示数据（按日微动，保证图表形态稳定）
function mockStats() {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const p = (n) => String(n).padStart(2, '0')
    return { date: `${p(d.getMonth() + 1)}-${p(d.getDate())}`, count: 9 + ((i * 37 + 11) % 21) }
  })
  return {
    userCount: 1286, todayNewUsers: 17, todayActive: 243,
    checkinTotal: 4521, todayCheckins: 89, tarotTotal: 3312,
    spreadDist: [
      { spread: 'single', count: 1240 }, { spread: 'three', count: 860 },
      { spread: 'choice', count: 430 }, { spread: 'love', count: 512 },
      { spread: 'celtic', count: 180 }, { spread: 'hexagram', count: 90 }
    ],
    dailyNewUsers: days
  }
}

async function load() {
  loading.value = true
  try {
    stats.value = await fetchAdminStats(adminKey.value)
    demo.value = false
  } catch (e) {
    if (e && e.code === 401) {
      // key 无效：回门禁
      localStorage.removeItem(KEY_STORE)
      adminKey.value = ''
      gated.value = true
      gateError.value = 'Key 无效，请重新输入'
      stats.value = null
      loading.value = false
      return
    }
    // 后端未上线：演示数据兜底
    stats.value = mockStats()
    demo.value = true
  } finally {
    loading.value = false
  }
  await nextTick()
  renderCharts()
}

function reload() {
  load()
}

const cards = computed(() => {
  const s = stats.value || {}
  return [
    { label: '总用户', en: 'USERS', value: s.userCount ?? '-', gold: true },
    { label: '今日新增', en: 'NEW TODAY', value: s.todayNewUsers ?? '-' },
    { label: '今日活跃', en: 'ACTIVE TODAY', value: s.todayActive ?? '-' },
    { label: '累计打卡', en: 'CHECKINS', value: s.checkinTotal ?? '-' },
    { label: '今日打卡', en: 'CHECKINS TODAY', value: s.todayCheckins ?? '-' },
    { label: '累计抽牌', en: 'TAROT DRAWS', value: s.tarotTotal ?? '-' }
  ]
})

/* ===== ECharts ===== */
const lineRef = ref(null)
const pieRef = ref(null)
let lineChart = null
let pieChart = null

const AXIS = {
  axisLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
  axisTick: { show: false },
  axisLabel: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 }
}
const TIP = {
  trigger: 'axis',
  backgroundColor: 'rgba(16, 22, 58, 0.92)',
  borderColor: 'rgba(232, 196, 124, 0.25)',
  textStyle: { color: '#E8E6F0', fontFamily: MONO, fontSize: 12.5 }
}
const SPREAD_NAMES = {
  single: '单牌指引', three: '时间之流', choice: '二选一',
  love: '爱情十字', celtic: '凯尔特十字', hexagram: '六芒星'
}

function renderCharts() {
  const s = stats.value
  if (!s) return
  if (lineRef.value) {
    lineChart = lineChart || echarts.init(lineRef.value)
    lineChart.setOption({
      tooltip: TIP,
      grid: { left: 40, right: 18, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: (s.dailyNewUsers || []).map((d) => d.date), ...AXIS },
      yAxis: {
        type: 'value', minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
        ...AXIS
      },
      series: [{
        name: '新增用户', type: 'line', smooth: true,
        symbol: 'circle', symbolSize: 5,
        data: (s.dailyNewUsers || []).map((d) => d.count),
        lineStyle: { color: '#E8C47C', width: 1.5 },
        itemStyle: { color: '#E8C47C' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(232, 196, 124, 0.22)' },
              { offset: 1, color: 'rgba(232, 196, 124, 0)' }
            ]
          }
        }
      }]
    })
  }
  if (pieRef.value) {
    pieChart = pieChart || echarts.init(pieRef.value)
    pieChart.setOption({
      tooltip: { ...TIP, trigger: 'item' },
      legend: {
        bottom: 0,
        textStyle: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 },
        itemWidth: 12, itemHeight: 8
      },
      color: ['#E8C47C', '#7FBF9E', '#9C8FD0', '#6E8FC8', '#C25E5E', '#A9A4CC'],
      series: [{
        name: '牌阵分布', type: 'pie',
        radius: ['38%', '64%'], center: ['50%', '44%'],
        label: { color: '#A9A4CC', fontFamily: MONO, fontSize: 11.5, formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.4)' } },
        itemStyle: { borderColor: '#070B1E', borderWidth: 2 },
        data: (s.spreadDist || []).map((d) => ({
          name: SPREAD_NAMES[d.spread] || d.spread,
          value: d.count
        }))
      }]
    })
  }
}

function handleResize() {
  lineChart && lineChart.resize()
  pieChart && pieChart.resize()
}
window.addEventListener('resize', handleResize)

function goHome() {
  location.hash = '' // 触发 App 的 hashchange，回到主站
}

if (!gated.value) load()

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  lineChart && lineChart.dispose()
  pieChart && pieChart.dispose()
})
</script>

<style scoped>
.admin-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 头部 ===== */
.a-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.a-title {
  font-family: var(--font-display);
  font-size: 34px;
  letter-spacing: 0.18em;
  color: var(--gold);
  text-shadow: 0 0 26px rgba(232, 196, 124, 0.3);
  margin-top: 8px;
}
.a-title-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  color: var(--ink-dim);
  margin-left: 10px;
}
.a-link {
  background: none;
  border: none;
  padding: 6px 2px;
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-dim);
  cursor: pointer;
  transition: color 0.2s;
}
.a-link:hover { color: var(--gold); }
.header-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--gold-dim);
  font-size: 12px;
}
.header-divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* ===== Key 门禁 ===== */
.gate {
  margin: 60px auto 0;
  padding: 44px 60px;
  text-align: center;
  max-width: 480px;
}
.gate-icon {
  font-size: 34px;
  color: var(--gold);
  margin-bottom: 14px;
}
.gate-text {
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--ink);
  margin-bottom: 22px;
}
.gate-form {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.gate-input {
  width: 220px;
  padding: 10px 14px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.6);
  color: var(--ink);
  font-size: 13px;
  letter-spacing: 0.14em;
  outline: none;
  transition: border-color 0.2s;
}
.gate-input:focus { border-color: var(--gold-dim); }
.a-btn {
  padding: 10px 28px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.22em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.a-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.a-btn:disabled { opacity: 0.5; cursor: default; }
.error-line {
  margin: 0 0 14px;
  font-size: 13.5px;
  letter-spacing: 0.1em;
  color: var(--cinnabar);
}

/* ===== 演示数据提示 ===== */
.demo-line {
  font-size: 12.5px;
  letter-spacing: 0.14em;
  color: var(--gold-dim);
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== 核心数字卡片 ===== */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
.stat-card {
  padding: 18px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-label {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
}
.stat-value {
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--ink);
  line-height: 1.2;
}
.stat-value.gold { color: var(--gold); }
.stat-en {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: rgba(169, 164, 204, 0.55);
}

/* ===== 图表 ===== */
.chart-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 22px;
}
.chart-card {
  padding: 20px 22px;
}
.sec-title {
  font-family: var(--font-display);
  font-size: 16px;
  letter-spacing: 0.26em;
  color: var(--ink);
  margin-bottom: 12px;
}
.sec-title-en {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
  margin-left: 8px;
}
.chart {
  height: 300px;
}

.a-state {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

/* ===== 窄屏 ===== */
@media (max-width: 960px) {
  .stat-grid { grid-template-columns: repeat(3, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .gate { padding: 34px 22px; }
}
</style>
