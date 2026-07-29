/** Placeholder alts from uploads — not real captions. */
export function isGenericImageAlt(alt: string): boolean {
  const a = (alt || '').trim().toLowerCase()
  return (
    !a ||
    a === 'image' ||
    a === 'img' ||
    a === 'photo' ||
    a === 'picture' ||
    a === 'untitled' ||
    /^image\s*\d*$/i.test(a) ||
    /^img\s*\d*$/i.test(a)
  )
}
