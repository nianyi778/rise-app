import { getTodaySession, getGoals } from '../../api/index'
import { store } from '../../store/index'
import { greeting, weekdayCN, formatDate, calcDashOffset, RING_CIRCUMFERENCE_27 } from '../../utils/index'
import { drawShareCard } from '../../utils/shareCard'
import type { Goal, Session } from '../../types/index'

interface HomeData {
  greet: string
  nickname: string
  dateLabel: string
  goal: Goal | null
  session: Session | null
  streakDays: number
  dayProgress: number
  dayProgressPct: number
  dayDashOffset: number
  aiNote: string
  loading: boolean
  pageEntered: boolean
}

Page<HomeData, AnyObject>({
  data: {
    greet: '',
    nickname: '',
    dateLabel: '',
    goal: null,
    session: null,
    streakDays: 0,
    dayProgress: 0,
    dayProgressPct: 0,
    dayDashOffset: RING_CIRCUMFERENCE_27,
    aiNote: '',
    loading: true,
    pageEntered: false,
  },

  onLoad() {
    const state = store.getState()
    this.setData({
      greet: greeting(),
      nickname: state.userInfo?.nickname ?? '',
      dateLabel: `${weekdayCN()} · ${formatDate(new Date(), 'MM月DD日')}`,
      streakDays: state.streakDays,
    })
  },

  async onShow() {
    const tabBar = this.getTabBar() as unknown as { setData: (d: object) => void } | undefined
    tabBar?.setData({ selected: 0 })
    await this.loadData()
    if (!this.data.pageEntered) {
      setTimeout(() => this.setData({ pageEntered: true }), 50)
    }
  },

  async loadData() {
    type CacheShape = { goal: Goal; session: Session }
    const cached = wx.getStorageSync('home_data') as CacheShape | ''
    if (cached && cached.goal && cached.session) {
      this._renderData(cached.goal, cached.session)
      this.setData({ loading: false })
      // silent background refresh — do NOT delete cache if server returns empty (transient flap)
      getGoals().then(goals => {
        const g = goals.find(g => g.status === 'active')
        if (!g) return
        return getTodaySession(g._id).then(s => {
          wx.setStorageSync('home_data', { goal: g, session: s })
          this._renderData(g, s)
        })
      }).catch(() => {})
      return
    }

    this.setData({ loading: true })
    try {
      const goals = await getGoals()
      const activeGoal = goals.find(g => g.status === 'active') || null
      if (!activeGoal) { wx.switchTab({ url: '/pages/goals/goals' }); return }
      const session = await getTodaySession(activeGoal._id)
      wx.setStorageSync('home_data', { goal: activeGoal, session })
      this._renderData(activeGoal, session)
      this.setData({ loading: false })
    } catch {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
    }
  },

  _renderData(activeGoal: Goal, session: Session) {
    const dayProgress = activeGoal.phase.durationDays > 0
      ? session.dayIndex / activeGoal.phase.durationDays
      : 0
    store.setCurrentGoal(activeGoal)
    store.setTodaySession(session)
    const state = store.getState()
    this.setData({
      goal: activeGoal,
      session,
      nickname: state.userInfo?.nickname ?? this.data.nickname,
      streakDays: state.streakDays,
      dayProgress,
      dayProgressPct: Math.floor(dayProgress * 100),
      dayDashOffset: calcDashOffset(dayProgress, 27),
      aiNote: activeGoal.aiPlan?.encouragement || '专注当下，每一步都算数',
    })
    setTimeout(() => this._drawDayRing(dayProgress), 200)
  },

  onPullDownRefresh() {
    wx.removeStorageSync('home_data')
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  /**
   * 使用 Canvas 2D API（非 deprecated 的 createCanvasContext）绘制天数进度环
   */
  _drawDayRing(progress: number) {
    const query = wx.createSelectorQuery().in(this)
    query
      .select('#dayRing')
      .fields({ node: true, size: true })
      .exec((res: Array<{ node: WechatMiniprogram.Canvas; width: number; height: number } | null>) => {
        const result = res[0]
        if (!result?.node) return

        const canvas = result.node
        const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
        if (!ctx) return

        // 适配 dpr（优先 getWindowInfo，兼容旧版）
        const dpr = wx.getWindowInfo?.().pixelRatio ?? wx.getSystemInfoSync().pixelRatio
        const w = result.width
        const h = result.height
        canvas.width  = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const cx = w / 2
        const cy = h / 2
        const r  = w * 0.41          // ~22px on 54px canvas
        const lw = w * 0.083         // ~4.5px on 54px canvas

        ctx.clearRect(0, 0, w, h)

        // 轨道圆（半透明白）
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth   = lw
        ctx.stroke()

        // 进度弧（白色，round cap）
        if (progress > 0) {
          const startAngle = -Math.PI / 2
          const endAngle   = startAngle + 2 * Math.PI * Math.min(1, progress)
          ctx.beginPath()
          ctx.arc(cx, cy, r, startAngle, endAngle)
          ctx.strokeStyle = 'rgba(255,255,255,0.90)'
          ctx.lineWidth   = lw
          ctx.lineCap     = 'round'
          ctx.stroke()
        }
      })
  },

  onStartFocus() {
    const { session } = this.data
    if (!session) return
    wx.navigateTo({ url: `/pages/focus/focus?sessionId=${session._id}` })
  },

  onSkip() {
    wx.showActionSheet({
      itemList: ['今天跳过，明天继续'],
      success: () => {
        wx.showToast({ title: '已记录，明天继续加油', icon: 'none' })
      },
    })
  },

  onGoReflection() {
    wx.switchTab({ url: '/pages/reflection/reflection' })
  },

  async onShare() {
    const { goal, session, streakDays, dayProgress } = this.data
    if (!goal || !session) return
    const state = store.getState()
    try {
      const filePath = await drawShareCard({
        canvasId: 'shareCanvas',
        pageInstance: this,
        goalTitle: goal.title,
        action: session.action,
        dayIndex: session.dayIndex,
        streakDays,
        phaseProgress: dayProgress,
        phaseName: goal.phase.name,
        nickname: state.userInfo?.nickname ?? '朋友',
        focusMin: session.estimatedMin,
      })
      wx.showShareImageMenu({ path: filePath })
    } catch {
      wx.showToast({ title: '生成分享卡失败', icon: 'none' })
    }
  },
})
