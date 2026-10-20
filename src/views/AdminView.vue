<template>
  <div class="admin-view">
    <!-- 头部：词标 + 返回首页 -->
    <header class="a-header">
      <div>
        <p class="eyebrow mono">STARWHISPER · CONSOLE</p>
        <h1 class="a-title">星语后台 <span class="a-title-en">ADMIN</span></h1>
      </div>
      <button type="button" class="a-link mono" @click="goHome">← 返回首页</button>
    </header>
    <div class="header-divider"><i></i><span>✦</span><i></i></div>

    <!-- ===== Key 门禁：未存 key 或 key 被拒绝时展示 ===== -->
    <section v-if="gated" class="glass-card gate">
      <p class="gate-icon">✧</p>
      <p class="gate-text">请输入管理 Key 查看运营数据</p>
      <p v-if="gateError" class="error-line">{{ gateError }}</p>
      <form class="gate-form" @submit.prevent="submitKey">
        <input
          v-model.trim="keyInput"
          class="gate-input mono"
          type="password"
          placeholder="ADMIN KEY"
          autocomplete="off"
        />
        <button type="submit" class="a-btn" :disabled="!keyInput">进入</button>
      </form>
    </section>

    <template v-else>
      <!-- ===== 模块切换：总览 / 用户 / 配置 ===== -->
      <nav class="tab-bar mono">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="tab-btn"
          :class="{ active: tab === t.key }"
          @click="switchTab(t.key)"
        >
          <span class="tab-cn">{{ t.cn }}</span>
          <span class="tab-en">{{ t.en }}</span>
        </button>
      </nav>

      <!-- ============ 模块一：数据总览 ============ -->
      <section v-if="tab === 'overview'" class="tab-panel">
        <div v-if="statsLoading && !stats" class="glass-card a-state"><div class="spinner"></div></div>
        <div v-else-if="statsError && !stats" class="glass-card a-state error-state">
          <p class="error-line">{{ statsError }}</p>
          <button type="button" class="a-btn" @click="loadStats">重试</button>
        </div>
        <template v-else-if="stats">
          <!-- 核心数字卡片：全部来自后端真实查询，无数据即 0 -->
          <section class="stat-grid">
            <div v-for="c in cards" :key="c.key" class="glass-card stat-card">
              <p class="stat-label mono">{{ c.label }}</p>
              <p class="stat-value" :class="{ gold: c.gold }">{{ c.value }}</p>
              <p class="stat-en mono">{{ c.hint || c.en }}</p>
            </div>
          </section>

          <!-- 图表：近 7 天 新增 vs 活跃 双折线 + 牌阵分布横向条形 -->
          <section class="chart-row">
            <div class="glass-card chart-card">
              <h3 class="sec-title">近 7 天 新增 vs 活跃 <span class="sec-title-en mono">NEW vs ACTIVE</span></h3>
              <div ref="lineRef" class="chart"></div>
            </div>
            <div class="glass-card chart-card">
              <h3 class="sec-title">塔罗牌阵分布 <span class="sec-title-en mono">SPREADS</span></h3>
              <div v-if="!(stats.spreadDist || []).length" class="empty-hint mono">暂无塔罗记录</div>
              <div v-else ref="barRef" class="chart"></div>
            </div>
          </section>

          <!-- 今日板块使用：登录用户 vs 游客（2026-10-20 起有埋点） -->
          <section class="glass-card chart-card today-usage">
            <h3 class="sec-title">今日板块使用 <span class="sec-title-en mono">TODAY · USERS vs GUESTS</span>
              <span class="guest-badge mono">活跃游客 {{ stats.todayGuestActive ?? 0 }} IP</span></h3>
            <table class="usage-table">
              <thead>
                <tr><th>板块</th><th>登录用户</th><th>游客</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in stats.todayModuleSplit || []" :key="m.key">
                  <td>{{ m.name }}</td>
                  <td class="mono num">{{ m.user }}</td>
                  <td class="mono num guest">{{ m.guest }}</td>
                </tr>
              </tbody>
            </table>
            <p class="mu-hint">埋点自 2026-10-20 起记录，历史数据不含此前游客行为；游客按 IP 去重</p>
          </section>

          <!-- 板块使用次数（全量累计；星运浏览未埋点显示「未统计」） -->
          <section class="glass-card chart-card module-usage">
            <h3 class="sec-title">板块使用次数 <span class="sec-title-en mono">MODULE USAGE</span></h3>
            <div class="mu-list">
              <div v-for="m in stats.moduleUsage || []" :key="m.key" class="mu-row">
                <span class="mu-name">{{ m.name }}</span>
                <div class="mu-track"><div class="mu-bar" :class="{ none: m.count == null }" :style="{ width: muWidth(m) }"></div></div>
                <span class="mu-count mono">{{ m.count == null ? '未统计' : m.count }}</span>
              </div>
            </div>
            <p class="mu-hint">累计真实行为次数；「星运浏览」未做埋点，显示未统计而非 0</p>
          </section>
        </template>
      </section>

      <!-- ============ 模块二：用户管理 ============ -->
      <section v-else-if="tab === 'users'" class="tab-panel">
        <div class="glass-card users-card">
          <div class="users-toolbar">
            <h3 class="sec-title">用户管理 <span class="sec-title-en mono">USERS · {{ usersTotal }}</span></h3>
            <form class="search-form" @submit.prevent="searchUsers">
              <input
                v-model="keywordInput"
                class="search-input mono"
                type="text"
                placeholder="按昵称搜索"
                autocomplete="off"
              />
              <button type="submit" class="a-btn a-btn-sm">搜索</button>
            </form>
          </div>

          <div v-if="usersLoading" class="a-state"><div class="spinner"></div></div>
          <p v-else-if="usersError" class="error-line pad">{{ usersError }} <button class="a-link mono" @click="loadUsers">重试</button></p>
          <template v-else>
            <table class="users-table">
              <thead>
                <tr class="mono">
                  <th>旅人</th>
                  <th>星座</th>
                  <th>注册时间</th>
                  <th>打卡</th>
                  <th>最近活跃</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="u in usersList" :key="u.id">
                  <tr class="user-row" :class="{ open: expandedId === u.id }" @click="toggleUser(u.id)">
                    <td>
                      <span class="u-identity">
                        <img v-if="u.avatarUrl" :src="u.avatarUrl" class="u-avatar" alt="" loading="lazy" />
                        <span v-else class="u-avatar u-avatar-fallback">✦</span>
                        <span class="u-name">{{ u.nickname || '星语旅人' }}</span>
                      </span>
                    </td>
                    <td class="mono dim">{{ signNameOf(u.signNameEn) }}</td>
                    <td class="mono dim">{{ formatDateTime(u.createdAt) }}</td>
                    <td class="mono">
                      <span class="streak" :class="{ hot: u.currentStreak > 0 }">{{ u.currentStreak }} 连</span>
                      <span class="dim"> · {{ u.totalCheckins }} 天</span>
                    </td>
                    <td class="mono dim">{{ formatDateTime(u.lastActiveAt) }}</td>
                  </tr>
                  <!-- 行内展开详情：打卡汇总 + 最近历史 -->
                  <tr v-if="expandedId === u.id" class="detail-row">
                    <td colspan="5">
                      <div v-if="detailLoading" class="detail-loading"><div class="spinner"></div></div>
                      <div v-else-if="detail" class="detail-grid">
                        <!-- 顶部通栏：打卡汇总横排大数字 + 用户元信息 -->
                        <div class="detail-block checkin-block">
                          <div class="ck-stats">
                            <div class="mini-stat"><b class="gold-text">{{ detail.checkin?.currentStreak ?? 0 }}</b><span>当前连续</span></div>
                            <div class="mini-stat"><b class="gold-text">{{ detail.checkin?.maxStreak ?? 0 }}</b><span>历史最长</span></div>
                            <div class="mini-stat"><b class="gold-text">{{ detail.checkin?.totalDays ?? 0 }}</b><span>累计打卡</span></div>
                            <span v-if="detail.checkin?.todayChecked" class="mono today-badge">今日已打卡</span>
                          </div>
                          <p class="detail-line dim mono" v-if="detail.user">
                            ID {{ detail.user.id }}<template v-if="detail.user.lastLoginAt"> · 最近登录 {{ formatDateTime(detail.user.lastLoginAt) }}</template>
                          </p>
                        </div>
                        <!-- 左：按日使用（提升到第二行，不再被长列表压底） -->
                        <div class="detail-block">
                          <p class="detail-title mono">按日使用 · DAILY USAGE</p>
                          <p class="detail-line">
                            <input type="date" class="usage-date mono" v-model="usageDate" :max="todayStr"
                              @change="loadUsage(u.id)" @click.stop />
                            <span v-if="usageLoading" class="dim"> 查询中…</span>
                          </p>
                          <template v-if="usage && !usageLoading">
                            <div class="usage-chips">
                              <span v-for="m in usage.modules" :key="m.key" class="usage-chip mono"
                                :class="{ zero: m.count === 0, none: m.count == null }">
                                {{ m.name }} {{ m.count == null ? '未统计' : m.count + ' 次' }}
                              </span>
                            </div>
                            <p v-if="!(usage.events || []).length" class="detail-line dim">当日无行为记录</p>
                            <ul v-else class="history-list usage-events">
                              <li v-for="(ev, i) in usage.events" :key="i" class="mono">
                                <span class="h-date dim">{{ ev.time }}</span>
                                <span class="h-type" :data-type="ev.type">{{ historyTypeName(ev.type) }}</span>
                                <span class="h-title">{{ ev.title || '（无摘要）' }}</span>
                              </li>
                            </ul>
                          </template>
                        </div>
                        <!-- 右：最近历史（限高滚动，不再把下方内容顶走） -->
                        <div class="detail-block">
                          <p class="detail-title mono">最近历史 · HISTORY</p>
                          <p v-if="!(detail.histories || []).length" class="detail-line dim">暂无占卜记录</p>
                          <ul v-else class="history-list history-scroll">
                            <li v-for="(h, i) in detail.histories" :key="i" class="mono">
                              <span class="h-type" :data-type="h.type">{{ historyTypeName(h.type) }}</span>
                              <span class="h-title">{{ h.title || '（无摘要）' }}</span>
                              <span class="h-date dim">{{ formatDateTime(h.createdAt) }}</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <p v-else class="detail-line dim">详情加载失败 <button class="a-link mono" @click.stop="toggleUser(u.id, true)">重试</button></p>
                    </td>
                  </tr>
                </template>
                <tr v-if="!usersList.length">
                  <td colspan="5" class="empty-hint mono">没有符合条件的用户</td>
                </tr>
              </tbody>
            </table>

            <!-- 分页 -->
            <div class="pager mono">
              <button type="button" class="pager-btn" :disabled="page <= 0" @click="gotoPage(page - 1)">← 上一页</button>
              <span class="pager-info">{{ page + 1 }} / {{ pageCount }} · 共 {{ usersTotal }} 人</span>
              <button type="button" class="pager-btn" :disabled="page + 1 >= pageCount" @click="gotoPage(page + 1)">下一页 →</button>
            </div>
          </template>
        </div>
      </section>

      <!-- ============ 模块三：参数配置 ============ -->
      <section v-else class="tab-panel">
        <div class="glass-card config-card">
          <h3 class="sec-title">参数配置 <span class="sec-title-en mono">RUNTIME CONFIG</span></h3>
          <p class="config-note mono">改动立即生效，无需重启 · 密钥类配置不在此处，仍走环境变量</p>

          <div v-if="configLoading" class="a-state"><div class="spinner"></div></div>
          <p v-else-if="configError" class="error-line pad">{{ configError }} <button class="a-link mono" @click="loadConfig">重试</button></p>
          <div v-else class="config-list">
            <div v-for="c in configItems" :key="c.key" class="config-row">
              <div class="config-meta">
                <p class="config-key mono">{{ c.key }}</p>
                <p class="config-desc">{{ c.desc }}</p>
                <p class="config-updated mono dim">{{ c.updatedAtText }}</p>
              </div>
              <form class="config-form" @submit.prevent="saveConfig(c)">
                <input
                  v-model.trim="c.input"
                  class="config-input mono"
                  type="number"
                  min="0"
                  step="1"
                  :disabled="c.saving"
                />
                <button type="submit" class="a-btn a-btn-sm" :disabled="c.saving || c.input === c.value || !c.input">
                  {{ c.saving ? '保存中…' : '保存' }}
                </button>
              </form>
              <p v-if="c.feedback" class="config-feedback mono" :class="{ bad: c.feedbackBad }">{{ c.feedback }}</p>
            </div>
            <p v-if="!configItems.length" class="empty-hint mono">暂无可配置项</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'
