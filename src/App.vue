<template>
  <div class="page">
    <!-- 背景星空画布 -->
    <StarField />

    <!-- 顶部：眉题 + 词标 + 右侧今日日期 -->
    <header class="header">
      <div class="header-left">
        <p class="eyebrow">EPHEMERIS · 星历</p>
        <h1 class="wordmark">
          <span class="wm-zh">星语</span><span class="wm-en">StarWhisper</span>
        </h1>
      </div>
      <p class="today mono">{{ todayText }}</p>
      <!-- 打卡 / 游客登录（融入头部右侧） -->
      <CheckinButton class="checkin-entry" />
    </header>

    <!-- 视图切换：星运 / 塔罗（纯状态切换，选择持久化到 localStorage） -->
    <nav class="view-tabs" aria-label="视图切换">
      <button
        type="button"
        class="view-tab mono"
        :class="{ active: view === 'fortune' }"
        @click="setView('fortune')"
      >星运 <span class="tab-en">FORTUNE</span></button>
      <button
        type="button"
        class="view-tab mono"
        :class="{ active: view === 'tarot' }"
        @click="setView('tarot')"
      >塔罗 <span class="tab-en">TAROT</span></button>
      <button
        type="button"
        class="view-tab mono"
        :class="{ active: view === 'bagua' }"
        @click="setView('bagua')"
      >八卦 <span class="tab-en">BAGUA</span></button>
      <button
        type="button"
        class="view-tab mono"
        :class="{ active: view === 'match' }"
        @click="setView('match')"
      >配对 <span class="tab-en">MATCH</span></button>
      <button
        type="button"
        class="view-tab mono"
        :class="{ active: view === 'mine' }"
        @click="setView('mine')"
      >我的 <span class="tab-en">MINE</span></button>
    </nav>
    <div class="header-divider"><i></i><span>✦</span><i></i></div>

    <!-- ===== 星运视图（原有内容，保持挂载不卸载） ===== -->
    <div v-show="view === 'fortune'">
      <!-- 后端连不上时的友好错误提示（不白屏） -->
      <div v-if="error" class="glass-card state-card">
        <p class="state-emoji">✧</p>
        <p class="state-text">{{ error }}</p>
        <button class="retry-btn" @click="init">重新连接</button>
      </div>

      <template v-else>
        <!-- 星座星盘：加载完成即渲染，无需任何交互 -->
        <SignWheel v-model="currentSignId" :signs="signs" @change="onSignChange" />

        <!-- 首次加载（还没拿到任何数据）才显示整页加载态 -->
        <div v-if="loading && !fortune" class="glass-card state-card">
          <div class="spinner"></div>
          <p class="state-text">正在聆听星辰的低语…</p>
        </div>

        <!-- 主内容：运势卡片 + 图表。
             切换星座重新拉取时保留旧数据继续渲染（降低透明度 + 角标提示），
             避免内容卸载 → 页面高度塌陷 → 滚动条闪烁 -->
        <main v-else-if="fortune" class="content" :class="{ refreshing: loading }">
          <div v-if="loading" class="refresh-tip">
            <span class="mini-spinner"></span>星辰换算中…
          </div>
          <section class="top-row">
            <FortuneCard :fortune="fortune" :sign="currentSign" class="fortune-col" />
            <RadarChart :fortune="fortune" :sign="currentSign" class="radar-col" />
          </section>
          <TrendChart :week="week" />
        </main>
      </template>
    </div>

    <!-- ===== 塔罗视图（首次进入才挂载，之后常驻保留抽牌状态） ===== -->
    <TarotView v-if="tarotMounted" v-show="view === 'tarot'" />

    <!-- ===== 八卦视图（同塔罗：懒挂载 + 常驻） ===== -->
    <BaguaView v-if="baguaMounted" v-show="view === 'bagua'" />

    <!-- ===== 配对视图（同塔罗：懒挂载 + 常驻） ===== -->
    <MatchView v-if="matchMounted" v-show="view === 'match'" />

    <!-- ===== 我的视图（同塔罗：懒挂载 + 常驻） ===== -->
    <MineView v-if="mineMounted" v-show="view === 'mine'" />

    <footer class="footer mono">星语 STARWHISPER · 仅供娱乐 · 愿你被星辰温柔以待</footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import StarField from './components/StarField.vue'
import SignWheel from './components/SignWheel.vue'
import FortuneCard from './components/FortuneCard.vue'
import RadarChart from './components/RadarChart.vue'
import TrendChart from './components/TrendChart.vue'
import TarotView from './views/TarotView.vue'
import BaguaView from './views/BaguaView.vue'
import MatchView from './views/MatchView.vue'
import MineView from './views/MineView.vue'
import CheckinButton from './components/CheckinButton.vue'
import { fetchSigns, fetchTodayFortune, fetchWeekFortune } from './api'

/* ===== 视图切换：星运 / 塔罗 / 八卦 / 配对 / 我的（localStorage 持久化） ===== */
const VALID_VIEWS = ['fortune', 'tarot', 'bagua', 'match', 'mine']
const savedView = localStorage.getItem('starwhisper:view')
const view = ref(VALID_VIEWS.includes(savedView) ? savedView : 'fortune')
// 塔罗/八卦/配对/我的视图首次进入才挂载（onMounted 自动拉内容），之后常驻保留状态
const tarotMounted = ref(view.value === 'tarot')
const baguaMounted = ref(view.value === 'bagua')
const matchMounted = ref(view.value === 'match')
const mineMounted = ref(view.value === 'mine')
function setView(v) {
  view.value = v
  localStorage.setItem('starwhisper:view', v)
  if (v === 'tarot') tarotMounted.value = true
  if (v === 'bagua') baguaMounted.value = true
  if (v === 'match') matchMounted.value = true
  if (v === 'mine') mineMounted.value = true
}

