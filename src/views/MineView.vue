<template>
  <div class="mine-view">
    <!-- ===== 未登录：占位头像 + 昵称登录卡 ===== -->
    <section v-if="!loggedIn" class="glass-card login-card">
      <div class="avatar-lg" aria-hidden="true"><span>✦</span></div>
      <h3 class="login-title">留一个昵称，开始你的星语旅程</h3>
      <p class="eyebrow mono">GUEST LOGIN · 游客通道</p>
      <input
        v-model="nickname"
        class="login-input"
        type="text"
        maxlength="20"
        placeholder="星语旅人"
        @keyup.enter="login"
      />
      <p v-if="error" class="error-line">{{ error }}</p>
      <button type="button" class="gold-btn" :disabled="busy" @click="login">
        {{ busy ? '星尘登记中…' : '游客登录' }}
      </button>
    </section>

    <template v-else>
      <!-- ===== 用户信息卡 ===== -->
      <section class="glass-card user-card">
        <div class="avatar" aria-hidden="true">
          <img v-if="me.avatarUrl" :src="me.avatarUrl" alt="头像" />
          <span v-else>{{ avatarChar }}</span>
        </div>
        <div class="user-info">
          <h3 class="user-name">{{ me.nickname }}</h3>
          <p class="user-meta mono">注册至今 {{ daysSince }} 天 · NO.{{ String(me.id).padStart(4, '0') }}</p>
          <div class="stat-chips">
            <span class="stat-chip mono">历史 {{ me.historyCount ?? 0 }}</span>
            <span class="stat-chip mono">塔罗 {{ me.tarotCount ?? 0 }}</span>
            <span class="stat-chip mono">起卦 {{ me.baguaCount ?? 0 }}</span>
          </div>
        </div>
      </section>

      <!-- ===== 打卡卡 ===== -->
      <section class="glass-card checkin-card">
        <div class="ck-head">
          <h3 class="sec-title">打卡 <span class="sec-title-en mono">CHECK-IN</span></h3>
          <p v-if="checkin" class="ck-summary">
            连续 <em class="mono">{{ checkin.streak }}</em> 天 ✦ 共 <em class="mono">{{ checkin.totalDays }}</em> 天
          </p>
        </div>

        <!-- 最近 14 天点阵：金色发光=已打卡，暗点=未打，今天描金边 -->
        <div class="dot-row" role="img" aria-label="最近 14 天打卡点阵">
          <div
            v-for="d in dotDays"
            :key="d.date"
            class="dot-cell"
          >
            <span class="dot" :class="{ on: d.done, today: d.isToday }"></span>
            <span class="dot-label mono">{{ d.label }}</span>
          </div>
        </div>

        <div class="ck-actions">
          <button
            type="button"
            class="gold-btn"
            :disabled="busy || (checkin && checkin.todayDone)"
            @click="doCheckin"
          >
            {{ checkin && checkin.todayDone ? '今日已打卡 ✦' : busy ? '打卡中…' : '今日打卡' }}
          </button>
        </div>
        <p v-if="ckError" class="error-line ck-err">{{ ckError }}</p>
      </section>

      <!-- ===== 历史记录 ===== -->
      <section class="glass-card history-card">
        <h3 class="sec-title">历史记录 <span class="sec-title-en mono">HISTORY</span></h3>

        <div class="hist-tabs mono" role="tablist">
          <button
            v-for="t in histTabs"
            :key="t.key"
            type="button"
            :class="{ active: histType === t.key }"
            @click="setHistType(t.key)"
          >{{ t.zh }}</button>
        </div>

        <div v-if="histLoading" class="h-state"><div class="spinner"></div></div>
        <p v-else-if="!history.length" class="h-empty">暂无记录，去抽一张牌或起一卦吧</p>

        <ul v-else class="hist-list">
          <li v-for="item in history" :key="item.id" class="hist-item">
            <button type="button" class="hist-head" @click="toggleExpand(item.id)">
              <span class="hist-type mono" :class="item.type.toLowerCase()">{{ typeLabel(item.type) }}</span>
              <span class="hist-title">{{ polishTitle(item.title) }}</span>
              <span class="hist-time mono">{{ formatTime(item.createdAt) }}</span>
              <span class="hist-toggle mono">{{ expandedId === item.id ? '−' : '+' }}</span>
            </button>
            <!-- 结构化详情行：label 行（牌位/本卦/指数…）+ cont 续行（释义/点评） -->
            <div v-if="expandedId === item.id" class="hist-detail">
              <p v-for="(ln, i) in detailLines(item)" :key="i" class="hd-line" :class="{ cont: ln.cont }">
                <span v-if="ln.label" class="hd-label mono">{{ ln.label }}</span>
                <span class="hd-text">{{ ln.text }}</span>
              </p>
            </div>
          </li>
        </ul>
      </section>

      <!-- ===== 连续打卡横幅 + 勋章墙（汇总接口失败整块隐藏，与小程序一致） ===== -->
      <section v-if="summary" class="glass-card streak-card">
        <div class="streak-banner">
          <span class="streak-flame" aria-hidden="true">🔥</span>
          <div class="streak-main">
            <p class="streak-num"><em class="mono">{{ summary.currentStreak }}</em> 天连续打卡</p>
            <p class="streak-sub mono">最长纪录 {{ summary.maxStreak }} 天 · 累计 {{ summary.totalDays }} 天</p>
          </div>
          <span v-if="summary.todayChecked" class="streak-today mono">今日已打卡 ✓</span>
        </div>
        <template v-if="badges.length">
          <div class="mini-divider"><i></i><span>✦</span><i></i></div>
          <div class="badge-wall">
            <div v-for="b in badges" :key="b.code" class="badge" :class="{ unlocked: b.unlocked }">
              <span class="badge-star">{{ b.unlocked ? '★' : '☆' }}</span>
              <span class="badge-name">{{ b.name }}</span>
              <span class="badge-desc">{{ b.unlocked ? b.desc : b.progressText + ' · ' + b.desc }}</span>
            </div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getToken, setToken, devLogin, postCheckin, fetchCheckinStatus, fetchCheckinSummary,
  fetchMe, fetchHistory
} from '../api'

