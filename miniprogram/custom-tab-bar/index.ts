const TABS = [
  { url: '/pages/home/home' },
  { url: '/pages/reflection/reflection' },
  { url: '/pages/report/report' },
  { url: '/pages/goals/goals' },
]

Component({
  data: {
    selected: 0,
  },

  methods: {
    onTabTap(e: WechatMiniprogram.TouchEvent) {
      const index = e.currentTarget.dataset['index'] as number
      const url = TABS[index]?.url
      if (!url) return
      wx.switchTab({ url })
    },
  },
})
