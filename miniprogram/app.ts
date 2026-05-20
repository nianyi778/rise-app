import { store } from './store/index'
import { wxLogin } from './api/index'
import type { User, Goal, Session } from './types/index'

App<IAppOption>({
  globalData: {
    userInfo: null as User | null,
    currentGoal: null as Goal | null,
    todaySession: null as Session | null,
    systemInfo: null as WechatMiniprogram.SystemInfo | null,
  },

  async onLaunch() {
    // 获取系统信息（状态栏高度等）
    const sysInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = sysInfo

    // 检查本地缓存登录态
    const token = wx.getStorageSync('token') as string
    if (!token) {
      await this.autoLogin()
      return
    }

    // 恢复全局状态
    const cachedUser = wx.getStorageSync('userInfo') as User | null
    if (cachedUser) {
      store.setUser(cachedUser)
      this.globalData.userInfo = cachedUser
    }

    const cachedGoal = wx.getStorageSync('currentGoal') as Goal | null
    if (cachedGoal) {
      store.setCurrentGoal(cachedGoal)
      this.globalData.currentGoal = cachedGoal
    }
  },

  async autoLogin() {
    try {
      const { user } = await wxLogin()
      store.setUser(user)
      this.globalData.userInfo = user
      wx.setStorageSync('userInfo', user)
    } catch (e) {
      console.error('自动登录失败', e)
    }
  },
})

interface IAppOption {
  globalData: {
    userInfo: User | null
    currentGoal: Goal | null
    todaySession: Session | null
    systemInfo: WechatMiniprogram.SystemInfo | null
  }
  autoLogin(): Promise<void>
}
