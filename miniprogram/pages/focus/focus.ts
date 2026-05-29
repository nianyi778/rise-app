import { store } from '../../store/index'
import { formatCountdown } from '../../utils/index'
import type { Session, Goal } from '../../types/index'

type Ctx2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D

interface CanvasQueryResult {
  node?: WechatMiniprogram.Canvas
  width?: number
  height?: number
}

interface FocusData {
  totalSec: number
  remainSec: number
  isRunning: boolean
  isPaused: boolean
  action: string
  goalTitle: string
  phaseName: string
  dayIndex: number
  timeDisplay: string
}

Page<FocusData, AnyObject>({
  // 私有字段
  _timer: null as ReturnType<typeof setInterval> | null,
  _ctx: null as Ctx2D | null,
  _canvasReady: false as boolean,
  _hasStarted: false as boolean,
  _sessionId: '' as string,
  // 累计专注秒数（跨多段暂停/恢复）
  _accumulatedSec: 0 as number,
  // 当前段开始时间戳（ms），暂停时置 0
  _segmentStart: 0 as number,

  data: {
    totalSec: 1500,
    remainSec: 1500,
    isRunning: false,
    isPaused: false,
    action: '',
    goalTitle: '',
    phaseName: '',
    dayIndex: 0,
    timeDisplay: '25:00',
  },

  onLoad(options: Record<string, string>) {
    this._sessionId = options.sessionId ?? ''

    const state = store.getState()
    const session: Session | null = state.todaySession
    const goal: Goal | null = state.currentGoal

    if (!session || !goal) {
      wx.showToast({ title: '任务数据异常', icon: 'none' })
      wx.navigateBack()
      return
    }

    const totalSec = (session.estimatedMin || 25) * 60
    this.setData({
      action: session.action,
      goalTitle: goal.title,
      phaseName: goal.phase.name,
      dayIndex: session.dayIndex,
      totalSec,
      remainSec: totalSec,
      timeDisplay: formatCountdown(totalSec),
    })
  },

  onReady() {
    this._initCanvas()
  },

  onShow() {
    if (!this._hasStarted) {
      this._hasStarted = true
      this._startTimer()
    }
  },

  onHide() {
    if (this.data.isRunning) {
      this._pauseTimer()
    }
  },

  onUnload() {
    this._clearInterval()
    wx.setKeepScreenOn({ keepScreenOn: false })
  },

  onBack() {
    if (this.data.isRunning) {
      wx.showModal({
        title: '退出专注？',
        content: '专注计时将暂停，进度已保留',
        confirmText: '退出',
        cancelText: '继续专注',
        success: (res: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
          if (res.confirm) {
            this._clearInterval()
            wx.navigateBack()
          }
        },
      })
    } else {
      wx.navigateBack()
    }
  },

  onTogglePause() {
    if (this.data.isPaused) {
      this._resumeTimer()
    } else {
      this._pauseTimer()
    }
  },

  onEarlyEnd() {
    wx.showModal({
      title: '提前结束？',
      content: '记录你专注的时间，照样算打卡',
      confirmText: '结束专注',
      cancelText: '继续',
      success: (res: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
        if (res.confirm) {
          this._clearInterval()
          this._goComplete()
        }
      },
    })
  },

  _startTimer() {
    this._segmentStart = Date.now()
    this.setData({ isRunning: true, isPaused: false })
    wx.setKeepScreenOn({ keepScreenOn: true })

    this._timer = setInterval(() => {
      const { remainSec, totalSec } = this.data
      const next = Math.max(0, remainSec - 1)
      const progress = totalSec > 0 ? (totalSec - next) / totalSec : 0

      this.setData({
        remainSec: next,
        timeDisplay: formatCountdown(next),
      })
      this._drawRing(progress)

      if (next === 0) {
        this._clearInterval()
        this._goComplete()
      }
    }, 1000)
  },

  _pauseTimer() {
    // 把当前段的时长累加到总计
    if (this._segmentStart > 0) {
      this._accumulatedSec += Math.round((Date.now() - this._segmentStart) / 1000)
      this._segmentStart = 0
    }
    this._clearInterval()
    this.setData({ isRunning: false, isPaused: true })
    wx.setKeepScreenOn({ keepScreenOn: false })
  },

  _resumeTimer() {
    this._startTimer()
  },

  _clearInterval() {
    if (this._timer !== null) {
      clearInterval(this._timer)
      this._timer = null
    }
    this.setData({ isRunning: false })
  },

  _initCanvas() {
    this._getCanvas()
      .then((canvas: WechatMiniprogram.Canvas) => {
        const { pixelRatio: dpr } = wx.getWindowInfo()
        const size = 260
        canvas.width = size * dpr
        canvas.height = size * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        this._ctx = ctx
        this._canvasReady = true
        const { remainSec, totalSec } = this.data
        this._drawRing(totalSec > 0 ? (totalSec - remainSec) / totalSec : 0)
      })
      .catch(() => {
        // canvas 节点未挂载时忽略，下次计时 tick 会重试
      })
  },

  _getCanvas(): Promise<WechatMiniprogram.Canvas> {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#timerRing')
        .fields({ node: true, size: true })
        .exec((results: (CanvasQueryResult | null)[]) => {
          const node = results[0]?.node
          if (node) {
            resolve(node)
          } else {
            reject(new Error('canvas node not found'))
          }
        })
    })
  },

  _drawRing(progress: number) {
    const ctx = this._ctx
    if (!ctx) return

    const size = 260
    const cx = 130
    const cy = 130
    const r = 116
    const lw = 10

    ctx.clearRect(0, 0, size, size)

    // 背景轨道
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.stroke()

    // 进度弧：从顶部 -π/2 顺时针，lineCap=round
    if (progress > 0) {
      const endAngle = -Math.PI / 2 + 2 * Math.PI * progress
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, endAngle)
      ctx.strokeStyle = '#E06844'
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  },

  _goComplete() {
    if (this._segmentStart > 0) {
      this._accumulatedSec += Math.round((Date.now() - this._segmentStart) / 1000)
      this._segmentStart = 0
    }
    const focusMin = Math.max(1, Math.round(this._accumulatedSec / 60))
    wx.setKeepScreenOn({ keepScreenOn: false })

    const { currentGoal, todaySession } = store.getState()
    const nextDay = (todaySession?.dayIndex ?? 0) + 1
    let tomorrowAction = ''
    if (currentGoal?.aiPlan?.dailyActions) {
      for (const da of currentGoal.aiPlan.dailyActions) {
        const parts = da.dayRange.split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : start
        if (nextDay >= start && nextDay <= end) {
          tomorrowAction = da.example != null ? da.example : da.theme
          break
        }
      }
    }

    wx.navigateTo({
      url: `/pages/complete/complete?focusMin=${focusMin}&sessionId=${this._sessionId}&tomorrowAction=${encodeURIComponent(tomorrowAction)}`,
    })
  },
})
