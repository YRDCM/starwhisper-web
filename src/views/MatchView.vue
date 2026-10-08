<template>
  <div class="match-view">
    <!-- ===== 配对选择器：左右两宫 + 中间 ✦ ===== -->
    <section class="glass-card picker">
      <div class="picker-row">
        <!-- 甲方 -->
        <div class="side">
          <p class="side-label mono">STAR Ⅰ · 甲方</p>
          <div class="sign-grid">
            <button
              v-for="s in signs"
              :key="'a' + s.id"
              type="button"
              class="sign-chip"
              :class="{ active: star1 === s.nameEn }"
              @click="star1 = s.nameEn"
            >
              <Constellation :sign="s.nameEn" class="chip-const" />
              <span class="chip-name">{{ s.name }}</span>
            </button>
          </div>
          <div class="gender-seg mono" role="group" aria-label="甲方性别">
            <button type="button" :class="{ active: gender1 === 1 }" @click="gender1 = 1">男</button>
            <button type="button" :class="{ active: gender1 === 0 }" @click="gender1 = 0">女</button>
          </div>
        </div>

        <!-- 中间饰 -->
        <div class="vs" aria-hidden="true">
          <span class="vs-star">✦</span>
          <span class="vs-en mono">VS</span>
        </div>

        <!-- 乙方 -->
        <div class="side">
          <p class="side-label mono">STAR Ⅱ · 乙方</p>
          <div class="sign-grid">
            <button
              v-for="s in signs"
              :key="'b' + s.id"
              type="button"
              class="sign-chip"
              :class="{ active: star2 === s.nameEn }"
              @click="star2 = s.nameEn"
            >
              <Constellation :sign="s.nameEn" class="chip-const" />
              <span class="chip-name">{{ s.name }}</span>
            </button>
          </div>
          <div class="gender-seg mono" role="group" aria-label="乙方性别">
            <button type="button" :class="{ active: gender2 === 1 }" @click="gender2 = 1">男</button>
            <button type="button" :class="{ active: gender2 === 0 }" @click="gender2 = 0">女</button>
          </div>
        </div>
      </div>

      <p v-if="error" class="error-line">{{ error }}</p>

      <div class="picker-actions">
        <button type="button" class="match-btn" :disabled="loading" @click="doMatch">
          {{ loading ? '星辰推演中…' : '开始配对' }}
        </button>
      </div>
    </section>

    <!-- ===== 配对结果 ===== -->
    <section v-if="result" class="glass-card result" :class="{ refreshing: loading }">
      <!-- 结果头：双方名 + 配比签 -->
      <div class="r-head">
        <div class="r-names">
          <span class="r-zh">{{ result.star1.name }}</span>
          <span class="r-cross">×</span>
          <span class="r-zh">{{ result.star2.name }}</span>
          <span class="r-en">{{ result.star1.nameEn }} × {{ result.star2.nameEn }}</span>
        </div>
        <span class="proportion mono">配比 {{ result.proportion }}</span>
      </div>

      <div class="divider"><i></i><span>✦</span><i></i></div>

      <!-- 综合指数：金环 + 大数字 -->
      <div class="overall-row">
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 140 140">
            <circle class="ring-track" cx="70" cy="70" :r="R" />
            <circle
              class="ring-value"
              cx="70" cy="70" :r="R"
              :stroke-dasharray="C"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <div class="ring-center">
            <span class="ring-num mono">{{ shownOverall }}</span>
            <span class="ring-label mono">综合指数</span>
          </div>
        </div>
        <p class="overall-note">{{ result.review }}</p>
      </div>

      <!-- 六项细分指数横条 -->
      <ul class="bars">
        <li v-for="d in barDims" :key="d.key">
          <span class="bar-label">
            <span class="bar-zh">{{ d.zh }}</span>
            <span class="bar-en mono">{{ d.en }}</span>
          </span>
          <span class="bar-track">
            <span class="bar-fill" :style="{ width: (ready ? d.value : 0) + '%' }"></span>
          </span>
          <span class="bar-num mono">{{ d.value }}</span>
        </li>
      </ul>

      <div class="divider"><i></i><span>✦</span><i></i></div>

      <!-- 文案四块 -->
      <div class="texts">
        <div v-for="b in textBlocks" :key="b.en" class="t-block">
          <p class="t-label">
            <span class="t-zh">{{ b.zh }}</span>
            <span class="t-en mono">{{ b.en }}</span>
          </p>
          <p class="t-text">{{ b.txt }}</p>
        </div>
      </div>

      <!-- 来源签 -->
      <div class="r-footer">
        <span class="source-tag mono" :class="{ showapi: result.source === 'SHOWAPI' }">
          {{ result.source === 'SHOWAPI' ? 'DATA · 万维易源 SHOWAPI' : 'DATA · 本地星算 LOCAL' }}
        </span>
      </div>
    </section>

    <!-- 首次加载占位 -->
    <section v-else-if="loading" class="glass-card state-card">
      <div class="spinner"></div>
      <p class="state-text">正在推演星轨交汇…</p>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import Constellation from '../components/Constellation.vue'
