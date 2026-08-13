/** Public map must never receive KOLs marked hidden in admin. */

export function isHiddenKol(k: unknown): boolean {
  return !!k && typeof k === 'object' && (k as { hidden?: unknown }).hidden === true
}

export function publicKolsOnly<T>(kols: T[]): T[] {
  return kols.filter((k) => !isHiddenKol(k))
}
