"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
const index_3 = require("../../utils/index");
Page({
    _streamTask: null,
    _greeted: false,
    data: {
        dateLabel: '',
        todayCheckin: null,
        chatMessages: [],
        inputText: '',
        replying: false,
        streamingText: '',
        scrollToId: '',
        pageEntered: false,
    },
    async onShow() {
        const today = new Date().toISOString().slice(0, 10);
        this.setData({ dateLabel: (0, index_3.friendlyDate)(today), pageEntered: false });
        const tabBar = this.getTabBar();
        tabBar === null || tabBar === void 0 ? void 0 : tabBar.setData({ selected: 1 });
        await this._loadCheckin();
        setTimeout(() => this.setData({ pageEntered: true }), 50);
    },
    async _loadCheckin() {
        var _a, _b;
        const storeState = index_2.store.getState();
        const today = new Date().toISOString().slice(0, 10);
        // First try store (populated after user completes a session)
        let todayCheckin = (_a = storeState.recentCheckins.find(c => c.date === today)) !== null && _a !== void 0 ? _a : null;
        // Fall back to API
        if (!todayCheckin) {
            try {
                const checkins = await (0, index_1.getTodayCheckin)();
                todayCheckin = (_b = checkins.find(c => c.date === today)) !== null && _b !== void 0 ? _b : null;
            }
            catch (_c) {
                // ignore network errors, show empty state
            }
        }
        this.setData({ todayCheckin });
        if (todayCheckin && !this._greeted) {
            this._greeted = true;
            const existing = storeState.chatHistory;
            if (existing.length > 0) {
                this.setData({ chatMessages: existing });
            }
            else {
                this._openAIGreeting(todayCheckin);
            }
        }
    },
    _openAIGreeting(checkin) {
        var _a;
        const { currentGoal, todaySession } = index_2.store.getState();
        if (!currentGoal)
            return;
        const initMsg = {
            role: 'user',
            content: `我刚完成了今天的目标：${(_a = todaySession === null || todaySession === void 0 ? void 0 : todaySession.action) !== null && _a !== void 0 ? _a : '今日任务'}。心情：${checkin.mood}。${checkin.note ? '备注：' + checkin.note : ''}`,
            timestamp: Date.now(),
        };
        this.setData({ replying: true, streamingText: '' });
        let accText = '';
        this._streamTask = (0, index_1.streamChatMessage)(currentGoal._id, checkin._id, [initMsg], (delta) => {
            accText += delta;
            this.setData({ streamingText: accText });
        }, () => {
            const replyMsg = { role: 'assistant', content: accText, timestamp: Date.now() };
            index_2.store.pushChatMessage(initMsg);
            index_2.store.pushChatMessage(replyMsg);
            this.setData({
                chatMessages: [replyMsg],
                streamingText: '',
                replying: false,
            });
            this._scrollToBottom();
        }, () => {
            this.setData({
                chatMessages: [{ role: 'assistant', content: '今天完成了，很棒！感觉怎么样？', timestamp: Date.now() }],
                streamingText: '',
                replying: false,
            });
        });
    },
    onInputChange(e) {
        this.setData({ inputText: e.detail.value });
    },
    onSend() {
        var _a;
        const { inputText, chatMessages } = this.data;
        if (!inputText.trim() || this.data.replying)
            return;
        const { currentGoal, todaySession } = index_2.store.getState();
        if (!currentGoal)
            return;
        const userMsg = {
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now(),
        };
        const allHistory = [...index_2.store.getState().chatHistory, userMsg];
        index_2.store.pushChatMessage(userMsg);
        this.setData({
            chatMessages: [...chatMessages, userMsg],
            inputText: '',
            replying: true,
            streamingText: '',
        });
        this._scrollToBottom();
        let accText = '';
        this._streamTask = (0, index_1.streamChatMessage)(currentGoal._id, (_a = todaySession === null || todaySession === void 0 ? void 0 : todaySession._id) !== null && _a !== void 0 ? _a : undefined, allHistory, (delta) => {
            accText += delta;
            this.setData({ streamingText: accText });
            this._scrollToBottom();
        }, () => {
            const replyMsg = { role: 'assistant', content: accText, timestamp: Date.now() };
            index_2.store.pushChatMessage(replyMsg);
            this.setData({
                chatMessages: [...this.data.chatMessages, replyMsg],
                streamingText: '',
                replying: false,
            });
            this._scrollToBottom();
        }, (err) => {
            console.error('[reflection] stream error', err);
            this.setData({ replying: false, streamingText: '' });
            wx.showToast({ title: '回复失败，请重试', icon: 'none' });
        });
    },
    goHome() {
        wx.switchTab({ url: '/pages/home/home' });
    },
    _scrollToBottom() {
        this.setData({ scrollToId: 'bottom' });
        setTimeout(() => this.setData({ scrollToId: '' }), 300);
    },
    onUnload() {
        var _a;
        (_a = this._streamTask) === null || _a === void 0 ? void 0 : _a.abort();
    },
});
