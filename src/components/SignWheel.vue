<template>
  <!-- 星轨仪 Astrolabe · 华贵版：60 格刻度外环 + 双轨道环 + 唯一 medallion 选中态。
       未选中星座为暗色裸符号；选中星座配细金环底座 + 微光晕 + 金色放大符号 + 名字。
       中心为选中星座星联线描底衬（暗金低透明度），上叠中文名/英文/日期三行。
       点击后整环旋转把选中星座转到正上方 ✦ 指针处（符号反向自转保持正向）；
       移动端降级为网格（见样式媒体查询） -->
  <div class="wheel-wrap">
    <div class="astro">
      <!-- 固定指针：不随环旋转，始终指向 12 点 -->
      <span class="pointer" aria-hidden="true">✦</span>

      <div class="wheel" :class="{ animated }" :style="{ transform: `rotate(${ringAngle}deg)` }">
        <!-- 刻度 bezel + 双轨道环（随环一起旋转）：
             60 格细分刻度（每 30° 主刻度加长加亮），主轨道 + 内轨道两道发丝环 -->
        <svg class="orbit" viewBox="0 0 720 720" aria-hidden="true">
          <circle cx="360" cy="360" r="352" class="bezel-ring" />
          <line
            v-for="(t, i) in ticks"
            :key="'t' + i"
            :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
            :class="t.long ? 'tick major' : 'tick'"
          />
          <circle cx="360" cy="360" r="300" class="orbit-ring" />
          <circle cx="360" cy="360" r="252" class="orbit-ring inner" />
          <circle v-for="(d, i) in dots" :key="'d' + i" :cx="d.x" :cy="d.y" r="1.6" class="orbit-dot" />
        </svg>

        <!-- 星座符号节点：未选中为暗色裸符号；选中为 medallion（细金环底座 + 光晕 + 名字） -->
        <button
          v-for="(sign, i) in signs"
          :key="sign.id"
          type="button"
          class="sign-node"
          :class="{ active: sign.id === modelValue }"
          :style="nodeStyle(i)"
          :title="`${sign.name} ${sign.dateRange || ''}`"
          @click="$emit('update:modelValue', sign.id); $emit('change', sign)"
        >
          <span class="node-inner" :style="{ transform: `rotate(${-ringAngle}deg)` }">
            <span class="glyph">{{ glyphOf(sign) }}</span>
            <span v-if="sign.id === modelValue" class="glyph-name">{{ sign.name }}</span>
            <!-- 移动端网格态补充信息（桌面端 CSS 隐藏） -->
            <span class="sign-name-m">{{ sign.name }}</span>
            <span class="sign-dates-m mono">{{ sign.dateRange }}</span>
          </span>
        </button>
      </div>

      <!-- 中心读数：静态不随环转。星联线描底衬（选中星座、暗金低透明度、放大做背景），
           上叠三行（中文名 / 英文斜体 / 日期区间） -->
      <div class="astro-center">
        <svg v-if="centerConst" class="center-const" viewBox="0 0 100 100" aria-hidden="true">
          <line
            v-for="(e, i) in centerConst.edges"
            :key="'l' + i"
            :x1="centerConst.points[e[0]][0]"
            :y1="centerConst.points[e[0]][1]"
            :x2="centerConst.points[e[1]][0]"
            :y2="centerConst.points[e[1]][1]"
            class="cc-line"
          />
          <circle
            v-for="(p, i) in centerConst.points"
            :key="'p' + i"
            :cx="p[0]" :cy="p[1]" r="1.6"
            class="cc-star"
          />
        </svg>
        <template v-if="current">
          <span class="center-name">{{ current.name }}</span>
          <span class="center-en">{{ current.nameEn }}</span>
          <span class="center-dates mono">{{ current.dateRange }}</span>
        </template>
        <span v-else class="center-name">星语</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { constellationOf } from '../constellations'

const props = defineProps({
  signs: { type: Array, default: () => [] },  // 12 星座列表
  modelValue: { type: Number, default: null } // 当前选中星座 id（v-model）
})
defineEmits(['update:modelValue', 'change'])

// 当前选中的星座对象（用于中心读数）
const current = computed(() => props.signs.find((s) => s.id === props.modelValue))

// 中心星联底衬：取选中星座的风格化星联数据（点 + 连线）
const centerConst = computed(() => (current.value ? constellationOf(current.value.nameEn) : null))