const signs = ref([])          // 12 星座列表
const currentSignId = ref(null) // 当前选中星座 id
const fortune = ref(null)       // 今日运势
const week = ref([])            // 近 7 天运势
const loading = ref(false)
const error = ref('')

const currentSign = computed(() => signs.value.find((s) => s.id === currentSignId.value) || null)

// 今日日期展示：等宽格式 2026-09-24 · 星期四
const todayText = computed(() => {
  const d = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} · 星期${weekNames[d.getDay()]}`
})

// 判断 (month, day) 是否落在星座区间内；注意摩羯座跨年（12/22 - 1/19）
function inRange(sign, month, day) {
  const { startMonth: sm, startDay: sd, endMonth: em, endDay: ed } = sign
  if (sm === em) {
    // 同月内（理论上不存在，兜底）
    return month === sm && day >= sd && day <= ed
  }
  if (sm > em) {
    // 跨年区间：要么在起始月的后半段，要么在结束月的前半段
    return (month === sm && day >= sd) || (month === em && day <= ed)
  }
  // 普通相邻两个月
  return (month === sm && day >= sd) || (month === em && day <= ed)
}

// 根据今天日期找出"今天的星座"，作为默认选中
function findTodaySign(list) {
  const now = new Date()
  const hit = list.find((s) => inRange(s, now.getMonth() + 1, now.getDate()))
  return hit || list[0]
}

// 并行拉取今日运势 + 近 7 天运势
async function loadFortune(sign) {
  loading.value = true
  error.value = ''
  try {
    const [today, weekData] = await Promise.all([
      fetchTodayFortune(sign.nameEn),
      fetchWeekFortune(sign.nameEn)
    ])
    fortune.value = today
    week.value = weekData
  } catch (e) {
    error.value = '无法连接星语服务器，请稍后再试'
    fortune.value = null
    week.value = []
  } finally {
    loading.value = false
  }
}

// 切换星座：重新拉取运势
function onSignChange(sign) {
  loadFortune(sign)
}

// 初始化：拉星座列表 → 默认选中今日星座 → 拉运势
async function init() {
  error.value = ''
  loading.value = true
  try {
    const list = await fetchSigns()
    signs.value = list
    const todaySign = findTodaySign(list)
    currentSignId.value = todaySign.id
    await loadFortune(todaySign)
  } catch (e) {
    error.value = '无法连接星语服务器，请稍后再试'
    loading.value = false
  }
}

onMounted(init)
</script>

<style scoped>
.page {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 36px 24px 48px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 头部：左侧眉题+词标，右侧等宽日期 */
.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.header-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wordmark {
  display: flex;
  align-items: baseline;
  gap: 14px;
  font-weight: 400;
}
.wm-zh {
  font-family: var(--font-display);
  font-size: 42px;
  letter-spacing: 0.22em;
  color: var(--gold);
  text-shadow: 0 0 26px rgba(232, 196, 124, 0.3);
}
.wm-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 24px;
  color: var(--ink-dim);
}
.today {
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
  padding-bottom: 8px;
}
.checkin-entry {
  align-self: flex-end;
  padding-bottom: 2px;
}

/* 视图切换标签：等宽小 caps，激活时金色下划线 */
.view-tabs {
  display: flex;
  gap: 28px;
  margin: 4px 0 14px;
}
.view-tab {
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  padding: 6px 2px 9px;
  font-size: 13px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s;
}
.tab-en {
  font-size: 12px;
  margin-left: 5px;
}
.view-tab:hover {
  color: var(--ink);
}
.view-tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

/* 头部下方 ✦ 饰线 */
.header-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  color: var(--gold-dim);
  font-size: 12px;
}
.header-divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* 主内容区 */
.content {
  position: relative; /* 供 refresh-tip 角标定位 */
  display: flex;
  flex-direction: column;
  gap: 22px;
  transition: opacity 0.25s ease;
}
/* 切换星座刷新中：旧内容保留原位，仅变淡并禁用点击，页面高度不变 */
.content.refreshing {
  opacity: 0.55;
  pointer-events: none;
}

/* 刷新提示角标：吸附在主内容右上角，不占文档流、不影响高度 */
.refresh-tip {
  position: absolute;
  top: -32px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: 0.16em;
  color: var(--gold);
}
.mini-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(232, 196, 124, 0.25);
  border-top-color: var(--gold);
  animation: spin 0.9s linear infinite;
}
.top-row {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 22px;
  align-items: stretch;
}

/* 加载 / 错误状态卡片 */
.state-card {
  margin: 40px auto 0;
  padding: 44px 60px;
  text-align: center;
  max-width: 520px;
}
.state-emoji {
  font-size: 40px;
  margin-bottom: 14px;
}
.state-text {
  margin-top: 16px;
  font-size: 15px;
  letter-spacing: 0.15em;
  line-height: 1.9;
  color: var(--ink);
}
.retry-btn {
  margin-top: 20px;
  padding: 10px 32px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.retry-btn:hover {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}

.footer {
  margin-top: auto;
  padding-top: 44px;
  text-align: center;
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
}

@media (max-width: 900px) {
  .top-row {
    grid-template-columns: 1fr; /* 窄屏上下堆叠 */
  }
}

@media (max-width: 640px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .eyebrow {
    white-space: nowrap; /* 眉题不折行 */
  }
  .wm-zh {
    font-size: 34px;
  }
  .wm-en {
    font-size: 19px;
  }
  .today {
    padding-bottom: 0;
  }
  /* 5 个 tab 在窄屏折行，避免「我的」被挤出视口 */
  .view-tabs {
    flex-wrap: wrap;
    gap: 14px 22px;
  }
}
</style>
