import { describe, expect, it } from 'vitest'
import {
  CONVICTION_EVENTS_SEED,
  confirmedEventDates,
  datesInRange,
  eventOccursOnDate,
  eventsOnDate,
  matchesDateFilter,
  normalizeDataset,
  normalizeSideEvent,
  sortEvents,
  type SideEvent,
} from '../data/convictionEvents'

describe('convictionEvents helpers', () => {
  it('seed dataset normalizes cleanly', () => {
    const n = normalizeDataset(CONVICTION_EVENTS_SEED)
    expect(n).not.toBeNull()
    expect(n!.event).toBe('conviction-2026')
    expect(n!.events).toHaveLength(10)
    expect(n!.events.every((e) => !!e.imageUrl && !!e.link)).toBe(true)
    // Luma calendar uses square uploads/gallery covers, not event-social banners
    expect(
      n!.events.every(
        (e) =>
          /\/(uploads|gallery-images)\//.test(e.imageUrl || '') &&
          !/event-social\//.test(e.imageUrl || ''),
      ),
    ).toBe(true)
    expect(n!.venue.lat).toBeCloseTo(10.772, 2)
    expect(n!.venue.lng).toBeCloseTo(106.721, 2)
  })

  it('datesInRange is inclusive', () => {
    expect(datesInRange('2026-08-13', '2026-08-15')).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ])
  })

  it('confirmedEventDates excludes dateTbd', () => {
    expect(confirmedEventDates(CONVICTION_EVENTS_SEED.events)).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ])
  })

  it('dateTbd does not match concrete day filters', () => {
    const tbd = normalizeSideEvent({
      id: 'x',
      title: 'X',
      lat: 10.77,
      lng: 106.7,
      date: '2026-08-14',
      startTime: '10:00',
      type: 'meetup',
      dateTbd: true,
    })!
    expect(eventOccursOnDate(tbd, '2026-08-14')).toBe(false)
    expect(matchesDateFilter(tbd, '2026-08-14')).toBe(false)
    expect(matchesDateFilter(tbd, 'tbd')).toBe(true)
    expect(matchesDateFilter(tbd, 'all')).toBe(true)
  })

  it('sortEvents by date then time', () => {
    const a: SideEvent = {
      id: 'a',
      title: 'A',
      host: '',
      venue: '',
      address: '',
      lat: 10,
      lng: 106,
      date: '2026-08-14',
      startTime: '18:00',
      type: 'meetup',
    }
    const b: SideEvent = {
      ...a,
      id: 'b',
      title: 'B',
      startTime: '09:00',
    }
    const c: SideEvent = {
      ...a,
      id: 'c',
      title: 'C',
      date: '2026-08-13',
      startTime: '20:00',
    }
    expect(sortEvents([a, b, c]).map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('eventsOnDate respects multi-day endDate', () => {
    const ev = normalizeSideEvent({
      id: 'hack',
      title: 'Hack',
      lat: 10.7,
      lng: 106.7,
      date: '2026-08-13',
      endDate: '2026-08-15',
      startTime: '09:00',
      type: 'hackathon',
    })!
    expect(eventOccursOnDate(ev, '2026-08-14')).toBe(true)
    expect(eventsOnDate([ev], '2026-08-16')).toHaveLength(0)
  })

  it('rejects invalid coords', () => {
    expect(
      normalizeSideEvent({
        id: 'x',
        title: 'X',
        lat: 999,
        lng: 106,
        date: '2026-08-14',
      }),
    ).toBeNull()
  })

  it('seed locations for known venues look sane', () => {
    const byId = Object.fromEntries(
      CONVICTION_EVENTS_SEED.events.map((e) => [e.id, e]),
    )
    expect(byId['hsc-conference-hcmc'].lat).toBeCloseTo(10.775, 2)
    expect(byId['lbank-labs-vip-saigon-nights'].lng).toBeCloseTo(106.694, 2)
    expect(byId['special-ai-forum-conviction'].lat).toBe(
      CONVICTION_EVENTS_SEED.venue.lat,
    )
    // TBD venues must be flagged so map hides fake pins
    expect(
      CONVICTION_EVENTS_SEED.events.filter((e) => e.locationTbd).length,
    ).toBeGreaterThanOrEqual(4)
  })
})
