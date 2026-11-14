import { addDays, fromIsoDate, mondayOf, monthBounds } from './dates.ts'
import { HEALTH_METRICS } from './health.ts'
import type { HealthLog, HealthMetric } from './health.ts'
import type { IsoDate } from './types.ts'

export type PeriodKind = 'day' | 'week' | 'month'

/** Inclusive dates. A week runs Monday to Sunday; a month is a calendar month. */
export interface Period {
  readonly kind: PeriodKind
  readonly from: IsoDate
  readonly to: IsoDate
}

const BOUNDS: Readonly<Record<PeriodKind, (date: IsoDate) => readonly [IsoDate, IsoDate]>> = {
  day: (date) => [date, date],
  week: (date) => {
    const monday = mondayOf(date)
    return [monday, addDays(monday, 6)]
  },
  month: (date) => {
    const d = fromIsoDate(date)
    return monthBounds(d.getFullYear(), d.getMonth() + 1)
  },
}

export function periodOf(kind: PeriodKind, date: IsoDate): Period {
  const [from, to] = BOUNDS[kind](date)
  return { kind, from, to }
}

export interface WatchSummary {
  readonly period: Period
  /** Days of the period up to and including today; 0 for a future period. */
  readonly elapsed: number
  /** Per metric, the average over the days that have a value, and how many days that is. Absent when no day has one. */
  readonly metrics: Readonly<Partial<Record<HealthMetric, { readonly average: number; readonly days: number }>>>
}

/** The Health Samples of a period's days up to today, each metric averaged over the days that have it. */
export function watchSummary(period: Period, health: HealthLog, today: IsoDate): WatchSummary {
  const dates: IsoDate[] = []
  for (let date = period.from; date <= period.to && date <= today; date = addDays(date, 1)) dates.push(date)
  const metrics: Partial<Record<HealthMetric, { average: number; days: number }>> = {}
  for (const { key } of HEALTH_METRICS) {
    const values = dates.flatMap((date) => health[date]?.[key] ?? [])
    if (values.length > 0) metrics[key] = { average: values.reduce((a, b) => a + b, 0) / values.length, days: values.length }
  }
  return { period, elapsed: dates.length, metrics }
}
