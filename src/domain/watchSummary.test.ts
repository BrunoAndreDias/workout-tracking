import { describe, expect, it } from 'vitest'
import type { HealthLog } from './health.ts'
import type { IsoDate } from './types.ts'
import { periodOf, watchSummary } from './watchSummary.ts'

const iso = (s: string) => s as IsoDate
const today = iso('2026-10-08')
const health: HealthLog = {
  [iso('2026-10-05')]: { steps: 8000, sleepMinutes: 420 },
  [iso('2026-10-06')]: { steps: 6000, sleepMinutes: 0 },
  [iso('2026-10-07')]: { restingHeartRate: 55 },
  [iso('2026-10-09')]: { steps: 1 },
}

describe('watchSummary', () => {
  it('averages each metric over only the days that have it, up to today', () => {
    const week = watchSummary(periodOf('week', iso('2026-10-07')), health, today)
    expect(week.period).toEqual({ kind: 'week', from: '2026-10-05', to: '2026-10-11' })
    expect(week.elapsed).toBe(4)
    expect(week.metrics).toEqual({
      steps: { average: 7000, days: 2 },
      sleepMinutes: { average: 210, days: 2 },
      restingHeartRate: { average: 55, days: 1 },
    })
  })

  it('reads a day on its own, and a future period as nothing yet', () => {
    expect(watchSummary(periodOf('day', iso('2026-10-07')), health, today).metrics).toEqual({ restingHeartRate: { average: 55, days: 1 } })
    const next = watchSummary(periodOf('week', iso('2026-10-14')), health, today)
    expect([next.elapsed, next.metrics]).toEqual([0, {}])
  })

  it('spans the calendar month', () => {
    expect(periodOf('month', iso('2026-02-10'))).toEqual({ kind: 'month', from: '2026-02-01', to: '2026-02-28' })
  })
})
