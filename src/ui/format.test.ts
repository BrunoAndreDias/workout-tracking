import { describe, expect, it } from 'vitest'
import type { IsoDate, LocalDateTime } from '../domain/types.ts'
import { formatAmount, formatDayMonth, formatGrams, formatKcal, formatLoggedCounts, formatMacro, formatNoteTimes, formatPercent, formatPlanned, formatPortionCount, formatSigned, formatSleepDuration } from './format.ts'

describe('pt-PT formatting', () => {
  it('uses comma decimals', () => {
    expect(formatGrams(120.5)).toBe('120,5')
    expect(formatGrams(120)).toBe('120')
    expect(formatMacro(5.16)).toBe('5,2')
    expect(formatMacro(5)).toBe('5,0')
  })

  it('rounds kcal to integers', () => {
    expect(formatKcal(326.4)).toBe('326')
    expect(formatKcal(326.5)).toBe('327')
    expect(formatKcal(1203)).toBe('1\u202F203')
    expect(formatKcal(12030.4)).toBe('12\u202F030')
  })

  it('formats portion counts to one decimal', () => {
    expect(formatPortionCount(1)).toBe('1')
    expect(formatPortionCount(1.44)).toBe('1,4')
    expect(formatPortionCount(4.16)).toBe('4,2')
  })

  it('writes sleep minutes as hours and minutes', () => {
    expect(formatSleepDuration(452)).toBe('7 h 32 min')
    expect(formatSleepDuration(480)).toBe('8 h')
    expect(formatSleepDuration(45)).toBe('45 min')
    expect(formatSleepDuration(431.6)).toBe('7 h 12 min')
  })

  it('signs deltas and avoids a signed zero', () => {
    expect(formatSigned(51.4, formatKcal)).toBe('+51')
    expect(formatSigned(-51.4, formatKcal)).toBe('−51')
    expect(formatSigned(-0.2, formatKcal)).toBe('±0')
    expect(formatSigned(0.04, formatMacro)).toBe('±0,0')
  })

  it('formats amounts by magnitude and percent', () => {
    expect(formatAmount(1234.5, 'mg')).toBe('1235')
    expect(formatAmount(12.34, 'mg')).toBe('12,3')
    expect(formatAmount(0.125, 'g')).toBe('0,13')
    expect(formatPercent(0.254)).toBe('25%')
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