/* ===== 登录状态 ===== */
const hasToken = ref(!!getToken())
const me = ref(null)           // /api/user/me
const nickname = ref('')
const busy = ref(false)
const error = ref('')

const loggedIn = computed(() => hasToken.value && !!me.value)
const avatarChar = computed(() => (me.value && me.value.nickname ? me.value.nickname[0] : '✦'))
const daysSince = computed(() => {
  if (!me.value || !me.value.createdAt) return 1
  const created = new Date(me.value.createdAt)
  const diff = Date.now() - created.getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
})

// 401 时 api 层已清 token，这里同步回未登录态
function onUnauthorized() {
  hasToken.value = false
  me.value = null
  checkin.value = null
  summary.value = null
  history.value = []
}

/* ===== 游客登录（与 CheckinButton 同一套 dev 通道） ===== */
async function login() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    let d
    try {
      d = await devLogin(nickname.value.trim() || '星语旅人')
    } catch (e) {
      // dev 通道后端已关闭（auth/dev 固定 500）：给用户能看懂的提示
      error.value = '登录服务暂未开放，敬请期待'
      return
    }
    setToken(d.token)
    hasToken.value = true
    await loadAll()
  } catch (e) {
    if (e.code === 401) onUnauthorized()
    else error.value = '无法连接星语服务器，请稍后再试'
  } finally {
    busy.value = false // 所有路径经 finally 复位，杜绝一直转圈
  }
}

/* ===== 打卡卡 ===== */
const checkin = ref(null)
const ckError = ref('') // 打卡失败提示（非 401 场景不吞错）

// 最近 14 天点阵（旧 → 新，今天在最右）
const dotDays = computed(() => {
  const done = new Set(checkin.value ? checkin.value.recentDates : [])
  const out = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({
      date: key,
      done: done.has(key),
      isToday: i === 0,
      label: `${d.getMonth() + 1}/${d.getDate()}`
    })
  }
  return out
})

async function doCheckin() {
  busy.value = true
  ckError.value = ''
  try {
    checkin.value = await postCheckin() // 幂等：已打则返回既有状态
    loadSummary() // 打卡后刷新连续纪录与勋章（后台异步，不阻塞）
  } catch (e) {
    if (e.code === 401) onUnauthorized()
    else ckError.value = '打卡失败，请稍后再试' // 非 401 失败明确提示，不无声复位
  } finally {
    busy.value = false
  }
}

/* ===== 连续打卡横幅 + 勋章墙（/checkin/summary；失败静默隐藏，与小程序一致） ===== */
const summary = ref(null)

