"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../utils/index");
const cache_1 = require("../../utils/cache");
const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
function ringDash(value, max) {
    const progress = max > 0 ? Math.min(1, value / max) : 0;
    return (0, index_2.calcDashOffset)(progress, 30);
}
Page({
    data: {
        report: null,
        weekOffset: 0,
        loading: true,
        pageEntered: false,
        ringData: {
            checkinDash: 188.5,
            focusDash: 188.5,
            streakDash: 188.5,
            totalFocusHours: '0',
        },
    },
    onShow() {
        const tabBar = this.getTabBar();
        tabBar === null || tabBar === void 0 ? void 0 : tabBar.setData({ selected: 2 });
        this._loadReport();
    },
    _loadReport() {
        const { weekOffset } = this.data;
        const cacheKey = `report_${weekOffset}`;
        const cached = (0, cache_1.swr)(cacheKey, () => (0, index_1.getWeeklyReport)(weekOffset), (fresh) => this._applyReport(fresh));
        if (cached) {
            this._applyReport(cached);
        }
        else {
            this.setData({ loading: true });
        }
    },
    _applyReport(raw) {
        const dailyData = raw.dailyData.map(d => {
            var _a;
            return (Object.assign(Object.assign({}, d), { dayShort: (_a = WEEK_DAYS[new Date(d.date).getDay()]) !== null && _a !== void 0 ? _a : '' }));
        });
        const totalFocusHours = (raw.totalFocusMin / 60).toFixed(1);
        const focusMax = (raw.totalDays * 30) || 210;
        this.setData({
            report: Object.assign(Object.assign({}, raw), { dailyData }),
            loading: false,
            pageEntered: true,
            ringData: {
                checkinDash: ringDash(raw.completedDays, raw.totalDays),
                focusDash: ringDash(raw.totalFocusMin, focusMax),
                streakDash: ringDash(raw.streakMax, 7),
                totalFocusHours,
            },
        });
    },
    onPrevWeek() {
        this.setData({ weekOffset: this.data.weekOffset + 1 });
        this._loadReport();
    },
    onNextWeek() {
        if (this.data.weekOffset <= 0)
            return;
        this.setData({ weekOffset: this.data.weekOffset - 1 });
        this._loadReport();
    },
    onShare() {
        wx.showShareMenu({ withShareTicket: true });
        wx.showToast({ title: 'Pro 功能：生成分享卡片', icon: 'none' });
    },
});
