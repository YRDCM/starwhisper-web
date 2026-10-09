// 分享海报：纯前端 Canvas 2D 绘制（750×1200），无新依赖。
// 注意：canvas 里用自定义 webfont 不可靠（字体未必加载完成、跨端差异大），
// 因此统一用系统 serif / sans / monospace 字体栈，视觉效果最接近即可。
import { constellationOf } from './constellations'

const W = 750
const H = 1200

// 主题色（与 style.css 设计令牌一致）
const C = {
  night: '#070B1E',
  nightMid: '#10163A',
  nebula: '#232048',
  gold: '#E8C47C',
  goldDim: 'rgba(232,196,124,0.55)',
  ink: '#E8E6F0',
  inkDim: '#A9A4CC',
  inkFaint: 'rgba(169,164,204,0.5)',
  jade: '#7FBF9E',
  cinnabar: '#C25E5E',
  hairline: 'rgba(139,135,176,0.25)'
}

const SERIF = '"Noto Serif SC", "Songti SC", "SimSun", serif'
const SANS = '"PingFang SC", "Microsoft YaHei", sans-serif'
const MONO = '"Consolas", "Menlo", monospace'

// 中文颜色名 → 色块值（与 FortuneCard 同款映射）
const COLOR_MAP = {
  红色: '#C25E5E', 橙色: '#D08C4A', 黄色: '#E8C47C', 金色: '#E8C47C',
  绿色: '#7FBF9E', 青色: '#5FA8A8', 蓝色: '#6E8FC8', 紫色: '#9C8FD0',
  葡萄紫: '#7B5CA8', 粉色: '#D094B0', 淡粉色: '#E3B8C8', 白色: '#EDEDF2', 奶白色: '#F0EBDD',
  黑色: '#2A2C40', 银色: '#B9BDCF', 棕色: '#9A7256', 灰色: '#8B87B0',
  珊瑚橙: '#E08A63', 玫瑰红: '#C25E7A', 天蓝色: '#6EA8D8', 米色: '#D8CBA8'
}

// 避头尾：这些标点不得出现在行首；若换行点落在标点前，
// 把标点收回上一行（上一行允许略微超出一字宽）
const NO_LINE_START = '，。、；：！？）》」』”’\'"%…)'

/** 文本自动换行（按像素宽度量 + 避头尾），返回行数组 */
function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const ch of String(text || '')) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      if (NO_LINE_START.includes(ch)) {
        line += ch // 标点收回上一行，禁止悬在新行行首
      } else {
        lines.push(line)
        line = ch
      }
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

