<template>
  <!-- 桌面端：星盘（astrolabe）——刻度环 + 星座星联节点，点击后环体旋转把选中星座转到正上方；
       移动端：降级为网格（见样式媒体查询） -->
  <div class="wheel-wrap">
    <div class="wheel" :class="{ animated }" :style="{ transform: `rotate(${ringAngle}deg)` }">
      <!-- 外圈刻度 bezel：60 格（每 6° 一格，每 30° 长刻度），随环一起旋转 -->
      <svg class="bezel" viewBox="0 0 600 600" aria-hidden="true">
        <circle cx="300" cy="300" r="292" class="bezel-ring" />
        <circle cx="300" cy="300" r="250" class="bezel-ring inner" />
        <line
          v-for="(t, i) in ticks"
          :key="i"
          :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
          :class="['tick', { long: t.long }]"
        />
      </svg>

      <!-- 星盘中心：当前选中星座（随环反向旋转保持文字直立） -->
      <div class="wheel-center" :style="{ transform: `translate(-50%, -50%) rotate(${-ringAngle}deg)` }">
        <span class="center-name">{{ current ? current.name : '星语' }}</span>
        <span class="center-en mono">{{ current ? current.nameEn.toUpperCase() : '' }}</span>
      </div>

      <!-- 星座节点：星联 SVG + 中文名 + 等宽日期 -->
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
          <Constellation :sign="sign.nameEn" class="node-const" />
          <span class="sign-name">{{ sign.name }}</span>
          <span class="sign-dates mono">{{ sign.dateRange }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Constellation from './Constellation.vue'

const props = defineProps({
  signs: { type: Array, default: () => [] },  // 12 星座列表
  modelValue: { type: Number, default: null } // 当前选中星座 id（v-model）
})
defineEmits(['update:modelValue', 'change'])

// 当前选中的星座对象（用于星盘中心展示）
const current = computed(() => props.signs.find((s) => s.id === props.modelValue))

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

/* ===== 刻度 bezel：60 格，每 5 格（30°）为长刻度 ===== */
const ticks = Array.from({ length: 60 }, (_, k) => {
  const rad = (k * 6 * Math.PI) / 180
  const long = k % 5 === 0
  const r1 = long ? 272 : 282
  const r2 = 292
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    long,
    x1: (300 + r1 * cos).toFixed(2),
    y1: (300 + r1 * sin).toFixed(2),
    x2: (300 + r2 * cos).toFixed(2),
    y2: (300 + r2 * sin).toFixed(2)
  }
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
  --wheel-radius: 214px; /* 节点所在圆环半径 */
  display: flex;
  justify-content: center;
  padding: 20px 0 8px;
}

.wheel {
  position: relative;
  width: 600px;
  height: 600px;
  border-radius: 50%;
}
/* 选中切换时环体平滑旋转（reduced-motion 由全局样式关停过渡） */
.wheel.animated {
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 刻度环 */
.bezel {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bezel-ring {
  fill: none;
  stroke: var(--gold-hairline);
  stroke-width: 1;
}
.bezel-ring.inner {
  stroke: rgba(139, 135, 176, 0.14);
}
.tick {
  stroke: rgba(139, 135, 176, 0.35);
  stroke-width: 1;
}
.tick.long {
  stroke: var(--gold-dim);
}

/* 星盘中心：当前星座名 */
.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 240px;
  text-align: center;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* transform 由内联样式给出（translate 居中 + 反向旋转直立），与环体同速过渡 */
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
.wheel:not(.animated) .wheel-center {
  transition: none;
}
.center-name {
  font-family: var(--font-display);
  font-size: 40px;
  color: var(--gold);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  text-shadow: 0 0 24px rgba(232, 196, 124, 0.3);
}
.center-en {
  font-size: 12.5px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--ink-dim2);
}

/* 单个星座节点：定位在圆心，再用 transform 推到圆环上 */
.sign-node {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -50px 0 0 -50px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 1px solid transparent;
  background: none;
  color: var(--ink);
  cursor: pointer;
}
/* 内层随环体反向旋转，保证节点内容始终直立（与环体同速过渡） */
.node-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgba(139, 135, 176, 0.22);
  background: rgba(35, 32, 72, 0.5);
  backdrop-filter: blur(6px);
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.25s, box-shadow 0.25s, background 0.25s;
}
.wheel:not(.animated) .node-inner {
  transition: none; /* 首次定位瞬间完成 */
}
.sign-node:hover .node-inner {
  border-color: var(--gold-dim);
  background: rgba(35, 32, 72, 0.72);
}
/* 选中态：金色发光描边 + 星联连线描绘动画 */
.sign-node.active .node-inner {
  border-color: var(--gold);
  background: rgba(232, 196, 124, 0.10);
  box-shadow: 0 0 20px rgba(232, 196, 124, 0.4), inset 0 0 12px rgba(232, 196, 124, 0.14);
}
.sign-node.active .const-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: drawline 0.9s ease forwards;
}
@keyframes drawline {
  to { stroke-dashoffset: 0; }
}

.node-const {
  width: 42px;
  height: 42px;
}
.sign-name {
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.sign-dates {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink-dim2);
}
.sign-node.active .sign-name {
  color: var(--gold);
}

/* ===== 移动端降级：圆环放不下，改为网格（不旋转） ===== */
@media (max-width: 680px) {
  .wheel {
    width: 100%;
    height: auto;
    transform: none !important; /* 覆盖内联旋转 */
    display: grid;
    /* minmax(0,1fr)：允许轨道收缩到内容最小宽度以下，防止网格整体溢出屏幕 */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 0 4px;
  }
  .bezel,
  .wheel-center {
    display: none;
  }
  .sign-node {
    position: static;
    margin: 0;
    width: auto;
    height: auto;
    min-width: 0; /* 允许网格项收缩，配合 minmax(0,1fr) */
    transform: none !important; /* 覆盖内联圆环 transform，否则节点散落成圆 */
  }
  .node-inner {
    min-width: 0;
  }
  .sign-dates {
    font-size: 11px; /* 窄屏下等宽日期略收，配合 minmax(0,1fr) 不撑宽轨道 */
    white-space: nowrap;
  }
  .node-inner {
    transform: none !important; /* 覆盖内联反向旋转 */
    padding: 10px 6px;
    border-radius: 6px;
    background: var(--panel-bg);
    border: 1px solid var(--gold-hairline);
    transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
  }
  .node-const {
    width: 36px;
    height: 36px;
  }
  .sign-node.active .const-line {
    animation: none;
    stroke-dasharray: none;
    stroke-dashoffset: 0;
  }
}
</style>