/* ===== 黄道符号（unicode 字形；\uFE0E 强制文本呈现，避免 Windows 渲染成彩色 emoji） ===== */
const GLYPHS = {
  aries: '♈︎', taurus: '♉︎', gemini: '♊︎', cancer: '♋︎',
  leo: '♌︎', virgo: '♍︎', libra: '♎︎', scorpio: '♏︎',
  sagittarius: '♐︎', capricorn: '♑︎', aquarius: '♒︎', pisces: '♓︎'
}
function glyphOf(sign) {
  return GLYPHS[String(sign.nameEn || '').toLowerCase()] || '✧'
}

/* ===== 环体旋转：把选中星座转到正上方 ===== */
// 第 i 个星座的基准角 = i*30°- 90°（从正上方开始）；选中 i 时环体转角 = -30*i
const ringAngle = ref(0)
const animated = ref(false) // 首次定位不播动画，避免进页面时环体自转

watch(
  () => props.modelValue,
  (id) => {
    const idx = props.signs.findIndex((s) => s.id === id)
    if (idx < 0) return
    const target = -30 * idx
    if (!animated.value) {
      ringAngle.value = target
      animated.value = true
      return
    }
    // 最短路径旋转：把目标角归一化到当前角的 ±180° 邻域
    const cur = ringAngle.value
    const delta = ((((target - cur) % 360) + 540) % 360) - 180
    ringAngle.value = cur + delta
  }
)

/* ===== 刻度 bezel：60 格（每 6° 一格），每 5 格（30°）为加长主刻度 ===== */
const ticks = Array.from({ length: 60 }, (_, k) => {
  const long = k % 5 === 0
  const rad = ((k * 6 - 90) * Math.PI) / 180
  const r1 = long ? 328 : 338
  const r2 = 350
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    long,
    x1: (360 + r1 * cos).toFixed(2),
    y1: (360 + r1 * sin).toFixed(2),
    x2: (360 + r2 * cos).toFixed(2),
    y2: (360 + r2 * sin).toFixed(2)
  }
})

/* ===== 主轨道上 12 等分刻度点（r=300，每 30° 一点） ===== */
const dots = Array.from({ length: 12 }, (_, k) => {
  const rad = ((k * 30 - 90) * Math.PI) / 180
  return { x: (360 + 300 * Math.cos(rad)).toFixed(2), y: (360 + 300 * Math.sin(rad)).toFixed(2) }
})

// 圆环布局：第 i 个节点旋转 i*30°-90° 后向外平移，再反向旋转保持内容在环坐标系内直立
function nodeStyle(i) {
  const angle = i * 30 - 90
  return {
    transform: `rotate(${angle}deg) translate(var(--wheel-radius)) rotate(${-angle}deg)`
  }
}
</script>

<style scoped>
.wheel-wrap {
  --wheel-radius: 300px; /* 符号所在轨道半径（与主环 r=300 对齐） */
  display: flex;
  justify-content: center;
  padding: 30px 0 18px;
}

.astro {
  position: relative;
  width: 720px;
  height: 720px;
}

/* 固定金色指针：12 点方向，不随环转 */
.pointer {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  color: var(--gold);
  text-shadow: 0 0 12px rgba(232, 196, 124, 0.65);
  z-index: 3;
  pointer-events: none;
}

.wheel {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
/* 选中切换时环体平滑旋转 600ms（reduced-motion 由全局样式关停，直接跳变） */
.wheel.animated {
  transition: transform 0.6s ease-out;
}

/* 刻度 bezel + 轨道环 SVG */
.orbit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bezel-ring {
  fill: none;
  stroke: rgba(232, 201, 122, 0.1);
  stroke-width: 1;
}
/* 60 格细分刻度：普通刻度极淡，主刻度（每 30°）加长加亮——天文钟精密感 */
.tick {
  stroke: rgba(139, 135, 176, 0.22);
  stroke-width: 1;
}
.tick.major {
  stroke: rgba(232, 196, 124, 0.5);
  stroke-width: 1.4;
}
/* 双轨道环：主环清晰，内环次之，均可辨 */
.orbit-ring {
  fill: none;
  stroke: rgba(232, 201, 122, 0.22);
  stroke-width: 1;
}
.orbit-ring.inner {
  stroke: rgba(232, 201, 122, 0.12);
}
.orbit-dot {
  fill: rgba(232, 196, 124, 0.28);
}

/* 中心读数：星联底衬 + 衬线大字中文名 + 英文小斜体 + 日期范围 */
.astro-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  text-align: center;
  pointer-events: none;
  z-index: 2; /* 自建层叠上下文：底衬 z-index:-1 只落在文字后、轨道环前 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
/* 星联线描底衬：放大铺满中心区，暗金低透明度，不抢文字 */
.center-const {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 380px;
  height: 380px;
  overflow: visible;
  z-index: -1;
}
.cc-line {
  stroke: rgba(232, 196, 124, 0.13);
  stroke-width: 0.6;
}
.cc-star {
  fill: rgba(232, 196, 124, 0.22);
}
.center-name {
  font-family: var(--font-display);
  font-size: 52px;
  color: var(--gold);
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  text-shadow: 0 0 26px rgba(232, 196, 124, 0.32);
}
.center-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  color: var(--ink-dim);
}
.center-dates {
  font-size: 12.5px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  color: var(--ink-dim2);
}

