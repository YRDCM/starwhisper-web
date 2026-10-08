<template>
  <!-- 塔罗牌面/牌背组件：7:12 牌比，细金边，星云紫底。
       逆位时仅牌面内部 rotateZ(180°)（牌名倒置，忠实塔罗），角签不随转 -->
  <div class="tarot-card" :class="[`sz-${size}`, { down: faceDown }]">
    <!-- 牌背：同心细线圆 + 中心 ✦ + 星点（纯 SVG，无图片无 emoji） -->
    <div v-if="faceDown" class="card-back" aria-hidden="true">
      <svg viewBox="0 0 70 120" class="back-pattern">
        <circle cx="35" cy="60" r="27" class="bp" />
        <circle cx="35" cy="60" r="20" class="bp" />
        <circle cx="35" cy="60" r="13" class="bp" />
        <text x="35" y="65" class="bp-star" text-anchor="middle">✦</text>
        <circle v-for="(d, i) in backDots" :key="i" :cx="d[0]" :cy="d[1]" r="0.9" class="bp-dot" />
      </svg>
    </div>

    <template v-else>
      <div class="face-inner" :class="{ reversed: orientation === 'reversed' }">
        <!-- 顶部等宽标识行：MAJOR · 0 / WANDS · 1 -->
        <p class="face-top mono">{{ card ? card.arcanaGroup : '' }} · {{ card ? card.cardNumber : '' }}</p>
        <!-- 中部：牌组印鉴 + 中文牌名 + 拉丁斜体名 -->
        <div class="face-center">
          <span class="suit-seal" :class="{ major: isMajor }">{{ sealText }}</span>
          <span class="face-name">{{ card ? card.name : '' }}</span>
          <span class="face-en">{{ card ? card.nameEn : '' }}</span>
        </div>
        <!-- 底部细线 -->
        <i class="face-bottom"></i>
      </div>
      <!-- 正/逆位角签：位于旋转层之外，始终保持可读 -->
      <span v-if="orientation" class="ori-tag mono" :class="orientation">
        {{ orientation === 'reversed' ? '逆位' : '正位' }}
      </span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, default: null },        // TarotCardVO
  orientation: { type: String, default: null }, // 'upright' | 'reversed' | null
  faceDown: { type: Boolean, default: false },  // 牌背
  size: { type: String, default: 'md' }         // lg / md / sm
})

const isMajor = computed(() => props.card && props.card.arcanaGroup === 'MAJOR')

// 小牌花色印鉴字 / 大牌罗马数字
const SUIT_CHAR = { WANDS: '权', CUPS: '杯', SWORDS: '剑', PENTACLES: '币' }
const sealText = computed(() => {
  if (!props.card) return '✦'
  return isMajor.value ? toRoman(props.card.cardNumber) : SUIT_CHAR[props.card.arcanaGroup] || '✦'
})

// 0-21 → 罗马数字（0 愚人保留 "0"）
function toRoman(n) {
  if (n === 0) return '0'
  const table = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let out = ''
  let rest = n
  for (const [v, s] of table) {
    while (rest >= v) { out += s; rest -= v }
  }
  return out
}

// 牌背散点星（固定坐标，避免每次渲染闪烁）
const backDots = [
  [10, 16], [58, 12], [16, 44], [54, 42], [12, 78], [60, 82],
  [24, 100], [48, 104], [35, 22], [8, 60], [62, 62], [35, 98]
]
</script>

<style scoped>
.tarot-card {
  position: relative;
  aspect-ratio: 7 / 12; /* 真实塔罗牌比 */
  width: 100%;
  border-radius: 6px;
}

/* ===== 牌背 ===== */
.card-back {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  border: 1px solid var(--gold-hairline);
  background: linear-gradient(160deg, #0B1030 0%, #141B42 55%, #1B1B46 100%);
  overflow: hidden;
}
.back-pattern {
  width: 100%;
  height: 100%;
}
.bp {
  fill: none;
  stroke: rgba(232, 196, 124, 0.28);
  stroke-width: 0.5;
}
.bp-star {
  fill: var(--gold);
  font-size: 10px;
}
.bp-dot {
  fill: rgba(232, 230, 240, 0.5);
}

/* ===== 牌面 ===== */
.face-inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border-radius: 6px;
  border: 1px solid var(--gold-hairline);
  background: rgba(35, 32, 72, 0.55);
  backdrop-filter: blur(6px);
  padding: 8% 6%;
  text-align: center;
}
.face-inner.reversed {
  transform: rotateZ(180deg); /* 逆位：牌名倒置 */
}
.face-top {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}
.face-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8%;
}
.suit-seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2em;
  height: 2.2em;
  border: 1px solid var(--gold-dim);
  border-radius: 50%;
  font-family: var(--font-display);
  color: var(--gold);
  font-size: 14px;
}
.suit-seal.major {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.face-name {
  font-family: var(--font-display);
  color: var(--ink);
  letter-spacing: 0.12em;
  writing-mode: horizontal-tb;
}
.face-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  color: var(--ink-dim);
}
.face-bottom {
  width: 60%;
  border-top: 1px solid rgba(139, 135, 176, 0.25);
}

/* 正/逆位角签（不随牌面旋转） */
.ori-tag {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid currentColor;
  background: rgba(7, 11, 30, 0.85);
}
.ori-tag.upright {
  color: var(--jade);
}
.ori-tag.reversed {
  color: var(--cinnabar);
}

/* ===== 尺寸变体 ===== */
.sz-lg .face-name { font-size: 26px; }
.sz-lg .face-en { font-size: 16px; }
.sz-lg .suit-seal { font-size: 20px; }
.sz-lg .face-top { font-size: 12px; }

.sz-md .face-name { font-size: 18px; }
.sz-md .face-en { font-size: 13px; }
.sz-md .suit-seal { font-size: 15px; }

.sz-sm .face-name { font-size: 13px; letter-spacing: 0.06em; }
.sz-sm .face-en { font-size: 10px; }
.sz-sm .suit-seal { font-size: 12px; }
.sz-sm .face-top { font-size: 9px; letter-spacing: 0.08em; }
.sz-sm .ori-tag { display: none; } /* 牌库小图不显示角签 */
</style>
