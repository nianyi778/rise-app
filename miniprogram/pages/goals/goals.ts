import { getGoals, updateGoalStatus } from '../../api/index'
import { store } from '../../store/index'
import { calcDashOffset } from '../../utils/index'
import type { Goal, GoalStatus } from '../../types/index'

interface GoalDisplayItem {
  _id: string
  title: string
  category: string
  dayIndex: number
  phaseName: string
  todayAction: string
  progress: number
  dashOffset: number    // SVG stroke-dashoffset (r=24, circ≈150.8)
  color: string
  colorGlow: string
  isActive: boolean
}

interface GoalsData {
  goals: GoalDisplayItem[]
  loading: boolean
  isPro: boolean
  maxGoals: number
  showUpgrade: boolean
  pageEntered: boolean
  proFeatures: string[]
}

const CAT_COLOR: Record<string, { stroke: string; glow: string }> = {
  work:    { stroke: '#E06844', glow: 'rgba(224,104,68,0.18)' },
  health:  { stroke: '#53A47A', glow: 'rgba(83,164,122,0.15)' },
  learn:   { stroke: '#7468E8', glow: 'rgba(116,104,232,0.15)' },
  fin:     { stroke: '#F5C542', glow: 'rgba(245,197,66,0.18)' },
  create:  { stroke: '#E06844', glow: 'rgba(224,104,68,0.18)' },
  relate:  { stroke: '#53A47A', glow: 'rgba(83,164,122,0.15)' },
  custom:  { stroke: '#7468E8', glow: 'rgba(116,104,232,0.15)' },
}

function toDisplayItem(goal: Goal, dayIndex: number, todayAction: string): GoalDisplayItem {
  const total = goal.phase.durationDays
  const progress = total > 0 ? Math.min(1, dayIndex / total) : 0
  const cat = CAT_COLOR[goal.category] ?? CAT_COLOR['custom']
  return {
    _id: goal._id,
    title: goal.title,
    category: goal.category,
    dayIndex,
    phaseName: goal.phase.name,
    todayAction,
    progress,
    dashOffset: calcDashOffset(progress, 24),
    color: cat.stroke,
    colorGlow: cat.glow,
    isActive: goal.status === 'active',
  }
}

Page<GoalsData, AnyObject>({
  data: {
    goals: [],
    loading: true,
    isPro: false,
    maxGoals: 1,
    showUpgrade: false,
    pageEntered: false,
    proFeatures: [
      '最多 5 个目标并行守护',
      '完整 AI 复盘对话（不限次数）',
      '周报分享卡片生成',
      '历史数据导出',
    ],
  },

  async onShow() {
    this.setData({ pageEntered: false })
    const tabBar = this.getTabBar() as unknown as { setData: (d: object) => void } | undefined
    tabBar?.setData({ selected: 3 })
    await this.loadGoals()
    setTimeout(() => this.setData({ pageEntered: true }), 50)
  },

  async loadGoals() {
    this.setData({ loading: true })
    try {
      const rawGoals = await getGoals()
      const { userInfo, todaySession } = store.getState()
      const isPro = userInfo?.plan === 'pro'
      const maxGoals = isPro ? 5 : 1

      const displayGoals: GoalDisplayItem[] = rawGoals.map((g: Goal) => {
        const dayIndex = (todaySession?.goalId === g._id)
          ? (todaySession?.dayIndex ?? 1)
          : 1
        const todayAction = (todaySession?.goalId === g._id)
          ? (todaySession?.action ?? '')
          : ''
        return toDisplayItem(g, dayIndex, todayAction)
      })

      const activeGoal = rawGoals.find((g: Goal) => g.status === 'active') ?? null
      if (activeGoal) store.setCurrentGoal(activeGoal)

      this.setData({ goals: displayGoals, isPro, maxGoals, loading: false })
    } catch (_) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onGoalTap(e: WechatMiniprogram.TouchEvent) {
    const goalId = e.currentTarget.dataset['id'] as string
    const { goals } = this.data
    const item = goals.find((g: GoalDisplayItem) => g._id === goalId)
    if (!item) return
    wx.switchTab({ url: '/pages/home/home' })
  },

  onAddGoal() {
    const { goals, isPro } = this.data
    if (!isPro && goals.length >= 1) {
      this.setData({ showUpgrade: true })
      return
    }
    wx.navigateTo({ url: '/pages/welcome/welcome' })
  },

  onCloseUpgrade() {
    this.setData({ showUpgrade: false })
  },

  onGoUpgrade() {
    this.setData({ showUpgrade: false })
    wx.showToast({ title: '即将开放，敬请期待', icon: 'none' })
  },

  onPauseGoal(e: WechatMiniprogram.TouchEvent) {
    const goalId = e.currentTarget.dataset['id'] as string
    wx.showModal({
      title: '暂停要事',
      content: '暂停后，这个目标的每日行动将不再生成',
      confirmText: '暂停',
      cancelText: '取消',
      success: async (res: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
        if (res.confirm) await this._updateStatus(goalId, 'paused')
      },
    })
  },

  onResumeGoal(e: WechatMiniprogram.TouchEvent) {
    const goalId = e.currentTarget.dataset['id'] as string
    this._updateStatus(goalId, 'active')
  },

  async _updateStatus(goalId: string, status: GoalStatus) {
    try {
      await updateGoalStatus(goalId, status)
      await this.loadGoals()
    } catch (_) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },
})
