import { fromIsoDate } from '../domain/days.ts'
import type { IsoDate } from '../domain/types.ts'
import { findDay } from '../domain/workouts.ts'
import type { WorkoutPlan, WorkoutSession } from '../domain/workouts.ts'

const int = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })
// pt-PT only groups from 10 000; the design groups thousands too, with a narrow no-break space.
const grouped = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0, useGrouping: 'always' })
const one = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const oneFixed = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const two = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 })

export const formatKcal = (v: number) => grouped.format(v).replace(/\s/g, '\u202F')
export const formatGrams = (v: number) => one.format(v)
/** Fixed one decimal, for macro columns where aligned digits matter. */
export const formatMacro = (v: number) => oneFixed.format(v)
export const formatPercent = (fraction: number) => `${int.format(fraction * 100)}%`

export function formatSigned(v: number, format: (n: number) => string): string {
  const rounded = Number(format(Math.abs(v)).replace(',', '.').replace(/\s/g, ''))
  if (rounded === 0) return `±${format(0)}`
  return `${v > 0 ? '+' : '−'}${format(Math.abs(v))}`
}

export function formatAmount(v: number, unit: string): string {
  if (unit === 'kcal' || unit === 'kJ') return int.format(v)
  if (v >= 100) return int.format(v)
  if (v >= 10) return one.format(v)
  return two.format(v)
}

export const formatPortionCount = (p: number) => one.format(Math.round(p * 10) / 10)

/** Monday first, matching `weekdayOf`; the calendar shows the first three letters. */
export const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const

const longDate = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' })
const monthYear = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

/** "segunda-feira, 5 de outubro" */
export const formatLongDate = (date: IsoDate) => longDate.format(fromIsoDate(date))
/** "sexta, 2 de outubro" */
export const formatRepeatDate = (date: IsoDate) => formatLongDate(date).replace('-feira', '')
/** "5/10", for chart axes and tiles where space is tight. */
export const formatShortDate = (date: IsoDate) => shortDate.format(fromIsoDate(date))
/** "outubro de 2026" */
export const formatMonth = (year: number, month: number) => monthYear.format(new Date(year, month - 1, 1))

/** "3 × 8–12", or "4 × 6" when the range is a single target. */
export const formatPlanned = ({ sets, reps }: { sets: number; reps: { min: number; max: number } }) =>
  `${sets} × ${reps.min === reps.max ? reps.min : `${reps.min}–${reps.max}`}`

/** "1 exercício, 3 séries" */
export const formatLoggedCounts = ({ exercises, sets }: { exercises: number; sets: number }) =>
  `${exercises} ${exercises === 1 ? 'exercício' : 'exercícios'}, ${sets} ${sets === 1 ? 'série' : 'séries'}`

/** The Workout Day a session started from, by its current name. */
export function sessionTitle(session: WorkoutSession, plans: readonly WorkoutPlan[]): string {
  if (session.workoutDayId === null) return 'Treino livre'
  return findDay(plans, session.workoutDayId)?.name ?? 'Dia de treino eliminado'
}
