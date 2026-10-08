import { parseIsoDate } from './days.ts'
import { isRecord } from './persistence.ts'
import type { WatchWorkoutId } from './types.ts'
import type { WatchWorkout, WatchWorkoutLog } from './watchWorkouts.ts'

export const WATCH_WORKOUTS_SCHEMA_VERSION = 1

const isValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function readStored(raw: unknown): WatchWorkout | null {
  if (!isRecord(raw)) return null
  const { id, date, start, activity, minutes, kcal, km } = raw
  const day = typeof date === 'string' ? parseIsoDate(date) : null
  const ok =
    typeof id === 'string' &&
    id !== '' &&
    day !== null &&
    typeof start === 'string' &&
    /^\d{2}:\d{2}$/.test(start) &&
    typeof activity === 'string' &&
    activity !== '' &&
    isValue(minutes) &&
    (kcal === undefined || isValue(kcal)) &&
    (km === undefined || isValue(km))
  if (!ok) return null
  return { id: id as WatchWorkoutId, date: day, start, activity, minutes, ...(kcal === undefined ? {} : { kcal }), ...(km === undefined ? {} : { km }) }
}

/** The current version only, and null for one bad row or an id twice. */
export function parseWatchWorkouts(raw: unknown): WatchWorkoutLog | null {
  if (!isRecord(raw) || raw.version !== WATCH_WORKOUTS_SCHEMA_VERSION || !Array.isArray(raw.workouts)) return null
  const log: Record<WatchWorkoutId, WatchWorkout> = {}
  for (const row of raw.workouts) {
    const workout = readStored(row)
    if (!workout || log[workout.id]) return null
    log[workout.id] = workout
  }
  return log
}
