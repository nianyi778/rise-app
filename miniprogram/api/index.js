"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wxLogin = wxLogin;
exports.createGoal = createGoal;
exports.getGoals = getGoals;
exports.getTodaySession = getTodaySession;
exports.updateGoalStatus = updateGoalStatus;
exports.getTodayCheckin = getTodayCheckin;
exports.submitCheckin = submitCheckin;
exports.streamChatMessage = streamChatMessage;
exports.getWeeklyReport = getWeeklyReport;
const BASE_URL = 'https://rise.likai.me';
const TIMEOUT = 10000;
// ── Mappers ───────────────────────────────────────────────────────────────────
function mapUser(r) {
    var _a, _b;
    return {
        _id: r.id,
        nickname: (_a = r.nickname) !== null && _a !== void 0 ? _a : '',
        avatar: (_b = r.avatar) !== null && _b !== void 0 ? _b : '',
        plan: r.plan,
        planExpire: r.plan_expire,
        onboarded: r.onboarded,
        timezone: r.timezone,
        createdAt: r.created_at,
    };
}
function mapGoal(r) {
    var _a, _b, _c, _d, _e, _f;
    return {
        _id: r.id,
        userId: r.user_id,
        title: r.title,
        category: r.category,
        rawInput: r.raw_input,
        blocker: ((_a = r.blocker) !== null && _a !== void 0 ? _a : 'no_time'),
        phase: {
            name: (_b = r.phase_name) !== null && _b !== void 0 ? _b : '',
            target: (_c = r.phase_target) !== null && _c !== void 0 ? _c : '',
            durationDays: r.phase_duration_days,
        },
        dailyMinutes: r.daily_minutes,
        preferTime: r.prefer_time,
        startDate: r.start_date,
        status: r.status,
        aiPlan: (_d = r.ai_plan) !== null && _d !== void 0 ? _d : {
            goalTitle: r.title,
            phase: { name: (_e = r.phase_name) !== null && _e !== void 0 ? _e : '', target: (_f = r.phase_target) !== null && _f !== void 0 ? _f : '', durationDays: r.phase_duration_days },
            dailyActions: [],
            recommendTime: r.prefer_time,
            dailyMinutes: r.daily_minutes,
            encouragement: '',
        },
        createdAt: r.created_at,
    };
}
function mapSession(r) {
    return {
        _id: r.id,
        userId: r.user_id,
        goalId: r.goal_id,
        date: r.date,
        dayIndex: r.day_index,
        action: r.action,
        estimatedMin: r.estimated_min,
        status: r.status,
        actualMin: r.actual_min,
        skippedReason: r.skipped_reason,
        generatedAt: r.generated_at,
    };
}
function mapCheckin(r) {
    var _a;
    return {
        _id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        goalId: r.goal_id,
        date: r.date,
        mood: r.mood,
        note: (_a = r.note) !== null && _a !== void 0 ? _a : '',
        focusMin: r.focus_min,
        streakDay: r.streak_day,
        createdAt: r.created_at,
    };
}
// ── HTTP client ───────────────────────────────────────────────────────────────
function request(path, method, data) {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');
        wx.request({
            url: `${BASE_URL}${path}`,
            method,
            data,
            timeout: TIMEOUT,
            header: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
            },
            success(res) {
                var _a;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data);
                }
                else {
                    const body = res.data;
                    reject(new Error((_a = body === null || body === void 0 ? void 0 : body.error) !== null && _a !== void 0 ? _a : `HTTP ${res.statusCode}`));
                }
            },
            fail(err) {
                var _a;
                reject(new Error((_a = err.errMsg) !== null && _a !== void 0 ? _a : '网络错误'));
            },
        });
    });
}
// ── Auth ──────────────────────────────────────────────────────────────────────
async function wxLogin() {
    return new Promise((resolve, reject) => {
        wx.login({
            success: async (loginRes) => {
                if (!loginRes.code) {
                    reject(new Error('wx.login 失败'));
                    return;
                }
                try {
                    const res = await request('/auth/login', 'POST', { code: loginRes.code });
                    wx.setStorageSync('token', res.token);
                    resolve({ token: res.token, user: mapUser(res.user) });
                }
                catch (e) {
                    reject(e);
                }
            },
            fail: (err) => reject(new Error(err.errMsg)),
        });
    });
}
// ── Goals ─────────────────────────────────────────────────────────────────────
async function createGoal(payload) {
    const res = await request('/goals', 'POST', payload);
    return { goal: mapGoal(res.goal), session: mapSession(res.session) };
}
async function getGoals() {
    const res = await request('/goals', 'GET');
    return res.goals.map(mapGoal);
}
async function getTodaySession(goalId) {
    const res = await request(`/goals/${goalId}/session`, 'GET');
    return mapSession(res.session);
}
async function updateGoalStatus(goalId, status) {
    const res = await request(`/goals/${goalId}`, 'PUT', { status });
    return mapGoal(res.goal);
}
// ── Checkin ───────────────────────────────────────────────────────────────────
async function getTodayCheckin() {
    const res = await request('/checkin/today', 'GET');
    return res.checkins.map(mapCheckin);
}
async function submitCheckin(payload) {
    const res = await request('/checkin', 'POST', payload);
    return { checkin: mapCheckin(res.checkin), streakDay: res.streakDay, isNewRecord: res.isNewRecord };
}
// ── AI Chat (streaming via chunked transfer) ──────────────────────────────────
function streamChatMessage(goalId, checkinId, messages, onChunk, onDone, onError) {
    const token = wx.getStorageSync('token');
    const task = wx.request({
        url: `${BASE_URL}/ai/chat`,
        method: 'POST',
        data: {
            goalId,
            checkinId,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        },
        header: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
            Accept: 'text/plain',
        },
        enableChunked: true,
        responseType: 'text',
        success() { onDone(); },
        fail(err) { var _a; onError(new Error((_a = err.errMsg) !== null && _a !== void 0 ? _a : 'stream error')); },
    });
    task.onChunkReceived((res) => {
        const text = String.fromCharCode(...new Uint8Array(res.data));
        onChunk(text);
    });
    return task;
}
// ── Weekly Report ─────────────────────────────────────────────────────────────
async function getWeeklyReport(weekOffset = 0) {
    const res = await request(`/report/weekly${weekOffset > 0 ? `?offset=${weekOffset}` : ''}`, 'GET');
    const totalFocusMin = res.sessions.reduce((s, r) => { var _a; return s + ((_a = r.actual_min) !== null && _a !== void 0 ? _a : 0); }, 0);
    const dailyData = res.sessions.map(s => {
        var _a, _b;
        return ({
            date: s.date,
            action: s.action,
            mood: (_a = s.mood) !== null && _a !== void 0 ? _a : null,
            focusMin: (_b = s.actual_min) !== null && _b !== void 0 ? _b : 0,
            status: s.status,
        });
    });
    return {
        weekLabel: `${res.week.monday} ~ ${res.week.sunday}`,
        completedDays: res.week.completedDays,
        totalDays: res.week.totalDays,
        totalFocusMin,
        streakMax: 0,
        highlight: res.insight.breakthrough,
        aiObservation: res.insight.observation,
        nextWeekDirection: res.insight.nextWeekDirection,
        dailyData,
    };
}
