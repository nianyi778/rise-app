"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
Page({
    data: {
        currentStep: 0,
        rawInput: '',
        selectedCategory: '',
        selectedBlocker: '',
        selectedTime: '',
        dailyMinutes: 25,
        inputFocused: false,
        submitting: false,
        windowH: '100vh',
        statusBarH: '44px',
        categories: [
            { key: 'work', label: '职场' },
            { key: 'health', label: '健康' },
            { key: 'learn', label: '学习' },
            { key: 'fin', label: '财务' },
            { key: 'create', label: '创意' },
            { key: 'relate', label: '关系' },
        ],
        blockerOptions: [
            { key: 'no_start', label: '不知道怎么开始', desc: '方向模糊，无从下手' },
            { key: 'no_time', label: '总感觉没时间', desc: '每天很忙，找不到空隙' },
            { key: 'interrupted', label: '有思路，但就是拖', desc: '知道该做，就是迈不出那步' },
            { key: 'fear', label: '怕做不好', desc: '想做，但担心结果不够好' },
        ],
        timeOptions: [
            { key: 'morning', label: '早上', desc: '起床后，清醒专注', value: '07:00' },
            { key: 'noon', label: '午休', desc: '午饭后，碎片时间', value: '12:30' },
            { key: 'evening', label: '下班后', desc: '下班途中或到家', value: '19:00' },
            { key: 'night', label: '睡前', desc: '安静，适合思考型任务', value: '22:00' },
        ],
    },
    onLoad() {
        var _a;
        const { hasOnboarded, currentGoal } = index_2.store.getState();
        if (hasOnboarded && currentGoal) {
            wx.switchTab({ url: '/pages/home/home' });
            return;
        }
        const sys = wx.getSystemInfoSync();
        this.setData({
            windowH: `${sys.windowHeight}px`,
            statusBarH: `${(_a = sys.statusBarHeight) !== null && _a !== void 0 ? _a : 44}px`,
        });
    },
    onInputChange(e) {
        this.setData({ rawInput: e.detail.value });
    },
    onInputFocus() {
        this.setData({ inputFocused: true });
    },
    onInputBlur() {
        this.setData({ inputFocused: false });
    },
    onCategoryTap(e) {
        const key = e.currentTarget.dataset['key'];
        this.setData({ selectedCategory: key });
    },
    onBlockerTap(e) {
        const key = e.currentTarget.dataset['key'];
        this.setData({ selectedBlocker: key });
    },
    onTimeTap(e) {
        const key = e.currentTarget.dataset['key'];
        this.setData({ selectedTime: key });
    },
    onSliderChange(e) {
        this.setData({ dailyMinutes: e.detail.value });
    },
    onNext() {
        const { currentStep, rawInput, selectedCategory, selectedBlocker } = this.data;
        if (currentStep === 0) {
            if (!rawInput.trim() && !selectedCategory) {
                wx.showToast({ title: '请描述你的目标或选一个方向', icon: 'none' });
                return;
            }
            this.setData({ currentStep: 1 });
            return;
        }
        if (currentStep === 1) {
            if (!selectedBlocker) {
                wx.showToast({ title: '请选择最像你的阻力', icon: 'none' });
                return;
            }
            this.setData({ currentStep: 2 });
        }
    },
    async onSubmit() {
        var _a, _b;
        const { rawInput, selectedCategory, selectedBlocker, selectedTime, dailyMinutes, timeOptions, categories } = this.data;
        if (!selectedTime) {
            wx.showToast({ title: '请选择你的可用时段', icon: 'none' });
            return;
        }
        const timeOption = timeOptions.find((t) => t.key === selectedTime);
        const availableTime = timeOption ? timeOption.value : '21:00';
        const catLabel = (_b = (_a = categories.find((c) => c.key === selectedCategory)) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : '';
        const rawInputFinal = rawInput.trim() || (catLabel ? `我想在${catLabel}方向上取得突破` : '开始一个新目标');
        const category = selectedCategory !== '' ? selectedCategory : 'work';
        const blocker = selectedBlocker !== '' ? selectedBlocker : 'no_time';
        this.setData({ submitting: true });
        const payload = {
            rawInput: rawInputFinal,
            category,
            blocker,
            availableTime,
            dailyMinutes,
        };
        try {
            const result = await (0, index_1.createGoal)(payload);
            index_2.store.setState({
                hasOnboarded: true,
                currentGoal: result.goal,
                todaySession: result.session,
            });
            wx.reLaunch({ url: '/pages/home/home' });
        }
        catch (_err) {
            this.setData({ submitting: false });
            wx.showToast({ title: '创建失败，请重试', icon: 'none' });
        }
    },
});