import {
  fetchAdminStats, fetchAdminUsers, fetchAdminUserDetail, fetchAdminUserDailyUsage,
  fetchAdminConfig, saveAdminConfig
} from '../api'
import {
  buildStatCards, buildUsersQuery, formatConfigItems, formatDateTime,
  historyTypeName, mergeDailySeries, moduleBarWidth, signNameOf, totalPages
} from '../adminLogic'

const KEY_STORE = 'starwhisper:adminkey'
const MONO = '"Space Mono", "Noto Sans SC", monospace'
const PAGE_SIZE = 20

const TABS = [
  { key: 'overview', cn: '总览', en: 'OVERVIEW' },
  { key: 'users', cn: '用户', en: 'USERS' },
  { key: 'config', cn: '配置', en: 'CONFIG' }
]

/* ===== Key 门禁（入口保持原状：localStorage 记忆 + 页面输入） ===== */
const adminKey = ref(localStorage.getItem(KEY_STORE) || '')
const gated = ref(!adminKey.value)
const keyInput = ref('')
const gateError = ref('')

function submitKey() {
  adminKey.value = keyInput.value
  localStorage.setItem(KEY_STORE, adminKey.value)
  gated.value = false
  gateError.value = ''
  loadStats()
}

/** 401/403 统一回门禁；返回 true 表示已处理 */
function handleAuthError(e) {
  if (e && (e.code === 401 || e.status === 401 || e.status === 403)) {
    localStorage.removeItem(KEY_STORE)
    adminKey.value = ''
    gated.value = true
    gateError.value = 'Key 无效，请重新输入'
    return true
  }
  return false
}

