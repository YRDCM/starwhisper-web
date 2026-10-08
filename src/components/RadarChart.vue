<template>
  <!-- 五维/四象星图卡片：雷达图看形状，下方读数条看数值，底部星座档案。
       v2：healthScore 为 null（SHOWAPI）时降为四象，读数隐藏健康行 -->
  <div class="glass-card chart-card">
    <h3 class="chart-title">
      {{ hasHealth ? '五维星图' : '四象星图' }}
      <span class="chart-title-en mono">{{ hasHealth ? 'PENTAGRAM' : 'QUADGRAM' }}</span>
    </h3>
    <div ref="chartRef" class="chart"></div>

    <!-- 读数：mono 标签 + 横向细条 + 精确分值 -->
    <div class="divider"><i></i><span>✦</span><i></i></div>
    <ul class="readout">
      <li v-for="dim in dimensions" :key="dim.en">
        <span class="r-label">
          <span class="r-zh">{{ dim.zh }}</span>
          <span class="r-en mono">{{ dim.en }}</span>
        </span>
        <span class="r-bar"><i :style="{ width: (dim.score / 5) * 100 + '%' }"></i></span>
        <span class="r-val mono">{{ dim.score }}/5</span>
      </li>
    </ul>

    <!-- 健康寄语（v2 预留字段，非空时以引文样式呈现） -->
    <blockquote v-if="fortune.healthTxt" class="health-quote">{{ fortune.healthTxt }}</blockquote>

    <!-- 星座档案：元素 / 守护星 / 幸运石 -->
    <div v-if="profile || element" class="profile mono">
      <span v-if="element" class="p-item">
        <span class="p-key">元素</span>{{ element }}
      </span>
      <span v-if="profile" class="p-item">
        <span class="p-key">守护星</span>{{ profile.planet }}
      </span>
      <span v-if="profile" class="p-item">
        <span class="p-key">幸运石</span>{{ profile.gem }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { profileOf } from '../signProfiles'

const props = defineProps({
  fortune: { type: Object, required: true }, // 今日运势（FortuneVO v2）
  sign: { type: Object, default: null }      // 星座基础信息（取元素与档案）
})

// 星座档案（守护星/幸运石，静态数据）与元素（来自后端 signs/list）
const profile = computed(() => (props.sign ? profileOf(props.sign.nameEn) : null))
const element = computed(() => (props.sign ? props.sign.element : ''))

// v2：SHOWAPI 无健康分（healthScore 为 null）→ 四象星图
const hasHealth = computed(() => props.fortune.healthScore != null)

// 读数行定义（与雷达图同序；健康分为 null 时整行隐藏）
const dimensions = computed(() =>
  [
    { zh: '综合', en: 'OVERALL', score: props.fortune.overallScore },
    { zh: '爱情', en: 'LOVE', score: props.fortune.loveScore },
    { zh: '事业', en: 'CAREER', score: props.fortune.careerScore },
    { zh: '财运', en: 'WEALTH', score: props.fortune.wealthScore },
    { zh: '健康', en: 'HEALTH', score: props.fortune.healthScore }
  ].filter((d) => d.score != null)
)

const chartRef = ref(null)
let chart = null

// 等宽字体栈（图表标签统一 Space Mono，中文自动回落系统字体）
const MONO = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// 组装雷达图配置：香槟金主线 + 暗紫灰细网格；维度随数据动态（四象/五维）
function buildOption() {
  return {
    textStyle: { fontFamily: MONO },
    radar: {
      indicator: dimensions.value.map((d) => ({ name: d.zh, max: 5 })),
      radius: '66%',
      axisName: {
        color: '#A9A4CC',
        fontSize: 13,
        fontFamily: MONO
      },
      splitLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(35, 32, 72, 0.15)', 'rgba(139, 135, 176, 0.04)']
        }
      },
      axisLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } }
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: dimensions.value.map((d) => d.score),
            name: '今日评分',
            areaStyle: { color: 'rgba(232, 196, 124, 0.16)' },
            lineStyle: { color: '#E8C47C', width: 1.5 },
            itemStyle: { color: '#E8C47C' },
            symbolSize: 4
          }
        ]
      }
    ]
  }
}

function render() {
  if (chart) chart.setOption(buildOption(), true) // notMerge：维度数变化时整体替换
}

function handleResize() {
  chart && chart.resize()
}

onMounted(() => {
  chart = echarts.init(chartRef.value)
  render()
  window.addEventListener('resize', handleResize)
})

// 切换星座后 fortune 对象变化 → 更新图表
watch(() => props.fortune, render, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart && chart.dispose()
})
</script>

<style scoped>
.chart-card {
  padding: 20px 22px;
  height: 100%;
  display: flex;
  flex-direction: column;
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
  height: 260px; /* 标签放大后略加高，避免拥挤 */
  flex: none;
}

/* ✦ 居中饰线（与运势卡同款） */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 12px;
  color: var(--gold-dim);
  font-size: 11px;
}
.divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* 读数条 */
.readout {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.readout li {
  display: flex;
  align-items: center;
  gap: 12px;
}
.r-label {
  flex: none;
  width: 118px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.r-zh {
  font-size: 14px;
  letter-spacing: 0.16em;
  color: var(--ink);
}
.r-en {
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--ink-dim2);
}
.r-bar {
  flex: 1;
  height: 2px;
  background: rgba(139, 135, 176, 0.15);
  border-radius: 1px;
  overflow: hidden;
}
.r-bar i {
  display: block;
  height: 100%;
  background: var(--gold);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(232, 196, 124, 0.4);
  /* 切换星座时条宽平滑过渡（reduced-motion 由全局样式关停） */
  transition: width 0.5s ease;
}
.r-val {
  flex: none;
  width: 38px;
  text-align: right;
  font-size: 12.5px;
  color: var(--gold);
}

/* 健康寄语：与运势卡点评同款的金色左边框引文 */
.health-quote {
  margin: 0 0 16px;
  padding: 4px 0 4px 16px;
  border-left: 2px solid var(--gold);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 15px;
  line-height: 1.9;
  color: var(--ink);
}

/* 星座档案：顶部细线分隔的小字条，吸附卡片底部吃掉残余空隙 */
.profile {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.p-key {
  color: var(--ink-dim2);
  margin-right: 8px;
}

@media (max-width: 640px) {
  .chart-card {
    padding: 18px;
  }
  .r-label {
    width: 96px;
  }
  .profile {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px 20px;
  }
}
</style>
