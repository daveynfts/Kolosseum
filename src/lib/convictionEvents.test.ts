import { describe, expect, it } from 'vitest'
import {
  CONVICTION_EVENTS_SEED,
  datesInRange,
  eventOccursOnDate,
  eventsOnDate,
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
    expect(n!.venue.lat).toBeCloseTo(10.72, 1)
  })

  it('datesInRange is inclusive', () => {
    expect(datesInRange('2026-08-13', '2026-08-16')).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ])
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
})
