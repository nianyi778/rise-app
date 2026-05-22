import { getWeeklyReport } from '../../api/index'
import { calcDashOffset } from '../../utils/index'
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

  async onShow() {
    this.setData({ pageEntered: false })
    const tabBar = this.getTabBar() as unknown as { setData: (d: object) => void } | undefined
    tabBar?.setData({ selected: 2 })
    await this.loadReport()
    setTimeout(() => this.setData({ pageEntered: true }), 50)
  },

  async loadReport() {
    const { weekOffset } = this.data
    const cacheKey = `report_${weekOffset}`

    const cached = wx.getStorageSync(cacheKey) as WeeklyReport | ''
    if (cached && cached.dailyData) {
      this._renderReport(cached)
      this.setData({ loading: false })
      // silent background refresh
      getWeeklyReport(weekOffset).then(fresh => {
        wx.setStorageSync(cacheKey, fresh)
        this._renderReport(fresh)
      }).catch(() => {})
      return
    }

    this.setData({ loading: true })
    try {
      const raw = await getWeeklyReport(weekOffset)
      wx.setStorageSync(cacheKey, raw)
      this._renderReport(raw)
      this.setData({ loading: false })
    } catch {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  _renderReport(raw: WeeklyReport) {
    const dailyData: DailyDisplayItem[] = raw.dailyData.map(d => ({
      ...d,
      dayShort: WEEK_DAYS[new Date(d.date).getDay()] ?? '',
    }))
    const totalFocusHours = (raw.totalFocusMin / 60).toFixed(1)
    const focusMax = (raw.totalDays * 30) || 210
    this.setData({
      report: { ...raw, dailyData },
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
})