// 勋章进度：连续类用 currentStreak，累计类（total*）用 totalDays
const badges = computed(() => {
  const s = summary.value
  if (!s) return []
  return (s.badges || []).map((b) => {
    const cur = b.code.startsWith('total') ? s.totalDays : s.currentStreak
    return { ...b, progressText: b.unlocked ? '' : `${Math.min(cur || 0, b.threshold)}/${b.threshold}` }
  })
})

async function loadSummary() {
  try {
    summary.value = await fetchCheckinSummary(me.value ? me.value.id : undefined)
  } catch (e) {
    summary.value = null // 静默兜底：整块隐藏，不打扰用户
  }
}

/* ===== 历史记录 ===== */
const histTabs = [
  { key: '', zh: '全部' },
  { key: 'TAROT', zh: '塔罗' },
  { key: 'BAGUA', zh: '起卦' },
  { key: 'MATCH', zh: '配对' }
]
const histType = ref('')
const history = ref([])
const histLoading = ref(false)
const expandedId = ref(null)

function typeLabel(t) {
  return { TAROT: '塔罗', BAGUA: '起卦', MATCH: '配对' }[t] || t
}

function formatTime(s) {
  if (!s) return ''
  // 后端 LocalDateTime 序列化为 2026-09-25T17:04:37，截到分钟
  return String(s).replace('T', ' ').slice(0, 16)
}

// 标题展示层润色：配对原标题「星座配对 · 天秤座 × 狮子座 · 90分」太长会折行，
// 重排为「天秤座 × 狮子座 · 契合度 90」；其他类型原样保留（CSS 保证单行省略）
function polishTitle(title) {
  const t = String(title || '')
  const m = t.match(/^星座配对 · (.+?) × (.+?)(?: · (\d+)\s*分)?$/)
  if (m) return m[3] ? `${m[1]} × ${m[2]} · 契合度 ${m[3]}` : `${m[1]} × ${m[2]}`
  return t
}

// detail JSON 安全解析：失败 / 非对象都返回 null
function safeParse(detail) {
  try {
    const d = typeof detail === 'string' ? JSON.parse(detail) : detail
    return d && typeof d === 'object' ? d : null
  } catch (e) {
    return null
  }
}

// detail → 结构化行 [{label, text, cont}]，按类型分派；解析失败兜底「暂无详情」，绝不糊原始 JSON
function detailLines(item) {
  const d = safeParse(item.detail)
  if (item.type === 'TAROT') return tarotLines(d)
  if (item.type === 'BAGUA') return baguaLines(d)
  if (item.type === 'MATCH') return matchLines(d)
  return [{ text: item.title || '暂无详情' }]
}

// 塔罗：detail 是 DrawResultVO JSON {spreadName, cards:[...]}（旧数据可能是裸数组）
// → 每张牌：牌位行（牌名 · 正逆位 · 关键词）+ 牌位释义 / 解读续行
function tarotLines(d) {
  const cards = d && (Array.isArray(d) ? d : d.cards)
  if (!Array.isArray(cards) || !cards.length) return [{ text: '暂无详情' }]
  const lines = []
  cards.forEach((dc, i) => {
    const name = (dc.card && dc.card.name) || '未知牌'
    const ori = dc.orientation === 'reversed' ? '逆位' : '正位'
    const label = dc.position || (cards.length > 1 ? `第 ${i + 1} 张` : '牌面')
    lines.push({ label, text: `${name} · ${ori}${dc.keywords ? ' · ' + dc.keywords : ''}` })
    if (dc.positionDesc) lines.push({ cont: true, text: dc.positionDesc })
    if (dc.meaning) lines.push({ cont: true, text: dc.meaning })
  })
  return lines
}

// 起卦：detail 是 CastVO JSON {primary, changed, linesDetail}
// → 本卦 / 卦辞 / 象曰 / 变卦 / 变卦卦辞 / 动爻
function baguaLines(c) {
  if (!c || !c.primary) return [{ text: '暂无详情' }]
  const p = c.primary
  const hexLine = (h) =>
    [h.symbol, h.name].filter(Boolean).join(' ') + (h.fortuneLevel ? ` · ${h.fortuneLevel}` : '')
  const lines = [{ label: '本卦', text: hexLine(p) }]
  if (p.judgment) lines.push({ label: '卦辞', text: p.judgment })
  if (p.meaning) lines.push({ label: '象曰', text: p.meaning })
  if (c.changed && c.changed.name && c.changed.name !== p.name) {
    lines.push({ label: '变卦', text: hexLine(c.changed) })
    if (c.changed.judgment) lines.push({ label: '变卦卦辞', text: c.changed.judgment })
  }
  const moving = (c.linesDetail || []).filter((l) => l.changing).map((l) => l.position)
  if (moving.length) lines.push({ label: '动爻', text: `第 ${moving.join('、')} 爻` })
  return lines
}

