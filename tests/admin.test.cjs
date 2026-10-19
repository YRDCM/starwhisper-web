// 后台管理页纯逻辑测试：分页参数组装 / 统计卡片 / 序列对齐 / 配置项格式化 / 时间格式化
const { test } = require('node:test')
const assert = require('node:assert/strict')

let logic
test.before(async () => {
  logic = await import('../src/adminLogic.js')
})

test('buildUsersQuery：分页参数钳制与 keyword 组装', () => {
  assert.deepEqual(logic.buildUsersQuery(0, 20, ''), { page: 0, size: 20 })
  assert.deepEqual(logic.buildUsersQuery(-5, 0, '  '), { page: 0, size: 20 }) // 负页/零 size 钳制
  assert.deepEqual(logic.buildUsersQuery(2, 999, ' 星 '), { page: 2, size: 50, keyword: '星' }) // 超上限 + 去空格
  assert.deepEqual(logic.buildUsersQuery('abc', undefined, null), { page: 0, size: 20 }) // 非法输入回落默认
  assert.ok(!('keyword' in logic.buildUsersQuery(0, 20, ''))) // 空词不传，避免无意义模糊查询
})

test('totalPages：总页数至少为 1', () => {
  assert.equal(logic.totalPages(0, 20), 1)
  assert.equal(logic.totalPages(20, 20), 1)
  assert.equal(logic.totalPages(21, 20), 2)
  assert.equal(logic.totalPages(41, 20), 3)
})

test('buildStatCards：缺数据时显示 0，AI 用量带 已用/上限 与剩余提示', () => {
  const empty = logic.buildStatCards(null)
  assert.equal(empty.length, 9)
  assert.equal(empty[0].value, 0) // 总用户缺省 0
  const ai = empty.find((c) => c.key === 'ai')
  assert.equal(ai.value, '0/0')
  assert.equal(ai.hint, '剩余 0')

  const real = logic.buildStatCards({
    userCount: 1286, todayNewUsers: 17, todayActive: 243, todayCheckins: 89,
    tarotTotal: 3312, baguaTotal: 51, matchTotal: 7,
    aiTodayUsed: 12, aiGlobalLimit: 100, aiGlobalRemaining: 88, subscribeActive: 34
  })
  assert.equal(real[0].value, 1286)
  assert.equal(real.find((c) => c.key === 'ai').value, '12/100')
  assert.equal(real.find((c) => c.key === 'subscribeActive').value, 34)
})

test('mergeDailySeries：新增与活跃按日期对齐，缺口补 0', () => {
  const merged = logic.mergeDailySeries(
    [{ date: '2026-10-13', count: 3 }, { date: '2026-10-14', count: 5 }],
    [{ date: '2026-10-14', count: 9 }, { date: '2026-10-15', count: 4 }]
  )
  assert.deepEqual(merged.dates, ['2026-10-13', '2026-10-14', '2026-10-15'])
  assert.deepEqual(merged.labels, ['10-13', '10-14', '10-15'])
  assert.deepEqual(merged.newUsers, [3, 5, 0])
  assert.deepEqual(merged.active, [0, 9, 4])
})

test('mergeDailySeries：空输入安全', () => {
  const merged = logic.mergeDailySeries(null, undefined)
  assert.deepEqual(merged.dates, [])
  assert.deepEqual(merged.newUsers, [])
})

test('formatConfigItems：补展示文本与输入初值', () => {
  const items = logic.formatConfigItems([
    { key: 'ai.perIpDailyLimit', value: '3', desc: '每 IP 限额', updatedAt: null },
    { key: 'ai.globalDailyLimit', value: '42', desc: '全站限额', updatedAt: '2026-10-19T08:30:00' }
  ])
  assert.equal(items.length, 2)
  assert.equal(items[0].input, '3')
  assert.equal(items[0].updatedAtText, '从未修改（默认值）')
  assert.match(items[1].updatedAtText, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.deepEqual(logic.formatConfigItems(null), [])
})

test('formatDateTime：LocalDateTime 字符串与空值', () => {
  assert.match(logic.formatDateTime('2026-10-19T08:30:00'), /^2026-10-19 \d{2}:\d{2}$/)
  assert.match(logic.formatDateTime('2026-10-19 08:30'), /^2026-10-19 \d{2}:\d{2}$/)
  assert.equal(logic.formatDateTime(null), '—')
  assert.equal(logic.formatDateTime(''), '—')
})

test('signNameOf / historyTypeName：中文标签映射与兜底', () => {
  assert.equal(logic.signNameOf('aries'), '白羊座')
  assert.equal(logic.signNameOf('ARIES'), '白羊座')
  assert.equal(logic.signNameOf('unknown-sign'), 'unknown-sign') // 未知原样透出
  assert.equal(logic.signNameOf(null), '—')
  assert.equal(logic.historyTypeName('TAROT'), '塔罗')
  assert.equal(logic.historyTypeName('hexagram'), '一卦')
  assert.equal(logic.historyTypeName('OTHER'), 'OTHER')
})


// ===== 整页运行时冒烟：用 Vue 响应式 + 隔离的 API/DOM 适配器执行 AdminView 的 script setup =====
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { ref, computed, nextTick, onBeforeUnmount } = require('vue')

function setupAdminPage(storage, api) {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/AdminView.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import[\s\S]*?from '..\/(api|adminLogic)'$/gm, '')
    .replace(/^import \* as echarts from 'echarts'$/gm, '')
  const charts = []
  const context = {
    ref, computed, nextTick, onBeforeUnmount,
    echarts: { init: () => { const c = { setOption(o) { this.option = o }, resize() {}, dispose() {} }; charts.push(c); return c } },
    fetchAdminStats: api.stats, fetchAdminUsers: api.users,
    fetchAdminUserDetail: api.userDetail, fetchAdminConfig: api.config, saveAdminConfig: api.saveConfig,
    ...logic,
    localStorage: {
      getItem: (k) => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = v },
      removeItem: (k) => { delete storage[k] }
    },
    window: { addEventListener() {}, removeEventListener() {} },
    location: { hash: '#admin' },
    // template ref 桩：只要 truthy 就会触发 echarts.init
    __charts: charts
  }
  vm.runInNewContext(source + `
this.page = { gated, submitKey, keyInput, gateError, tab, switchTab, stats, cards, loadStats,
  usersList, usersTotal, page, pageCount, keywordInput, searchUsers, gotoPage, toggleUser, expandedId, detail,
  configItems, loadConfig, saveConfig, TABS }
// template ref 在真实运行时由 Vue 注入；测试里直接赋桩对象
lineRef.value = {}; barRef.value = {};`, context)
  return context
}

