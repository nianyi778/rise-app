"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const defaultState = {
    userInfo: null,
    currentGoal: null,
    todaySession: null,
    recentCheckins: [],
    streakDays: 0,
    chatHistory: [],
    isLoading: false,
    hasOnboarded: false,
};
class Store {
    constructor() {
        this.state = Object.assign({}, defaultState);
        this.listeners = new Set();
    }
    getState() {
        return this.state;
    }
    setState(patch) {
        this.state = Object.assign(Object.assign({}, this.state), patch);
        this.notify();
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    notify() {
        this.listeners.forEach(fn => fn(this.state));
    }
    // 便捷 setter
    setUser(user) {
        this.setState({ userInfo: user, hasOnboarded: user.onboarded });
    }
    setCurrentGoal(goal) {
        this.setState({ currentGoal: goal });
    }
    setTodaySession(session) {
        this.setState({ todaySession: session });
    }
    setStreakDays(days) {
        this.setState({ streakDays: days });
    }
    appendCheckin(checkin) {
        this.setState({
            recentCheckins: [checkin, ...this.state.recentCheckins].slice(0, 30),
            streakDays: checkin.streakDay,
        });
    }
    pushChatMessage(msg) {
        this.setState({
            chatHistory: [...this.state.chatHistory, msg],
        });
    }
    clearChatHistory() {
        this.setState({ chatHistory: [] });
    }
    setLoading(loading) {
        this.setState({ isLoading: loading });
    }
    reset() {
        this.state = Object.assign({}, defaultState);
        this.notify();
    }
}
exports.store = new Store();