import { fetchSigns, fetchMatch } from '../api'

/* ===== 选择器状态 ===== */
const signs = ref([])
const star1 = ref('')
const star2 = ref('')
const gender1 = ref(1) // 默认男
const gender2 = ref(0) // 默认女

const result = ref(null)
const loading = ref(false)
const error = ref('')

// 入场动画开关：结果渲染后下一帧再推到目标值，触发金环/金条过渡
const ready = ref(false)

/* ===== 综合指数金环 ===== */
const R = 60
const C = 2 * Math.PI * R // ≈377
const shownOverall = ref(0)
const ringOffset = computed(() => C * (1 - (ready.value ? shownOverall.value : 0) / 100))

/* ===== 六项细分 ===== */
const DIMS = [
  { key: 'love', zh: '爱情', en: 'LOVE' },
  { key: 'friendship', zh: '友情', en: 'FRIENDSHIP' },
  { key: 'marriage', zh: '婚姻', en: 'MARRIAGE' },
  { key: 'forever', zh: '天长地久', en: 'FOREVER' },
  { key: 'lqxy', zh: '两情相悦', en: 'MUTUAL' },
  { key: 'affection', zh: '亲情', en: 'AFFECTION' }
]
const barDims = computed(() =>
  result.value
    ? DIMS.map((d) => ({ ...d, value: result.value.scores[d.key] ?? 0 }))
    : []
)

/* ===== 文案四块 ===== */
const textBlocks = computed(() =>
  result.value
    ? [
        { zh: '缘分解析', en: 'PREDESTINATION', txt: result.value.predestination },
        { zh: '恋爱建议', en: 'SUGGEST', txt: result.value.suggest },
        { zh: '注意事项', en: 'ATTENTION', txt: result.value.attention },
        { zh: '配对点评', en: 'REVIEW', txt: result.value.review }
      ].filter((b) => b.txt)
    : []
)

/* ===== 默认选中：今日星座 × 狮子座（与 App.vue 同一套区间判定） ===== */
function inRange(sign, month, day) {
  const { startMonth: sm, startDay: sd, endMonth: em, endDay: ed } = sign
  if (sm > em) return (month === sm && day >= sd) || (month === em && day <= ed)
  return (month === sm && day >= sd) || (month === em && day <= ed)
}
function findTodaySign(list) {
  const now = new Date()
  return list.find((s) => inRange(s, now.getMonth() + 1, now.getDate())) || list[0]
}

/* ===== 发起配对 ===== */
async function doMatch() {
  if (!star1.value || !star2.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await fetchMatch(star1.value, star2.value, gender1.value, gender2.value)
    ready.value = false
    result.value = data
    shownOverall.value = data.scores.overall ?? 0
    // 下一帧推开动画终态
    await nextTick()
    requestAnimationFrame(() => { ready.value = true })
  } catch (e) {
    error.value = '无法连接星语服务器，请稍后再试'
  } finally {
    loading.value = false
  }
}

/* ===== 初始化：拉星座列表 → 默认 今日星座 × 狮子座 → 自动配对一次（首屏即有内容） ===== */
onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchSigns()
    signs.value = list
    const today = findTodaySign(list)
    star1.value = today.nameEn
    const leo = list.find((s) => s.nameEn === 'leo') || list[1] || list[0]
    star2.value = leo.nameEn === star1.value && list.length > 1 ? list[0].nameEn : leo.nameEn
    loading.value = false
    await doMatch()
  } catch (e) {
    loading.value = false
    error.value = '无法连接星语服务器，请稍后再试'
  }
})
</script>

<style scoped>
.match-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 选择器 ===== */
.picker {
  padding: 24px 30px 26px;
}
.picker-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 22px;
  align-items: start;
}
.side-label {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
  margin-bottom: 12px;
}
.sign-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.sign-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px 7px;
  background: none;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 4px;
  color: var(--ink-dim2);
  cursor: pointer;
  transition: border-color 0.25s, color 0.25s, background 0.25s;
}
.sign-chip:hover {
  border-color: var(--gold-dim);
  color: var(--ink);
}
.sign-chip.active {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(232, 196, 124, 0.08);
}
.chip-const {
  width: 26px;
  height: 26px;
}
.chip-name {
  font-size: 12.5px;
  letter-spacing: 0.08em;
}

