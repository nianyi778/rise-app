"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../api/index");
const index_2 = require("../../store/index");
const shareCard_1 = require("../../utils/shareCard");
Page({
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
            { key: 'hard', emoji: '😓', label: '有点难' },
            { key: 'ok', emoji: '😐', label: '还好' },
            { key: 'good', emoji: '😊', label: '不错' },
            { key: 'great', emoji: '🚀', label: '超棒' },
        ],
    },
    onLoad(options) {
        var _a;
        const focusMin = parseInt(options['focusMin'] || '25', 10);
        const { streakDays, todaySession } = index_2.store.getState();
        const dayIndex = (_a = todaySession === null || todaySession === void 0 ? void 0 : todaySession.dayIndex) !== null && _a !== void 0 ? _a : 1;
        const tomorrowAction = decodeURIComponent(options['tomorrowAction'] || '');
        this.setData({ focusMin, streakDays, dayIndex, tomorrowAction });
    },
    onReady() {
        this._launchConfetti();
    },
    _launchConfetti() {
        const query = wx.createSelectorQuery();
        query
            .select('#confettiCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
            var _a;
            if (!res[0] || !res[0].node)
                return;
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            const winInfo = wx.getWindowInfo();
            const dpr = (_a = winInfo.pixelRatio) !== null && _a !== void 0 ? _a : 2;
            const W = winInfo.windowWidth;
            const H = winInfo.windowHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
            const COLORS = ['#E06844', '#7468E8', '#53A47A', '#F5C542', '#FF69B4'];
            const particles = [];
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
                });
            }
            let frame = 0;
            const MAX_FRAMES = 150;
            let startTs = -1;
            const WARM_MS = 300;
            const animate = (ts) => {
                if (startTs < 0)
                    startTs = ts;
                if (ts - startTs < WARM_MS) {
                    canvas.requestAnimationFrame(animate);
                    return;
                }
                ctx.clearRect(0, 0, W, H);
                let anyAlive = false;
                for (const p of particles) {
                    if (p.life <= 0)
                        continue;
                    anyAlive = true;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.15;
                    p.life -= 0.007;
                    p.rotation += p.rotVel;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life);
                    ctx.fillStyle = p.color;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    ctx.restore();
                }
                frame++;
                if (frame < MAX_FRAMES && anyAlive) {
                    canvas.requestAnimationFrame(animate);
                }
            };
            canvas.requestAnimationFrame(animate);
        });
    },
    onSelectMood(e) {
        this.setData({ selectedMood: e.currentTarget.dataset['key'] });
    },
    onNoteInput(e) {
        this.setData({ note: e.detail.value });
    },
    async onSave() {
        const { selectedMood, note, focusMin } = this.data;
        if (!selectedMood) {
            wx.showToast({ title: '选个心情吧', icon: 'none' });
            return;
        }
        const state = index_2.store.getState();
        const session = state.todaySession;
        if (!session)
            return;
        const payload = {
            sessionId: session._id,
            goalId: session.goalId,
            mood: selectedMood,
            note,
            focusMin,
        };
        this.setData({ submitting: true });
        try {
            const result = await (0, index_1.submitCheckin)(payload);
            index_2.store.appendCheckin(result.checkin);
            this.setData({
                submitting: false,
                submitted: true,
                streakDays: result.streakDay,
                isNewRecord: result.isNewRecord,
            });
            setTimeout(() => {
                wx.switchTab({ url: '/pages/reflection/reflection' });
            }, 1800);
        }
        catch (_a) {
            wx.showToast({ title: '保存失败，请重试', icon: 'none' });
            this.setData({ submitting: false });
        }
    },
    async onShare() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (this.data.sharing)
            return;
        this.setData({ sharing: true });
        try {
            const state = index_2.store.getState();
            const goal = state.currentGoal;
            const user = state.userInfo;
            const goalTitle = (_a = goal === null || goal === void 0 ? void 0 : goal.title) !== null && _a !== void 0 ? _a : '今日目标';
            const action = (_e = (_d = (_c = (_b = goal === null || goal === void 0 ? void 0 : goal.aiPlan) === null || _b === void 0 ? void 0 : _b.phase) === null || _c === void 0 ? void 0 : _c.target) !== null && _d !== void 0 ? _d : this.data.tomorrowAction) !== null && _e !== void 0 ? _e : '完成今日要事';
            const phaseName = (_g = (_f = goal === null || goal === void 0 ? void 0 : goal.phase) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : '进行中';
            const phaseDays = (_j = (_h = goal === null || goal === void 0 ? void 0 : goal.phase) === null || _h === void 0 ? void 0 : _h.durationDays) !== null && _j !== void 0 ? _j : 30;
            const phaseProgress = Math.min(1, this.data.dayIndex / phaseDays);
            const nickname = (_k = user === null || user === void 0 ? void 0 : user.nickname) !== null && _k !== void 0 ? _k : '你';
            const tempPath = await (0, shareCard_1.drawShareCard)({
                canvasId: 'shareCard',
                pageInstance: this,
                goalTitle,
                action,
                dayIndex: this.data.dayIndex,
                streakDays: this.data.streakDays,
                phaseProgress,
                phaseName,
                nickname,
                focusMin: this.data.focusMin,
            });
            this.setData({ sharing: false });
            wx.showActionSheet({
                itemList: ['保存到相册', '分享给朋友'],
                success: (res) => {
                    if (res.tapIndex === 0) {
                        wx.saveImageToPhotosAlbum({
                            filePath: tempPath,
                            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
                            fail: (err) => {
                                var _a, _b;
                                if (((_a = err === null || err === void 0 ? void 0 : err.errMsg) === null || _a === void 0 ? void 0 : _a.includes('auth deny')) || ((_b = err === null || err === void 0 ? void 0 : err.errMsg) === null || _b === void 0 ? void 0 : _b.includes('authorize'))) {
                                    wx.showModal({
                                        title: '需要相册权限',
                                        content: '请在设置中开启相册权限',
                                        confirmText: '去设置',
                                        success: (modal) => {
                                            if (modal.confirm)
                                                wx.openSetting({});
                                        },
                                    });
                                }
                                else {
                                    wx.showToast({ title: '保存失败', icon: 'none' });
                                }
                            },
                        });
                    }
                    else if (res.tapIndex === 1) {
                        wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
                        wx.showToast({ title: '请点右上角菜单分享', icon: 'none', duration: 2500 });
                    }
                },
                fail: () => { },
            });
        }
        catch (err) {
            this.setData({ sharing: false });
            wx.showToast({ title: '生成卡片失败，请重试', icon: 'none' });
            console.error('[shareCard] error:', err);
        }
    },
});