/** ✦ 分隔线：线 — ✦ — 线 */
function divider(ctx, y, x1 = 60, x2 = W - 60) {
  ctx.strokeStyle = C.hairline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(W / 2 - 24, y)
  ctx.moveTo(W / 2 + 24, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.fillStyle = C.goldDim
  ctx.font = `14px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✦', W / 2, y)
}

/** 星联简笔画：把 0-100 视窗坐标缩放到 (cx, cy, size) 区域内 */
function drawConstellation(ctx, signName, cx, cy, size) {
  const data = constellationOf(signName)
  if (!data) return
  const sx = (p) => cx - size / 2 + (p[0] / 100) * size
  const sy = (p) => cy - size / 2 + (p[1] / 100) * size
  ctx.strokeStyle = C.goldDim
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const [a, b] of data.edges) {
    ctx.moveTo(sx(data.points[a]), sy(data.points[a]))
    ctx.lineTo(sx(data.points[b]), sy(data.points[b]))
  }
  ctx.stroke()
  ctx.fillStyle = C.gold
  for (const p of data.points) {
    ctx.beginPath()
    ctx.arc(sx(p), sy(p), 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 印章文字块：描边方框字（宜/忌）+ 内容 */
function drawSeal(ctx, x, y, stamp, stampColor, text, maxW) {
  ctx.strokeStyle = stampColor
  ctx.lineWidth = 1
  // 双线铅印感：外框 + 内缩 3px 内框
  ctx.strokeRect(x, y, 34, 34)
  ctx.strokeRect(x + 3, y + 3, 28, 28)
  ctx.fillStyle = stampColor
  ctx.font = `19px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(stamp, x + 17, y + 18)

  ctx.fillStyle = C.ink
  ctx.font = `15px ${SANS}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const lines = wrapText(ctx, text, maxW)
  lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + 46, y + 4 + i * 24))
}

/**
 * 生成分享海报，返回 dataURL（image/png）
 * @param fortune 今日运势（FortuneVO）
 * @param sign    星座基础信息（取 dateRange）
 */
export function renderPoster(fortune, sign) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // ===== 深空背景：夜空 → 星云紫 纵向渐变 =====
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, C.night)
  bg.addColorStop(0.5, C.nightMid)
  bg.addColorStop(1, C.nebula)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 星星背景：40 个随机点（亮度随机，少量带十字光晕）
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const r = Math.random() * 1.4 + 0.4
    ctx.fillStyle = `rgba(232,230,240,${0.15 + Math.random() * 0.5})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 外框细金边
  ctx.strokeStyle = 'rgba(232,196,124,0.22)'
  ctx.lineWidth = 1
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(24, 24, W - 48, H - 48, 8)
    ctx.stroke()
  } else {
    ctx.strokeRect(24, 24, W - 48, H - 48)
  }

  // ===== 版面垂直配重（自适应版）=====
  // 不再用固定槽位：先量出各段实际高度（评分行数 / 点评行数都随数据变），
  // 再把剩余空间按比例均分到各段间距，短文案不再塌出大空档，长文案也不挤。
  // 落款钉底 1080–1160 不变。

  // ===== 顶部：词标（中英分行，杜绝写死 x 坐标导致重叠）+ 日期 =====
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = C.gold
  ctx.font = `30px ${SERIF}`
  ctx.fillText('星语', 60, 80)
  ctx.fillStyle = C.inkDim
  ctx.font = `italic 17px ${SERIF}`
  ctx.fillText('StarWhisper', 62, 106)

  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const dateStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  ctx.fillStyle = C.inkDim
  ctx.font = `15px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText(dateStr, W - 60, 86)

  divider(ctx, 132)

  // ===== 星座名 + 日期区间 + 星联 =====
  ctx.textAlign = 'left'
  ctx.fillStyle = C.gold
  ctx.font = `56px ${SERIF}`
  ctx.fillText(fortune.signName || '', 60, 232)
  const nameW = ctx.measureText(fortune.signName || '').width
  ctx.fillStyle = C.inkDim
  ctx.font = `italic 24px ${SERIF}`
  ctx.fillText(fortune.signNameEn || '', 60 + nameW + 16, 230)

  const range = (sign && sign.dateRange ? sign.dateRange : '').replace('-', '–')
  ctx.fillStyle = C.inkDim
  ctx.font = `15px ${MONO}`
  ctx.fillText(`${(fortune.signNameEn || '').toUpperCase()} · ${range}`, 62, 268)

  drawConstellation(ctx, fortune.signName, W - 140, 224, 110)

  // ===== 第一遍：量高 =====
  const dims = [
    { zh: '综合运势', score: fortune.overallScore },
    { zh: '爱情运势', score: fortune.loveScore },
    { zh: '事业学业', score: fortune.careerScore },
    { zh: '财富运势', score: fortune.wealthScore },
    { zh: '健康运势', score: fortune.healthScore }
  ].filter((x) => x.score != null)

  const lucky = [
    { label: '幸运色', value: fortune.luckyColor, color: COLOR_MAP[fortune.luckyColor] || '#8B87B0' },
    { label: '幸运数字', value: fortune.luckyNumber },
    { label: '吉时', value: fortune.luckyTime },
    fortune.luckyDirection ? { label: '方位', value: fortune.luckyDirection } : null
  ].filter(Boolean)

  ctx.font = `15px ${SANS}`
  const sealLines = Math.max(
    wrapText(ctx, fortune.doText, 250).slice(0, 2).length,
    wrapText(ctx, fortune.dontText, 250).slice(0, 2).length,
    1
  )
  ctx.font = `17px ${SERIF}`
  const sumLines = wrapText(ctx, fortune.summary, W - 120 - 20).slice(0, 5)

  const FOOTER_TOP = H - 120          // 落款分隔线 y=1080，钉底
  const CONTENT_TOP = 306             // 星座名块结束后的内容起点
  const DIM_ROW = 46                  // 评分行高
  const LUCKY_H = 78                  // 幸运条目块高
  const sealH = sealLines * 26 + 14   // 宜忌块高
  const sumH = sumLines.length * 32   // 点评块高
  // 4 段内容之间的 5 个空隙（头前/段间×3/尾后）均分剩余空间，兜底最小 30
  const gaps = 5
  const leftover = FOOTER_TOP - CONTENT_TOP - (dims.length * DIM_ROW + LUCKY_H + sealH + sumH)
  const gap = Math.max(30, Math.floor(leftover / gaps))

  // ===== 第二遍：排版 =====
  let y = CONTENT_TOP + gap

  // 五维评分 ✦ 行
  ctx.font = `16px ${SANS}`
  for (const dim of dims) {
    ctx.textAlign = 'left'
    ctx.fillStyle = C.ink
    ctx.fillText(dim.zh, 60, y)
    // ✦ 实 / 暗 空
    let gx = 210
    for (let n = 1; n <= 5; n++) {
      ctx.fillStyle = n <= dim.score ? C.gold : C.inkFaint
      ctx.font = `17px ${SANS}`
      ctx.fillText('✦', gx, y)
      gx += 26
    }
    y += DIM_ROW
  }

  divider(ctx, y + Math.floor(gap * 0.4))
  y += gap

  // ===== 幸运信息：单行分段流式排版（幸运色 墨绿色 · 数字 60 · 吉时 16:00-18:00），
  // 光标推进替代写死列宽；量宽自适应字号，整体绝不超出安全边距（左右各 60px） =====
  const LUCKY_MAXW = W - 120
  // draw=false 时只量总宽：字号、间距与绘制完全同一路径，保证量得准
  function luckyLine(font, draw, baseline) {
    let lx = 60
    lucky.forEach((it, i) => {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `${font - 3}px ${MONO}`
      if (draw) {
        ctx.fillStyle = C.inkDim
        ctx.fillText(it.label, lx, baseline)
      }
      lx += ctx.measureText(it.label).width + 8
      if (it.color) {
        if (draw) {
          ctx.fillStyle = it.color
          ctx.beginPath()
          ctx.arc(lx + 8, baseline - Math.floor(font / 4), 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(232,230,240,0.4)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        lx += 24
      }
      ctx.font = `${font}px ${it.label === '幸运数字' ? MONO : SANS}`
      const v = String(it.value ?? '')
      if (draw) {
        ctx.fillStyle = it.label === '幸运数字' ? C.gold : C.ink
        ctx.fillText(v, lx, baseline)
      }
      lx += ctx.measureText(v).width
      if (i < lucky.length - 1) {
        if (draw) {
          ctx.fillStyle = C.goldDim
          ctx.font = `${font - 2}px ${SANS}`
          ctx.fillText('·', lx + 10, baseline)
        }
        lx += 28
      }
    })
    return lx - 60
  }
  let luckyFont = 16
  while (luckyFont > 12 && luckyLine(luckyFont, false, 0) > LUCKY_MAXW) luckyFont -= 1
  luckyLine(luckyFont, true, y + 38)
  ctx.textBaseline = 'alphabetic'
  y += LUCKY_H + gap

  // ===== 宜 / 忌 印章 =====
  drawSeal(ctx, 60, y, '宜', C.jade, fortune.doText, 250)
  drawSeal(ctx, W / 2 + 10, y, '忌', C.cinnabar, fortune.dontText, 250)
  y += sealH + gap

  // ===== 点评（自动换行 + 避头尾，衬线斜体感用 serif 代替） =====
  // 金色左边框引文（上下各留 6px 呼吸，单行时也不再是悬空的短桩）
  ctx.strokeStyle = C.gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(60, y - 4)
  ctx.lineTo(60, y + sumH + 2)
  ctx.stroke()
  ctx.fillStyle = C.ink
  ctx.font = `17px ${SERIF}`
  ctx.textAlign = 'left'
  sumLines.forEach((ln, i) => ctx.fillText(ln, 78, y + 20 + i * 32))

  // ===== 底部：分隔线 + 品牌落款（钉底 1080–1160，点评后留 ~120 呼吸区） =====
  divider(ctx, H - 120)
  ctx.textAlign = 'center'
  ctx.fillStyle = C.gold
  ctx.font = `18px ${SERIF}`
  ctx.fillText('星语 StarWhisper · 星辰低语', W / 2, H - 84)
  ctx.fillStyle = C.inkDim
  ctx.font = `12.5px ${MONO}`
  ctx.fillText(dateStr + ' · 仅供娱乐 · 愿你被星辰温柔以待', W / 2, H - 56)

  return canvas.toDataURL('image/png')
}
