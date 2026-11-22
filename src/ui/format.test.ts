import { describe, expect, it } from 'vitest'
import type { IsoDate, LocalDateTime } from '../domain/types.ts'
import { formatAfterDay, formatDaysAgo, formatNoteTimes, formatPlanned } from './format.ts'

describe('pt-PT formatting', () => {
  it('writes a planned exercise', () => {
    expect(formatPlanned({ sets: 3, reps: { min: 8, max: 12 } })).toBe('3 × 8–12')
    expect(formatPlanned({ sets: 4, reps: { min: 6, max: 6 } })).toBe('4 × 6')
  })
})

describe('note times', () => {
  const note = (createdAt: string, updatedAt: string) => ({ text: 'x', createdAt: createdAt as LocalDateTime, updatedAt: updatedAt as LocalDateTime })

  it('shows only when it was written while the edit falls in the same minute', () => {
    expect(formatNoteTimes(note('2026-10-06T18:50:05', '2026-10-06T18:50:59'))).toBe('Escrito a 6 out, 18:50')
  })

  it('adds the edit time on the same day', () => {
    expect(formatNoteTimes(note('2026-10-06T18:50:05', '2026-10-06T19:02:00'))).toBe('Escrito a 6 out, 18:50 · editado 19:02')
  })

  it('repeats the date when edited on another day', () => {
    expect(formatNoteTimes(note('2026-01-31T23:59:00', '2026-02-01T00:10:00'))).toBe('Escrito a 31 jan, 23:59 · editado 1 fev, 00:10')
  })
})

describe('After-effect days', () => {
  const d = (s: string) => s as IsoDate
  it('names the day after a session, then counts days, then gives the date', () => {
    expect(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13'].map((on) => formatAfterDay(d('2026-10-06'), d(on)))).toEqual(['Dia seguinte', '2 dias depois', '3 dias depois', '13 out'])
  })

  it('says how long before a date a session was, across a month', () => {
    expect([d('2026-09-30'), d('2026-09-29')].map((on) => formatDaysAgo(on, d('2026-10-01')))).toEqual(['ontem', 'há 2 dias'])
  })
})
