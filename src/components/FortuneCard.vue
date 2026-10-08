<template>
  <!-- 今日运势：星历条目（ephemeris entry）排版 -->
  <div class="fortune-card glass-card">
    <!-- 条目头：展示衬线大名 + 等宽元信息行 -->
    <div class="fc-head">
      <div class="fc-name">
        <span class="zh">{{ fortune.signName }}</span>
        <span class="en">{{ fortune.signNameEn }}</span>
      </div>
      <p class="fc-meta mono">
        <template v-for="(seg, i) in metaParts" :key="i">
          <span class="meta-seg">{{ seg }}</span><span v-if="i < metaParts.length - 1"> · </span>
        </template>
      </p>
    </div>

    <!-- ✦ 居中饰线 -->
    <div class="divider"><i></i><span>✦</span><i></i></div>

    <!-- 评分：等宽小标签 + ✦ 字形（SHOWAPI 无健康分，自动隐藏该行） -->
    <ul class="score-list">
      <li v-for="dim in dimensions" :key="dim.en">
        <span class="dim-label">
          <span class="dim-zh">{{ dim.zh }}</span>
          <span class="dim-en mono">{{ dim.en }}</span>
        </span>
        <span class="glyphs">
          <span v-for="n in 5" :key="n" :class="n <= dim.score ? 'on' : 'off'">✦</span>
        </span>
      </li>
    </ul>

    <div class="divider"><i></i><span>✦</span><i></i></div>

    <!-- 幸运条目：幸运色 / 幸运数字 / 吉时 / 方位（v2 新增，LOCAL 无方位自动隐藏） -->
    <div class="lucky-row">
      <div class="lucky-item">
        <span class="lucky-label mono">LUCKY COLOR · 幸运色</span>
        <span class="lucky-value">
          <i class="color-chip" :style="{ background: colorMap[fortune.luckyColor] || '#8B87B0' }"></i>
          {{ fortune.luckyColor }}
        </span>
      </div>
      <div class="lucky-item">
        <span class="lucky-label mono">NUMBER · 幸运数字</span>
        <span class="lucky-value number mono">{{ fortune.luckyNumber }}</span>
      </div>
      <div class="lucky-item">
        <span class="lucky-label mono">HOUR · 吉时</span>
        <span class="lucky-value mono">{{ fortune.luckyTime }}</span>
      </div>
      <div v-if="fortune.luckyDirection" class="lucky-item">
        <span class="lucky-label mono">DIRECTION · 方位</span>
        <span class="lucky-value">{{ fortune.luckyDirection }}</span>
      </div>
    </div>

    <!-- 点评：衬线斜体引文，金色左边框 -->
    <blockquote class="summary">{{ fortune.summary }}</blockquote>

    <!-- 今日提醒（v2，SHOWAPI 提供）：细长横幅，描边小签 + 暗紫灰正文 -->
    <div v-if="fortune.dayNotice" class="notice">
      <span class="notice-chip mono">提醒</span>
      <span class="notice-text">{{ fortune.dayNotice }}</span>
    </div>

    <!-- 宜 / 忌：黄历印章签 + 速配/贵人小签（SHOWAPI 为贵人） -->
    <div class="seal-row">
      <div class="seal do">
        <span class="stamp">宜</span>
        <span class="items">{{ fortune.doText }}</span>
      </div>
      <div class="seal dont">
        <span class="stamp">忌</span>
        <span class="items">{{ fortune.dontText }}</span>
      </div>
      <div class="pair">
        <span class="pair-label mono">MATCH · {{ pairLabel }}</span>
        <Constellation :sign="fortune.pairSignName" class="pair-const" />
        <span class="pair-name">{{ fortune.pairSignName }}</span>
      </div>
    </div>

    <!-- 分维解读（v2，SHOWAPI 长文案）：爱情 / 事业 / 财运 三段 -->
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

    <!-- 条目脚：分享海报按钮 + 数据来源小签 -->
    <div class="fc-footer">
      <button type="button" class="poster-btn mono" @click="makePoster">生成分享卡</button>
      <span class="source-tag mono" :class="{ showapi: isShowapi }">
        {{ isShowapi ? 'DATA · 万维易源 SHOWAPI' : 'DATA · 本地星算 LOCAL' }}
      </span>
    </div>

    <!-- 分享海报预览弹层：canvas → dataURL → <img> + 下载。
         必须 Teleport 到 body：glass-card 的 backdrop-filter 会创建包含块，
         使 position:fixed 的弹层相对卡片定位而非视口 -->
    <Teleport to="body">
      <div v-if="posterUrl" class="poster-mask" @click.self="posterUrl = ''">
        <div class="poster-modal glass-card" role="dialog" aria-label="分享海报">
          <button type="button" class="poster-close mono" @click="posterUrl = ''">✕</button>
          <img class="poster-img" :src="posterUrl" alt="星语分享海报" />
          <a class="poster-save" :href="posterUrl" :download="posterFileName">保存图片</a>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Constellation from './Constellation.vue'
import { renderPoster } from '../poster'

const props = defineProps({
  fortune: { type: Object, required: true }, // 今日运势数据（FortuneVO v2）
  sign: { type: Object, default: null }      // 对应星座基础信息（取 dateRange 用）
})

/* ===== 分享海报（纯前端 canvas，无新依赖） ===== */
const posterUrl = ref('')
const posterFileName = computed(() => {
  const d = props.fortune.fortuneDate || new Date().toISOString().slice(0, 10)
  return `starwhisper-${(props.fortune.signNameEn || 'sign').toLowerCase()}-${d}.png`
})
function makePoster() {
  posterUrl.value = renderPoster(props.fortune, props.sign)
}

