<template>
  <div class="bagua-view">
    <!-- ===== 每日一卦（进入标签页即自动加载） ===== -->
    <section class="glass-card daily" :class="{ refreshing: dailyLoading && daily }">
      <div v-if="dailyError" class="b-state">
        <p class="b-state-icon">✧</p>
        <p class="b-state-text">{{ dailyError }}</p>
        <button class="b-btn" @click="loadDaily">重新连接</button>
      </div>
      <div v-else-if="dailyLoading && !daily" class="b-state">
        <div class="spinner"></div>
        <p class="b-state-text">正在排卦…</p>
      </div>
      <template v-else-if="daily">
        <div class="daily-glyph">
          <HexagramGlyph :lines="daily.lines" size="lg" />
        </div>
        <div class="daily-panel">
          <p class="eyebrow mono">DAILY HEXAGRAM · {{ todayStr }} · 第{{ daily.seqNumber }}卦</p>
          <h3 class="daily-name">{{ daily.name }}</h3>
          <div class="daily-seal-row">
            <span class="level-seal" :class="levelClass(daily.fortuneLevel)">{{ daily.fortuneLevel }}</span>
            <span class="trigram-line mono">
              上{{ daily.upperTrigram }} {{ trigramSymbol(daily.upperTrigram) }} ·
              下{{ daily.lowerTrigram }} {{ trigramSymbol(daily.lowerTrigram) }}
            </span>
          </div>
          <blockquote class="judgment">{{ daily.judgment }}</blockquote>
          <p class="meaning">{{ daily.meaning }}</p>
        </div>
      </template>
    </section>

    <!-- ===== 铜钱起卦 ===== -->
    <section class="glass-card cast">
      <h3 class="sec-title">铜钱起卦 <span class="sec-title-en mono">CASTING</span></h3>
      <p v-if="castError" class="error-line">{{ castError }}</p>

      <!-- 未起卦：仪式入口 -->
      <div v-if="!castResult" class="cast-entry">
        <p class="cast-hint">静心默念所求之事，而后起卦</p>
        <button type="button" class="b-btn cast-btn" :disabled="casting" @click="doCast">
          {{ casting ? '摇卦中…' : '起卦' }}
        </button>
      </div>

      <!-- 起卦中/完成：六爻自下而上逐爻显现 -->
      <template v-else>
        <div class="lines-stage">
          <!-- 视觉顶部 = 第六爻，自上而下遍历 position 6..1 -->
          <div
            v-for="pos in [6, 5, 4, 3, 2, 1]"
            :key="pos"
            class="line-row"
            :class="{ revealed: revealedCount >= pos }"
          >
            <template v-if="revealedCount >= pos">
              <span class="line-bar" :class="{ yin: !lineAt(pos).yang }">
                <i class="seg"></i><i v-if="!lineAt(pos).yang" class="seg"></i>
              </span>
              <span class="line-label mono" :class="labelClass(lineAt(pos))">
                {{ lineAt(pos).label }}{{ lineAt(pos).changing ? (lineAt(pos).yang ? ' ○' : ' ✕') : '' }}
              </span>
            </template>
          </div>
        </div>

        <!-- 六爻齐后：本卦（+之卦）面板 -->
        <div v-if="showResult" class="result-row" :class="{ 'has-changed': castResult.changed }">
          <div class="hex-panel">
            <p class="hp-tag mono">本卦</p>
            <HexagramGlyph :lines="castResult.primary.lines" size="md" />
            <p class="hp-name">{{ castResult.primary.name }}</p>
            <p class="hp-seq mono">第{{ castResult.primary.seqNumber }}卦</p>
            <span class="level-seal sm" :class="levelClass(castResult.primary.fortuneLevel)">
              {{ castResult.primary.fortuneLevel }}
            </span>
            <blockquote class="judgment sm">{{ castResult.primary.judgment }}</blockquote>
            <p class="meaning sm">{{ castResult.primary.meaning }}</p>
          </div>

          <template v-if="castResult.changed">
            <div class="arrow mono"><span class="arrow-char">→</span><span class="arrow-label">之卦</span></div>
            <div class="hex-panel">
              <p class="hp-tag mono">之卦</p>
              <HexagramGlyph :lines="castResult.changed.lines" size="md" />
              <p class="hp-name">{{ castResult.changed.name }}</p>
              <p class="hp-seq mono">第{{ castResult.changed.seqNumber }}卦</p>
              <span class="level-seal sm" :class="levelClass(castResult.changed.fortuneLevel)">
                {{ castResult.changed.fortuneLevel }}
              </span>
              <blockquote class="judgment sm">{{ castResult.changed.judgment }}</blockquote>
              <p class="meaning sm">{{ castResult.changed.meaning }}</p>
            </div>
          </template>
        </div>

        <div v-if="showResult" class="cast-again">
          <button type="button" class="b-btn" @click="resetCast">重新起卦</button>
        </div>
      </template>
    </section>

    <!-- ===== 六十四卦（默认收起，首次展开懒加载） ===== -->
    <section class="glass-card archive">
      <button type="button" class="archive-head" @click="toggleArchive">
        <h3 class="sec-title">六十四卦 <span class="sec-title-en mono">SIXTY-FOUR HEXAGRAMS</span></h3>
        <span class="toggle mono">{{ archiveOpen ? '收起 −' : '展开 +' }}</span>
      </button>
      <div v-if="archiveOpen" class="archive-body">
        <div v-if="listLoading" class="b-state"><div class="spinner"></div></div>
        <p v-else-if="listError" class="error-line">{{ listError }}</p>
        <div v-else class="hex-grid">
          <button
            v-for="h in hexagrams"
            :key="h.seqNumber"
            type="button"
            class="grid-cell"
            :title="`第${h.seqNumber}卦 ${h.name}`"
            @click="activeHex = h"
          >
            <HexagramGlyph :lines="h.lines" size="sm" />
            <span class="cell-seq mono">{{ h.seqNumber }}</span>
            <span class="cell-name">{{ h.name }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 卦详情弹层 -->
    <div v-if="activeHex" class="modal-mask" @click.self="activeHex = null">
      <div class="modal glass-card" role="dialog" :aria-label="activeHex.name">
        <button type="button" class="modal-close mono" @click="activeHex = null">✕</button>
        <div class="modal-glyph">
          <HexagramGlyph :lines="activeHex.lines" size="md" />
        </div>
        <div class="modal-info">
          <h4 class="m-title">{{ activeHex.name }}</h4>
          <p class="m-meta mono">
            第{{ activeHex.seqNumber }}卦 · 上{{ activeHex.upperTrigram }} {{ trigramSymbol(activeHex.upperTrigram) }} ·
            下{{ activeHex.lowerTrigram }} {{ trigramSymbol(activeHex.lowerTrigram) }}
          </p>
          <span class="level-seal sm" :class="levelClass(activeHex.fortuneLevel)">{{ activeHex.fortuneLevel }}</span>
          <blockquote class="judgment sm">{{ activeHex.judgment }}</blockquote>
          <p class="meaning sm">{{ activeHex.meaning }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import HexagramGlyph from '../components/HexagramGlyph.vue'
import { fetchBaguaDaily, castBagua, fetchHexagrams } from '../api'

const todayStr = new Date().toISOString().slice(0, 10)

/* ===== 八卦符号映射（后端返回中文卦名；☰☱☲☳☴☵☶☷ 为基本多文种平面符号，字体覆盖好） ===== */
const TRIGRAM_SYMBOLS = {
  乾: '☰', 兑: '☱', 离: '☲', 震: '☳', 巽: '☴', 坎: '☵', 艮: '☶', 坤: '☷'
}
function trigramSymbol(name) {
  return TRIGRAM_SYMBOLS[name] || ''
}

/* ===== 卦运等级 → 印章配色：上上/上吉玉色，中吉/中平金，中下/下下朱砂 ===== */
function levelClass(level) {
  if (level === '上上' || level === '上吉') return 'good'
  if (level === '中吉' || level === '中平') return 'mid'
  return 'bad'
}

/* ===== 每日一卦 ===== */
const daily = ref(null)
const dailyLoading = ref(false)
const dailyError = ref('')

async function loadDaily() {
  dailyLoading.value = true
  dailyError.value = ''
  try {
    daily.value = await fetchBaguaDaily()
  } catch (e) {
    dailyError.value = '无法连接星语服务器，请稍后再试'
  } finally {
    dailyLoading.value = false
  }
}

/* ===== 铜钱起卦 ===== */
const castResult = ref(null)
const casting = ref(false)
const castError = ref('')
const revealedCount = ref(0)  // 已显现爻数（自下而上：revealedCount >= position 即显现）
const showResult = ref(false)

function lineAt(pos) {
  // linesDetail 按 position 1-6 自下而上排列
  return castResult.value.linesDetail.find((l) => l.position === pos)
}

// 爻签样式：老阳金、老阴朱砂、少阳少阴平常
function labelClass(line) {
  if (!line.changing) return ''
  return line.yang ? 'lao-yang' : 'lao-yin'
}

async function doCast() {
  casting.value = true
  castError.value = ''
  try {
    castResult.value = await castBagua()
    revealedCount.value = 0
    showResult.value = false
    // 逐爻显现：每 220ms 一爻，自初爻（底）至上爻（顶）
    const timer = setInterval(() => {
      revealedCount.value += 1
      if (revealedCount.value >= 6) {
        clearInterval(timer)
        setTimeout(() => { showResult.value = true }, 350)
      }
    }, 220)
  } catch (e) {
    castError.value = '无法连接星语服务器，请稍后再试'
    castResult.value = null
  } finally {
    casting.value = false
  }
}

function resetCast() {
  castResult.value = null
  revealedCount.value = 0
  showResult.value = false
  castError.value = ''
}

/* ===== 六十四卦（首次展开懒加载） ===== */
const archiveOpen = ref(false)
const hexagrams = ref([])
const listLoading = ref(false)
const listError = ref('')
const activeHex = ref(null)

async function toggleArchive() {
  archiveOpen.value = !archiveOpen.value
  if (archiveOpen.value && !hexagrams.value.length && !listLoading.value) {
    listLoading.value = true
    listError.value = ''
    try {
      hexagrams.value = await fetchHexagrams()
    } catch (e) {
      listError.value = '无法连接星语服务器，请稍后再试'
    } finally {
      listLoading.value = false
    }
  }
}

onMounted(loadDaily) // 进入标签页即自动加载每日一卦
</script>

<style scoped>
.bagua-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 每日一卦 ===== */
.daily {
  display: flex;
  gap: 36px;
  padding: 28px 30px;
  transition: opacity 0.25s ease;
}
.daily.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.daily-glyph {
  flex: none;
  display: flex;
  align-items: center;
  padding: 10px 18px;
  border: 1px solid var(--gold-hairline);
  border-radius: 6px;
  background: rgba(35, 32, 72, 0.4);
}
.daily-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.daily-name {
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--gold);
  letter-spacing: 0.14em;
}
.daily-seal-row {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
.trigram-line {
  font-size: 13px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
}

/* 卦运印章（与宜/忌、正逆位同款双线铅印） */
.level-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 40px;
  padding: 0 10px;
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0.1em;
  border: 1px solid currentColor;
  border-radius: 4px;
  box-shadow: inset 0 0 0 3px var(--bg-night), inset 0 0 0 4px currentColor;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.level-seal.good { color: var(--jade); }
.level-seal.mid { color: var(--gold); }
.level-seal.bad { color: var(--cinnabar); }
.level-seal.sm {
  min-width: 48px;
  height: 32px;
  font-size: 14px;
  box-shadow: inset 0 0 0 2px var(--bg-night), inset 0 0 0 3px currentColor;
}

/* 卦辞引文 / 释义 */
.judgment {
  padding: 4px 0 4px 18px;
  border-left: 2px solid var(--gold);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16px;
  line-height: 1.9;
  color: var(--ink);
}
.judgment.sm {
  font-size: 15px;
}
.meaning {
  font-size: 15px;
  line-height: 2;
  color: rgba(232, 230, 240, 0.9);
}
.meaning.sm {
  font-size: 14px;
  line-height: 1.9;
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

/* ===== 铜钱起卦 ===== */
.cast {
  padding: 24px 30px 28px;
}
.cast-entry {
  text-align: center;
  padding: 26px 0 20px;
}
.cast-hint {
  font-size: 14px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
  margin-bottom: 20px;
}
.b-btn {
  padding: 10px 36px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 0.25em;
  text-indent: 0.25em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.b-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.b-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

/* 六爻显现区：自上而下 6..1 排列，未到位的爻占位隐形保持高度 */
.lines-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 300px;
  margin: 18px auto 8px;
}
.line-row {
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  opacity: 0;
  transform: translateY(6px);
}
.line-row.revealed {
  opacity: 1;
  transform: none;
  transition: opacity 0.35s ease, transform 0.35s ease; /* reduced-motion 由全局关停 */
}
.line-bar {
  display: flex;
  justify-content: space-between;
  width: 150px;
  gap: 14%;
}
.line-bar .seg {
  display: block;
  height: 7px;
  width: 100%;
  background: var(--gold);
  border-radius: 1px;
}
.line-bar.yin .seg {
  width: 43%;
}
.line-label {
  width: 96px;
  font-size: 12.5px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}
.line-label.lao-yang { color: var(--gold); }
.line-label.lao-yin { color: var(--cinnabar); }

/* 本卦 / 之卦面板 */
.result-row {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 24px;
  margin-top: 22px;
}
.hex-panel {
  flex: 1;
  max-width: 380px;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 6px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.hp-tag {
  font-size: 12px;
  letter-spacing: 0.24em;
  color: var(--ink-dim2);
}
.hp-name {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.hp-seq {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
}
.arrow {
  align-self: center;
  font-size: 22px;
  color: var(--gold);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.arrow-char {
  display: inline-block;
}
.arrow-label {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
}
.cast-again {
  text-align: center;
  margin-top: 22px;
}

/* ===== 六十四卦 ===== */
.archive {
  padding: 0;
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
.hex-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
}
.grid-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px;
  background: rgba(35, 32, 72, 0.4);
  border: 1px solid rgba(139, 135, 176, 0.14);
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}
.grid-cell:hover {
  border-color: var(--gold-dim);
  transform: translateY(-3px);
}
.cell-seq {
  font-size: 12px;
  color: var(--ink-dim2);
}
.cell-name {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--ink);
}

/* ===== 弹层 ===== */
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
  max-width: 560px;
  width: 100%;
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
.modal-glyph {
  flex: none;
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border: 1px solid var(--gold-hairline);
  border-radius: 6px;
  background: rgba(35, 32, 72, 0.4);
}
.modal-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.m-title {
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--gold);
  letter-spacing: 0.12em;
}
.m-meta {
  font-size: 12.5px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}

/* ===== 状态与错误 ===== */
.b-state {
  width: 100%;
  padding: 40px 0;
  text-align: center;
}
.b-state-icon {
  font-size: 30px;
  color: var(--gold);
  margin-bottom: 12px;
}
.b-state-text {
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
  .daily-panel {
    width: 100%;
  }
  .cast {
    padding: 20px 18px 24px;
  }
  .lines-stage {
    width: 100%;
  }
  .line-bar {
    width: 120px;
  }
  .result-row {
    flex-direction: column; /* 之卦在移动端纵向堆叠 */
    align-items: center;
  }
  .hex-panel {
    width: 100%;
    max-width: none;
  }
  .arrow-char {
    transform: rotate(90deg); /* 纵向时箭头向下（仅字符旋转，文字保持正向） */
  }
  .hex-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .modal {
    flex-direction: column;
    align-items: center;
  }
}
</style>