/* ===== 模块切换（懒加载：切到哪个 tab 才拉哪个接口） ===== */
const tab = ref('overview')

function switchTab(key) {
  tab.value = key
  if (key === 'overview') {
    if (!stats.value && !statsLoading.value) loadStats()
    else nextTick(renderCharts) // 从隐藏态切回时重绘
  } else if (key === 'users') {
    if (!usersLoaded.value) loadUsers()
  } else if (key === 'config') {
    if (!configLoaded.value) loadConfig()
  }
}

/* ===== 模块一：数据总览 ===== */
const stats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await fetchAdminStats(adminKey.value)
  } catch (e) {
    if (handleAuthError(e)) return
    statsError.value = e.message || '统计接口暂不可用'
  } finally {
    statsLoading.value = false
  }
  await nextTick()
  renderCharts()
}

const cards = computed(() => buildStatCards(stats.value))
// 板块使用条宽度（按列表最大值归一化）
const muWidth = (m) => moduleBarWidth(m.count, stats.value?.moduleUsage || [])

/* ===== ECharts ===== */
const lineRef = ref(null)
const barRef = ref(null)
let lineChart = null
let barChart = null

const AXIS = {
  axisLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
  axisTick: { show: false },
  axisLabel: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 }
}
const TIP = {
  trigger: 'axis',
  backgroundColor: 'rgba(16, 22, 58, 0.92)',
  borderColor: 'rgba(232, 196, 124, 0.25)',
  textStyle: { color: '#E8E6F0', fontFamily: MONO, fontSize: 12.5 }
}
const SPREAD_NAMES = {
  single: '单牌指引', three: '时间之流', choice: '二选一',
  love: '爱情十字', celtic: '凯尔特十字', hexagram: '六芒星'
}

