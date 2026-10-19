// axios 封装：统一处理 /api 前缀和后端的 {code, message, data} 包装结构
import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 8000
})

// 登录 token 存 localStorage；请求时自动带 Authorization 头
const TOKEN_KEY = 'starwhisper:token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

// 统一拆包：code 200（旧契约）或 0（新契约，如 checkin/summary）均视为成功；
// 其余视为业务错误；401 清 token 并标记 err.code 供上层识别
http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && (body.code === 200 || body.code === 0)) {
      return body.data
    }
    const err = new Error((body && body.message) || '服务返回异常')
    if (body && body.code === 401) {
      setToken('') // 401 视为未登录：清掉失效 token
      err.code = 401
    }
    return Promise.reject(err)
  },
  (err) => {
    const status = err.response?.status
    if (status) err.status = status // 透出 HTTP 状态码（后台页据此识别 403 回门禁）
    if (status === 401) {
      setToken('')
      err.code = 401
      err.message = '登录已失效，请重新登录'
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      err.message = '请求超时，请稍后重试'
    } else if (!err.response) {
      err.message = '无法连接星语服务器，请检查网络后重试'
    } else {
      err.message = err.response.data?.message || `星语服务器响应异常（HTTP ${status}）`
    }
    return Promise.reject(err)
  }
)

/** 获取 12 星座列表（按 id 排序：白羊..双鱼） */
export function fetchSigns() {
  return http.get('/signs/list')
}

/** 获取某星座今日运势；sign 支持英文 nameEn（不区分大小写）或中文名 */
export function fetchTodayFortune(sign) {
  return http.get('/fortune/today', { params: { sign } })
}

/** 获取某星座近 7 天运势（today-6 .. today，升序） */
export function fetchWeekFortune(sign) {
  return http.get('/fortune/week', { params: { sign } })
}

/** 获取某星座本周运势（ShowAPI week 节点；无本地兜底，失败会 reject，前端显示错误态） */
export function fetchWeeklyFortune(sign) {
  return http.get('/fortune/weekly', { params: { sign } })
}

/** 每日塔罗（不传 sign，按日确定性出一张） */
export function fetchTarotDaily() {
  return http.get('/tarot/daily')
}

/** 抽牌仪式：spread = single（单牌指引）/ three（时间之流）/ choice（二选一）/ love（爱情十字）
 *  返回 {spread, spreadName, cards:[{card, orientation, position, keywords, meaning}]}
 *  cardNos：用户自行选牌的牌序号（逗号分隔，1-78，数量=牌阵张数，按牌位顺序）；
 *  自选失败保留错误，不自动改为随机抽牌。 */
export function drawTarot(spread, cardNos) {
  const params = cardNos ? { spread, cardNos } : { spread }
  return http.post('/tarot/draw', null, { params })
}

/** 牌库：78 张塔罗牌全量（正逆位关键词与牌义） */
export function fetchTarotCards() {
  return http.get('/tarot/cards')
}

export function fetchTarotReading(drawId, question) {
  return http.post('/tarot/ai-reading', { drawId, question }, { timeout: 60000 })
}

/** 每日一卦（按日确定性出一卦） */
export function fetchBaguaDaily() {
  return http.get('/bagua/daily')
}

/** 铜钱起卦：本卦 + 变卦 + 六爻明细（自下而上） */
export function castBagua() {
  return http.post('/bagua/cast')
}

/** 六十四卦全表（按卦序） */
export function fetchHexagrams() {
  return http.get('/bagua/hexagrams')
}

/** Kimi AI 解卦：payload = { primarySeq, changedSeq, changingLines, question }，响应 { summary, detail } 同塔罗 */
export function fetchBaguaReading(payload) {
  return http.post('/bagua/ai-reading', payload, { timeout: 60000 })
}

/** 星座配对：star 支持 nameEn 或中文名；gender 1男0女，可空 */
export function fetchMatch(star1, star2, gender1, gender2) {
  const params = { star1, star2 }
  if (gender1 != null) params.gender1 = gender1
  if (gender2 != null) params.gender2 = gender2
  return http.get('/match', { params })
}

/** dev 游客登录（PC 开发期通道）：body {"nickname": "可选"} */
export function devLogin(nickname) {
  return http.post('/auth/dev', { nickname })
}

/** 今日打卡（需登录，幂等） */
export function postCheckin() {
  return http.post('/checkin')
}

/** 打卡状态：{todayDone, streak, totalDays, recentDates}（需登录） */
export function fetchCheckinStatus() {
  return http.get('/checkin/status')
}

/** 打卡汇总：{currentStreak, maxStreak, totalDays, todayChecked,
 *  badges:[{code,name,desc,threshold,unlocked}]}；openid 可省略（新契约 code:0） */
export function fetchCheckinSummary(openid) {
  return http.get('/checkin/summary', { params: openid ? { openid } : {} })
}

/** 当前用户信息 + 历史统计：{id, nickname, avatarUrl, createdAt, historyCount, tarotCount, baguaCount}（需登录） */
export function fetchMe() {
  return http.get('/user/me')
}

/** 占卜历史：type 可选 TAROT / BAGUA / MATCH，最新在前（需登录） */
export function fetchHistory(type) {
  return http.get('/user/history', { params: type ? { type } : {} })
}

/** 每日一卦（v3 新契约）：{date, name, symbol, guaCi, interpretation, advice, luckLevel}；openid 可省略 */
export function fetchHexagramToday(openid) {
  return http.get('/hexagram/today', { params: openid ? { openid } : {} })
}

/** 后台统计（管理 key）：{userCount, todayNewUsers, todayActive, checkinTotal,
 *  todayCheckins, tarotTotal, baguaTotal, matchTotal, spreadDist:[{spread,count}],
 *  dailyNewUsers/dailyActive:[{date,count}], aiTodayUsed, aiGlobalLimit, aiGlobalRemaining, subscribeActive} */
export function fetchAdminStats(key) {
  return http.get('/admin/stats', { params: { key } })
}

/** 后台用户分页：{list, total, page, size}；params 由 buildUsersQuery 组装（page/size/keyword?） */
export function fetchAdminUsers(key, params) {
  return http.get('/admin/users', { params: { ...params, key } })
}

/** 后台用户详情：{user, checkin, histories:[{type,title,createdAt}]} */
export function fetchAdminUserDetail(key, id) {
  return http.get(`/admin/users/${id}`, { params: { key } })
}

/** 后台某用户某天的功能使用明细：{date, modules:[{key,name,count}], events:[{time,type,title}]} */
export function fetchAdminUserDailyUsage(key, id, date) {
  return http.get(`/admin/users/${id}/daily-usage`, { params: date ? { key, date } : { key } })
}

/** 后台配置项列表：[{key, value, desc, updatedAt}] */
export function fetchAdminConfig(key) {
  return http.get('/admin/config', { params: { key } })
}

/** 更新配置项：body {key: 配置项, value}；管理 key 走 query */
export function saveAdminConfig(adminKey, configKey, value) {
  return http.put('/admin/config', { key: configKey, value }, { params: { key: adminKey } })
}
