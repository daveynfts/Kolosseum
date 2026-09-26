export type ArenaTab = 'overview' | 'posts' | 'surfai'
export function readArenaSelection(search = window.location.search) {
  const p = new URLSearchParams(search), raw = (p.get('kol') || '').replace(/^@/, '').toLowerCase()
  const handle = /^[a-z0-9_]{1,32}$/.test(raw) ? raw : null
  const t = p.get('tab'), tab: ArenaTab = t === 'posts' || t === 'surfai' ? t : 'overview'
  return { handle, tab }
}
export function navigateArena(handle: string | null, tab: ArenaTab = 'overview') {
  const url = new URL(window.location.href)
  if (handle) { url.searchParams.set('kol', handle.toLowerCase()); url.searchParams.set('tab', tab) }
  else { url.searchParams.delete('kol'); url.searchParams.delete('tab') }
  if (url.href === window.location.href) return
  history.pushState(null, '', url.pathname + url.search + url.hash)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
