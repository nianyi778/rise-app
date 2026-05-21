import { createGoal } from '../../api/index'
import { store } from '../../store/index'
import type { GoalCategory, BlockerType, OnboardingPayload } from '../../types/index'

type TimeSlot = 'morning' | 'noon' | 'evening' | 'night'

interface CategoryOption {
  key: GoalCategory
  label: string
}

interface BlockerOption {
  key: BlockerType
  label: string
  desc: string
}

interface TimeOption {
  key: TimeSlot
  label: string
  desc: string
  value: string
}

interface WelcomeData {
  currentStep: number
  rawInput: string
  selectedCategory: GoalCategory | ''
  selectedBlocker: BlockerType | ''
  selectedTime: TimeSlot | ''
  dailyMinutes: number
  inputFocused: boolean
  submitting: boolean
  scrollH: string
  categories: CategoryOption[]
  blockerOptions: BlockerOption[]
  timeOptions: TimeOption[]
}

Page<WelcomeData, AnyObject>({
  data: {
    currentStep: 0,
    rawInput: '',
    selectedCategory: '',
    selectedBlocker: '',
    selectedTime: '',
    dailyMinutes: 25,
    inputFocused: false,
    submitting: false,
    scrollH: '100vh',
    categories: [
      { key: 'work',   label: '职场' },
      { key: 'health', label: '健康' },
      { key: 'learn',  label: '学习' },
      { key: 'fin',    label: '财务' },
      { key: 'create', label: '创意' },
      { key: 'relate', label: '关系' },
    ],
    blockerOptions: [
      { key: 'no_start',    label: '不知道怎么开始', desc: '方向模糊，无从下手' },
      { key: 'no_time',     label: '总感觉没时间',   desc: '每天很忙，找不到空隙' },
      { key: 'interrupted', label: '有思路，但就是拖', desc: '知道该做，就是迈不出那步' },
      { key: 'fear',        label: '怕做不好',       desc: '想做，但担心结果不够好' },
    ],
    timeOptions: [
      { key: 'morning', label: '早上',   desc: '起床后，清醒专注',         value: '07:00' },
      { key: 'noon',    label: '午休',   desc: '午饭后，碎片时间',         value: '12:30' },
      { key: 'evening', label: '下班后', desc: '下班途中或到家',           value: '19:00' },
      { key: 'night',   label: '睡前',   desc: '安静，适合思考型任务',     value: '22:00' },
    ],
  },

  onLoad() {
    const { hasOnboarded, currentGoal } = store.getState()
    if (hasOnboarded && currentGoal) {
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    const sys = wx.getSystemInfoSync()
    const rpxRatio = sys.windowWidth / 750
    const dotsH = Math.ceil(88 * rpxRatio) // 88rpx prog-dots area in px
    const scrollH = sys.windowHeight - (sys.statusBarHeight ?? 44) - dotsH
    this.setData({ scrollH: `${scrollH}px` })
  },

  onInputChange(e: WechatMiniprogram.Input) {
    this.setData({ rawInput: e.detail.value })
  },

  onInputFocus() {
    this.setData({ inputFocused: true })
  },

  onInputBlur() {
    this.setData({ inputFocused: false })
  },

  onCategoryTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset['key'] as GoalCategory
    this.setData({ selectedCategory: key })
  },

  onBlockerTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset['key'] as BlockerType
    this.setData({ selectedBlocker: key })
  },

  onTimeTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset['key'] as TimeSlot
    this.setData({ selectedTime: key })
  },

  onSliderChange(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    this.setData({ dailyMinutes: e.detail.value })
  },

  onNext() {
    const { currentStep, rawInput, selectedCategory, selectedBlocker } = this.data

    if (currentStep === 0) {
      if (!rawInput.trim() && !selectedCategory) {
        wx.showToast({ title: '请描述你的目标或选一个方向', icon: 'none' })
        return
      }
      this.setData({ currentStep: 1 })
      return
    }

    if (currentStep === 1) {
      if (!selectedBlocker) {
        wx.showToast({ title: '请选择最像你的阻力', icon: 'none' })
        return
      }
      this.setData({ currentStep: 2 })
    }
  },

  async onSubmit() {
    const { rawInput, selectedCategory, selectedBlocker, selectedTime, dailyMinutes, timeOptions, categories } = this.data

    if (!selectedTime) {
      wx.showToast({ title: '请选择你的可用时段', icon: 'none' })
      return
    }

    const timeOption = timeOptions.find((t: TimeOption) => t.key === selectedTime)
    const availableTime = timeOption ? timeOption.value : '21:00'

    const catLabel = categories.find((c: CategoryOption) => c.key === selectedCategory)?.label ?? ''
    const rawInputFinal = rawInput.trim() || (catLabel ? `我想在${catLabel}方向上取得突破` : '开始一个新目标')
    const category: GoalCategory = selectedCategory !== '' ? selectedCategory : 'work'
    const blocker: BlockerType = selectedBlocker !== '' ? selectedBlocker : 'no_time'

    this.setData({ submitting: true })

    const payload: OnboardingPayload = {
      rawInput: rawInputFinal,
      category,
      blocker,
      availableTime,
      dailyMinutes,
    }

    try {
      const result = await createGoal(payload)
      store.setState({
        hasOnboarded: true,
        currentGoal: result.goal,
        todaySession: result.session,
      })
      wx.reLaunch({ url: '/pages/home/home' })
    } catch (_err) {
      this.setData({ submitting: false })
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  },
})