function renderCharts() {
  const s = stats.value
  if (!s || tab.value !== 'overview') return

  if (lineRef.value) {
    const merged = mergeDailySeries(s.dailyNewUsers, s.dailyActive)
    lineChart = lineChart || echarts.init(lineRef.value)
    lineChart.setOption({
      tooltip: TIP,
      legend: {
        data: ['新增用户', '活跃用户'],
        textStyle: { color: '#A9A4CC', fontFamily: MONO, fontSize: 12 },
        inactiveColor: 'rgba(139, 135, 176, 0.3)',
        itemWidth: 16, itemHeight: 1, icon: 'rect', top: 0
      },
      grid: { left: 40, right: 18, top: 34, bottom: 30 },
      xAxis: { type: 'category', data: merged.labels, ...AXIS },
      yAxis: {
        type: 'value', minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
        ...AXIS
      },
      series: [
        {
          name: '新增用户', type: 'line', smooth: true,
          symbol: 'circle', symbolSize: 5,
          data: merged.newUsers,
          lineStyle: { color: '#E8C47C', width: 1.5 },
          itemStyle: { color: '#E8C47C' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(232, 196, 124, 0.22)' },
                { offset: 1, color: 'rgba(232, 196, 124, 0)' }
              ]
            }
          }
        },
        {
          name: '活跃用户', type: 'line', smooth: true,
          symbol: 'circle', symbolSize: 5,
          data: merged.active,
          lineStyle: { color: '#7FBF9E', width: 1.5 },
          itemStyle: { color: '#7FBF9E' }
        }
      ]
    })
  }

  const dist = (s.spreadDist || [])
  if (barRef.value && dist.length) {
    barChart = barChart || echarts.init(barRef.value)
    barChart.setOption({
      tooltip: { ...TIP, trigger: 'item' },
      grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
      xAxis: {
        type: 'value', minInterval: 1,
        splitLine: { lineStyle: { color: 'rgba(139, 135, 176, 0.15)' } },
        ...AXIS
      },
      yAxis: {
        type: 'category', inverse: true,
        data: dist.map((d) => SPREAD_NAMES[d.spread] || d.spread),
        ...AXIS
      },
      series: [{
        name: '牌阵分布', type: 'bar', barWidth: 14,
        data: dist.map((d) => d.count),
        label: {
          show: true, position: 'right',
          color: '#E8C47C', fontFamily: MONO, fontSize: 12
        },
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(232, 196, 124, 0.35)' },
              { offset: 1, color: '#E8C47C' }
            ]
          }
        }
      }]
    })
  }
}

