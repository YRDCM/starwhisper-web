// 星语后台的纯逻辑：分页参数组装、统计卡片/图表数据整形、配置项格式化、时间格式化。
// 与 AdminView.vue 分离，方便 node:test 直接单测（不依赖 Vue/DOM）。

/** 星座英文名 → 中文名（用户表「星座」列展示用） */
export const SIGN_NAMES = {
  aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座',
  leo: '狮子座', virgo: '室女座', libra: '天秤座', scorpio: '天蝎座',
  sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座'
}

/** nameEn（不区分大小写）→ 中文名；空值/未知返回 '—' */
export function signNameOf(nameEn) {
  if (!nameEn) return '—'
  return SIGN_NAMES[String(nameEn).toLowerCase()] || nameEn
}

/** 历史类型 → 中文标签 */
export function historyTypeName(type) {
  return { TAROT: '塔罗', BAGUA: '起卦', MATCH: '配对', hexagram: '一卦' }[type] || type || '—'
}

/**
 * 用户列表查询参数组装：page 负值钳到 0，size 钳到 1..50（与后端上限一致），
 * keyword 去空格，空字符串不传（避免无意义的模糊查询）
 */
export function buildUsersQuery(page, size, keyword) {
  const p = Number.isFinite(+page) ? Math.max(0, Math.floor(+page)) : 0
  let s = Number.isFinite(+size) ? Math.floor(+size) : 20
  s = s <= 0 ? 20 : Math.min(s, 50)
  const query = { page: p, size: s }
  const kw = (keyword || '').trim()
  if (kw) query.keyword = kw
  return query
}

/** 总页数：total 条 / size 条每页，至少 1 页（空列表也显示第 1 页） */
export function totalPages(total, size) {
  const t = Math.max(0, +total || 0)
  const s = Math.max(1, +size || 20)
  return Math.max(1, Math.ceil(t / s))
}

/**
 * 总览统计卡片：数据全部来自后端真实查询，缺字段显示 0。
 * AI 用量展示「已用/全站上限」，剩余名额在副标题里。
 */
export function buildStatCards(stats) {
  const s = stats || {}
  const num = (v) => (v == null ? 0 : v)
  return [
    { key: 'userCount', label: '总用户', en: 'USERS', value: num(s.userCount), gold: true },
    { key: 'todayNewUsers', label: '今日新增', en: 'NEW TODAY', value: num(s.todayNewUsers) },
    { key: 'todayActive', label: '今日活跃', en: 'ACTIVE TODAY', value: num(s.todayActive) },
    { key: 'todayCheckins', label: '今日打卡', en: 'CHECKINS TODAY', value: num(s.todayCheckins) },
    { key: 'tarotTotal', label: '塔罗', en: 'TAROT', value: num(s.tarotTotal) },
    { key: 'baguaTotal', label: '起卦', en: 'BAGUA', value: num(s.baguaTotal) },
    { key: 'matchTotal', label: '配对', en: 'MATCH', value: num(s.matchTotal) },
    {
      key: 'ai', label: 'AI 今日用量', en: 'AI QUOTA',
      value: `${num(s.aiTodayUsed)}/${num(s.aiGlobalLimit)}`,
      hint: `剩余 ${num(s.aiGlobalRemaining)}`
    },
    { key: 'subscribeActive', label: '订阅中', en: 'SUBSCRIBED', value: num(s.subscribeActive) }
  ]
}

/**
 * 近 7 天「新增 vs 活跃」双折线数据对齐：
 * 两个序列理论同长同日期，但后端分桶逻辑独立，这里按日期对齐并补齐缺口，
 * 日期标签取 MM-DD 更省空间
 */
export function mergeDailySeries(dailyNewUsers, dailyActive) {
  const toMap = (list) => {
    const map = new Map()
    ;(list || []).forEach((d) => { if (d && d.date) map.set(d.date, d.count || 0) })
    return map
  }
  const newMap = toMap(dailyNewUsers)
  const activeMap = toMap(dailyActive)
  const dates = [...new Set([...newMap.keys(), ...activeMap.keys()])].sort()
  return {
    dates,
    labels: dates.map((d) => d.slice(5)),
    newUsers: dates.map((d) => newMap.get(d) || 0),
    active: dates.map((d) => activeMap.get(d) || 0)
  }
}

/** ISO/LocalDateTime 字符串 → 'YYYY-MM-DD HH:mm'；空值 '—' */
export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(typeof value === 'string' && !value.includes('Z') && !value.includes('+')
    ? value.replace(' ', 'T')
    : value)
  if (Number.isNaN(d.getTime())) return String(value)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * 配置项整形：后端 [{key, value, desc, updatedAt}] → 表单行
 * 补上展示用的更新时间文本与输入初值
 */
export function formatConfigItems(items) {
  return (items || []).map((item) => ({
    key: item.key,
    desc: item.desc || '',
    value: item.value ?? '',
    input: item.value ?? '',
    updatedAt: item.updatedAt || null,
    updatedAtText: item.updatedAt ? formatDateTime(item.updatedAt) : '从未修改（默认值）'
  }))
}
