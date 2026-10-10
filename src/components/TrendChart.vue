<template>
  <!-- 近 7 天运势趋势折线图（echarts，星历主题配色），图例可切换维度 -->
  <div class="glass-card chart-card">
    <h3 class="chart-title">近 7 天运势趋势 <span class="chart-title-en mono">7-DAY TREND</span></h3>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  week: { type: Array, default: () => [] } // 近 7 天运势数组（升序日期）
})

const chartRef = ref(null)
let chart = null

// 等宽字体栈（图表标签统一 Space Mono，中文自动回落系统字体）
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// 维度定义：字段名 + 显示名 + 星历配色（综合金 / 爱情朱砂 / 事业玉色）
const DIMS = [
  { key: 'overallScore', name: '综合', color: '#E8C47C' },
  { key: 'loveScore', name: '爱情', color: '#C25E5E' },
  { key: 'careerScore', name: '事业', color: '#7FBF9E' },
  { key: 'wealthScore', name: '财运', color: '#9C8FD0' },
  { key: 'healthScore', name: '健康', color: '#7FA8BF' }
]

// 后端「去伪」后某维度可能整周为 null（如健康分）→ 整条线与图例一并剔除
function activeDims() {
  return DIMS.filter((d) => props.week.some((w) => w[d.key] != null))
}

function buildOption() {
  const dims = activeDims()
  // x 轴取 MM-DD 格式的日期
  const dates = props.week.map((d) => (d.fortuneDate || '').slice(5))
  return {
    textStyle: { fontFamily: MONO },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(35, 32, 72, 0.95)',
      borderColor: 'rgba(232, 196, 124, 0.25)',
      textStyle: { color: '#E8E6F0', fontFamily: MONO, fontSize: 12.5 }
    },
    legend: {
      data: dims.map((d) => d.name),
      // 默认只画"综合"线，其余维度通过点击图例开启
      selected: Object.fromEntries(dims.map((d) => [d.name, d.key === 'overallScore'])),
      textStyle: { color: '#A9A4CC', fontFamily: MONO, fontSize: 13 },
      inactiveColor: 'rgba(139, 135, 176, 0.3)',
      itemWidth: 16,
      itemHeight: 1,
      icon: 'rect',
      top: 0
    },
    grid: { left: 36, right: 18, top: 44, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
      axisTick: { show: false },
      axisLabel: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5,
      interval: 1,
      splitLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
      axisLabel: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 }
    },
    series: dims.map((d) => ({
      name: d.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: props.week.map((w) => w[d.key]),
      lineStyle: { color: d.color, width: 1.5 },
      itemStyle: { color: d.color },
      areaStyle: d.key === 'overallScore'
        ? {
            // 只给综合线一点渐变底色，突出主线
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(232, 196, 124, 0.22)' },
                { offset: 1, color: 'rgba(232, 196, 124, 0)' }
              ]
            }
          }
        : undefined
    }))
  }
}

function render() {
  if (chart) chart.setOption(buildOption())
}

function handleResize() {
  chart && chart.resize()
}

onMounted(() => {
  chart = echarts.init(chartRef.value)
  render()
  window.addEventListener('resize', handleResize)
})

// 切换星座后 week 数组变化 → 重画（保留用户的图例勾选状态）
watch(
  () => props.week,
  () => {
    if (!chart) return
    const prev = chart.getOption()
    const selected = prev && prev.legend && prev.legend[0] ? prev.legend[0].selected : undefined
    const opt = buildOption()
    if (selected) opt.legend.selected = selected
    chart.setOption(opt)
  },
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart && chart.dispose()
})
</script>

<style scoped>
.chart-card {
  padding: 20px 22px;
}
.chart-title {
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0.3em;
  color: var(--ink);
  margin-bottom: 6px;
}
.chart-title-en {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
  margin-left: 8px;
}
.chart {
  width: 100%;
  height: 320px;
}
</style>