function handleResize() {
  lineChart && lineChart.resize()
  barChart && barChart.resize()
}
window.addEventListener('resize', handleResize)

/* ===== 模块二：用户管理 ===== */
const usersList = ref([])
const usersTotal = ref(0)
const page = ref(0)
const keywordInput = ref('')
const keyword = ref('') // 已生效的搜索词（输入框内容未必已提交）
const usersLoaded = ref(false)
const usersLoading = ref(false)
const usersError = ref('')

const pageCount = computed(() => totalPages(usersTotal.value, PAGE_SIZE))

async function loadUsers() {
  usersLoading.value = true
  usersError.value = ''
  try {
    const data = await fetchAdminUsers(adminKey.value, buildUsersQuery(page.value, PAGE_SIZE, keyword.value))
    usersList.value = data.list || []
    usersTotal.value = data.total || 0
    page.value = data.page ?? page.value
    usersLoaded.value = true
  } catch (e) {
    if (handleAuthError(e)) return
    usersError.value = e.message || '用户列表加载失败'
  } finally {
    usersLoading.value = false
  }
}

function searchUsers() {
  keyword.value = keywordInput.value
  page.value = 0
  expandedId.value = null
  loadUsers()
}

function gotoPage(p) {
  page.value = p
  expandedId.value = null
  loadUsers()
}

/* 行展开详情 */
const expandedId = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

/* 按日使用明细（跟随展开的用户） */
const todayStr = new Date().toISOString().slice(0, 10)
const usageDate = ref(todayStr)
const usage = ref(null)
const usageLoading = ref(false)

async function loadUsage(userId) {
  if (!userId) return
  usageLoading.value = true
  try {
    usage.value = await fetchAdminUserDailyUsage(adminKey.value, userId, usageDate.value)
  } catch (e) {
    if (handleAuthError(e)) return
    usage.value = null
  } finally {
    usageLoading.value = false
  }
}

async function toggleUser(id, force) {
  if (expandedId.value === id && !force) {
    expandedId.value = null
    detail.value = null
    usage.value = null
    return
  }
  expandedId.value = id
  detail.value = null
  usage.value = null
  usageDate.value = todayStr // 每次展开默认看今天
  detailLoading.value = true
  try {
    detail.value = await fetchAdminUserDetail(adminKey.value, id)
  } catch (e) {
    if (handleAuthError(e)) return
    detail.value = null
  } finally {
    detailLoading.value = false
  }
  loadUsage(id) // 使用明细与详情并行加载
}

