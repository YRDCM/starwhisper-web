<template>
  <!-- 星座星联小图：金点 + 细连线；取不到图案时渲染一个四星菱形兜底 -->
  <svg viewBox="0 0 100 100" class="constellation" aria-hidden="true">
    <template v-if="data">
      <line
        v-for="(e, i) in data.edges"
        :key="'l' + i"
        :x1="data.points[e[0]][0]"
        :y1="data.points[e[0]][1]"
        :x2="data.points[e[1]][0]"
        :y2="data.points[e[1]][1]"
        class="const-line"
        pathLength="1"
      />
      <circle
        v-for="(p, i) in data.points"
        :key="'p' + i"
        :cx="p[0]"
        :cy="p[1]"
        r="3"
        class="const-star"
      />
    </template>
    <template v-else>
      <line x1="50" y1="20" x2="80" y2="50" class="const-line" pathLength="1" />
      <line x1="80" y1="50" x2="50" y2="80" class="const-line" pathLength="1" />
      <line x1="50" y1="80" x2="20" y2="50" class="const-line" pathLength="1" />
      <line x1="20" y1="50" x2="50" y2="20" class="const-line" pathLength="1" />
      <circle cx="50" cy="20" r="3" class="const-star" />
      <circle cx="80" cy="50" r="3" class="const-star" />
      <circle cx="50" cy="80" r="3" class="const-star" />
      <circle cx="20" cy="50" r="3" class="const-star" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { constellationOf } from '../constellations'

// sign：英文名 nameEn（不区分大小写）或中文名
const props = defineProps({
  sign: { type: String, default: '' }
})

const data = computed(() => constellationOf(props.sign))
</script>
