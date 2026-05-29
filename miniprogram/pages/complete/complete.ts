import { submitCheckin } from '../../api/index'
import { store } from '../../store/index'
import type { MoodType, CheckinPayload } from '../../types/index'
import { drawShareCard } from '../../utils/shareCard'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  w: number
  h: number
  rotation: number
  rotVel: number
  life: number
}

interface CompleteData {
  focusMin: number
  streakDays: number
  dayIndex: number
  tomorrowAction: string
  selectedMood: MoodType | ''
  note: string
  submitting: boolean
  submitted: boolean
  isNewRecord: boolean
  sharing: boolean
  moods: Array<{ key: MoodType; label: string }>
}

Page<CompleteData, AnyObject>({
  data: {
    focusMin: 0,
    streakDays: 0,
    dayIndex: 1,
    tomorrowAction: '',
    selectedMood: '',
    note: '',
    submitting: false,
    submitted: false,
    isNewRecord: false,
    sharing: false,
    moods: [
      { key: 'hard',  label: '有点难' },
      { key: 'ok',    label: '还好'   },
      { key: 'good',  label: '不错'   },
      { key: 'great', label: '超棒'   },
    ],
  },

  onLoad(options: Record<string, string>) {
    const focusMin = parseInt(options['focusMin'] || '25', 10)
    const { streakDays, todaySession } = store.getState()
    const dayIndex = todaySession?.dayIndex ?? 1
    const tomorrowAction = decodeURIComponent(options['tomorrowAction'] || '')
    this.setData({ focusMin, streakDays, dayIndex, tomorrowAction })
  },

  onReady() {
    this._launchConfetti()
  },

  _launchConfetti() {
    const query = wx.createSelectorQuery()
    query
      .select('#confettiCanvas')
      .fields({ node: true, size: true })
      .exec((res: Array<{ node: WechatMiniprogram.Canvas; width: number; height: number } | null>) => {
        if (!res[0] || !res[0].node) return

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const winInfo = wx.getWindowInfo()
        const dpr = winInfo.pixelRatio ?? 2
        const W = winInfo.windowWidth
        const H = winInfo.windowHeight

        canvas.width  = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        const COLORS = ['#E06844', '#7468E8', '#53A47A', '#F5C542', '#FF69B4']
        const particles: Particle[] = []

        for (let i = 0; i < 100; i++) {
          particles.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 10,
            vy: Math.random() * 5 + 2,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            w: Math.random() * 8 + 3,
            h: Math.random() * 5 + 2,
            rotation: Math.random() * Math.PI * 2,
            rotVel: (Math.random() - 0.5) * 0.25,
            life: 1.0,
          })
        }

        let frame = 0
        const MAX_FRAMES = 150
        let startTs = -1
        const WARM_MS = 300

        const animate = (ts: number) => {
          if (startTs < 0) startTs = ts
          if (ts - startTs < WARM_MS) {
            canvas.requestAnimationFrame(animate)
            return
          }

          ctx.clearRect(0, 0, W, H)
          let anyAlive = false

          for (const p of particles) {
            if (p.life <= 0) continue
            anyAlive = true
            p.x += p.vx
            p.y += p.vy
            p.vy += 0.15
            p.life -= 0.007
            p.rotation += p.rotVel
            ctx.save()
            ctx.globalAlpha = Math.max(0, p.life)
            ctx.fillStyle = p.color
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
            ctx.restore()
          }

          frame++
          if (frame < MAX_FRAMES && anyAlive) {
            canvas.requestAnimationFrame(animate)
          }
        }

        canvas.requestAnimationFrame(animate)
      })
  },

  onSelectMood(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedMood: e.currentTarget.dataset['key'] as MoodType })
  },

  onNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ note: e.detail.value })
  },

  async onSave() {
    const { selectedMood, note, focusMin } = this.data
    if (!selectedMood) {
      wx.showToast({ title: '选个心情吧', icon: 'none' })
      return
    }

    const state = store.getState()
    const session = state.todaySession
    if (!session) {
      wx.showToast({ title: '数据异常，请返回重试', icon: 'none' })
      return
    }

    const payload: CheckinPayload = {
      sessionId: session._id,
      goalId: session.goalId,
      mood: selectedMood,
      note,
      focusMin,
    }

    this.setData({ submitting: true })
    try {
      const result = await submitCheckin(payload)
      store.appendCheckin(result.checkin)
      wx.removeStorageSync('home_data')
      this.setData({
        submitting: false,
        submitted: true,
        streakDays: result.streakDay,
        isNewRecord: result.isNewRecord,
      })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/reflection/reflection' })
      }, 1800)
    } catch {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  async onShare() {
    if (this.data.sharing) return
    this.setData({ sharing: true })

    try {
      const state = store.getState()
      const goal  = state.currentGoal
      const user  = state.userInfo

      const goalTitle     = goal?.title ?? '今日目标'
      const action        = goal?.aiPlan?.phase?.target ?? this.data.tomorrowAction ?? '完成今日要事'
      const phaseName     = goal?.phase?.name ?? '进行中'
      const phaseDays     = goal?.phase?.durationDays ?? 30
      const phaseProgress = Math.min(1, this.data.dayIndex / phaseDays)
      const nickname      = user?.nickname ?? '你'

      const tempPath = await drawShareCard({
        canvasId:      'shareCard',
        pageInstance:  this,
        goalTitle,
        action,
        dayIndex:      this.data.dayIndex,
        streakDays:    this.data.streakDays,
        phaseProgress,
        phaseName,
        nickname,
        focusMin:      this.data.focusMin,
      })

      this.setData({ sharing: false })

      wx.showActionSheet({
        itemList: ['保存到相册', '分享给朋友'],
        success: (res: WechatMiniprogram.ShowActionSheetSuccessCallbackResult) => {
          if (res.tapIndex === 0) {
            wx.saveImageToPhotosAlbum({
              filePath: tempPath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
                if (err?.errMsg?.includes('auth deny') || err?.errMsg?.includes('authorize')) {
                  wx.showModal({
                    title: '需要相册权限',
                    content: '请在设置中开启相册权限',
                    confirmText: '去设置',
                    success: (modal: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
                      if (modal.confirm) wx.openSetting({})
                    },
                  })
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' })
                }
              },
            })
          } else if (res.tapIndex === 1) {
            wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] })
            wx.showToast({ title: '请点右上角菜单分享', icon: 'none', duration: 2500 })
          }
        },
        fail: () => { /* 用户取消 */ },
      })
    } catch (err) {
      this.setData({ sharing: false })
      wx.showToast({ title: '生成卡片失败，请重试', icon: 'none' })
      console.error('[shareCard] error:', err)
    }
  },
})