/* ===== 模块三：参数配置 ===== */
const configItems = ref([])
const configLoaded = ref(false)
const configLoading = ref(false)
const configError = ref('')

async function loadConfig() {
  configLoading.value = true
  configError.value = ''
  try {
    configItems.value = formatConfigItems(await fetchAdminConfig(adminKey.value))
    configLoaded.value = true
  } catch (e) {
    if (handleAuthError(e)) return
    configError.value = e.message || '配置加载失败'
  } finally {
    configLoading.value = false
  }
}

async function saveConfig(c) {
  c.saving = true
  c.feedback = ''
  c.feedbackBad = false
  try {
    const saved = await saveAdminConfig(adminKey.value, c.key, c.input)
    c.value = saved.value
    c.input = saved.value
    c.updatedAtText = formatDateTime(saved.updatedAt)
    c.feedback = `✓ 已保存，立即生效`
  } catch (e) {
    if (handleAuthError(e)) return
    c.feedback = e.message || '保存失败'
    c.feedbackBad = true
  } finally {
    c.saving = false
  }
}

function goHome() {
  location.hash = '' // 触发 App 的 hashchange，回到主站
}

if (!gated.value) loadStats()

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  lineChart && lineChart.dispose()
  barChart && barChart.dispose()
})
</script>

<style scoped>
.admin-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 头部 ===== */
.a-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.a-title {
  font-family: var(--font-display);
  font-size: 34px;
  letter-spacing: 0.18em;
  color: var(--gold);
  text-shadow: 0 0 26px rgba(232, 196, 124, 0.3);
  margin-top: 8px;
}
.a-title-en {
  font-family: "Cormorant Garamond", "Noto Serif SC", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  color: var(--ink-dim);
  margin-left: 10px;
}
.a-link {
  background: none;
  border: none;
  padding: 6px 2px;
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-dim);
  cursor: pointer;
  transition: color 0.2s;
}
.a-link:hover { color: var(--gold); }
.header-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--gold-dim);
  font-size: 12px;
}
.header-divider i {
  flex: 1;
  border-top: 1px solid rgba(139, 135, 176, 0.16);
}

/* ===== Key 门禁 ===== */
.gate {
  margin: 60px auto 0;
  padding: 44px 60px;
  text-align: center;
  max-width: 480px;
}
.gate-icon {
  font-size: 34px;
  color: var(--gold);
  margin-bottom: 14px;
}
.gate-text {
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--ink);
  margin-bottom: 22px;
}
.gate-form {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.gate-input {
  width: 220px;
  padding: 10px 14px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.6);
  color: var(--ink);
  font-size: 13px;
  letter-spacing: 0.14em;
  outline: none;
  transition: border-color 0.2s;
}
.gate-input:focus { border-color: var(--gold-dim); }
.a-btn {
  padding: 10px 28px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.22em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.a-btn:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.a-btn:disabled { opacity: 0.5; cursor: default; }
.a-btn-sm { padding: 8px 20px; font-size: 12px; }
.error-line {
  margin: 0 0 14px;
  font-size: 13.5px;
  letter-spacing: 0.1em;
  color: var(--cinnabar);
}
.error-line.pad { padding: 8px 4px; }

/* ===== 模块切换 ===== */
.tab-bar {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.16);
}
.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 22px 12px;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--ink-dim);
  transition: color 0.2s, border-color 0.2s;
}
.tab-cn {
  font-size: 15px;
  letter-spacing: 0.24em;
}
.tab-en {
  font-size: 10.5px;
  letter-spacing: 0.18em;
  opacity: 0.6;
}
.tab-btn:hover { color: var(--ink); }
.tab-btn.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
  text-shadow: 0 0 14px rgba(232, 196, 124, 0.35);
}
.tab-panel { display: flex; flex-direction: column; gap: 22px; }

/* ===== 核心数字卡片 ===== */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 18px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-label {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--ink-dim2);
}
.stat-value {
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--ink);
  line-height: 1.2;
}
.stat-value.gold { color: var(--gold); }
.stat-en {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: rgba(169, 164, 204, 0.55);
}

