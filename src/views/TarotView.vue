<template>
  <div class="tarot-view">
    <!-- ===== 每日塔罗（进入标签页即自动加载，无需点击） ===== -->
    <section class="glass-card daily" :class="{ refreshing: dailyLoading && daily }">
      <div v-if="dailyError" class="t-state">
        <p class="t-state-icon">✧</p>
        <p class="t-state-text">{{ dailyError }}</p>
        <button class="t-btn" @click="loadDaily">重新连接</button>
      </div>
      <div v-else-if="dailyLoading && !daily" class="t-state">
        <div class="spinner"></div>
        <p class="t-state-text">正在洗牌…</p>
      </div>
      <template v-else-if="daily">
        <div class="daily-face">
          <TarotCardFace :card="daily.card" :orientation="daily.orientation" size="lg" />
        </div>
        <div class="daily-panel">
          <p class="eyebrow mono">DAILY TAROT · {{ todayStr }}</p>
          <h3 class="daily-name">
            <span class="zh">{{ daily.card.name }}</span>
            <span class="en">{{ daily.card.nameEn }}</span>
          </h3>
          <!-- 正逆位印章：与宜/忌同款双线铅印 -->
          <div class="ori-seal-row">
            <span class="ori-seal" :class="daily.orientation">
              {{ daily.orientation === 'reversed' ? '逆位' : '正位' }}
            </span>
          </div>
          <div class="kw-chips">
            <span v-for="(k, i) in dailyKeywords" :key="i" class="kw-chip mono">{{ k }}</span>
          </div>
          <p class="meaning">{{ daily.meaning }}</p>
        </div>
      </template>
    </section>

    <!-- ===== 抽牌仪式 ===== -->
    <section class="glass-card ritual">
      <h3 class="sec-title">抽牌仪式 <span class="sec-title-en mono">RITUAL</span></h3>

      <!-- 牌阵选择器：日常 / 进阶 分组 chips（标注牌数），选中金边；切换即重置为待抽状态 -->
      <div class="spread-picker">
        <div v-for="g in SPREAD_GROUPS" :key="g.label" class="spread-group">
          <span class="sg-label mono">{{ g.label }} <i>{{ g.en }}</i></span>
          <div class="sg-chips">
            <button
              v-for="s in g.spreads"
              :key="s.key"
              type="button"
              class="mode-btn mono"
              :class="{ active: spread === s.key }"
              :disabled="drawing"
              @click="setSpread(s.key)"
            >{{ s.name }} <i class="cnt">{{ s.count }}</i></button>
          </div>
        </div>
      </div>

      <p v-if="drawError" class="error-line">{{ drawError }}</p>

      <!-- 抽牌前：一排牌背 -->
      <template v-if="!drawn.length">
        <div class="backs-row">
          <TarotCardFace v-for="n in backCount" :key="n" faceDown size="md" class="back-item" />
        </div>
        <div class="stage-actions">
          <button type="button" class="t-btn draw-btn" :disabled="drawing" @click="doDraw">
            {{ drawing ? '洗牌抽牌中…' : '开始抽牌' }}
          </button>
        </div>
      </template>

      <!-- 抽牌后：按牌阵摆牌（牌位标签取自 spread 返回的 position 字段） -->
      <template v-else>
        <!-- single / three：横排 -->
        <div v-if="layout === 'row'" class="drawn-row" :class="{ three: drawn.length === 3 }">
          <TarotFlipCard
            v-for="(d, i) in drawn"
            :key="d.card.id + '-' + i"
            class="drawn-item"
            :item="d"
            :flipped="flipped"
            :index="i"
          />
        </div>

        <!-- choice 二选一：现状居中略小居上，Y 形分叉线下接 选择A/B 两翼，暗示两条路径 -->
        <div v-else-if="layout === 'choice'" class="choice-layout">
          <TarotFlipCard class="choice-center" :item="cardAt('现状')" :flipped="flipped" :index="0" size="sm" />
          <svg class="choice-fork" viewBox="0 0 470 60" aria-hidden="true">
            <line x1="235" y1="0" x2="235" y2="16" class="fork-line" />
            <line x1="235" y1="16" x2="75" y2="58" class="fork-line" />
            <line x1="235" y1="16" x2="395" y2="58" class="fork-line" />
            <circle cx="235" cy="16" r="2.5" class="fork-dot" />
          </svg>
          <div class="choice-wings">
            <TarotFlipCard class="choice-wing" :item="cardAt('选择 A')" :flipped="flipped" :index="1" />
            <TarotFlipCard class="choice-wing" :item="cardAt('选择 B')" :flipped="flipped" :index="2" />
          </div>
        </div>

        <!-- love 爱情十字：3×3 布点（上=现实阻碍 左=你的状态 中=关系现状 右=对方的状态 下=结果与建议） -->
        <div v-else-if="layout === 'love'" class="love-cross">
          <TarotFlipCard class="c-top" :item="cardAt('现实阻碍')" :flipped="flipped" :index="3" size="sm" />
          <TarotFlipCard class="c-left" :item="cardAt('你的状态')" :flipped="flipped" :index="0" size="sm" />
          <TarotFlipCard class="c-center" :item="cardAt('关系现状')" :flipped="flipped" :index="2" />
          <TarotFlipCard class="c-right" :item="cardAt('对方的状态')" :flipped="flipped" :index="1" size="sm" />
          <TarotFlipCard class="c-bottom" :item="cardAt('结果与建议')" :flipped="flipped" :index="4" size="sm" />
        </div>

        <!-- celtic 凯尔特十字：左侧六牌十字（中央 现状核心 + 障碍挑战 横压 90°），右侧纵列牌杖 7→10 自下而上 -->
        <div v-else-if="layout === 'celtic'" class="celtic-wrap">
          <div class="celtic-cross">
            <div class="cx-center">
              <TarotFlipCard :item="cardAt('现状核心')" :flipped="flipped" :index="0" size="sm" />
              <TarotFlipCard class="cx-cross" :item="cardAt('障碍与挑战')" :flipped="flipped" :index="1" size="sm" bare />
            </div>
            <TarotFlipCard class="cx-bottom" :item="cardAt('潜意识根源')" :flipped="flipped" :index="2" size="sm" />
            <TarotFlipCard class="cx-left" :item="cardAt('过去的印记')" :flipped="flipped" :index="3" size="sm" />
            <TarotFlipCard class="cx-top" :item="cardAt('显意识目标')" :flipped="flipped" :index="4" size="sm" />
            <TarotFlipCard class="cx-right" :item="cardAt('未来的发展')" :flipped="flipped" :index="5" size="sm" />
          </div>
          <div class="celtic-staff">
            <TarotFlipCard :item="cardAt('自我认知')" :flipped="flipped" :index="6" size="sm" />
            <TarotFlipCard :item="cardAt('环境与外力')" :flipped="flipped" :index="7" size="sm" />
            <TarotFlipCard :item="cardAt('希望与恐惧')" :flipped="flipped" :index="8" size="sm" />
            <TarotFlipCard :item="cardAt('最终结果')" :flipped="flipped" :index="9" size="sm" />
          </div>
        </div>

        <!-- hexagram 六芒星：上下顶点 + 左右四角，结果居心（grid-area 跨两行） -->
        <div v-else-if="layout === 'hexagram'" class="hex-grid">
          <TarotFlipCard class="hx-past" :item="cardAt('过去')" :flipped="flipped" :index="0" size="sm" />
          <TarotFlipCard class="hx-present" :item="cardAt('现在')" :flipped="flipped" :index="1" size="sm" />
          <TarotFlipCard class="hx-future" :item="cardAt('未来')" :flipped="flipped" :index="2" size="sm" />
          <TarotFlipCard class="hx-block" :item="cardAt('阻碍')" :flipped="flipped" :index="3" size="sm" />
          <TarotFlipCard class="hx-help" :item="cardAt('助力')" :flipped="flipped" :index="4" size="sm" />
          <TarotFlipCard class="hx-advice" :item="cardAt('建议')" :flipped="flipped" :index="5" size="sm" />
          <TarotFlipCard class="hx-result" :item="cardAt('结果')" :flipped="flipped" :index="6" />
        </div>

        <!-- 逐牌解读：关键词签 + 牌义段落 -->
        <div class="meaning-panels">
          <div v-for="(d, i) in drawn" :key="'m' + d.card.id + '-' + i" class="m-panel">
            <p class="m-head">
              <span v-if="d.position" class="m-pos mono">{{ d.position }}</span>
              <span class="m-name">{{ d.card.name }}</span>
              <span class="m-ori mono" :class="d.orientation">
                {{ d.orientation === 'reversed' ? '逆位' : '正位' }}
              </span>
            </p>
            <p v-if="d.positionDesc" class="m-posdesc">{{ d.positionDesc }}</p>
            <div class="kw-chips">
              <span v-for="(k, j) in splitKw(d.keywords)" :key="j" class="kw-chip mono">{{ k }}</span>
            </div>
            <p class="m-text">{{ d.meaning }}</p>
          </div>
        </div>

        <div class="stage-actions">
          <button type="button" class="t-btn" @click="resetDraw">重新抽牌</button>
        </div>
      </template>
    </section>

    <!-- ===== 牌库 ARCANA ARCHIVE（默认收起，首次展开时懒加载） ===== -->
    <section class="glass-card archive">
      <button type="button" class="archive-head" @click="toggleArchive">
        <h3 class="sec-title">牌库 <span class="sec-title-en mono">ARCANA ARCHIVE</span></h3>
        <span class="toggle mono">{{ archiveOpen ? '收起 −' : '展开 +' }}</span>
      </button>

      <div v-if="archiveOpen" class="archive-body">
        <div v-if="cardsLoading" class="t-state"><div class="spinner"></div></div>
        <p v-else-if="cardsError" class="error-line">{{ cardsError }}</p>
        <template v-else>
          <div v-for="g in groups" :key="g.key" class="group">
            <p class="group-title mono">{{ g.zh }} · {{ g.key }}</p>
            <div class="card-grid">
              <button
                v-for="c in g.cards"
                :key="c.id"
                type="button"
                class="grid-card"
                :title="`${c.name} ${c.nameEn}`"
                @click="activeCard = c"
              >
                <TarotCardFace :card="c" size="sm" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- 牌详情弹层：正逆位关键词与牌义 -->
    <div v-if="activeCard" class="modal-mask" @click.self="activeCard = null">
      <div class="modal glass-card" role="dialog" :aria-label="activeCard.name">
        <button type="button" class="modal-close mono" @click="activeCard = null">✕</button>
        <div class="modal-face">
          <TarotCardFace :card="activeCard" size="md" />
        </div>
        <div class="modal-info">
          <h4 class="m-title">
            <span class="zh">{{ activeCard.name }}</span>
            <span class="en">{{ activeCard.nameEn }}</span>
          </h4>
          <div class="m-block">
            <p class="m-label mono" style="color: var(--jade)">正位 UPRIGHT</p>
            <div class="kw-chips">
              <span v-for="(k, i) in splitKw(activeCard.uprightKeywords)" :key="i" class="kw-chip mono">{{ k }}</span>
            </div>
            <p class="m-text">{{ activeCard.uprightMeaning }}</p>
          </div>
          <div class="m-block">
            <p class="m-label mono" style="color: var(--cinnabar)">逆位 REVERSED</p>
            <div class="kw-chips">
              <span v-for="(k, i) in splitKw(activeCard.reversedKeywords)" :key="i" class="kw-chip mono">{{ k }}</span>
            </div>
            <p class="m-text">{{ activeCard.reversedMeaning }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import TarotCardFace from '../components/TarotCardFace.vue'
import TarotFlipCard from '../components/TarotFlipCard.vue'
import { fetchTarotDaily, drawTarot, fetchTarotCards } from '../api'

/* ===== 每日塔罗 ===== */
const daily = ref(null)
const dailyLoading = ref(false)
const dailyError = ref('')

const todayStr = new Date().toISOString().slice(0, 10)
const dailyKeywords = computed(() => splitKw(daily.value ? daily.value.keywords : ''))

async function loadDaily() {
  dailyLoading.value = true
  dailyError.value = ''
  try {
    daily.value = await fetchTarotDaily()
  } catch (e) {
    dailyError.value = '无法连接星语服务器，请稍后再试'
  } finally {
    dailyLoading.value = false
  }
}

/* ===== 抽牌仪式（牌阵系统：日常 4 阵 + 进阶大牌阵 celtic/hexagram） ===== */
const SPREAD_GROUPS = [
  {
    label: '日常', en: 'DAILY',
    spreads: [
      { key: 'single', name: '单牌指引', count: 1 },
      { key: 'three', name: '时间之流', count: 3 },
      { key: 'choice', name: '二选一', count: 3 },
      { key: 'love', name: '爱情十字', count: 5 }
    ]
  },
  {
    label: '进阶', en: 'ADVANCED',
    spreads: [
      { key: 'celtic', name: '凯尔特十字', count: 10 },
      { key: 'hexagram', name: '六芒星', count: 7 }
    ]
  }
]
const spread = ref('single') // 当前牌阵
const drawn = ref([])        // 抽到的牌（带 position 牌位）
const flipped = ref(false)   // 是否已翻开（驱动 3D 翻转动画）
const drawing = ref(false)
const drawError = ref('')

// 摆牌方式：single/three 横排；choice 二选一分翼；love 十字；celtic 凯尔特十字；hexagram 六芒星
const layout = computed(() =>
  ({ choice: 'choice', love: 'love', celtic: 'celtic', hexagram: 'hexagram' }[spread.value] || 'row')
)

// 按牌位名取牌（摆阵用；取不到时给兜底，避免模板崩）
function cardAt(position) {
  return drawn.value.find((d) => d.position === position) || drawn.value[0] || { card: {}, orientation: 'upright', position }
}

// 牌背展示数量跟随牌阵（大牌阵一排放不下，封顶 6 张示意）
const backCount = computed(() => Math.min({ single: 1, three: 3, choice: 3, love: 5, celtic: 10, hexagram: 7 }[spread.value] || 3, 6))

function setSpread(s) {
  if (drawing.value) return
  spread.value = s
  if (drawn.value.length) resetDraw() // 切换牌阵重置为牌背待抽状态
}

async function doDraw() {
  drawing.value = true
  drawError.value = ''
  try {
    const result = await drawTarot(spread.value)
    drawn.value = result.cards || []
    // 等 DOM 渲染出背面后再触发翻转，形成逐张 stagger
    setTimeout(() => { flipped.value = true }, 80)
  } catch (e) {
    drawError.value = '无法连接星语服务器，请稍后再试'
    drawn.value = []
  } finally {
    drawing.value = false
  }
}

function resetDraw() {
  drawn.value = []
  flipped.value = false
  drawError.value = ''
}

/* ===== 牌库（首次展开懒加载） ===== */
const archiveOpen = ref(false)
const cards = ref([])
const cardsLoading = ref(false)
const cardsError = ref('')
const activeCard = ref(null)

const GROUP_META = [
  { key: 'MAJOR', zh: '大阿尔卡纳' },
  { key: 'WANDS', zh: '权杖' },
  { key: 'CUPS', zh: '圣杯' },
  { key: 'SWORDS', zh: '宝剑' },
  { key: 'PENTACLES', zh: '星币' }
]

const groups = computed(() =>
  GROUP_META.map((g) => ({
    ...g,
    cards: cards.value.filter((c) => c.arcanaGroup === g.key)
  })).filter((g) => g.cards.length)
)

async function toggleArchive() {
  archiveOpen.value = !archiveOpen.value
  if (archiveOpen.value && !cards.value.length && !cardsLoading.value) {
    cardsLoading.value = true
    cardsError.value = ''
    try {
      cards.value = await fetchTarotCards()
    } catch (e) {
      cardsError.value = '无法连接星语服务器，请稍后再试'
    } finally {
      cardsLoading.value = false
    }
  }
}

/* ===== 工具：关键词字符串 → 数组（顿号/逗号/斜杠分隔均兼容） ===== */
function splitKw(s) {
  if (!s) return []
  return String(s).split(/[、,，\/|]/).map((x) => x.trim()).filter(Boolean)
}

onMounted(loadDaily) // 进入标签页即自动加载每日塔罗
</script>

<style scoped>
.tarot-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 每日塔罗 ===== */
.daily {
  display: flex;
  gap: 32px;
  padding: 28px 30px;
  transition: opacity 0.25s ease;
}
.daily.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.daily-face {
  flex: none;
  width: 210px;
}
.daily-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.daily-name {
  display: flex;
  flex-direction: column;
  gap: 4px; /* 中文一行、英文独立一行 */
}
.daily-name .zh {
  font-family: var(--font-display);
  font-size: 32px;
  color: var(--gold);
  letter-spacing: 0.14em;
}
.daily-name .en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  color: var(--ink-dim);
  white-space: nowrap; /* 英文不折词 */
}
/* 正逆位大印章（与宜/忌同工艺） */
.ori-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 40px;
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0.1em;
  border: 1px solid currentColor;
  border-radius: 4px;
  box-shadow: inset 0 0 0 3px var(--bg-night), inset 0 0 0 4px currentColor;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.ori-seal.upright { color: var(--jade); }
