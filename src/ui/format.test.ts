import { describe, expect, it } from 'vitest'
import type { IsoDate, LocalDateTime } from '../domain/types.ts'
import { formatAfterDay, formatCount, formatDaysAgo, formatDayMonth, formatDayRange, formatDecimal, formatMonthName, formatLoggedCounts, formatNoteTimes, formatPlanned, formatDuration, formatWatchWorkout } from './format.ts'
import type { WatchWorkout } from '../domain/watchWorkouts.ts'

describe('pt-PT formatting', () => {
  it('uses comma decimals', () => {
    expect(formatDecimal(42.5)).toBe('42,5')
    expect(formatDecimal(60)).toBe('60')
  })

  it('rounds counts to integers and groups thousands', () => {
    expect(formatCount(326.5)).toBe('327')
    expect(formatCount(1203)).toBe('1\u202F203')
    expect(formatCount(12030.4)).toBe('12\u202F030')
  })

  it('writes minutes as hours and minutes', () => {
    expect(formatDuration(452)).toBe('7 h 32 min')
    expect(formatDuration(480)).toBe('8 h')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(431.6)).toBe('7 h 12 min')
  })

  it('writes a watch workout’s start, duration, energy and distance, leaving out what it lacks', () => {
    const lift = { id: 'x', date: '2026-10-06', start: '18:02', activity: 'TraditionalStrengthTraining', minutes: 52.3, kcal: 310.5 } as unknown as WatchWorkout
    expect(formatWatchWorkout(lift)).toBe('18:02 · 52 min · 311 kcal')
    expect(formatWatchWorkout({ ...lift, minutes: 90, kcal: undefined, km: 4.99 })).toBe('18:02 · 1 h 30 min · 4,99 km')
  })

  it('writes a planned exercise and a session count', () => {
    expect(formatPlanned({ sets: 3, reps: { min: 8, max: 12 } })).toBe('3 × 8–12')
    expect(formatPlanned({ sets: 4, reps: { min: 6, max: 6 } })).toBe('4 × 6')
    expect(formatLoggedCounts({ exercises: 1, sets: 1 })).toBe('1 exercício, 1 série')
    expect(formatLoggedCounts({ exercises: 2, sets: 7 })).toBe('2 exercícios, 7 séries')
  })
})

describe('day and month', () => {
  it('writes the day and the short month', () => {
    expect(formatDayMonth('2026-10-05' as IsoDate)).toBe('5 out')
  })

  it('writes a range of days, naming the month once when it is the same', () => {
    expect(formatDayRange('2026-10-05' as IsoDate, '2026-10-11' as IsoDate)).toBe('5–11 out')
    expect(formatDayRange('2026-09-28' as IsoDate, '2026-10-04' as IsoDate)).toBe('28 set – 4 out')
  })

  it('names the month', () => {
    expect(formatMonthName('2026-10-05' as IsoDate)).toBe('outubro')
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
