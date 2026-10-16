<template>
  <!-- 本周运势：与 FortuneCard 同款的星历条目排版 -->
  <div class="fortune-card weekly-card glass-card">
    <!-- 条目头：衬线大名 + 等宽元信息（本周运势 · 周区间） -->
    <div class="fc-head">
      <div class="fc-name">
        <span class="zh">{{ weekly.signName }}</span>
        <span class="en">{{ weekly.signNameEn }}</span>
      </div>
      <p class="fc-meta mono">
        <template v-for="(seg, i) in metaParts" :key="i">
          <span class="meta-seg">{{ seg }}</span><span v-if="i < metaParts.length - 1"> · </span>
        </template>
      </p>
    </div>

    <div class="divider"><i></i><span>✦</span><i></i></div>

    <!-- 四维评分：等宽小标签 + ✦ 字形（null 维度整行隐藏） -->
    <ul class="score-list">
      <li v-for="dim in dimensions" :key="dim.en">
        <span class="dim-label">
          <span class="dim-zh">{{ dim.zh }}</span>
          <span class="dim-en mono">{{ dim.en }}</span>
        </span>
        <span class="glyphs">
          <span v-for="n in 5" :key="n" :class="n <= dim.score ? 'on' : 'off'">✦</span>
        </span>
        <span class="dim-score mono">{{ dim.score }}/5</span>
      </li>
    </ul>

    <!-- 本周提醒 -->
    <div v-if="weekly.weekNotice" class="notice">
      <span class="notice-chip mono">本周提醒</span>
      <span class="notice-text">{{ weekly.weekNotice }}</span>
    </div>

    <div class="divider"><i></i><span>✦</span><i></i></div>

    <!-- 幸运条目：幸运色 / 幸运数字 / 幸运日 / 贵人 / 小人（null 项不渲染） -->
    <div class="lucky-row">
      <div v-for="item in luckyItems" :key="item.key" class="lucky-item">
        <span class="lucky-label mono">{{ item.label }}</span>
        <span class="lucky-value" :class="{ number: item.key === 'number', mono: item.key === 'number' }">
          <i v-if="item.key === 'color'" class="color-chip" :style="{ background: luckyColorBg }"></i>
          {{ item.value }}
        </span>
      </div>
    </div>

    <!-- 四段文案：综合 / 爱情 / 事业 / 财富（null 段不渲染） -->
    <template v-if="insights.length">
      <div class="divider"><i></i><span>✦</span><i></i></div>
      <section class="insights">
        <div v-for="ins in insights" :key="ins.en" class="insight">
          <p class="i-label">
            <span class="i-zh">{{ ins.zh }}</span>
            <span class="i-en mono">{{ ins.en }}</span>
          </p>
          <p class="i-text">{{ ins.txt }}</p>
        </div>
      </section>
    </template>

    <!-- 条目脚：数据来源（周运无本地兜底，只会是 SHOWAPI） -->
    <div class="fc-footer">
      <span class="source-tag mono" :class="{ showapi: isShowapi }">
        {{ isShowapi ? 'DATA · 万维易源 SHOWAPI' : 'DATA · 本地星算 LOCAL' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatWeekRange } from '../weekly'

const props = defineProps({
  weekly: { type: Object, required: true }, // 本周运势（WeeklyFortuneVO）
  sign: { type: Object, default: null }     // 对应星座基础信息（取 dateRange 用）
})

const isShowapi = computed(() => props.weekly.source === 'SHOWAPI')

// 元信息行：LEO · 07.23–08.22 · 本周 10.11 – 10.18
const metaParts = computed(() => {
  const en = (props.weekly.signNameEn || '').toUpperCase()
  const range = props.sign ? (props.sign.dateRange || '').replace('-', '–') : ''
  const weekRange = formatWeekRange(props.weekly.timeRange)
  return [en, range, weekRange ? `本周 ${weekRange}` : '本周运势'].filter(Boolean)
})

// 四维评分（周运无健康维）
const dimensions = computed(() =>
  [
    { zh: '综合运势', en: 'OVERALL', score: props.weekly.overallScore },
    { zh: '爱情运势', en: 'LOVE', score: props.weekly.loveScore },
    { zh: '事业学业', en: 'CAREER', score: props.weekly.careerScore },
    { zh: '财富运势', en: 'WEALTH', score: props.weekly.wealthScore }
  ].filter((d) => d.score != null)
)

// 幸运条目：字段为 null 的项不出现
const luckyItems = computed(() =>
  [
    { key: 'color', label: 'LUCKY COLOR · 幸运色', value: props.weekly.luckyColor },
    { key: 'number', label: 'NUMBER · 幸运数字', value: props.weekly.luckyNumber != null ? String(props.weekly.luckyNumber) : null },
    { key: 'day', label: 'LUCKY DAY · 幸运日', value: props.weekly.luckyDay },
    { key: 'pair', label: 'BENEFACTOR · 贵人', value: props.weekly.pairSignName },
    { key: 'nemesis', label: 'NEMESIS · 小人', value: props.weekly.nemesisSignName }
  ].filter((it) => it.value)
)

const insights = computed(() =>
  [
    { zh: '综合', en: 'GENERAL', txt: props.weekly.generalTxt },
    { zh: '爱情', en: 'LOVE', txt: props.weekly.loveTxt },
    { zh: '事业', en: 'CAREER', txt: props.weekly.workTxt },
    { zh: '财运', en: 'WEALTH', txt: props.weekly.moneyTxt }
  ].filter((i) => i.txt)
)

// 中文颜色名 → 色块值（与 FortuneCard 同一张映射表）
const colorMap = {
  红色: '#C25E5E', 橙色: '#D08C4A', 黄色: '#E8C47C', 金色: '#E8C47C',
  绿色: '#7FBF9E', 青色: '#5FA8A8', 蓝色: '#6E8FC8', 紫色: '#9C8FD0',
  葡萄紫: '#7B5CA8', 粉色: '#D094B0', 淡粉色: '#E3B8C8', 白色: '#EDEDF2', 奶白色: '#F0EBDD',
  黑色: '#2A2C40', 银色: '#B9BDCF', 棕色: '#9A7256', 灰色: '#8B87B0',
  珊瑚橙: '#E08A63', 玫瑰红: '#C25E7A', 天蓝色: '#6EA8D8', 米色: '#D8CBA8',
  米白色: '#F0EBDD'
}
const luckyColorBg = computed(() => colorMap[props.weekly.luckyColor] || '#8B87B0')
</script>

<style scoped>
.weekly-card {
  padding: 26px 30px 24px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* 条目头 */
.fc-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.fc-name .zh {
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--gold);
  letter-spacing: 0.14em;
}
.fc-name .en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 19px;
  color: var(--ink-dim);
  margin-left: 12px;
}
.fc-meta {
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--ink-dim2);
  padding-bottom: 6px;
}
.meta-seg {
  white-space: nowrap;
}

