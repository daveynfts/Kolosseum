import { describe, expect, it } from 'vitest'
import {
  CONVICTION_EVENTS_SEED,
  MAIN_EVENT_ID,
  buildConflictMap,
  buildDayTimeline,
  confirmedEventDates,
  datesInRange,
  distanceKm,
  eventDistanceKm,
  eventHasMapPin,
  eventOccursOnDate,
  eventTimeOfDay,
  eventsOnDate,
  formatDistanceKm,
  getSideEventStatus,
  isMainEvent,
  isMainVenueSideStage,
  matchesDateFilter,
  normalizeDataset,
  normalizeSideEvent,
  pinDisplayPositions,
  sortEvents,
  type SideEvent,
} from '../data/convictionEvents'

describe('convictionEvents helpers', () => {
  it('seed dataset normalizes cleanly', () => {
    const n = normalizeDataset(CONVICTION_EVENTS_SEED)
    expect(n).not.toBeNull()
    expect(n!.event).toBe('conviction-2026')
    expect(n!.events).toHaveLength(18)
    expect(n!.events.every((e) => !!e.imageUrl && !!e.link)).toBe(true)
    // Main forum is venue chrome only — not a side-event pin
    expect(n!.events.some((e) => isMainEvent(e))).toBe(false)
    const ai = n!.events.find((e) => e.id === 'special-ai-forum-conviction')
    expect(ai && isMainVenueSideStage(ai)).toBe(true)
    // Prefer square covers (Luma uploads/gallery or other CDN) — never event-social OG banners
    expect(
      n!.events.every(
        (e) =>
          !!e.imageUrl &&
          !/event-social\//.test(e.imageUrl || '') &&
          (/\/(uploads|gallery-images|event-covers)\//.test(e.imageUrl || '') ||
            /cloudfront\.net|gradual\.com|arc\.io/i.test(e.imageUrl || '')),
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
      '2026-08-16',
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

  it('eventTimeOfDay buckets start times', () => {
    const mk = (startTime: string) =>
      normalizeSideEvent({
        id: 't',
        title: 'T',
        lat: 10.7,
        lng: 106.7,
        date: '2026-08-14',
        startTime,
        type: 'meetup',
      })!
    expect(eventTimeOfDay(mk('09:30'))).toBe('morning')
    expect(eventTimeOfDay(mk('12:00'))).toBe('afternoon')
    expect(eventTimeOfDay(mk('16:59'))).toBe('afternoon')
    expect(eventTimeOfDay(mk('17:00'))).toBe('evening')
    expect(
      eventHasMapPin(
        normalizeSideEvent({
          id: 'p',
          title: 'P',
          lat: 10.7,
          lng: 106.7,
          date: '2026-08-14',
          startTime: '10:00',
          type: 'meetup',
          locationTbd: true,
        })!,
      ),
    ).toBe(false)
  })

  it('buildDayTimeline flags overlapping side slots on 14 Aug', () => {
    const tl = buildDayTimeline(CONVICTION_EVENTS_SEED.events, '2026-08-14')
    expect(tl).not.toBeNull()
    expect(tl!.bars.every((b) => !b.isMain)).toBe(true)
    // Hydra / Builders HH / Redots all 16:00+
    expect(tl!.conflictedSideCount).toBeGreaterThanOrEqual(2)
    const conf = buildConflictMap(
      CONVICTION_EVENTS_SEED.events.filter((e) =>
        eventOccursOnDate(e, '2026-08-14'),
      ),
      { includeMain: false },
    )
    const builders = conf.get('builders-happy-hours-hcmc') || []
    expect(builders.some((e) => e.id === 'redotsclub-vietnam-welcome-mixer')).toBe(
      true,
    )
    expect(conf.has(MAIN_EVENT_ID)).toBe(false)
  })

  it('getSideEventStatus handles multi-day overnight window', () => {
    const multi = normalizeSideEvent({
      id: 'multi-day',
      title: 'Multi',
      lat: 10.77,
      lng: 106.72,
      date: '2026-08-14',
      endDate: '2026-08-15',
      startTime: '08:00',
      endTime: '18:00',
      type: 'conference',
    })!
    const d1eve = getSideEventStatus(
      multi,
      new Date('2026-08-14T19:00:00+07:00'),
    )
    expect(d1eve.phase).toBe('live')
    const d2am = getSideEventStatus(
      multi,
      new Date('2026-08-15T07:00:00+07:00'),
    )
    expect(d2am.phase).toBe('live')
    const after = getSideEventStatus(
      multi,
      new Date('2026-08-15T19:00:00+07:00'),
    )
    expect(after.phase).toBe('ended')
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
    const a = normalizeSideEvent({
      ...base,
      id: 'special-ai-forum-conviction',
      title: 'AI Forum',
      startTime: '09:00',
      endTime: '15:00',
    })!
    const b = normalizeSideEvent({
      ...base,
      id: 'another-sala-stage',
      title: 'Other Sala',
      startTime: '10:00',
      endTime: '12:00',
    })!
    const pos = pinDisplayPositions([a, b])
    const pA = pos.get(a.id)!
    const pB = pos.get(b.id)!
    expect(pA.lng).not.toBeCloseTo(pB.lng, 6)
    expect(distanceKm(pA.lat, pA.lng, pB.lat, pB.lng)).toBeGreaterThan(0.04)
    expect(distanceKm(pA.lat, pA.lng, base.lat, base.lng)).toBeLessThan(0.08)
    expect(distanceKm(pB.lat, pB.lng, base.lat, base.lng)).toBeLessThan(0.08)
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
