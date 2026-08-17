import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EVENT_SLUG,
  SEED_EVENT_EDITIONS,
  eventObjectKey,
  eventPublicPath,
  isEventHubPath,
  latestLiveSlug,
  mergeEditionCatalog,
  nextYearSlug,
  parseEventSlug,
  parseEventSlugFromPathname,
  shiftIsoYear,
  upsertEditionInCatalog,
} from '../data/eventEditions'
import {
  CONVICTION_EVENTS_SEED,
  cloneEditionTemplate,
  normalizeDataset,
} from '../data/convictionEvents'

describe('event edition slugs', () => {
  it('accepts yearly slugs and rejects path tricks', () => {
    expect(parseEventSlug('conviction-2026')).toBe('conviction-2026')
    expect(parseEventSlug('Conviction-2026')).toBe('conviction-2026')
    expect(parseEventSlug('../secret')).toBeNull()
    expect(parseEventSlug('events/conviction-2026')).toBeNull()
    expect(parseEventSlug('')).toBeNull()
  })

  it('parses /event and /event/:slug', () => {
    expect(isEventHubPath('/event')).toBe(true)
    expect(isEventHubPath('/event/')).toBe(true)
    expect(isEventHubPath('/event/conviction-2026')).toBe(false)
    expect(parseEventSlugFromPathname('/event/conviction-2026')).toBe(
      'conviction-2026',
    )
    expect(parseEventSlugFromPathname('/event/conviction-2026/')).toBe(
      'conviction-2026',
    )
    expect(parseEventSlugFromPathname('/event')).toBeNull()
    expect(eventPublicPath('conviction-2026')).toBe('/event/conviction-2026')
    expect(eventObjectKey('conviction-2026')).toBe(
      'events/conviction-2026/v1.json',
    )
  })

  it('computes next-year slug without colliding with the archive', () => {
    expect(nextYearSlug('conviction-2026')).toBe('conviction-2027')
    expect(nextYearSlug(DEFAULT_EVENT_SLUG)).not.toBe(DEFAULT_EVENT_SLUG)
    expect(shiftIsoYear('2026-08-13', 1)).toBe('2027-08-13')
  })

  it('clone copies venue/window and leaves old events behind', () => {
    const next = cloneEditionTemplate(CONVICTION_EVENTS_SEED, 'conviction-2027')
    expect(next.event).toBe('conviction-2027')
    expect(next.events).toEqual([])
    expect(next.venue.name).toBe(CONVICTION_EVENTS_SEED.venue.name)
    expect(next.dateRange.start).toBe('2027-08-13')
    expect(next.dateRange.end).toBe('2027-08-16')
    expect(next.kind).toBe('side-events')
    expect(CONVICTION_EVENTS_SEED.event).toBe('conviction-2026')
    expect(CONVICTION_EVENTS_SEED.events.length).toBeGreaterThan(10)
  })

  it('normalizeDataset keeps the edition slug', () => {
    const n = normalizeDataset({
      event: 'conviction-2027',
      title: 'Conviction 2027',
      venue: CONVICTION_EVENTS_SEED.venue,
      dateRange: { start: '2027-08-13', end: '2027-08-16' },
      events: [],
    })
    expect(n?.event).toBe('conviction-2027')
    expect(n?.kind).toBe('side-events')
    expect(n?.title).toBe('Conviction 2027')
  })

  it('catalog merge prefers remote rows and keeps the 2026 seed', () => {
    const list = mergeEditionCatalog({
      editions: [
        {
          slug: 'conviction-2027',
          title: 'Conviction 2027',
          year: 2027,
          status: 'live',
        },
      ],
    })
    expect(list.some((e) => e.slug === 'conviction-2026')).toBe(true)
    expect(list[0]?.slug).toBe('conviction-2027')
    expect(latestLiveSlug(list)).toBe('conviction-2027')
    const up = upsertEditionInCatalog(list, {
      slug: 'conviction-2027',
      title: 'Conviction 2027 · HCMC',
      year: 2027,
      status: 'live',
    })
    expect(up.filter((e) => e.slug === 'conviction-2027')).toHaveLength(1)
    expect(up.find((e) => e.slug === 'conviction-2027')?.title).toBe(
      'Conviction 2027 · HCMC',
    )
  })

  it('ignores a leaked side-event dataset as catalog payload', () => {
    const list = mergeEditionCatalog(CONVICTION_EVENTS_SEED)
    expect(list).toHaveLength(SEED_EVENT_EDITIONS.length)
    expect(list.every((e) => e.slug === 'conviction-2026')).toBe(true)
  })
})
