import { getWeeklyReport } from '../../api/index'
import { store } from '../../store/index'
import { calcDashOffset } from '../../utils/index'
import type { WeeklyReport, SessionStatus, MoodType } from '../../types/index'

// 扩展 dailyData，加入 dayShort 字段供 WXML 用
interface DailyDisplayItem {
  date: string
  dayShort: string          // "一"/"二"/…
  action: string
  mood: MoodType | null
  focusMin: number
  status: SessionStatus
}

interface ReportData {
  report: (Omit<WeeklyReport, 'dailyData'> & { dailyData: DailyDisplayItem[] }) | null
  weekOffset: number
  loading: boolean
  pageEntered: boolean
  ringData: {
    checkinDash: number
    focusDash: number
    streakDash: number
    totalFocusHours: string
  }
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']

// r=30, circ=188.5
function ringDash(value: number, max: number): number {
  const progress = max > 0 ? Math.min(1, value / max) : 0
  return calcDashOffset(progress, 30)
}

Page<ReportData, AnyObject>({
  data: {
    report: null,
    weekOffset: 0,
    loading: true,
    pageEntered: false,
    ringData: {
      checkinDash: 188.5,
      focusDash: 188.5,
      streakDash: 188.5,
      totalFocusHours: '0',
    },
  },

  async onShow() {
    this.setData({ pageEntered: false })
    await this.loadReport()
    setTimeout(() => this.setData({ pageEntered: true }), 50)
  },

  async loadReport() {
    const { currentGoal } = store.getState()
    if (!currentGoal) return

    this.setData({ loading: true })
    try {
      const raw = await getWeeklyReport(currentGoal._id, this.data.weekOffset)

      // 为每日数据加上 dayShort
      const dailyData: DailyDisplayItem[] = raw.dailyData.map(d => ({
        ...d,
        dayShort: WEEK_DAYS[new Date(d.date).getDay()],
      }))

      const totalFocusHours = (raw.totalFocusMin / 60).toFixed(1)
      // 专注时长环：假设目标每天 30 分，7 天 = 210 分为满
      const focusMax = 210

      const report = { ...raw, dailyData }
      this.setData({
        report,
        loading: false,
        ringData: {
          checkinDash: ringDash(raw.completedDays, raw.totalDays),
          focusDash: ringDash(raw.totalFocusMin, focusMax),
          streakDash: ringDash(raw.streakMax, 7),
          totalFocusHours,
        },
      })
      setTimeout(() => {
        this._drawRing('ring-checkin', raw.completedDays / Math.max(1, raw.totalDays), '#E06844')
        this._drawRing('ring-focus', Math.min(1, raw.totalFocusMin / focusMax), '#53A47A')
        this._drawRing('ring-streak', Math.min(1, raw.streakMax / 7), '#7468E8')
      }, 150)
    } catch (_) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onPrevWeek() {
    this.setData({ weekOffset: this.data.weekOffset + 1 })
    this.loadReport()
  },

  onNextWeek() {
    if (this.data.weekOffset <= 0) return
    this.setData({ weekOffset: this.data.weekOffset - 1 })
    this.loadReport()
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
    wx.showToast({ title: 'Pro 功能：生成分享卡片', icon: 'none' })
  },

  _drawRing(canvasId: string, progress: number, color: string) {
    const ctx = wx.createCanvasContext(canvasId, this)
    const cx = 37, cy = 37, r = 30, lw = 5

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.setStrokeStyle('rgba(255,255,255,0.08)')
    ctx.setLineWidth(lw)
    ctx.stroke()

    const p = Math.min(1, Math.max(0, progress))
    if (p > 0) {
      const end = -Math.PI / 2 + 2 * Math.PI * p
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, end)
      ctx.setStrokeStyle(color)
      ctx.setLineWidth(lw)
      ctx.setLineCap('round')
      ctx.stroke()
    }

    ctx.draw()
  },
})
