<template>
  <!-- 星座轮盘（旧版观感恢复版）：一圈 12 个圆形底座节点（星联 + 名字 + 日期全部显示），
       静态不旋转；节点之间保留 ≥20px 清晰间隙（几何见样式注释）。
       选中星座金色高亮底座，其余暗色；中心为选中星座三行读数（中文名/英文/日期）。
       移动端降级为网格（见样式媒体查询） -->
  <div class="wheel-wrap">
    <div class="wheel">
      <!-- 单圈发丝轨道：仅作结构衬线，极淡 -->
      <svg class="orbit" viewBox="0 0 640 640" aria-hidden="true">
        <circle cx="320" cy="320" r="250" class="orbit-ring" />
      </svg>

      <!-- 中心读数：静态三行（中文名 / 英文 / 日期区间） -->
      <div class="wheel-center">
        <template v-if="current">
          <span class="center-name">{{ current.name }}</span>
          <span class="center-en">{{ current.nameEn }}</span>
          <span class="center-dates mono">{{ current.dateRange }}</span>
        </template>
        <span v-else class="center-name">星语</span>
      </div>

      <!-- 星座节点：圆形底座 + 星联 + 中文名 + 日期，12 个全部显示 -->
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
        <span class="node-inner">
          <Constellation :sign="sign.nameEn" class="node-const" />
          <span class="sign-name">{{ sign.name }}</span>
          <span class="sign-dates mono">{{ sign.dateRange }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Constellation from './Constellation.vue'

const props = defineProps({
  signs: { type: Array, default: () => [] },  // 12 星座列表
  modelValue: { type: Number, default: null } // 当前选中星座 id（v-model）
})
defineEmits(['update:modelValue', 'change'])

// 当前选中的星座对象（用于中心读数）
const current = computed(() => props.signs.find((s) => s.id === props.modelValue))

// 圆环布局：第 i 个节点旋转 i*30°-90° 后向外平移，再反向旋转保持内容直立（静态，不随选中旋转）
function nodeStyle(i) {
  const angle = i * 30 - 90
  return {
    transform: `rotate(${angle}deg) translate(var(--wheel-radius)) rotate(${-angle}deg)`
  }
}
</script>

<style scoped>
/* ===== 几何：轮盘 640×640，节点环半径 R=250，节点直径 D=108。
   相邻节点弦距 = 2·R·sin(15°) ≈ 129.4px，间隙 = 129.4 - 108 ≈ 21px（≥16-24px 要求）。
   最外缘 = 250 + 54 = 304 < 320（轮盘半径），不出界。 */
.wheel-wrap {
  --wheel-radius: 250px;
  display: flex;
  justify-content: center;
  padding: 24px 0 12px;
}

.wheel {
  position: relative;
  width: 640px;
  height: 640px;
  border-radius: 50%;
}

/* 单圈发丝轨道：仅作结构衬线 */
.orbit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.orbit-ring {
  fill: none;
  stroke: rgba(232, 201, 122, 0.12);
  stroke-width: 1;
}

/* 中心读数：中文名 + 英文斜体 + 日期区间 */
.wheel-center {
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

/* 星座节点：108px 圆形底座（暗色星云紫 + 细描边），符号/名字/日期全部显示 */
.sign-node {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -54px 0 0 -54px;
  width: 108px;
  height: 108px;
  border: none;
  background: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--ink);
}
.node-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgba(139, 135, 176, 0.22);
  background: rgba(35, 32, 72, 0.5);
  backdrop-filter: blur(6px);
  transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
}
.sign-node:hover .node-inner {
  border-color: var(--gold-dim);
  background: rgba(35, 32, 72, 0.72);
}
/* 选中态：金色高亮底座 + 光晕 */
.sign-node.active .node-inner {
  border-color: var(--gold);
  background: rgba(232, 196, 124, 0.1);
  box-shadow: 0 0 20px rgba(232, 196, 124, 0.4), inset 0 0 12px rgba(232, 196, 124, 0.14);
}

.node-const {
  width: 36px;
  height: 36px;
}
.sign-name {
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
  line-height: 1.2;
}
.sign-dates {
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--ink-dim2);
  white-space: nowrap;
}
.sign-node.active .sign-name {
  color: var(--gold);
}

/* ===== 移动端降级：圆环放不下，改为网格（不旋转） ===== */
@media (max-width: 680px) {
  .wheel {
    width: 100%;
    height: auto;
    display: grid;
    /* minmax(0,1fr)：允许轨道收缩到内容最小宽度以下，防止网格整体溢出屏幕 */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 0 4px;
    border-radius: 0;
  }
  .orbit,
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
    padding: 10px 6px;
    border-radius: 6px;
    background: var(--panel-bg);
    border: 1px solid var(--gold-hairline);
  }
  .node-const {
    width: 36px;
    height: 36px;
  }
  .sign-dates {
    white-space: nowrap;
  }
}
</style>
