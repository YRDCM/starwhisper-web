<template>
  <!-- 六爻卦形：纯 CSS 爻条（不用 Unicode 卦符，Windows 字体支持不稳）。
       lines 为自下而上数组，显示时最上一爻在顶 → 渲染时倒序遍历 -->
  <div class="hex-glyph" :class="`sz-${size}`" role="img" :aria-label="ariaLabel">
    <div
      v-for="(bit, i) in displayLines"
      :key="i"
      class="hex-line"
      :class="{ yin: bit === '0' }"
    >
      <i class="seg"></i>
      <i v-if="bit === '0'" class="seg"></i>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  lines: { type: String, required: true }, // 6 位字符串，自下而上：'1'=阳 '0'=阴
  size: { type: String, default: 'md' }    // sm / md / lg
})

// 显示顺序：最上一爻在视觉顶部 → 把自下而上的输入倒序
const displayLines = computed(() => String(props.lines).split('').reverse())

const ariaLabel = computed(() =>
  String(props.lines).split('').map((b) => (b === '1' ? '阳爻' : '阴爻')).join('，')
)
</script>

<style scoped>
.hex-glyph {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  aspect-ratio: 1 / 1; /* 六爻近方形 */
}
.hex-line {
  display: flex;
  justify-content: space-between;
  gap: 12%; /* 阴爻中间缺口 */
}
.seg {
  display: block;
  width: 100%;
  background: var(--gold);
  border-radius: 1px;
}
.hex-line.yin .seg {
  width: 44%; /* 阴爻两段，各 44%，中间留出缺口 */
}

/* 尺寸变体：爻条高度与发光 */
.sz-sm { width: 44px; height: 44px; }
.sz-sm .seg { height: 3px; }
.sz-md { width: 88px; height: 88px; }
.sz-md .seg { height: 6px; }
.sz-lg { width: 130px; height: 130px; }
.sz-lg .seg {
  height: 8px;
  box-shadow: 0 0 8px rgba(232, 196, 124, 0.35); /* 大号爻条微光晕 */
}
</style>
