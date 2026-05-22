"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
const index_3 = require("../../utils/index");
const shareCard_1 = require("../../utils/shareCard");
Page({
    data: {
        greet: '',
        nickname: '',
        dateLabel: '',
        goal: null,
        session: null,
        streakDays: 0,
        dayProgress: 0,
        dayProgressPct: 0,
        dayDashOffset: index_3.RING_CIRCUMFERENCE_27,
        aiNote: '',
        loading: true,
        pageEntered: false,
    },
    onLoad() {
        var _a, _b;
        const state = index_2.store.getState();
        this.setData({
            greet: (0, index_3.greeting)(),
            nickname: (_b = (_a = state.userInfo) === null || _a === void 0 ? void 0 : _a.nickname) !== null && _b !== void 0 ? _b : '',
            dateLabel: `${(0, index_3.weekdayCN)()} · ${(0, index_3.formatDate)(new Date(), 'MM月DD日')}`,
            streakDays: state.streakDays,
        });
    },
    async onShow() {
        const tabBar = this.getTabBar();
        tabBar === null || tabBar === void 0 ? void 0 : tabBar.setData({ selected: 0 });
        await this.loadData();
        setTimeout(() => this.setData({ pageEntered: true }), 50);
    },
    async loadData() {
        var _a, _b, _c;
        this.setData({ loading: true, pageEntered: false });
        try {
            const goals = await (0, index_1.getGoals)();
            const activeGoal = goals.find(g => g.status === 'active') || null;
            if (!activeGoal) {
                wx.reLaunch({ url: '/pages/welcome/welcome' });
                return;
            }
            const session = await (0, index_1.getTodaySession)(activeGoal._id);
            const dayProgress = activeGoal.phase.durationDays > 0
                ? session.dayIndex / activeGoal.phase.durationDays
                : 0;
            index_2.store.setCurrentGoal(activeGoal);
            index_2.store.setTodaySession(session);
            // 同步最新 nickname / streakDays
            const state = index_2.store.getState();
            this.setData({
                goal: activeGoal,
                session,
                nickname: (_b = (_a = state.userInfo) === null || _a === void 0 ? void 0 : _a.nickname) !== null && _b !== void 0 ? _b : this.data.nickname,
                streakDays: state.streakDays,
                dayProgress,
                dayProgressPct: Math.floor(dayProgress * 100),
                dayDashOffset: (0, index_3.calcDashOffset)(dayProgress, 27),
                aiNote: ((_c = activeGoal.aiPlan) === null || _c === void 0 ? void 0 : _c.encouragement) || '专注当下，每一步都算数',
                loading: false,
            });
            // Canvas 绘制延后到 DOM 渲染完成后
            setTimeout(() => this._drawDayRing(dayProgress), 200);
        }
        catch (e) {
            this.setData({ loading: false });
            wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' });
        }
    },
    onPullDownRefresh() {
        this.loadData().then(() => wx.stopPullDownRefresh());
    },
    /**
     * 使用 Canvas 2D API（非 deprecated 的 createCanvasContext）绘制天数进度环
     */
    _drawDayRing(progress) {
        const query = wx.createSelectorQuery().in(this);
        query
            .select('#dayRing')
            .fields({ node: true, size: true })
            .exec((res) => {
            var _a, _b;
            const result = res[0];
            if (!(result === null || result === void 0 ? void 0 : result.node))
                return;
            const canvas = result.node;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            // 适配 dpr（优先 getWindowInfo，兼容旧版）
            const dpr = (_b = (_a = wx.getWindowInfo) === null || _a === void 0 ? void 0 : _a.call(wx).pixelRatio) !== null && _b !== void 0 ? _b : wx.getSystemInfoSync().pixelRatio;
            const w = result.width;
            const h = result.height;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
            const cx = w / 2;
            const cy = h / 2;
            const r = w * 0.41; // ~22px on 54px canvas
            const lw = w * 0.083; // ~4.5px on 54px canvas
            ctx.clearRect(0, 0, w, h);
            // 轨道圆（半透明白）
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = lw;
            ctx.stroke();
            // 进度弧（白色，round cap）
            if (progress > 0) {
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + 2 * Math.PI * Math.min(1, progress);
                ctx.beginPath();
                ctx.arc(cx, cy, r, startAngle, endAngle);
                ctx.strokeStyle = 'rgba(255,255,255,0.90)';
                ctx.lineWidth = lw;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        });
    },
    onStartFocus() {
        const { session } = this.data;
        if (!session)
            return;
        wx.navigateTo({ url: `/pages/focus/focus?sessionId=${session._id}` });
    },
    onSkip() {
        wx.showActionSheet({
            itemList: ['今天跳过，明天继续'],
            success: () => {
                wx.showToast({ title: '已记录，明天继续加油', icon: 'none' });
            },
        });
    },
    onGoReflection() {
        wx.switchTab({ url: '/pages/reflection/reflection' });
    },
    async onShare() {
        var _a, _b;
        const { goal, session, streakDays, dayProgress } = this.data;
        if (!goal || !session)
            return;
        const state = index_2.store.getState();
        try {
            const filePath = await (0, shareCard_1.drawShareCard)({
                canvasId: 'shareCanvas',
                pageInstance: this,
                goalTitle: goal.title,
                action: session.action,
                dayIndex: session.dayIndex,
                streakDays,
                phaseProgress: dayProgress,
                phaseName: goal.phase.name,
                nickname: (_b = (_a = state.userInfo) === null || _a === void 0 ? void 0 : _a.nickname) !== null && _b !== void 0 ? _b : '朋友',
                focusMin: session.estimatedMin,
            });
            wx.showShareImageMenu({ path: filePath });
        }
        catch (_c) {
            wx.showToast({ title: '生成分享卡失败', icon: 'none' });
        }
    },
});
