import type { IsoDate } from './types.ts'

const pad = (n: number) => String(n).padStart(2, '0')

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as IsoDate
}

/** Null unless `s` is a real calendar date written as 'YYYY-MM-DD'. */
export function parseIsoDate(s: string): IsoDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return toIsoDate(d) === s ? (s as IsoDate) : null
}

/** Local midday, so adding days never trips over a daylight-saving hour. */
export function fromIsoDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export const daysBetween = (from: IsoDate, to: IsoDate): number => Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / 86_400_000)

export function addDays(date: IsoDate, n: number): IsoDate {
  const d = fromIsoDate(date)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

/** 0 for Monday through 6 for Sunday. */
export const weekdayOf = (date: IsoDate): number => (fromIsoDate(date).getDay() + 6) % 7

// Block, week and Exercise Run math asks this of every session on every render, so each date is worked out once.
const mondays = new Map<IsoDate, IsoDate>()

export function mondayOf(date: IsoDate): IsoDate {
  let monday = mondays.get(date)
  if (monday === undefined) mondays.set(date, (monday = addDays(date, -weekdayOf(date))))
  return monday
}
