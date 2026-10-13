<template>
  <!-- 抽牌结果单卡：牌位标签 + 用户主动揭晓 -->
  <div class="flip-card">
    <p v-if="item.position && !bare" class="pos mono">{{ item.position }}</p>
    <div class="flip" :class="{ flipped, 'can-reveal': canReveal, 'is-selected': selected, 'can-select': flipped }"
      :role="(canReveal || flipped) ? 'button' : undefined" :tabindex="(canReveal || flipped) ? 0 : undefined"
      :aria-label="canReveal ? `揭晓第 ${index + 1} 张：${item.position || '单牌指引'}` : flipped ? `查看第 ${index + 1} 张：${item.position || '指引'}` : undefined"
      :aria-pressed="flipped ? selected : undefined"
      @click="flipped ? $emit('select', index) : canReveal && $emit('reveal')" @keydown.enter.prevent="flipped ? $emit('select', index) : canReveal && $emit('reveal')" @keydown.space.prevent="flipped ? $emit('select', index) : canReveal && $emit('reveal')">
      <div class="flip-inner">
        <div class="flip-back" :aria-hidden="flipped"><TarotCardFace faceDown :size="size" /></div>
        <div class="flip-front" :aria-hidden="!flipped">
          <TarotCardFace :card="item.card" :orientation="item.orientation" :size="size" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TarotCardFace from './TarotCardFace.vue'
defineEmits(['reveal', 'select'])

defineProps({
  item: { type: Object, required: true },   // {card, orientation, position, keywords, meaning}
  selected: { type: Boolean, default: false },
  flipped: { type: Boolean, default: false },
  canReveal: { type: Boolean, default: false },
  index: { type: Number, default: 0 },      // 牌位序号
  size: { type: String, default: 'md' },
  bare: { type: Boolean, default: false }   // 隐藏牌位标签（凯尔特障碍牌旋转 90° 时用）
})
</script>

<style scoped>
.can-select { cursor: pointer; }
.is-selected { outline: 2px solid var(--gold); outline-offset: 4px; border-radius: 10px; }
.can-select:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; }
.can-reveal { cursor: pointer; border-radius: 10px; outline: 1px solid var(--gold); outline-offset: 4px; }
.can-reveal:focus-visible { outline-width: 3px; }
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