.ori-seal.reversed { color: var(--cinnabar); }
.meaning {
  font-size: 15px;
  line-height: 2;
  color: rgba(232, 230, 240, 0.9);
}

/* 关键词签 */
.kw-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.kw-chip {
  font-size: 12.5px;
  letter-spacing: 0.1em;
  color: var(--gold);
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  padding: 4px 10px;
}

/* ===== 通用小节标题 ===== */
.sec-title {
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0.3em;
  color: var(--ink);
}
.sec-title-en {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
  margin-left: 8px;
}

/* ===== 抽牌仪式 ===== */
.ritual {
  padding: 24px 30px 28px;
}
/* 牌阵选择器：日常 / 进阶 分组 */
.spread-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 16px 0 22px;
}
.spread-group {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}
.sg-label {
  flex: none;
  width: 92px;
  font-size: 12px;
  letter-spacing: 0.24em;
  color: var(--ink-dim2);
}
.sg-label i {
  font-style: italic;
  font-size: 10px;
  letter-spacing: 0.14em;
  opacity: 0.7;
  margin-left: 4px;
}
.sg-chips {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)); /* 均分宽度：日常 4 枚占满，进阶 2 枚同宽 */
  gap: 12px;
}
.cnt {
  font-style: normal;
  font-size: 10.5px;
  letter-spacing: 0.05em;
  color: var(--gold-dim);
  margin-left: 6px;
}
.mode-btn {
  /* 统一宽高：宽度由网格均分，高度固定，内部排版一致（名称 + 牌数角标居中一行） */
  width: 100%;
  height: 44px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  font-size: 13px;
  letter-spacing: 0.16em;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.25);
  background: none;
  color: var(--ink-dim);
  cursor: pointer;
  transition: border-color 0.25s, color 0.25s, background 0.25s;
}
.mode-btn:hover {
  border-color: var(--gold-dim);
  color: var(--ink);
}
.mode-btn.active {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(232, 196, 124, 0.08);
}
.mode-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* 牌背排 */
.backs-row {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 10px 0 22px;
}
.back-item {
  width: 110px;
  flex: none;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.back-item:hover {
  transform: translateY(-8px); /* 悬停轻浮 */
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
}

.stage-actions {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.t-btn {
  padding: 9px 34px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.25em;
  text-indent: 0.25em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.t-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.t-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

/* 翻牌区：single/three 横排 */
.drawn-row {
  display: flex;
  justify-content: center;
  gap: 26px;
  padding: 6px 0 20px;
}
.drawn-item {
  width: 150px;
  flex: none;
}

/* 二选一：现状居上，Y 形分叉，两翼分列 */
.choice-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 20px;
}
.choice-center {
  width: 118px;
}
.choice-fork {
  width: 470px;
  max-width: 100%;
  height: 60px;
  display: block;
}
.fork-line {
  stroke: var(--gold-dim);
  stroke-width: 1;
}
.fork-dot {
  fill: var(--gold);
}
.choice-wings {
  width: 470px;
  max-width: 100%;
  display: flex;
  justify-content: space-between;
}
.choice-wing {
  width: 150px;
  flex: none;
}

/* 爱情十字：3×3 布点，中心（关系现状）略大 */
.love-cross {
  display: grid;
  grid-template-columns: 130px 160px 130px;
  justify-content: center;
  align-items: start;
  gap: 16px 18px;
  padding: 6px 0 20px;
  grid-template-areas:
    ". top ."
    "left center right"
    ". bottom .";
}
.c-top { grid-area: top; }
.c-left { grid-area: left; }
.c-center { grid-area: center; }
.c-right { grid-area: right; }
.c-bottom { grid-area: bottom; }

/* 凯尔特十字：左十字 + 右牌杖 */
.celtic-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 48px;
  padding: 6px 0 20px;
}
.celtic-cross {
  display: grid;
  grid-template-columns: 88px 88px 88px;
  justify-content: center;
  align-items: center;
  gap: 20px 24px;
  grid-template-areas:
    ". ctop ."
    "cleft ccenter cright"
    ". cbottom .";
}
.cx-top { grid-area: ctop; }
.cx-left { grid-area: cleft; }
.cx-right { grid-area: cright; }
.cx-bottom { grid-area: cbottom; }
.cx-center {
  grid-area: ccenter;
  position: relative;
  width: 88px;
}
/* 障碍牌：横压 90° 覆盖在现状核心之上（无标签，bare） */
.cx-cross {
  position: absolute;
  top: 26px; /* 跳过基牌标签高度，使旋转中心与牌面中心重合 */
  left: 0;
  width: 88px;
  transform: rotate(90deg);
  z-index: 2;
}
.celtic-staff {
  display: flex;
  flex-direction: column-reverse; /* 牌杖 7→10 自下而上 */
  gap: 18px;
  width: 88px;
  flex: none;
}

/* 六芒星：上下顶点 + 四角，结果居心跨两行 */
.hex-grid {
  display: grid;
  grid-template-columns: 88px 104px 88px;
  justify-content: center;
  align-items: center;
  gap: 18px 32px;
  padding: 6px 0 20px;
  grid-template-areas:
    ". hfuture ."
    "hpast hresult hpresent"
    "hblock hresult hhelp"
    ". hadvice .";
}
.hx-past { grid-area: hpast; }
.hx-present { grid-area: hpresent; }
.hx-future { grid-area: hfuture; }
.hx-block { grid-area: hblock; }
.hx-help { grid-area: hhelp; }
.hx-advice { grid-area: hadvice; }
.hx-result { grid-area: hresult; width: 104px; }

/* 逐牌解读 */
.meaning-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}
.m-panel {
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 6px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.m-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.m-pos {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
}
.m-name {
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.m-ori {
  font-size: 12px;
  letter-spacing: 0.16em;
  margin-left: auto;
}
.m-ori.upright { color: var(--jade); }
.m-ori.reversed { color: var(--cinnabar); }
/* 牌位释义（大牌阵 positionDesc）：一句话说明这个牌位在问什么 */
.m-posdesc {
  font-size: 12.5px;
  font-style: italic;
  line-height: 1.8;
  color: var(--ink-dim2);
  padding-left: 10px;
  border-left: 2px solid var(--gold-hairline);
}
.m-text {
  font-size: 14px;
  line-height: 1.9;
  color: rgba(232, 230, 240, 0.9);
}

/* ===== 牌库 ===== */
.archive {
  padding: 0; /* 头部整行可点 */
}
.archive-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 26px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.toggle {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--gold);
}
.archive-body {
  padding: 0 26px 24px;
}
.group {
  margin-top: 18px;
}
.group-title {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.16);
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.grid-card {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.grid-card:hover {
  transform: translateY(-4px);
}

/* ===== 详情弹层 ===== */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(7, 11, 30, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.modal {
  position: relative;
  display: flex;
  gap: 26px;
  max-width: 640px;
  width: 100%;
  max-height: 86vh;
  overflow-y: auto;
  padding: 26px 28px;
}
.modal-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  color: var(--ink-dim);
  font-size: 14px;
  cursor: pointer;
}
.modal-close:hover { color: var(--gold); }
.modal-face {
  flex: none;
  width: 140px;
}
.modal-info {
  flex: 1;
  min-width: 0;
}
.m-title {
  display: flex;
  flex-direction: column;
  gap: 2px; /* 中文一行、英文独立一行 */
}
.m-title .zh {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--gold);
  letter-spacing: 0.12em;
}
.m-title .en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-size: 15px;
  color: var(--ink-dim);
  white-space: nowrap; /* 英文不折词 */
}
.m-block {
  margin-top: 16px;
}
.m-label {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  margin-bottom: 8px;
}

