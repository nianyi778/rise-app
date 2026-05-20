// 日期格式化
export function formatDate(date: Date | string, fmt = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return fmt
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', day)
}

export function today(): string {
  return formatDate(new Date())
}

// 中文友好日期展示，如"今天"/"昨天"/"5月19日"
export function friendlyDate(dateStr: string): string {
  const t = today()
  if (dateStr === t) return '今天'
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  if (dateStr === yesterday) return '昨天'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 分钟转为"X小时Y分"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}小时${m}分` : `${h}小时`
}

// 秒数转为 MM:SS
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 计算圆环 stroke-dashoffset（circumference - progress * circumference）
export function calcDashOffset(progress: number, radius: number): number {
  const circumference = 2 * Math.PI * radius
  return circumference * (1 - Math.min(1, Math.max(0, progress)))
}

// 圆周长（常用半径）
export const RING_CIRCUMFERENCE_119 = 2 * Math.PI * 119  // focus timer r=119
export const RING_CIRCUMFERENCE_27  = 2 * Math.PI * 27   // hero day ring r=27
export const RING_CIRCUMFERENCE_29  = 2 * Math.PI * 29   // goal card r=29

// 星期几中文
export function weekdayCN(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

// 问候语（根据时段）
export function greeting(): string {
  const h = new Date().getHours()
  if (h < 6)  return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜了'
}

// 延迟工具
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// wx.createAnimation 弹簧效果
export function springAnim(
  ctx: WechatMiniprogram.Page.TrivialInstance,
  key: string,
  duration = 400,
): void {
  const anim = wx.createAnimation({ duration, timingFunction: 'ease' })
  anim.scale(0.92).step({ duration: 100 })
  anim.scale(1.04).step({ duration: 150 })
  anim.scale(1.0).step({ duration: 150 })
  ctx.setData({ [key]: anim.export() })
}

// 错落入场延迟（列表动画）
export function staggerDelay(index: number, base = 60): number {
  return index * base
}

// 节流
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
): T {
  let last = 0
  return ((...args) => {
    const now = Date.now()
    if (now - last >= wait) {
      last = now
      fn(...args)
    }
  }) as T
}
