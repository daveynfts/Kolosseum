import { describe, expect, it } from 'vitest'
import {
  CONVICTION_EVENTS_SEED,
  MAIN_EVENT_ID,
  confirmedEventDates,
  datesInRange,
  distanceKm,
  eventDistanceKm,
  eventOccursOnDate,
  eventsOnDate,
  formatDistanceKm,
  isMainEvent,
  isMainVenueSideStage,
  matchesDateFilter,
  normalizeDataset,
  normalizeSideEvent,
  partitionMainAndSide,
  pinDisplayPositions,
  sortEvents,
  type SideEvent,
} from '../data/convictionEvents'

describe('convictionEvents helpers', () => {
  it('seed dataset normalizes cleanly', () => {
    const n = normalizeDataset(CONVICTION_EVENTS_SEED)
    expect(n).not.toBeNull()
    expect(n!.event).toBe('conviction-2026')
    expect(n!.events).toHaveLength(14)
    expect(n!.events.every((e) => !!e.imageUrl && !!e.link)).toBe(true)
    expect(n!.events.some((e) => isMainEvent(e))).toBe(true)
    const main = n!.events.find((e) => isMainEvent(e))!
    expect(main.id).toBe(MAIN_EVENT_ID)
    const parts = partitionMainAndSide(n!.events)
    expect(parts.main).toHaveLength(1)
    expect(parts.side.length).toBe(n!.events.length - 1)
    const ai = n!.events.find((e) => e.id === 'special-ai-forum-conviction')
    expect(ai && isMainVenueSideStage(ai)).toBe(true)
    expect(isMainVenueSideStage(main)).toBe(false)
    // Luma calendar covers: uploads / gallery / event-covers (not event-social)
    expect(
      n!.events.every(
        (e) =>
          /\/(uploads|gallery-images|event-covers)\//.test(e.imageUrl || '') &&
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

  it('pinDisplayPositions fans out overlapping venue pins', () => {
    const base = {
      host: '',
      venue: 'Sala',
      address: '',
      lat: 10.7719776,
      lng: 106.7210607,
      date: '2026-08-15',
      type: 'conference' as const,
    }
    const main = normalizeSideEvent({
      ...base,
      id: 'conviction-2026-main-event',
      title: 'Main',
      startTime: '08:00',
      endTime: '18:00',
    })!
    const ai = normalizeSideEvent({
      ...base,
      id: 'special-ai-forum-conviction',
      title: 'AI Forum',
      startTime: '09:00',
      endTime: '15:00',
    })!
    const pos = pinDisplayPositions([main, ai])
    const pMain = pos.get(main.id)!
    const pAi = pos.get(ai.id)!
    // Fan left/right → different lng, same-ish lat
    expect(pMain.lng).not.toBeCloseTo(pAi.lng, 6)
    expect(distanceKm(pMain.lat, pMain.lng, pAi.lat, pAi.lng)).toBeGreaterThan(
      0.04,
    )
    // Both still near the shared venue (~ < 80 m)
    expect(distanceKm(pMain.lat, pMain.lng, base.lat, base.lng)).toBeLessThan(
      0.08,
    )
    expect(distanceKm(pAi.lat, pAi.lng, base.lat, base.lng)).toBeLessThan(0.08)
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

  it('formats haversine distances', () => {
    const km = distanceKm(10.771895, 106.721066, 10.775058, 106.705713)
    expect(km).toBeGreaterThan(1)
    expect(km).toBeLessThan(3)
    expect(formatDistanceKm(0.35)).toBe('350 m')
    expect(formatDistanceKm(1.24)).toBe('1.2 km')
    const hilton = CONVICTION_EVENTS_SEED.events.find(
      (e) => e.id === 'hsc-conference-hcmc',
    )!
    const d = eventDistanceKm(CONVICTION_EVENTS_SEED.venue, hilton)
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(1)
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
