import { getCheckins, sendChatMessage, streamChatMessage } from '../../api/index'
import { store } from '../../store/index'
import { friendlyDate } from '../../utils/index'
import type { Checkin, ChatMessage } from '../../types/index'

interface ReflectionData {
  dateLabel: string
  todayCheckin: Checkin | null
  chatMessages: ChatMessage[]
  inputText: string
  replying: boolean
  streamingText: string
  suggestions: string[]
  scrollToId: string
  pageEntered: boolean
}

Page<ReflectionData, AnyObject>({
  _streamTask: null as WechatMiniprogram.RequestTask | null,

  data: {
    dateLabel: '',
    todayCheckin: null,
    chatMessages: [],
    inputText: '',
    replying: false,
    streamingText: '',
    suggestions: [],
    scrollToId: '',
    pageEntered: false,
  },

  async onShow() {
    const today = new Date().toISOString().slice(0, 10)
    this.setData({
      dateLabel: friendlyDate(today),
      pageEntered: false,
    })

    await this.loadCheckin()
    setTimeout(() => this.setData({ pageEntered: true }), 50)
  },

  async loadCheckin() {
    const { currentGoal } = store.getState()
    if (!currentGoal) return

    try {
      const checkins = await getCheckins(currentGoal._id, 1)
      const today = new Date().toISOString().slice(0, 10)
      const todayCheckin = checkins.find(c => c.date === today) || null

      if (todayCheckin) {
        const history = store.getState().chatHistory
        const aiGreeting = history.length === 0
          ? await this._openAIChat(todayCheckin)
          : null
        this.setData({
          todayCheckin,
          chatMessages: aiGreeting
            ? [{ role: 'assistant', content: aiGreeting, timestamp: Date.now() }]
            : history,
        })
      }
    } catch (e) {
      console.error('加载打卡失败', e)
    }
  },

  async _openAIChat(checkin: Checkin): Promise<string> {
    const { currentGoal, todaySession } = store.getState()
    if (!todaySession || !currentGoal) return ''

    const systemMsg: ChatMessage = {
      role: 'user',
      content: `我刚完成了今天的目标：${todaySession.action}。心情是：${checkin.mood}。${checkin.note ? '备注：' + checkin.note : ''}`,
      timestamp: Date.now(),
    }
    try {
      const reply = await sendChatMessage(todaySession._id, [systemMsg])
      store.pushChatMessage(systemMsg)
      const replyMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() }
      store.pushChatMessage(replyMsg)
      return reply
    } catch (_) {
      return '今天完成了，很棒！感觉怎么样？'
    }
  },

  onInputChange(e: WechatMiniprogram.Input) {
    this.setData({ inputText: e.detail.value })
  },

  async onSend() {
    const { inputText, chatMessages } = this.data
    if (!inputText.trim() || this.data.replying) return

    const { todaySession } = store.getState()
    if (!todaySession) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    }

    store.pushChatMessage(userMsg)
    this.setData({
      chatMessages: [...chatMessages, userMsg],
      inputText: '',
      replying: true,
      streamingText: '',
    })
    this._scrollToBottom()

    const allMessages = store.getState().chatHistory

    // streaming 回复
    this._streamTask = streamChatMessage(
      todaySession._id,
      allMessages,
      (delta) => {
        this.setData({ streamingText: this.data.streamingText + delta })
      },
      () => {
        const finalText = this.data.streamingText
        const replyMsg: ChatMessage = { role: 'assistant', content: finalText, timestamp: Date.now() }
        store.pushChatMessage(replyMsg)
        this.setData({
          chatMessages: [...this.data.chatMessages, replyMsg],
          streamingText: '',
          replying: false,
        })
        this._scrollToBottom()
      },
      (err) => {
        console.error('streaming 失败', err)
        this.setData({ replying: false, streamingText: '' })
      },
    )
  },

  onUseSuggestion(e: WechatMiniprogram.TouchEvent) {
    const text = e.currentTarget.dataset['text'] as string
    this.setData({ inputText: text })
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
