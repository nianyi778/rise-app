"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RING_CIRCUMFERENCE_29 = exports.RING_CIRCUMFERENCE_27 = exports.RING_CIRCUMFERENCE_119 = void 0;
exports.formatDate = formatDate;
exports.today = today;
exports.friendlyDate = friendlyDate;
exports.formatDuration = formatDuration;
exports.formatCountdown = formatCountdown;
exports.calcDashOffset = calcDashOffset;
exports.weekdayCN = weekdayCN;
exports.greeting = greeting;
exports.sleep = sleep;
exports.springAnim = springAnim;
exports.staggerDelay = staggerDelay;
exports.throttle = throttle;
// 日期格式化
function formatDate(date, fmt = 'YYYY-MM-DD') {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return fmt
        .replace('YYYY', String(y))
        .replace('MM', m)
        .replace('DD', day);
}
function today() {
    return formatDate(new Date());
}
// 中文友好日期展示，如"今天"/"昨天"/"5月19日"
function friendlyDate(dateStr) {
    const t = today();
    if (dateStr === t)
        return '今天';
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    if (dateStr === yesterday)
        return '昨天';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}
// 分钟转为"X小时Y分"
function formatDuration(minutes) {
    if (minutes < 60)
        return `${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}小时${m}分` : `${h}小时`;
}
// 秒数转为 MM:SS
function formatCountdown(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
// 计算圆环 stroke-dashoffset（circumference - progress * circumference）
function calcDashOffset(progress, radius) {
    const circumference = 2 * Math.PI * radius;
    return circumference * (1 - Math.min(1, Math.max(0, progress)));
}
// 圆周长（常用半径）
exports.RING_CIRCUMFERENCE_119 = 2 * Math.PI * 119; // focus timer r=119
exports.RING_CIRCUMFERENCE_27 = 2 * Math.PI * 27; // hero day ring r=27
exports.RING_CIRCUMFERENCE_29 = 2 * Math.PI * 29; // goal card r=29
// 星期几中文
function weekdayCN(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
}
// 问候语（根据时段）
function greeting() {
    const h = new Date().getHours();
    if (h < 6)
        return '夜深了';
    if (h < 12)
        return '早上好';
    if (h < 14)
        return '中午好';
    if (h < 18)
        return '下午好';
    if (h < 22)
        return '晚上好';
    return '夜了';
}
// 延迟工具
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// wx.createAnimation 弹簧效果
function springAnim(ctx, key, duration = 400) {
    const anim = wx.createAnimation({ duration, timingFunction: 'ease' });
    anim.scale(0.92).step({ duration: 100 });
    anim.scale(1.04).step({ duration: 150 });
    anim.scale(1.0).step({ duration: 150 });
    ctx.setData({ [key]: anim.export() });
}
// 错落入场延迟（列表动画）
function staggerDelay(index, base = 60) {
    return index * base;
}
// 节流
function throttle(fn, wait) {
    let last = 0;
    return ((...args) => {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            fn(...args);
        }
    });
}
