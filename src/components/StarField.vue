<template>
  <!-- 画布星空：固定在视口底层，星星随机闪烁 -->
  <canvas ref="canvasRef" class="starfield"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let stars = []
let rafId = 0

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  initStars()
}

// 随机撒一把星星：位置、半径、闪烁相位都不同
function initStars() {
  const canvas = canvasRef.value
  const count = Math.floor((canvas.width * canvas.height) / 4500)
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.3 + 0.3,
    phase: Math.random() * Math.PI * 2,   // 闪烁相位
    speed: Math.random() * 0.015 + 0.005  // 闪烁速度
  }))
}

// 减少动态偏好：只画一帧静态星空，不闪烁
const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function draw() {
  const canvas = canvasRef.value
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const s of stars) {
    if (!reducedMotion) s.phase += s.speed
    // 透明度随正弦波动 → 星星在"呼吸"闪烁（整体调暗，让文字更突出）
    const alpha = reducedMotion ? 0.4 : 0.16 + 0.42 * Math.abs(Math.sin(s.phase))
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 244, 214, ${alpha.toFixed(3)})`
    ctx.fill()
  }
  if (!reducedMotion) rafId = requestAnimationFrame(draw)
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
  draw()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.starfield {
  position: fixed;
  inset: 0;
  z-index: 0;           /* 压在渐变背景上、内容之下 */
  pointer-events: none; /* 不挡任何点击 */
}
</style>