// 是否万维易源（SHOWAPI）数据
const isShowapi = computed(() => props.fortune.source === 'SHOWAPI')

// 元信息行：LIBRA · 09.23–10.23 · 2026-09-24（全等宽）
const metaLine = computed(() => {
  const en = (props.fortune.signNameEn || '').toUpperCase()
  const range = props.sign ? (props.sign.dateRange || '').replace('-', '–') : ''
  return [en, range, props.fortune.fortuneDate].filter(Boolean).join(' · ')
})

// 评分维度定义（分数均为 1-5）；v2 中 healthScore 可能为 null → 自动隐藏该行
const dimensions = computed(() =>
  [
    { zh: '综合运势', en: 'OVERALL', score: props.fortune.overallScore },
    { zh: '爱情运势', en: 'LOVE', score: props.fortune.loveScore },
    { zh: '事业学业', en: 'CAREER', score: props.fortune.careerScore },
    { zh: '财富运势', en: 'WEALTH', score: props.fortune.wealthScore },
    { zh: '健康运势', en: 'HEALTH', score: props.fortune.healthScore }
  ].filter((d) => d.score != null)
)

// 元信息行分段（每段 nowrap，只在 · 分隔处换行，避免日期被从中间折断）
const metaParts = computed(() => metaLine.value.split(' · '))

// 配对签标签：SHOWAPI 语义为"贵人"，本地数据为"速配"
const pairLabel = computed(() => (isShowapi.value ? '贵人' : '速配'))

// 分维解读段落：只保留有文案的维度
const insights = computed(() =>
  [
    { zh: '爱情', en: 'LOVE', txt: props.fortune.loveTxt },
    { zh: '事业', en: 'CAREER', txt: props.fortune.workTxt },
    { zh: '财运', en: 'WEALTH', txt: props.fortune.moneyTxt }
  ].filter((i) => i.txt)
)

// 中文颜色名 → 色块值（后端返回中文颜色名，映射成 CSS 颜色）
const colorMap = {
  红色: '#C25E5E', 橙色: '#D08C4A', 黄色: '#E8C47C', 金色: '#E8C47C',
  绿色: '#7FBF9E', 青色: '#5FA8A8', 蓝色: '#6E8FC8', 紫色: '#9C8FD0',
  葡萄紫: '#7B5CA8', 粉色: '#D094B0', 淡粉色: '#E3B8C8', 白色: '#EDEDF2', 奶白色: '#F0EBDD',
  黑色: '#2A2C40', 银色: '#B9BDCF', 棕色: '#9A7256', 灰色: '#8B87B0',
  珊瑚橙: '#E08A63', 玫瑰红: '#C25E7A', 天蓝色: '#6EA8D8', 米色: '#D8CBA8'
}
</script>

<style scoped>
.fortune-card {
  padding: 26px 30px 24px;
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
  white-space: nowrap; /* 每段不折断，只在 · 分隔处换行 */
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

/* 评分 */
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

/* 点评引文 */
.summary {
  margin: 20px 0 16px;
  padding: 4px 0 4px 18px;
  border-left: 2px solid var(--gold);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16px;
  line-height: 2;
  color: var(--ink);
}

/* 今日提醒横幅 */
.notice {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0 0 18px;
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
  padding: 2px 8px 2px 10px; /* 右侧补回字距，视觉居中 */
}
.notice-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink-dim2);
}

/* 宜 / 忌印章签 + 速配/贵人 */
.seal-row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 14px;
}
.seal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 4px;
  flex: 1 1 220px;
}
/* 印章：1px 同色描边 + 内阴影双线（轻微铅印感） */
.stamp {
  flex: none;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 20px;
  border: 1px solid currentColor;
  border-radius: 4px;
  box-shadow: inset 0 0 0 3px var(--bg-night), inset 0 0 0 4px currentColor;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.seal.do .stamp {
  color: var(--jade);
}
.seal.dont .stamp {
  color: var(--cinnabar);
}
.items {
  font-size: 14px;
  line-height: 1.8;
  color: var(--ink);
}
.pair {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 4px;
}
.pair-label {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
}
.pair-const {
  width: 34px;
  height: 34px;
}
.pair-name {
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 0.15em;
  color: var(--ink);
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

/* 条目脚：分享按钮 + 数据来源 */
.fc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
}
/* 小金边「生成分享卡」按钮 */
.poster-btn {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 12.5px;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.poster-btn:hover {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 14px rgba(232, 196, 124, 0.28);
}

/* 海报预览弹层 */
.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(7, 11, 30, 0.78);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.poster-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 22px;
  max-height: 92vh;
}
.poster-close {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 1;
  background: none;
  border: none;
  color: var(--ink-dim);
  font-size: 14px;
  cursor: pointer;
}
.poster-close:hover {
  color: var(--gold);
}
.poster-img {
  height: min(72vh, 720px);
  border-radius: 6px;
  border: 1px solid var(--gold-hairline);
}
.poster-save {
  padding: 9px 34px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  text-decoration: none;
  transition: background 0.25s, box-shadow 0.25s;
}
.poster-save:hover {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
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
  .fortune-card {
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
  /* 速配/贵人小签独占一行横排，避免被宜/忌签挤出右缘 */
  .pair {
    flex: 1 1 100%;
    flex-direction: row;
    gap: 10px;
    padding: 10px 14px;
  }
  .pair-const {
    width: 26px;
    height: 26px;
  }
}
</style>