/* ===== 状态与错误 ===== */
.t-state {
  width: 100%;
  padding: 40px 0;
  text-align: center;
}
.t-state-icon {
  font-size: 30px;
  color: var(--gold);
  margin-bottom: 12px;
}
.t-state-text {
  margin: 14px 0 18px;
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--ink);
}
.error-line {
  margin: 8px 0 14px;
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--cinnabar);
}

/* ===== 移动端 ===== */
@media (max-width: 640px) {
  .daily {
    flex-direction: column;
    align-items: center;
    padding: 22px 18px;
  }
  .daily-face {
    width: 170px;
  }
  .daily-panel {
    width: 100%;
  }
  .ritual {
    padding: 20px 18px 24px;
  }
  /* 窄屏：牌阵按钮改 2 列网格，宽度依然均分 */
  .spread-group {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .sg-chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .backs-row {
    gap: 10px;
    flex-wrap: wrap;
  }
  .back-item {
    width: 84px;
  }
  .drawn-row {
    gap: 8px;
    flex-wrap: nowrap; /* 三牌阵在 390px 也要一行放下：3×92+2×8=292 < 内容宽 */
  }
  .drawn-item {
    width: 92px;
  }
  /* 二选一：两翼收窄仍保持分列，分叉线随宽度缩放 */
  .choice-center {
    width: 96px;
  }
  .choice-wing {
    width: 118px;
  }
  /* 爱情十字：降级为带牌位标签的纵列（标签在组件内，天然可读） */
  .love-cross {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .love-cross > * {
    width: 130px;
  }
  /* 凯尔特十字：降级为纵列（障碍牌取消旋转与绝对定位，恢复正常站位） */
  .celtic-wrap {
    flex-direction: column;
    gap: 20px;
  }
  .celtic-cross {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .celtic-cross > * {
    width: 110px;
  }
  .cx-center {
    width: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .cx-center > * {
    width: 110px;
  }
  .cx-cross {
    position: static;
    transform: none;
    width: 110px;
  }
  .celtic-staff {
    flex-direction: column; /* 移动端恢复 7→10 自上而下自然阅读顺序 */
    align-items: center;
    width: auto;
  }
  .celtic-staff > * {
    width: 110px;
  }
  /* 六芒星：降级为纵列 */
  .hex-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .hex-grid > * {
    width: 110px;
  }
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .modal {
    flex-direction: column;
    align-items: center;
  }
}
</style>
