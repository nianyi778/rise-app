"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swr = swr;
exports.invalidate = invalidate;
/**
 * Stale-while-revalidate cache backed by wx.Storage.
 * Read returns the cached value immediately (sync), then calls fetch()
 * in background. If fresh data differs, calls onUpdate so the page
 * can re-render without any loading state.
 */
function swr(key, fetch, onUpdate) {
    const cached = wx.getStorageSync(key);
    const stale = cached || null;
    fetch().then((fresh) => {
        try {
            wx.setStorageSync(key, fresh);
        }
        catch (_) { }
        onUpdate(fresh);
    }).catch(() => { });
    return stale;
}
function invalidate(key) {
    try {
        wx.removeStorageSync(key);
    }
    catch (_) { }
}
