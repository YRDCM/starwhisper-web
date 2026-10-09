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

// 统一拆包：code 非 200 视为业务错误；401 清 token 并标记 err.code 供上层识别
http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && body.code === 200) {
      return body.data
    }
    const err = new Error((body && body.message) || '服务返回异常')
    if (body && body.code === 401) {
      setToken('') // 401 视为未登录：清掉失效 token
      err.code = 401
    }
    return Promise.reject(err)
  },
  (err) => Promise.reject(err)
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

/** 每日塔罗（不传 sign，按日确定性出一张） */
export function fetchTarotDaily() {
  return http.get('/tarot/daily')
}

/** 抽牌仪式：spread = single（单牌指引）/ three（时间之流）/ choice（二选一）/ love（爱情十字）
 *  返回 {spread, spreadName, cards:[{card, orientation, position, keywords, meaning}]} */
export function drawTarot(spread) {
  return http.post('/tarot/draw', null, { params: { spread } })
}

/** 牌库：78 张塔罗牌全量（正逆位关键词与牌义） */
export function fetchTarotCards() {
  return http.get('/tarot/cards')
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
 *  todayCheckins, tarotTotal, spreadDist:[{spread,count}], dailyNewUsers:[{date,count}]} */
export function fetchAdminStats(key) {
  return http.get('/admin/stats', { params: { key } })
}
