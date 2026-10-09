<template>
  <!-- 星轨仪 Astrolabe：发丝轨道环 + 星座符号直接落环，无刻度底座；
       点击后整环旋转把选中星座转到正上方 ✦ 指针处（符号反向自转保持正向）；
       移动端降级为网格（见样式媒体查询） -->
  <div class="wheel-wrap">
    <div class="astro">
      <!-- 固定指针：不随环旋转，始终指向 12 点 -->
      <span class="pointer" aria-hidden="true">✦</span>

      <div class="wheel" :class="{ animated }" :style="{ transform: `rotate(${ringAngle}deg)` }">
        <!-- 轨道：主环 + 更淡外环 + 12 等分刻度点（随环一起旋转） -->
        <svg class="orbit" viewBox="0 0 600 600" aria-hidden="true">
          <circle cx="300" cy="300" r="248" class="orbit-ring" />
          <circle cx="300" cy="300" r="290" class="orbit-ring outer" />
          <circle v-for="(d, i) in dots" :key="i" :cx="d.x" :cy="d.y" r="1.6" class="orbit-dot" />
        </svg>

        <!-- 星座符号节点：无圆形底座，符号直接落在轨道上 -->
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

      <!-- 中心读数：静态不随环转，三行（中文名 / 英文斜体 / 日期区间） -->
      <div class="astro-center">
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

const props = defineProps({
  signs: { type: Array, default: () => [] },  // 12 星座列表
  modelValue: { type: Number, default: null } // 当前选中星座 id（v-model）
})
defineEmits(['update:modelValue', 'change'])

// 当前选中的星座对象（用于中心读数）
const current = computed(() => props.signs.find((s) => s.id === props.modelValue))

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

/* ===== 外环 12 等分刻度点（r=290，每 30° 一点） ===== */
const dots = Array.from({ length: 12 }, (_, k) => {
  const rad = ((k * 30 - 90) * Math.PI) / 180
  return { x: (300 + 290 * Math.cos(rad)).toFixed(2), y: (300 + 290 * Math.sin(rad)).toFixed(2) }
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
  --wheel-radius: 248px; /* 符号所在轨道半径（与主环 r=248 对齐） */
  display: flex;
  justify-content: center;
  padding: 26px 0 14px;
}

.astro {
  position: relative;
  width: 600px;
  height: 600px;
}

/* 固定金色指针：12 点方向，不随环转 */
.pointer {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 15px;
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

/* 轨道环：1px 发丝级，极淡金色；外环更淡 */
.orbit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.orbit-ring {
  fill: none;
  stroke: rgba(232, 201, 122, 0.15);
  stroke-width: 1;
}
.orbit-ring.outer {
  stroke: rgba(232, 201, 122, 0.07);
}
.orbit-dot {
  fill: rgba(232, 196, 124, 0.22);
}

/* 中心读数：衬线大字中文名 + 英文小斜体 + 日期范围 */
.astro-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 260px;
  text-align: center;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.center-name {
  font-family: var(--font-display);
  font-size: 46px;
  color: var(--gold);
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  text-shadow: 0 0 26px rgba(232, 196, 124, 0.32);
}
.center-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 17px;
  color: var(--ink-dim);
}
.center-dates {
  font-size: 12.5px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  color: var(--ink-dim2);
}

/* 星座符号节点：无底座无背景，符号直接落轨道（1px 发丝环线从符号下穿过，几乎不可见） */
.sign-node {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -28px 0 0 -28px;
  width: 56px;
  height: 56px;
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
  transition: transform 0.6s ease-out;
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
/* 选中态：金色 + 放大 + 光晕，名字落在符号下方 */
.sign-node.active {
  color: var(--gold);
}
.sign-node.active .glyph {
  font-size: 32px;
  text-shadow: 0 0 16px rgba(232, 196, 124, 0.7), 0 0 34px rgba(232, 196, 124, 0.35);
}
.glyph-name {
  margin-top: 5px;
  font-family: var(--font-display);
  font-size: 13px;
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
