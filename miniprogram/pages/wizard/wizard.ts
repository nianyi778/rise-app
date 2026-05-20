import { createGoal } from '../../api/index'
import { store } from '../../store/index'
import type { OnboardingPayload, BlockerType } from '../../types/index'

type BlockerKey = BlockerType
type TimeKey = 'morning' | 'noon' | 'evening' | 'night'
type MinutesKey = '15' | '25' | '40'

interface WizardData {
  step: number
  totalSteps: number
  selectedBlocker: BlockerKey | ''
  selectedTime: TimeKey | ''
  selectedMinutes: MinutesKey | ''
  submitting: boolean
  goalTitle: string
  blockers: Array<{ key: BlockerKey; label: string; desc: string }>
  times: Array<{ key: TimeKey; label: string; desc: string }>
  minutes: Array<{ key: MinutesKey; label: string; desc: string }>
}

Page<WizardData, AnyObject>({
  data: {
    step: 1,
    totalSteps: 3,
    selectedBlocker: '',
    selectedTime: '',
    selectedMinutes: '25',
    submitting: false,
    goalTitle: '',
    blockers: [
      { key: 'no_time',     label: '总是没时间',   desc: '紧急的事情挤掉了重要的事' },
      { key: 'no_start',    label: '不知道怎么开始', desc: '有想法但卡在第一步' },
      { key: 'interrupted', label: '总被打断',      desc: '开始了但难以坚持' },
      { key: 'fear',        label: '内心有点怕',    desc: '担心做不好或不值得做' },
    ],
    times: [
      { key: 'morning', label: '早晨',   desc: '6:00 - 9:00' },
      { key: 'noon',    label: '午休',   desc: '12:00 - 14:00' },
      { key: 'evening', label: '傍晚',   desc: '18:00 - 20:00' },
      { key: 'night',   label: '夜晚',   desc: '21:00 - 23:00' },
    ],
    minutes: [
      { key: '15', label: '15 分钟', desc: '轻量，建立习惯' },
      { key: '25', label: '25 分钟', desc: '一个番茄钟，推荐' },
      { key: '40', label: '40 分钟', desc: '深度专注' },
    ],
  },

  onLoad() {
    const draft = wx.getStorageSync('onboardingDraft') as OnboardingPayload
    if (draft) {
      this.setData({ goalTitle: draft.rawInput.slice(0, 20) + (draft.rawInput.length > 20 ? '…' : '') })
    }
  },

  onSelectBlocker(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedBlocker: e.currentTarget.dataset['key'] as BlockerKey })
  },

  onSelectTime(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedTime: e.currentTarget.dataset['key'] as TimeKey })
  },

  onSelectMinutes(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedMinutes: e.currentTarget.dataset['key'] as MinutesKey })
  },

  onBack() {
    const { step } = this.data
    if (step === 1) {
      wx.navigateBack()
    } else {
      this.setData({ step: step - 1 })
    }
  },

  onNext() {
    const { step, selectedBlocker, selectedTime } = this.data
    if (step === 1 && !selectedBlocker) {
      wx.showToast({ title: '请选择最大阻力', icon: 'none' })
      return
    }
    if (step === 2 && !selectedTime) {
      wx.showToast({ title: '请选择专注时段', icon: 'none' })
      return
    }
    if (step < 3) {
      this.setData({ step: step + 1 })
    } else {
      this.onSubmit()
    }
  },

  async onSubmit() {
    const { selectedBlocker, selectedTime, selectedMinutes } = this.data
    const draft = wx.getStorageSync('onboardingDraft') as OnboardingPayload
    if (!draft) return

    const timeMap: Record<TimeKey, string> = {
      morning: '07:00',
      noon:    '12:30',
      evening: '18:30',
      night:   '21:00',
    }

    const payload: OnboardingPayload = {
      ...draft,
      blocker: selectedBlocker as BlockerType,
      availableTime: timeMap[selectedTime as TimeKey] || '21:00',
      dailyMinutes: parseInt(selectedMinutes || '25', 10),
    }

    this.setData({ submitting: true })
    try {
      const { goal, session } = await createGoal(payload)
      store.setCurrentGoal(goal)
      store.setTodaySession(session)
      wx.setStorageSync('currentGoal', goal)
      wx.removeStorageSync('onboardingDraft')
      wx.reLaunch({ url: '/pages/home/home' })
    } catch (e) {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
