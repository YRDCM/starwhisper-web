<template>
  <!-- 抽牌结果单卡：牌位标签 + 3D 翻牌（翻牌动画与 stagger 由 flipped/index 驱动） -->
  <div class="flip-card">
    <p v-if="item.position && !bare" class="pos mono">{{ item.position }}</p>
    <div class="flip" :class="{ flipped }">
      <div class="flip-inner" :style="{ transitionDelay: flipped ? index * 150 + 'ms' : '0ms' }">
        <div class="flip-back"><TarotCardFace faceDown :size="size" /></div>
        <div class="flip-front">
          <TarotCardFace :card="item.card" :orientation="item.orientation" :size="size" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TarotCardFace from './TarotCardFace.vue'

defineProps({
  item: { type: Object, required: true },   // {card, orientation, position, keywords, meaning}
  flipped: { type: Boolean, default: false },
  index: { type: Number, default: 0 },      // stagger 序号
  size: { type: String, default: 'md' },
  bare: { type: Boolean, default: false }   // 隐藏牌位标签（凯尔特障碍牌旋转 90° 时用）
})
</script>

<style scoped>
.flip-card {
  display: flex;
  flex-direction: column;
}
.pos {
  text-align: center;
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
  margin-bottom: 8px;
  white-space: nowrap;
}
/* 3D 翻转：初始背面朝外，flipped 后逐张 rotateY(180°) */
.flip {
  perspective: 900px;
  flex: 1;
}
.flip-inner {
  position: relative;
  width: 100%;
  aspect-ratio: 7 / 12;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
.flip.flipped .flip-inner {
  transform: rotateY(180deg);
}
.flip-back,
.flip-front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flip-front {
  transform: rotateY(180deg);
}
</style>
