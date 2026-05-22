"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
const TIME_MAP = {
    morning: '07:00',
    noon: '12:30',
    evening: '18:30',
    night: '21:00',
};
Page({
    data: {
        currentCard: 0,
        sliderStyle: 'transform: translateX(0%)',
        duration: '',
        selectedTime: '',
        goalTitle: '',
        phaseName: '建立初始动力',
        dailyMinutes: 25,
        encouragement: '每一个目标都始于一个决定。Rise 会陪你把这件事变成日常，一天 25 分钟，稳扎稳打。',
        aiPlan: null,
        submitting: false,
        q0: '你想做这件事\n多久了？',
        q1: '好，我来帮你\n找突破口',
        q2: '你的专属计划\n已生成',
        aiAnalysis: '',
        durations: [
            { key: 'new', label: '刚有这个想法' },
            { key: 'weeks', label: '几周了' },
            { key: 'months', label: '几个月' },
            { key: 'halfyear', label: '超过半年了' },
        ],
        times: [
            { key: 'morning', label: '早上', desc: '06:00 – 09:00' },
            { key: 'noon', label: '午休', desc: '12:00 – 14:00' },
            { key: 'evening', label: '下班后', desc: '18:00 – 20:00' },
            { key: 'night', label: '睡前', desc: '21:00 – 23:00' },
        ],
    },
    onLoad() {
        const draft = wx.getStorageSync('onboardingDraft');
        if (!draft)
            return;
        const raw = draft.rawInput;
        const title = raw.length > 18 ? raw.slice(0, 18) + '…' : raw;
        const snippet = raw.length > 12 ? raw.slice(0, 12) + '…' : raw;
        const aiAnalysis = `我注意到你想「${snippet}」。根据你选择的阻力，让我们先锁定一个每天都能落地的小时间窗，从那里突破。`;
        this.setData({ goalTitle: title, aiAnalysis });
    },
    onDurationTap(e) {
        this.setData({ duration: e.currentTarget.dataset['key'] });
    },
    onTimeTap(e) {
        this.setData({ selectedTime: e.currentTarget.dataset['key'] });
    },
    onBack() {
        const { currentCard } = this.data;
        if (currentCard === 0) {
            wx.navigateBack();
            return;
        }
        const newCard = currentCard - 1;
        this.setData({
            currentCard: newCard,
            sliderStyle: `transform: translateX(-${((newCard * 100) / 3).toFixed(3)}%)`,
        });
    },
    onNext() {
        const { currentCard, duration, selectedTime } = this.data;
        if (currentCard === 0 && !duration) {
            wx.showToast({ title: '请先选择一个选项', icon: 'none' });
            return;
        }
        if (currentCard === 1 && !selectedTime) {
            wx.showToast({ title: '请选择专注时段', icon: 'none' });
            return;
        }
        const newCard = currentCard + 1;
        this.setData({
            currentCard: newCard,
            sliderStyle: `transform: translateX(-${((newCard * 100) / 3).toFixed(3)}%)`,
        });
    },
    async onConfirm() {
        const selectedTime = this.data.selectedTime;
        const draft = wx.getStorageSync('onboardingDraft');
        if (!draft) {
            wx.showToast({ title: '信息丢失，请重新填写', icon: 'none' });
            wx.navigateBack();
            return;
        }
        const payload = Object.assign(Object.assign({}, draft), { availableTime: selectedTime ? TIME_MAP[selectedTime] : '21:00', dailyMinutes: 25 });
        this.setData({ submitting: true });
        try {
            const { goal, session } = await (0, index_1.createGoal)(payload);
            index_2.store.setCurrentGoal(goal);
            index_2.store.setTodaySession(session);
            wx.setStorageSync('currentGoal', goal);
            wx.removeStorageSync('onboardingDraft');
            wx.reLaunch({ url: '/pages/home/home' });
        }
        catch (e) {
            wx.showToast({ title: '网络错误，请重试', icon: 'none' });
            this.setData({ submitting: false });
        }
    },
});
