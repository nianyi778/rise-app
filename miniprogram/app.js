"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./store/index");
const index_2 = require("./api/index");
App({
    globalData: {
        userInfo: null,
        currentGoal: null,
        todaySession: null,
        systemInfo: null,
    },
    async onLaunch() {
        // 获取系统信息（状态栏高度等）
        const sysInfo = wx.getSystemInfoSync();
        this.globalData.systemInfo = sysInfo;
        // 检查本地缓存登录态
        const token = wx.getStorageSync('token');
        if (!token) {
            await this.autoLogin();
            return;
        }
        // 恢复全局状态
        const cachedUser = wx.getStorageSync('userInfo');
        if (cachedUser) {
            index_1.store.setUser(cachedUser);
            this.globalData.userInfo = cachedUser;
        }
        const cachedGoal = wx.getStorageSync('currentGoal');
        if (cachedGoal) {
            index_1.store.setCurrentGoal(cachedGoal);
            this.globalData.currentGoal = cachedGoal;
        }
    },
    async autoLogin() {
        try {
            const { user } = await (0, index_2.wxLogin)();
            index_1.store.setUser(user);
            this.globalData.userInfo = user;
            wx.setStorageSync('userInfo', user);
        }
        catch (e) {
            console.error('自动登录失败', e);
        }
    },
});