// 配对：detail 是 MatchVO JSON → 指数 / 点评 / 建议
function matchLines(m) {
  if (!m) return [{ text: '暂无详情' }]
  const lines = []
  const s = m.scores || {}
  const scoreParts = [
    ['综合', s.overall], ['爱情', s.love], ['友情', s.friendship], ['婚姻', s.marriage]
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`)
  if (scoreParts.length) lines.push({ label: '指数', text: scoreParts.join(' · ') })
  if (m.review) lines.push({ label: '点评', text: m.review })
  if (m.suggest) lines.push({ label: '建议', text: m.suggest })
  return lines.length ? lines : [{ text: '暂无详情' }]
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

async function loadHistory() {
  histLoading.value = true
  try {
    history.value = await fetchHistory(histType.value || undefined)
    expandedId.value = null
  } catch (e) {
    if (e.code === 401) onUnauthorized()
  } finally {
    histLoading.value = false
  }
}

function setHistType(t) {
  if (histType.value === t) return
  histType.value = t
  loadHistory()
}

/* ===== 初始化：有 token 则并行拉取 用户/打卡/历史/打卡汇总 ===== */
async function loadAll() {
  try {
    const [meData, ckData] = await Promise.all([fetchMe(), fetchCheckinStatus()])
    me.value = meData
    checkin.value = ckData
    await Promise.all([loadHistory(), loadSummary()])
  } catch (e) {
    if (e.code === 401) onUnauthorized()
  }
}

onMounted(() => {
  if (hasToken.value) loadAll()
})
</script>

<style scoped>
.mine-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 登录卡 ===== */
.login-card {
  max-width: 420px;
  margin: 40px auto 0;
  width: 100%;
  padding: 40px 36px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.avatar-lg {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 1px solid var(--gold-hairline);
  background: rgba(232, 196, 124, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: var(--gold);
  text-shadow: 0 0 18px rgba(232, 196, 124, 0.4);
}
.login-title {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.login-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.5);
  color: var(--ink);
  font-size: 14px;
  letter-spacing: 0.06em;
  font-family: var(--font-body);
  text-align: center;
}
.login-input::placeholder {
  color: var(--ink-dim);
}
.login-input:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 0;
  border-color: var(--gold);
}

/* ===== 通用金边按钮 ===== */
.gold-btn {
  padding: 10px 34px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.gold-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.gold-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.error-line {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--cinnabar);
}

/* ===== 用户信息卡 ===== */
.user-card {
  padding: 24px 30px;
  display: flex;
  align-items: center;
  gap: 22px;
}
.avatar {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid var(--gold-hairline);
  background: rgba(232, 196, 124, 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--gold);
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.user-name {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: 0.12em;
  color: var(--gold);
}
.user-meta {
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
}
.stat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.stat-chip {
  font-size: 12.5px;
  letter-spacing: 0.1em;
  color: var(--ink-dim2);
  border: 1px solid rgba(139, 135, 176, 0.2);
  border-radius: 3px;
  padding: 3px 10px;
}

/* ===== 小节标题（与塔罗页同款） ===== */
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

/* ===== 打卡卡 ===== */
.checkin-card {
  padding: 24px 30px 26px;
}
.ck-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ck-summary {
  font-size: 14px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.ck-summary em {
  font-style: normal;
  color: var(--gold);
  font-size: 18px;
  padding: 0 2px;
}
.dot-row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 0 6px;
}
.dot-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(139, 135, 176, 0.22);
  transition: background 0.3s, box-shadow 0.3s;
}
.dot.on {
  background: var(--gold);
  box-shadow: 0 0 10px rgba(232, 196, 124, 0.55);
}
.dot.today {
  box-shadow: 0 0 0 2px var(--bg-night), 0 0 0 3px var(--gold-dim);
}
.dot.on.today {
  box-shadow: 0 0 0 2px var(--bg-night), 0 0 0 3px var(--gold), 0 0 12px rgba(232, 196, 124, 0.6);
}
.dot-label {
  font-size: 12px;
  letter-spacing: 0;
  color: var(--ink-dim);
}
.ck-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.ck-err {
  text-align: right;
  margin-top: 10px;
}

/* ===== 历史记录 ===== */
.history-card {
  padding: 24px 30px 26px;
}
.hist-tabs {
  display: inline-flex;
  margin: 16px 0 18px;
  border: 1px solid rgba(139, 135, 176, 0.25);
  border-radius: 4px;
  overflow: hidden;
}
.hist-tabs button {
  background: none;
  border: none;
  padding: 7px 22px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--ink-dim);
  cursor: pointer;
  transition: background 0.25s, color 0.25s;
}
.hist-tabs button + button {
  border-left: 1px solid rgba(139, 135, 176, 0.25);
}
.hist-tabs button.active {
  background: rgba(232, 196, 124, 0.12);
  color: var(--gold);
}
.h-state {
  padding: 30px 0;
  text-align: center;
}
.h-empty {
  padding: 26px 0 20px;
  text-align: center;
  font-size: 14px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}
.hist-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hist-item {
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 6px;
  overflow: hidden;
}
.hist-head {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}
.hist-head:hover {
  background: rgba(232, 196, 124, 0.04);
}
.hist-type {
  flex: none;
  font-size: 12px;
  letter-spacing: 0.14em;
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  padding: 2px 8px;
  color: var(--gold);
}
.hist-type.bagua {
  color: var(--jade);
  border-color: rgba(127, 191, 158, 0.3);
}
.hist-type.match {
  color: var(--cinnabar);
  border-color: rgba(194, 94, 94, 0.35);
}
.hist-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hist-time {
  flex: none;
  font-size: 12.5px;
  color: var(--ink-dim2);
}
.hist-toggle {
  flex: none;
  font-size: 13px;
  color: var(--gold);
}
.hist-detail {
  margin: 0 16px 14px;
  padding: 10px 0 0;
  border-top: 1px solid rgba(139, 135, 176, 0.12);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hd-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.9;
  color: rgba(232, 230, 240, 0.88);
}
.hd-line.cont {
  padding-left: 74px; /* 与 label 行正文对齐的续行（释义/点评） */
  font-size: 13px;
  color: var(--ink-dim2);
}
.hd-label {
  flex: none;
  width: 64px;
  font-size: 11.5px;
  letter-spacing: 0.14em;
  color: var(--gold-dim);
  text-align: right;
}

/* ===== 连续打卡横幅 + 勋章墙 ===== */
.streak-card {
  padding: 22px 30px 26px;
}
.streak-banner {
  display: flex;
  align-items: center;
  gap: 18px;
}
.streak-flame {
  font-size: 34px;
  filter: drop-shadow(0 0 10px rgba(232, 150, 80, 0.5));
}
.streak-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.streak-num {
  font-size: 15px;
  letter-spacing: 0.1em;
  color: var(--ink);
}
.streak-num em {
  font-style: normal;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--gold);
  text-shadow: 0 0 18px rgba(232, 196, 124, 0.45);
  margin-right: 4px;
}
.streak-sub {
  font-size: 12.5px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
}
.streak-today {
  flex: none;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--jade);
  border: 1px solid rgba(127, 191, 158, 0.4);
  border-radius: 4px;
  padding: 6px 12px;
}
.mini-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 16px;
  color: var(--gold-dim);
  font-size: 11px;
}
.mini-divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}
.badge-wall {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 14px 8px 12px;
  border: 1px solid rgba(139, 135, 176, 0.16);
  border-radius: 6px;
  text-align: center;
  opacity: 0.55; /* 未解锁灰显 */
}
.badge.unlocked {
  opacity: 1;
  border-color: var(--gold-hairline);
  background: rgba(232, 196, 124, 0.05);
}
.badge-star {
  font-size: 22px;
  color: var(--ink-dim2);
}
.badge.unlocked .badge-star {
  color: var(--gold);
  text-shadow: 0 0 14px rgba(232, 196, 124, 0.6);
}
.badge-name {
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--ink);
}
.badge-desc {
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--ink-dim2);
  line-height: 1.6;
}

@media (max-width: 640px) {
  .user-card {
    padding: 20px 18px;
    gap: 16px;
  }
  .checkin-card,
  .history-card,
  .streak-card {
    padding: 20px 18px 22px;
  }
  .hd-line.cont {
    padding-left: 0; /* 窄屏续行不缩进，避免挤占宽度 */
  }
  .streak-banner {
    flex-wrap: wrap;
  }
  .dot-label {
    display: none; /* 窄屏只留点阵 */
  }
  .hist-time {
    display: none;
  }
}
</style>