/* ===== 图表 ===== */
.chart-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 22px;
}
.chart-card { padding: 20px 22px; }
.sec-title {
  font-family: var(--font-display);
  font-size: 16px;
  letter-spacing: 0.26em;
  color: var(--ink);
  margin-bottom: 12px;
}
.sec-title-en {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-dim2);
  margin-left: 8px;
}
.chart { height: 300px; }
.empty-hint {
  padding: 40px 0;
  text-align: center;
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
}

/* ===== 用户表格 ===== */
.users-card { padding: 20px 22px; }
.users-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.users-toolbar .sec-title { margin-bottom: 0; }
.search-form { display: flex; gap: 10px; }
.search-input {
  width: 200px;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.6);
  color: var(--ink);
  font-size: 12.5px;
  letter-spacing: 0.1em;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: var(--gold-dim); }

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.users-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--ink-dim2);
  border-bottom: 1px solid var(--gold-hairline);
  font-weight: normal;
}
.users-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.1);
  color: var(--ink);
}
.user-row { cursor: pointer; transition: background 0.2s; }
.user-row:hover { background: rgba(232, 196, 124, 0.05); }
.user-row.open { background: rgba(232, 196, 124, 0.07); }
.dim { color: var(--ink-dim); }
.u-identity { display: flex; align-items: center; gap: 10px; }
.u-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--gold-hairline);
}
.u-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--gold-dim);
  font-size: 13px;
  background: rgba(232, 196, 124, 0.06);
}
.streak.hot { color: var(--gold); }

