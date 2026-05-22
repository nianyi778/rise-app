"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
const index_3 = require("../../utils/index");
const CAT_COLOR = {
    work: { stroke: '#E06844', glow: 'rgba(224,104,68,0.18)' },
    health: { stroke: '#53A47A', glow: 'rgba(83,164,122,0.15)' },
    learn: { stroke: '#7468E8', glow: 'rgba(116,104,232,0.15)' },
    fin: { stroke: '#F5C542', glow: 'rgba(245,197,66,0.18)' },
    create: { stroke: '#E06844', glow: 'rgba(224,104,68,0.18)' },
    relate: { stroke: '#53A47A', glow: 'rgba(83,164,122,0.15)' },
    custom: { stroke: '#7468E8', glow: 'rgba(116,104,232,0.15)' },
};
function toDisplayItem(goal, dayIndex, todayAction) {
    var _a;
    const total = goal.phase.durationDays;
    const progress = total > 0 ? Math.min(1, dayIndex / total) : 0;
    const cat = (_a = CAT_COLOR[goal.category]) !== null && _a !== void 0 ? _a : CAT_COLOR['custom'];
    return {
        _id: goal._id,
        title: goal.title,
        category: goal.category,
        dayIndex,
        phaseName: goal.phase.name,
        todayAction,
        progress,
        dashOffset: (0, index_3.calcDashOffset)(progress, 24),
        color: cat.stroke,
        colorGlow: cat.glow,
        isActive: goal.status === 'active',
    };
}
Page({
    data: {
        goals: [],
        loading: true,
        isPro: false,
        maxGoals: 1,
        showUpgrade: false,
        pageEntered: false,
        proFeatures: [
            '最多 5 个目标并行守护',
            '完整 AI 复盘对话（不限次数）',
            '周报分享卡片生成',
            '历史数据导出',
        ],
    },
    async onShow() {
        this.setData({ pageEntered: false });
        const tabBar = this.getTabBar();
        tabBar === null || tabBar === void 0 ? void 0 : tabBar.setData({ selected: 3 });
        await this.loadGoals();
        setTimeout(() => this.setData({ pageEntered: true }), 50);
    },
    async loadGoals() {
        var _a;
        this.setData({ loading: true });
        try {
            const rawGoals = await (0, index_1.getGoals)();
            const { userInfo, todaySession } = index_2.store.getState();
            const isPro = (userInfo === null || userInfo === void 0 ? void 0 : userInfo.plan) === 'pro';
            const maxGoals = isPro ? 5 : 1;
            const displayGoals = rawGoals.map((g) => {
                var _a, _b;
                const dayIndex = ((todaySession === null || todaySession === void 0 ? void 0 : todaySession.goalId) === g._id)
                    ? ((_a = todaySession === null || todaySession === void 0 ? void 0 : todaySession.dayIndex) !== null && _a !== void 0 ? _a : 1)
                    : 1;
                const todayAction = ((todaySession === null || todaySession === void 0 ? void 0 : todaySession.goalId) === g._id)
                    ? ((_b = todaySession === null || todaySession === void 0 ? void 0 : todaySession.action) !== null && _b !== void 0 ? _b : '')
                    : '';
                return toDisplayItem(g, dayIndex, todayAction);
            });
            const activeGoal = (_a = rawGoals.find((g) => g.status === 'active')) !== null && _a !== void 0 ? _a : null;
            if (activeGoal)
                index_2.store.setCurrentGoal(activeGoal);
            this.setData({ goals: displayGoals, isPro, maxGoals, loading: false });
        }
        catch (_) {
            this.setData({ loading: false });
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },
    onGoalTap(e) {
        const goalId = e.currentTarget.dataset['id'];
        const { goals } = this.data;
        const item = goals.find((g) => g._id === goalId);
        if (!item)
            return;
        wx.switchTab({ url: '/pages/home/home' });
    },
    onAddGoal() {
        const { goals, isPro } = this.data;
        if (!isPro && goals.length >= 1) {
            this.setData({ showUpgrade: true });
            return;
        }
        wx.navigateTo({ url: '/pages/welcome/welcome' });
    },
    onCloseUpgrade() {
        this.setData({ showUpgrade: false });
    },
    onGoUpgrade() {
        this.setData({ showUpgrade: false });
        wx.showToast({ title: '即将开放，敬请期待', icon: 'none' });
    },
    onPauseGoal(e) {
        const goalId = e.currentTarget.dataset['id'];
        wx.showModal({
            title: '暂停要事',
            content: '暂停后，这个目标的每日行动将不再生成',
            confirmText: '暂停',
            cancelText: '取消',
            success: async (res) => {
                if (res.confirm)
                    await this._updateStatus(goalId, 'paused');
            },
        });
    },
    onResumeGoal(e) {
        const goalId = e.currentTarget.dataset['id'];
        this._updateStatus(goalId, 'active');
    },
    async _updateStatus(goalId, status) {
        try {
            await (0, index_1.updateGoalStatus)(goalId, status);
            await this.loadGoals();
        }
        catch (_) {
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    },
});
