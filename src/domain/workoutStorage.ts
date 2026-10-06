import { parseIsoDate } from './days.ts'
import { atTime, parseOptionalNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import { defaultStorage, isId, isRecord, loadStore, saveStore } from './persistence.ts'
import type { StorageLike } from './persistence.ts'
import type { ExerciseId, IsoDate, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { exerciseKey } from './workouts.ts'
import type { Exercise, LoggedSet, PlannedExercise, SessionExercise, WorkoutDay, WorkoutPlan, WorkoutPlanState, WorkoutSession, WorkoutState } from './workouts.ts'
import { STORE_KEY } from './storeKeys.ts'

export const EXERCISES_STORAGE_KEY = STORE_KEY.exercises
export const EXERCISES_SCHEMA_VERSION = 1
export const WORKOUT_PLANS_STORAGE_KEY = STORE_KEY.workoutPlans
export const WORKOUT_PLANS_SCHEMA_VERSION = 1
export const WORKOUT_SESSIONS_STORAGE_KEY = STORE_KEY.workoutSessions
/** 1 had a plain-text `notes`; 2 has an optional timed `note` on the session and on each of its exercises. */
export const WORKOUT_SESSIONS_SCHEMA_VERSION = 2

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isKg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** Every item parsed, or null when one fails or, given `key`, two share a key. */
function parseList<T>(raw: unknown, parse: (raw: unknown) => T | null, key?: (item: T) => string): T[] | null {
  if (!Array.isArray(raw)) return null
  const items = []
  for (const r of raw) {
    const item = parse(r)
    if (!item) return null
    items.push(item)
  }
  return key && new Set(items.map(key)).size !== items.length ? null : items
}

function parseExercise(raw: unknown): Exercise | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || raw.name.trim() === '') return null
  return { id: raw.id as ExerciseId, name: raw.name }
}

/** The current version only; null for anything else, including one bad exercise or two with the same id or name. */
export function parseExercises(raw: unknown): Exercise[] | null {
  if (!isRecord(raw) || raw.version !== EXERCISES_SCHEMA_VERSION) return null
  const exercises = parseList(raw.exercises, parseExercise, (e) => e.id)
  return exercises && new Set(exercises.map((e) => exerciseKey(e.name))).size === exercises.length ? exercises : null
}

function parsePlanned(raw: unknown): PlannedExercise | null {
  if (!isRecord(raw) || !isId(raw.exerciseId) || !isCount(raw.sets) || raw.sets < 1 || !isRecord(raw.reps)) return null
  const { min, max } = raw.reps
  if (!isCount(min) || !isCount(max) || min < 1 || max < min) return null
  return { exerciseId: raw.exerciseId as ExerciseId, sets: raw.sets, reps: { min, max } }
}

function parseDay(raw: unknown): WorkoutDay | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const exercises = parseList(raw.exercises, parsePlanned, (p) => p.exerciseId)
  return exercises && { id: raw.id as WorkoutDayId, name: raw.name, exercises }
}

function parsePlan(raw: unknown): WorkoutPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const days = parseList(raw.days, parseDay, (d) => d.id)
  return days && { id: raw.id as WorkoutPlanId, name: raw.name, days }
}

/** The current version only; the active plan must be one of the plans, and is null only when there are none. */
export function parseWorkoutPlans(raw: unknown): WorkoutPlanState | null {
  if (!isRecord(raw) || raw.version !== WORKOUT_PLANS_SCHEMA_VERSION) return null
  const plans = parseList(raw.plans, parsePlan, (p) => p.id)
  if (!plans) return null
  const active = plans.find((p) => p.id === raw.activePlanId)
  if (plans.length > 0 ? !active : raw.activePlanId !== null) return null
  return { plans, activePlanId: active?.id ?? null }
}