/* 行内详情 */
.detail-row td {
  background: rgba(7, 11, 30, 0.45);
  border-bottom: 1px solid var(--gold-hairline);
}
.detail-loading { display: flex; justify-content: center; padding: 22px 0; }
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 26px;
  padding: 6px 4px;
}
/* 顶部通栏：打卡汇总横排 */
.checkin-block {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.12);
}
.ck-stats {
  display: flex;
  align-items: center;
  gap: 34px;
}
.mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.mini-stat b {
  font-size: 26px;
  font-weight: 500;
  line-height: 1.1;
}
.mini-stat span {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  color: var(--ink-dim);
}
.today-badge {
  position: static;
}
/* 第二行两列等高：固定高度，内容超出内部滚动 */
.detail-grid > .detail-block:not(.checkin-block) {
  display: flex;
  flex-direction: column;
  height: 320px;
  min-width: 0;
}
.detail-grid > .detail-block:not(.checkin-block) .history-scroll,
.detail-grid > .detail-block:not(.checkin-block) .usage-events {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
}
/* 使用胶囊在窄列里两枚一行 */
.usage-chips {
  align-content: flex-start;
}
.usage-chip {
  flex: 1 1 calc(50% - 8px);
  text-align: center;
  white-space: nowrap;
}
/* 历史列表滚动条 */
.history-scroll::-webkit-scrollbar, .usage-events::-webkit-scrollbar { width: 4px; }
.history-scroll::-webkit-scrollbar-thumb, .usage-events::-webkit-scrollbar-thumb { background: rgba(232, 196, 124, 0.25); border-radius: 2px; }
.history-scroll::-webkit-scrollbar { width: 4px; }
.history-scroll::-webkit-scrollbar-thumb { background: rgba(232, 196, 124, 0.25); border-radius: 2px; }
.detail-title {
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--gold-dim);
  margin-bottom: 10px;
}
.detail-line { font-size: 13px; color: var(--ink); line-height: 1.9; }
.gold-text { color: var(--gold); font-weight: normal; }
.today-badge {
  margin-left: 10px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: #7FBF9E;
  border: 1px solid rgba(127, 191, 158, 0.4);
  border-radius: 3px;
  padding: 1px 7px;
}
.history-list { list-style: none; display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; }
.history-list li { display: flex; align-items: baseline; gap: 10px; }
.h-type {
  flex-shrink: 0;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--gold);
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  padding: 1px 6px;
}
.h-type[data-type="MATCH"] { color: #C25E5E; border-color: rgba(194, 94, 94, 0.3); }
.h-type[data-type="BAGUA"], .h-type[data-type="hexagram"] { color: #7FBF9E; border-color: rgba(127, 191, 158, 0.3); }
.h-title { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-date { flex-shrink: 0; margin-left: auto; font-size: 11px; }

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding-top: 16px;
}
.pager-btn {
  background: none;
  border: 1px solid rgba(139, 135, 176, 0.3);
  border-radius: 4px;
  padding: 7px 16px;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.pager-btn:hover:not(:disabled) { color: var(--gold); border-color: var(--gold-dim); }
.pager-btn:disabled { opacity: 0.35; cursor: default; }
.pager-info { font-size: 12px; letter-spacing: 0.14em; color: var(--ink-dim2); }

/* ===== 配置 ===== */
.config-card { padding: 20px 22px; }
.config-note {
  font-size: 11.5px;
  letter-spacing: 0.14em;
  color: var(--ink-dim2);
  margin-bottom: 18px;
}
.config-list { display: flex; flex-direction: column; }
.config-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 22px;
  align-items: center;
  padding: 18px 4px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.1);
}
.config-row:last-child { border-bottom: none; }
.config-key {
  font-size: 13.5px;
  letter-spacing: 0.1em;
  color: var(--gold);
  margin-bottom: 6px;
}
.config-desc { font-size: 13px; color: var(--ink); line-height: 1.7; }
.config-updated { font-size: 11px; letter-spacing: 0.1em; margin-top: 6px; }
.config-form { display: flex; gap: 10px; align-items: center; }
.config-input {
  width: 110px;
  padding: 9px 12px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.6);
  color: var(--ink);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.config-input:focus { border-color: var(--gold-dim); }
.config-feedback {
  grid-column: 2;
  font-size: 11.5px;
  letter-spacing: 0.12em;
  color: #7FBF9E;
}
.config-feedback.bad { color: var(--cinnabar); }

.a-state {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}
.error-state {
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

/* ===== 窄屏 ===== */
@media (max-width: 960px) {
  .chart-row { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .gate { padding: 34px 22px; }
  .config-row { grid-template-columns: 1fr; }
  .config-feedback { grid-column: 1; }
  .users-table th:nth-child(3), .users-table td:nth-child(3) { display: none; }
}

/* ===== 板块使用次数 ===== */
.module-usage {
  margin-top: 22px;
}
.mu-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.mu-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.mu-name {
  flex: none;
  width: 88px;
  font-size: 13px;
  color: var(--ink);
}
.mu-track {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: rgba(139, 135, 176, 0.12);
  overflow: hidden;
}
.mu-bar {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(232, 196, 124, 0.35), #E8C47C);
  transition: width 0.4s ease;
}
.mu-bar.none {
  background: transparent;
}
.mu-count {
  flex: none;
  width: 64px;
  text-align: right;
  font-size: 13px;
  color: var(--gold);
}
.mu-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--ink-dim2);
}

/* ===== 按日使用明细 ===== */

.usage-date {
  padding: 6px 10px;
  border: 1px solid var(--gold-hairline);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
  color: var(--ink);
  font-size: 13px;
  color-scheme: dark;
}
.usage-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.usage-chip {
  padding: 4px 12px;
  border: 1px solid var(--gold-hairline);
  border-radius: 999px;
  font-size: 12px;
  color: var(--gold);
  background: rgba(232, 196, 124, 0.07);
}
.usage-chip.zero {
  color: var(--ink-dim2);
  border-color: rgba(139, 135, 176, 0.15);
  background: transparent;
}
.usage-chip.none {
  color: var(--ink-dim2);
  border-style: dashed;
  border-color: rgba(139, 135, 176, 0.25);
  background: transparent;
}

/* ===== 今日板块使用（登录 vs 游客） ===== */
.today-usage {
  margin-top: 22px;
}
.guest-badge {
  margin-left: 12px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #7FA8BF;
  border: 1px solid rgba(127, 168, 191, 0.35);
  border-radius: 999px;
  padding: 2px 10px;
}
.usage-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 13px;
}
.usage-table th {
  text-align: left;
  font-weight: normal;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-dim2);
  padding: 6px 10px;
  border-bottom: 1px solid rgba(139, 135, 176, 0.15);
}
.usage-table td {
  padding: 8px 10px;
  color: var(--ink);
  border-bottom: 1px solid rgba(139, 135, 176, 0.08);
}
.usage-table td.num {
  text-align: right;
  color: var(--gold);
}
.usage-table td.guest {
  color: #7FA8BF;
}
.usage-table th:nth-child(2), .usage-table th:nth-child(3) {
  text-align: right;
}
</style>
