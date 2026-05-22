import { getWeeklyReport } from '../../api/index'
import { calcDashOffset } from '../../utils/index'
import { swr } from '../../utils/cache'
import type { WeeklyReport, SessionStatus, MoodType } from '../../types/index'

interface DailyDisplayItem {
  date: string
  dayShort: string
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

  onShow() {
    const tabBar = this.getTabBar() as unknown as { setData: (d: object) => void } | undefined
    tabBar?.setData({ selected: 2 })
    this._loadReport()
  },

  _loadReport() {
    const { weekOffset } = this.data
    const cacheKey = `report_${weekOffset}`

    const cached = swr<WeeklyReport>(
      cacheKey,
      () => getWeeklyReport(weekOffset),
      (fresh) => this._applyReport(fresh),
    )

    if (cached) {
      this._applyReport(cached)
    } else {
      this.setData({ loading: true })
    }
  },

  _applyReport(raw: WeeklyReport) {
    const dailyData: DailyDisplayItem[] = raw.dailyData.map(d => ({
      ...d,
      dayShort: WEEK_DAYS[new Date(d.date).getDay()] ?? '',
    }))

    const totalFocusHours = (raw.totalFocusMin / 60).toFixed(1)
    const focusMax = (raw.totalDays * 30) || 210

    this.setData({
      report: { ...raw, dailyData },
      loading: false,
      pageEntered: true,
      ringData: {
        checkinDash: ringDash(raw.completedDays, raw.totalDays),
        focusDash: ringDash(raw.totalFocusMin, focusMax),
        streakDash: ringDash(raw.streakMax, 7),
        totalFocusHours,
      },
    })
  },

  onPrevWeek() {
    this.setData({ weekOffset: this.data.weekOffset + 1 })
    this._loadReport()
  },

  onNextWeek() {
    if (this.data.weekOffset <= 0) return
    this.setData({ weekOffset: this.data.weekOffset - 1 })
    this._loadReport()
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
    wx.showToast({ title: 'Pro 功能：生成分享卡片', icon: 'none' })
  },
})