/* ✦ 居中饰线 */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: var(--gold-dim);
  font-size: 11px;
}
.divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* 评分：标签 + ✦ 字形 + 等宽分值 */
.score-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.score-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.dim-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.dim-zh {
  font-size: 15px;
  letter-spacing: 0.18em;
  color: var(--ink);
}
.dim-en {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
}
.dim-score {
  font-size: 12.5px;
  color: var(--ink-dim2);
  min-width: 28px;
  text-align: right;
}

/* 本周提醒横幅（与今日提醒同款） */
.notice {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 16px 0 0;
  padding: 9px 14px;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 4px;
}
.notice-chip {
  flex: none;
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--gold);
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  padding: 2px 8px 2px 10px;
}
.notice-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink-dim2);
}

/* 幸运条目 */
.lucky-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 40px;
}
.lucky-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.lucky-label {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
}
.lucky-value {
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 9px;
}
.lucky-value.number {
  font-size: 20px;
  color: var(--gold);
}
.color-chip {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(232, 230, 240, 0.4);
}

/* 分维解读 */
.insights {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.i-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.i-zh {
  font-size: 15px;
  letter-spacing: 0.18em;
  color: var(--gold);
}
.i-en {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
}
.i-text {
  font-size: 15px;
  line-height: 2;
  color: rgba(232, 230, 240, 0.9);
}

/* 条目脚 */
.fc-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 18px;
}
.source-tag {
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
}
.source-tag.showapi {
  color: var(--gold);
}

@media (max-width: 640px) {
  .weekly-card {
    padding: 20px 18px;
  }
  .fc-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .fc-meta {
    padding-bottom: 0;
  }
}
</style>