function parseSet(raw: unknown): LoggedSet | null {
  if (!isRecord(raw) || (raw.reps !== null && !isCount(raw.reps)) || (raw.kg !== null && !isKg(raw.kg))) return null
  return { reps: raw.reps, kg: raw.kg }
}

function parseSessionExercise(raw: unknown): SessionExercise | null {
  if (!isRecord(raw) || !isId(raw.exerciseId)) return null
  const sets = parseList(raw.sets, parseSet)
  const note = parseOptionalNote(raw.note)
  if (!sets || note === false) return null
  return note ? { exerciseId: raw.exerciseId as ExerciseId, sets, note } : { exerciseId: raw.exerciseId as ExerciseId, sets }
}

/** A version 1 note was plain text with no time: it counts as written at midday of the session's date. */
function legacyNote(notes: string, date: IsoDate): TimedNote | undefined {
  if (notes.trim() === '') return undefined
  const at = atTime(date, '12:00')
  return { text: notes, createdAt: at, updatedAt: at }
}

function parseSession(raw: unknown, legacy: boolean): WorkoutSession | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.date !== 'string') return null
  const date = parseIsoDate(raw.date)
  if (!date || (raw.workoutDayId !== null && !isId(raw.workoutDayId))) return null
  if (legacy && typeof raw.notes !== 'string') return null
  const note = legacy ? legacyNote(raw.notes as string, date) : parseOptionalNote(raw.note)
  const exercises = parseList(raw.exercises, parseSessionExercise, (e) => e.exerciseId)
  if (!exercises || note === false) return null
  const session = { id: raw.id as WorkoutSessionId, date, workoutDayId: raw.workoutDayId as WorkoutDayId | null, exercises }
  return note ? { ...session, note } : session
}

/** Versions 1 and 2; null for anything else, including one bad session or two with the same id. */
export function parseWorkoutSessions(raw: unknown): WorkoutSession[] | null {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== WORKOUT_SESSIONS_SCHEMA_VERSION)) return null
  const legacy = raw.version === 1
  return parseList(raw.sessions, (r) => parseSession(r, legacy), (s) => s.id)
}

const emptyPlans = (): WorkoutPlanState => ({ plans: [], activePlanId: null })

export const loadExercises = (storage: StorageLike | null = defaultStorage()): Exercise[] => loadStore(storage, EXERCISES_STORAGE_KEY, parseExercises, () => [])
export const loadWorkoutPlans = (storage: StorageLike | null = defaultStorage()): WorkoutPlanState =>
  loadStore(storage, WORKOUT_PLANS_STORAGE_KEY, parseWorkoutPlans, emptyPlans)
export const loadWorkoutSessions = (storage: StorageLike | null = defaultStorage()): WorkoutSession[] =>
  loadStore(storage, WORKOUT_SESSIONS_STORAGE_KEY, parseWorkoutSessions, () => [])

export const loadWorkouts = (storage: StorageLike | null = defaultStorage()): WorkoutState => ({
  exercises: loadExercises(storage),
  ...loadWorkoutPlans(storage),
  sessions: loadWorkoutSessions(storage),
})

export const saveExercises = (exercises: readonly Exercise[], storage: StorageLike | null = defaultStorage()): boolean =>
  saveStore(EXERCISES_STORAGE_KEY, { version: EXERCISES_SCHEMA_VERSION, exercises }, storage)
export const saveWorkoutPlans = ({ plans, activePlanId }: WorkoutPlanState, storage: StorageLike | null = defaultStorage()): boolean =>
  saveStore(WORKOUT_PLANS_STORAGE_KEY, { version: WORKOUT_PLANS_SCHEMA_VERSION, plans, activePlanId }, storage)
export const saveWorkoutSessions = (sessions: readonly WorkoutSession[], storage: StorageLike | null = defaultStorage()): boolean =>
  saveStore(WORKOUT_SESSIONS_STORAGE_KEY, { version: WORKOUT_SESSIONS_SCHEMA_VERSION, sessions }, storage)
