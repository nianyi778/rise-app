/**
 * Stale-while-revalidate cache backed by wx.Storage.
 * Read returns the cached value immediately (sync), then calls fetch()
 * in background. If fresh data differs, calls onUpdate so the page
 * can re-render without any loading state.
 */
export function swr<T>(
  key: string,
  fetch: () => Promise<T>,
  onUpdate: (fresh: T) => void,
): T | null {
  const cached = wx.getStorageSync(key) as T | undefined | ''
  const stale = cached || null

  fetch().then((fresh) => {
    try {
      wx.setStorageSync(key, fresh)
    } catch (_) {}
    onUpdate(fresh)
  }).catch(() => {})

  return stale as T | null
}

export function invalidate(key: string): void {
  try { wx.removeStorageSync(key) } catch (_) {}
}