/* 性别 segmented */
.gender-seg {
  display: inline-flex;
  margin-top: 14px;
  border: 1px solid rgba(139, 135, 176, 0.25);
  border-radius: 4px;
  overflow: hidden;
}
.gender-seg button {
  background: none;
  border: none;
  padding: 6px 18px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim);
  cursor: pointer;
  transition: background 0.25s, color 0.25s;
}
.gender-seg button + button {
  border-left: 1px solid rgba(139, 135, 176, 0.25);
}
.gender-seg button.active {
  background: rgba(232, 196, 124, 0.12);
  color: var(--gold);
}

/* 中间 ✦ / VS */
.vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 84px;
}
.vs-star {
  font-size: 30px;
  color: var(--gold);
  text-shadow: 0 0 18px rgba(232, 196, 124, 0.45);
}
.vs-en {
  font-size: 12.5px;
  letter-spacing: 0.3em;
  color: var(--ink-dim2);
}

.picker-actions {
  display: flex;
  justify-content: center;
  margin-top: 22px;
}
.match-btn {
  padding: 10px 44px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.match-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.match-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.error-line {
  margin: 14px 0 0;
  text-align: center;
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--cinnabar);
}

/* ===== 结果卡 ===== */
.result {
  padding: 26px 30px 24px;
  transition: opacity 0.25s ease;
}
.result.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.r-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.r-names {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.r-zh {
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--gold);
  letter-spacing: 0.12em;
}
.r-cross {
  color: var(--ink-dim);
  font-size: 20px;
}
.r-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-size: 16px;
  color: var(--ink-dim);
  margin-left: 6px;
}
.proportion {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--gold);
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  padding: 4px 12px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: var(--gold-dim);
  font-size: 11px;
}
.divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* 综合指数金环 */
.overall-row {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
}
.ring-wrap {
  position: relative;
  width: 140px;
  height: 140px;
  flex: none;
}
.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: rgba(139, 135, 176, 0.18);
  stroke-width: 5;
}
.ring-value {
  fill: none;
  stroke: var(--gold);
  stroke-width: 5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(232, 196, 124, 0.4));
  transition: stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1);
}
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.ring-num {
  font-size: 40px;
  line-height: 1;
  color: var(--gold);
  text-shadow: 0 0 18px rgba(232, 196, 124, 0.35);
}
.ring-label {
  font-size: 12.5px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  color: var(--ink-dim2);
}
.overall-note {
  flex: 1;
  min-width: 220px;
  padding: 4px 0 4px 18px;
  border-left: 2px solid var(--gold);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16px;
  line-height: 2;
  color: var(--ink);
}

/* 六项横条 */
.bars {
  list-style: none;
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bars li {
  display: grid;
  grid-template-columns: 170px 1fr 40px;
  align-items: center;
  gap: 14px;
}
.bar-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.bar-zh {
  font-size: 14px;
  letter-spacing: 0.14em;
  color: var(--ink);
}
.bar-en {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}
.bar-track {
  height: 5px;
  border-radius: 3px;
  background: rgba(139, 135, 176, 0.15);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(232, 196, 124, 0.55), var(--gold));
  box-shadow: 0 0 8px rgba(232, 196, 124, 0.35);
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.bar-num {
  text-align: right;
  font-size: 14px;
  color: var(--gold);
}

/* 文案四块 */
.texts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.t-block {
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 6px;
  padding: 14px 16px;
}
.t-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.t-zh {
  font-size: 14px;
  letter-spacing: 0.18em;
  color: var(--gold);
}
.t-en {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
}
.t-text {
  font-size: 14px;
  line-height: 1.95;
  color: rgba(232, 230, 240, 0.9);
}

.r-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}
.source-tag {
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
}
.source-tag.showapi {
  color: var(--gold);
}

/* 加载占位 */
.state-card {
  padding: 44px 60px;
  text-align: center;
}
.state-text {
  margin-top: 16px;
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--ink);
}

@media (max-width: 900px) {
  .picker-row {
    grid-template-columns: 1fr;
  }
  .vs {
    flex-direction: row;
    padding-top: 0;
    justify-content: center;
  }
  .texts {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .picker,
  .result {
    padding: 20px 18px;
  }
  .sign-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .bars li {
    grid-template-columns: 120px 1fr 34px;
    gap: 10px;
  }
}
</style>