/* 星座符号节点：固定 88px 圆域；未选中为暗色裸符号，无底座无背景 */
.sign-node {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -44px 0 0 -44px;
  width: 88px;
  height: 88px;
  border: none;
  background: none;
  color: #6B7194;
  cursor: pointer;
  border-radius: 50%;
}
/* 内层随环体反向旋转，保证符号始终正向（与环体同速过渡） */
.node-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid transparent;
  transition: transform 0.6s ease-out,
    border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}
.wheel:not(.animated) .node-inner {
  transition: none; /* 首次定位瞬间完成 */
}
.glyph {
  font-family: "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", sans-serif;
  font-size: 22px;
  line-height: 1;
  transition: font-size 0.3s ease, color 0.3s ease, text-shadow 0.3s ease;
}
.sign-node:hover .glyph {
  color: var(--ink);
}
/* 唯一 medallion：细金环圆形底座 + 微弱光晕 + 金色放大符号 + 名字 */
.sign-node.active {
  color: var(--gold);
}
.sign-node.active .node-inner {
  border-color: rgba(232, 196, 124, 0.75);
  background: rgba(232, 196, 124, 0.06);
  box-shadow: 0 0 22px rgba(232, 196, 124, 0.22),
    inset 0 0 14px rgba(232, 196, 124, 0.1);
}
.sign-node.active .glyph {
  font-size: 30px;
  text-shadow: 0 0 14px rgba(232, 196, 124, 0.65), 0 0 30px rgba(232, 196, 124, 0.3);
}
.glyph-name {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 12.5px;
  letter-spacing: 0.14em;
  color: var(--gold);
  white-space: nowrap;
}
/* 移动端补充信息：桌面端隐藏 */
.sign-name-m,
.sign-dates-m {
  display: none;
}

/* ===== 移动端降级：圆环放不下，改为网格（不旋转） ===== */
@media (max-width: 680px) {
  .astro {
    width: 100%;
    height: auto;
  }
  .pointer,
  .orbit,
  .astro-center {
    display: none;
  }
  .wheel {
    position: static;
    transform: none !important; /* 覆盖内联旋转 */
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 0 4px;
  }
  .sign-node {
    position: static;
    margin: 0;
    width: auto;
    height: auto;
    min-width: 0;
    transform: none !important; /* 覆盖内联圆环 transform */
    border-radius: 6px;
    background: var(--panel-bg);
    border: 1px solid var(--gold-hairline);
    color: var(--ink);
  }
  .node-inner {
    transform: none !important; /* 覆盖内联反向旋转 */
    padding: 10px 6px;
    gap: 3px;
    border: none;
    border-radius: 6px;
    transition: border-color 0.25s, box-shadow 0.25s;
  }
  .glyph {
    font-size: 24px;
    color: var(--ink-dim);
  }
  .sign-node.active {
    border-color: var(--gold);
    box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
  }
  .sign-node.active .node-inner {
    border: none;
    background: none;
    box-shadow: none;
  }
  .sign-node.active .glyph {
    font-size: 24px;
    color: var(--gold);
    text-shadow: 0 0 12px rgba(232, 196, 124, 0.5);
  }
  .glyph-name {
    display: none; /* 移动端用常显名字，不用选中名 */
  }
  .sign-name-m {
    display: block;
    font-family: var(--font-display);
    font-size: 14px;
    letter-spacing: 0.1em;
    color: var(--ink);
  }
  .sign-node.active .sign-name-m {
    color: var(--gold);
  }
  .sign-dates-m {
    display: block;
    font-size: 11px;
    color: var(--ink-dim2);
    white-space: nowrap;
  }
}
</style>
