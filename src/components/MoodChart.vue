<template>
  <!-- 心情曲线图（echarts，星历主题配色，风格对齐 TrendChart 近 7 天运势趋势） -->
  <div ref="chartRef" class="mood-chart"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  // 心情曲线点（日期升序）：[{ date:'YYYY-MM-DD', day:'MM-DD', mood, score }]
  curve: { type: Array, default: () => [] }
})

const chartRef = ref(null)
let chart = null

// 等宽字体栈（图表标签统一 Space Mono，中文自动回落系统字体）
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// y 轴整刻度直接显示心情名；疲惫为 1.5 分（精力状态而非情绪谷底），无整刻度，tooltip 展示精确分数
const MOOD_AT = { 5: '开心', 4: '期待', 3: '平静', 2: '纠结', 1: '低落' }

function buildOption() {
  const curve = props.curve
  return {
    textStyle: { fontFamily: MONO },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(35, 32, 72, 0.95)',
      borderColor: 'rgba(232, 196, 124, 0.25)',
      textStyle: { color: '#E8E6F0', fontFamily: MONO, fontSize: 12.5 },
      formatter: (params) => {
        const p = params && params[0]
        const item = p && curve[p.dataIndex]
        return item ? `${item.date} · ${item.mood}（${item.score} 分）` : ''
      }
    },
    grid: { left: 52, right: 18, top: 24, bottom: 30 },
    xAxis: {
      type: 'category',
      data: curve.map((p) => p.day),
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
      axisLabel: {
        color: '#A9A4CC', fontFamily: MONO, fontSize: 12,
        formatter: (v) => MOOD_AT[v] || ''
      }
    },
    series: [{
      name: '心情',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: curve.map((p) => p.score),
      lineStyle: { color: '#E8C47C', width: 1.5 },
      itemStyle: { color: '#E8C47C' },
      // 只给主线一点渐变底色，与运势趋势图的综合线一致
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

// 记录新增/修改 → 重画
watch(() => props.curve, render, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart && chart.dispose()
})
</script>

<style scoped>
.mood-chart {
  width: 100%;
  height: 260px;
}
</style>