const STATS = {
  userCount: 1286, todayNewUsers: 17, todayActive: 243, checkinTotal: 4521, todayCheckins: 89,
  tarotTotal: 3312, baguaTotal: 51, matchTotal: 7, subscribeActive: 34,
  aiTodayUsed: 12, aiGlobalLimit: 100, aiGlobalRemaining: 88,
  spreadDist: [{ spread: 'single', count: 100 }, { spread: 'three', count: 60 }],
  dailyNewUsers: [{ date: '2026-10-13', count: 3 }],
  dailyActive: [{ date: '2026-10-13', count: 9 }]
}

test('整页冒烟：过门禁后总览加载并渲染图表', async () => {
  const storage = { 'starwhisper:adminkey': 'good-key' }
  const context = setupAdminPage(storage, { stats: async () => STATS })
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(context.page.gated.value, false)
  assert.equal(context.page.stats.value.userCount, 1286)
  assert.equal(context.page.cards.value.length, 9)
  assert.equal(context.__charts.length, 2) // 折线 + 横向条形
})

test('整页冒烟：403 回门禁并清掉本地 key', async () => {
  const storage = { 'starwhisper:adminkey': 'bad-key' }
  const err = new Error('无权访问'); err.status = 403
  const context = setupAdminPage(storage, { stats: async () => { throw err } })
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(context.page.gated.value, true)
  assert.equal(storage['starwhisper:adminkey'], undefined)
  assert.equal(context.page.gateError.value, 'Key 无效，请重新输入')
})

test('整页冒烟：用户 tab 搜索/翻页/展开详情，配置 tab 保存反馈', async () => {
  const storage = { 'starwhisper:adminkey': 'k' }
  const calls = []
  const api = {
    stats: async () => STATS,
    users: async (key, params) => {
      calls.push(params)
      return { list: [{ id: 1, nickname: '星野', signNameEn: 'aries', createdAt: '2026-10-01T10:00:00', totalCheckins: 5, currentStreak: 2, lastActiveAt: null }], total: 41, page: params.page, size: params.size }
    },
    userDetail: async () => ({ user: { id: 1, nickname: '星野' }, checkin: { currentStreak: 2, maxStreak: 4, totalDays: 5, todayChecked: true }, histories: [{ type: 'TAROT', title: '单牌指引', createdAt: '2026-10-18T20:00:00' }] }),
    config: async () => [{ key: 'ai.perIpDailyLimit', value: '3', desc: '每 IP 限额', updatedAt: null }],
    saveConfig: async (adminKey, configKey, value) => ({ key: configKey, value, desc: '', updatedAt: '2026-10-19T14:00:00' })
  }
  const context = setupAdminPage(storage, api)
  await new Promise((r) => setTimeout(r, 0)) // 总览先加载完

  // 用户 tab：懒加载
  context.page.switchTab('users')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(context.page.usersTotal.value, 41)
  assert.equal(context.page.pageCount.value, 3)
  assert.deepEqual(calls[0], { page: 0, size: 20 })

  // 搜索：回第 0 页并带 keyword
  context.page.keywordInput.value = ' 星 '
  context.page.searchUsers()
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(calls.at(-1), { page: 0, size: 20, keyword: '星' })

  // 翻页
  context.page.gotoPage(1)
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(calls.at(-1), { page: 1, size: 20, keyword: '星' })

  // 展开详情 → 打卡汇总 + 历史
  await context.page.toggleUser(1)
  assert.equal(context.page.expandedId.value, 1)
  assert.equal(context.page.detail.value.checkin.currentStreak, 2)
  assert.equal(context.page.detail.value.histories.length, 1)

  // 配置 tab：加载 → 编辑 → 保存 → 反馈
  context.page.switchTab('config')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(context.page.configItems.value.length, 1)
  const item = context.page.configItems.value[0]
  item.input = '9'
  await context.page.saveConfig(item)
  assert.equal(item.value, '9')
  assert.match(item.feedback, /已保存/)
  assert.match(item.updatedAtText, /^\d{4}-\d{2}-\d{2}/)
})
