import { getTodayCheckin, streamChatMessage } from '../../api/index'
import { store } from '../../store/index'
import { friendlyDate } from '../../utils/index'
import { swr } from '../../utils/cache'
import type { Checkin, ChatMessage } from '../../types/index'

interface ReflectionData {
  dateLabel: string
  todayCheckin: Checkin | null
  chatMessages: ChatMessage[]
  inputText: string
  replying: boolean
  streamingText: string
  scrollToId: string
  pageEntered: boolean
}

Page<ReflectionData, AnyObject>({
  _streamTask: null as WechatMiniprogram.RequestTask | null,
  _greeted: false as boolean,

  data: {
    dateLabel: '',
    todayCheckin: null,
    chatMessages: [],
    inputText: '',
    replying: false,
    streamingText: '',
    scrollToId: '',
    pageEntered: false,
  },

  onShow() {
    const today = new Date().toISOString().slice(0, 10)
    this.setData({ dateLabel: friendlyDate(today) })

    const tabBar = this.getTabBar() as unknown as { setData: (d: object) => void } | undefined
    tabBar?.setData({ selected: 1 })

    this._loadCheckin()
  },

  _loadCheckin() {
    const storeState = store.getState()
    const today = new Date().toISOString().slice(0, 10)

    // In-memory store takes priority (populated immediately after check-in)
    const fromStore = storeState.recentCheckins.find(c => c.date === today) ?? null
    if (fromStore) {
      this._applyCheckin(fromStore)
      return
    }

    // SWR: show cached checkin immediately, refresh in background
    const cached = swr<Checkin | null>(
      `checkin_${today}`,
      async () => {
        const checkins = await getTodayCheckin()
        return checkins.find(c => c.date === today) ?? null
      },
      (fresh) => this._applyCheckin(fresh),
    )

    this._applyCheckin(cached)
  },

  _applyCheckin(checkin: Checkin | null) {
    this.setData({ todayCheckin: checkin, pageEntered: true })
    const storeState = store.getState()
    if (checkin && !this._greeted) {
      this._greeted = true
      const existing = storeState.chatHistory
      if (existing.length > 0) {
        this.setData({ chatMessages: existing })
      } else {
        this._openAIGreeting(checkin)
      }
    }
  },

  _openAIGreeting(checkin: Checkin) {
    const { currentGoal, todaySession } = store.getState()
    if (!currentGoal) return

    const initMsg: ChatMessage = {
      role: 'user',
      content: `我刚完成了今天的目标：${todaySession?.action ?? '今日任务'}。心情：${checkin.mood}。${checkin.note ? '备注：' + checkin.note : ''}`,
      timestamp: Date.now(),
    }

    this.setData({ replying: true, streamingText: '' })

    let accText = ''
    this._streamTask = streamChatMessage(
      currentGoal._id,
      checkin._id,
      [initMsg],
      (delta) => {
        accText += delta
        this.setData({ streamingText: accText })
      },
      () => {
        const replyMsg: ChatMessage = { role: 'assistant', content: accText, timestamp: Date.now() }
        store.pushChatMessage(initMsg)
        store.pushChatMessage(replyMsg)
        this.setData({
          chatMessages: [replyMsg],
          streamingText: '',
          replying: false,
        })
        this._scrollToBottom()
      },
      () => {
        this.setData({
          chatMessages: [{ role: 'assistant', content: '今天完成了，很棒！感觉怎么样？', timestamp: Date.now() }],
          streamingText: '',
          replying: false,
        })
      },
    )
  },

  onInputChange(e: WechatMiniprogram.Input) {
    this.setData({ inputText: e.detail.value })
  },

  onSend() {
    const { inputText, chatMessages } = this.data
    if (!inputText.trim() || this.data.replying) return

    const { currentGoal, todaySession } = store.getState()
    if (!currentGoal) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    }

    const allHistory = [...store.getState().chatHistory, userMsg]
    store.pushChatMessage(userMsg)

    this.setData({
      chatMessages: [...chatMessages, userMsg],
      inputText: '',
      replying: true,
      streamingText: '',
    })
    this._scrollToBottom()

    let accText = ''
    this._streamTask = streamChatMessage(
      currentGoal._id,
      todaySession?._id ?? undefined,
      allHistory,
      (delta) => {
        accText += delta
        this.setData({ streamingText: accText })
        this._scrollToBottom()
      },
      () => {
        const replyMsg: ChatMessage = { role: 'assistant', content: accText, timestamp: Date.now() }
        store.pushChatMessage(replyMsg)
        this.setData({
          chatMessages: [...this.data.chatMessages, replyMsg],
          streamingText: '',
          replying: false,
        })
        this._scrollToBottom()
      },
      (err) => {
        console.error('[reflection] stream error', err)
        this.setData({ replying: false, streamingText: '' })
        wx.showToast({ title: '回复失败，请重试', icon: 'none' })
      },
    )
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  _scrollToBottom() {
    this.setData({ scrollToId: 'bottom' })
    setTimeout(() => this.setData({ scrollToId: '' }), 300)
  },

  onUnload() {
    this._streamTask?.abort()
  },
})
