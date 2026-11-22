import { daysBetween, fromIsoDate } from '../domain/dates.ts'
import { equipmentLabel } from '../domain/equipment.ts'
import type { EquipmentId, EquipmentState } from '../domain/equipment.ts'
import type { TimedNote } from '../domain/notes.ts'
import type { IsoDate, LocalDateTime } from '../domain/types.ts'
import { AFTER_EFFECT_DAYS } from '../domain/sessions.ts'
import { findDay } from '../domain/blocks.ts'
import { rangeText } from '../domain/numbers.ts'
import type { WorkoutPlan, WorkoutSession } from '../domain/workouts.ts'

const longDate = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** "segunda-feira, 5 de outubro" */
export const formatLongDate = (date: IsoDate) => longDate.format(fromIsoDate(date))

/** "3 × 8–12", or "4 × 6" when the range is a single target. */
export const formatPlanned = ({ sets, reps }: { sets: number; reps: { min: number; max: number } }) => `${sets} × ${rangeText(reps)}`

/** "1 noite", "3 noites" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The Workout Day a session started from, by its current name. */
export function sessionTitle(session: WorkoutSession, plans: readonly WorkoutPlan[]): string {
  if (session.workoutDayId === null) return 'Treino livre'
  return findDay(plans, session.workoutDayId)?.name ?? 'Dia de treino eliminado'
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
const dayMonth = (at: IsoDate | LocalDateTime) => `${Number(at.slice(8, 10))} ${MONTHS_SHORT[Number(at.slice(5, 7)) - 1]}`
const clock = (at: LocalDateTime) => at.slice(11, 16)

/** When an After-effect was felt, from its session: "Dia seguinte", "2 dias depois", or the date further on. */
export function formatAfterDay(sessionDate: IsoDate, date: IsoDate): string {
  const n = daysBetween(sessionDate, date)
  if (n === 1) return 'Dia seguinte'
  return n <= AFTER_EFFECT_DAYS ? `${n} dias depois` : dayMonth(date)
}

/** How long before `today` a date was: "ontem", "há 2 dias". */
export const formatDaysAgo = (date: IsoDate, today: IsoDate) => {
  const n = daysBetween(date, today)
  return n === 1 ? 'ontem' : `há ${n} dias`
}

/** "Escrito a 6 out, 18:50 · editado 19:02"; no edit part within the same minute, and the date again when edited on another day. */
export function formatNoteTimes({ createdAt, updatedAt }: TimedNote): string {
  const written = `Escrito a ${dayMonth(createdAt)}, ${clock(createdAt)}`
  if (updatedAt.slice(0, 16) === createdAt.slice(0, 16)) return written
  const sameDay = updatedAt.slice(0, 10) === createdAt.slice(0, 10)
  return `${written} · editado ${sameDay ? '' : `${dayMonth(updatedAt)}, `}${clock(updatedAt)}`
}

/** "Halteres, Banco plano", or "Sem material" for none. */
export const materialText = (state: EquipmentState, ids: readonly EquipmentId[]): string =>
  ids.length === 0 ? 'Sem material' : ids.map((id) => equipmentLabel(state, id)).join(', ')
