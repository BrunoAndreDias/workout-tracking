import { describe, expect, it } from 'vitest'
import { addDays, parseIsoDate, toIsoDate, weekdayOf } from './dates.ts'
import type { IsoDate } from './types.ts'

describe('IsoDate helpers', () => {
  it('formats local dates and steps across months, years and the March clock change', () => {
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09')
    expect(addDays('2026-01-31' as IsoDate, 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01' as IsoDate, -1)).toBe('2025-12-31')
    expect(addDays('2026-03-28' as IsoDate, 2)).toBe('2026-03-30')
  })

  it('parses only real dates', () => {
    expect(parseIsoDate('2026-02-28')).toBe('2026-02-28')
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-2-3')).toBeNull()
  })

  it('numbers weekdays from Monday', () => {
    expect(weekdayOf('2026-10-05' as IsoDate)).toBe(0)
    expect(weekdayOf('2026-10-04' as IsoDate)).toBe(6)
  })
})

