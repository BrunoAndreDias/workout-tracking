import { isRating } from './body.ts'
import { parseIsoDate } from './days.ts'
import { atTime, parseOptionalNote, parseTimedNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import { isId, isRecord } from './persistence.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { exerciseKey, isRirTarget, MAX_BLOCK_WEEKS, newBlock } from './workouts.ts'
import type { AfterEffect, CycleStart, Exercise, LoggedSet, PlannedExercise, RirTarget, SessionExercise, WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutPlanState, WorkoutSession } from './workouts.ts'

export const EXERCISES_SCHEMA_VERSION = 1
/** 1 had the days on the plan; 2 has them in Training Blocks, and the cycle's start. */
export const WORKOUT_PLANS_SCHEMA_VERSION = 2
/**
 * 1 had a plain-text `notes`; 2 has an optional timed `note` on the session and on each of its exercises. A session's
 * optional `feel` and `after` came later without a new version: absent, they are none.
 */
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

function parseRirTarget(raw: unknown): RirTarget | null | false {
  if (raw === null) return null
  if (!isRecord(raw) || typeof raw.min !== 'number' || typeof raw.max !== 'number') return false
  const rir = { min: raw.min, max: raw.max }
  return isRirTarget(rir) && rir
}

function parseBlock(raw: unknown): WorkoutBlock | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || !isCount(raw.weeks) || raw.weeks < 1 || raw.weeks > MAX_BLOCK_WEEKS) return null
  if (!Array.isArray(raw.rir) || raw.rir.length !== raw.weeks) return null
  const rir = raw.rir.map(parseRirTarget)
  if (rir.includes(false)) return null
  const days = parseList(raw.days, parseDay)
  return days && { id: raw.id as WorkoutBlockId, name: raw.name, weeks: raw.weeks, rir: rir as (RirTarget | null)[], days }
}

function parseStart(raw: unknown, blocks: readonly WorkoutBlock[]): CycleStart | null | false {
  if (raw === null) return null
  if (!isRecord(raw) || typeof raw.since !== 'string' || !blocks.some((b) => b.id === raw.blockId)) return false
  const since = parseIsoDate(raw.since)
  return since !== null && { blockId: raw.blockId as WorkoutBlockId, since }
}

function parsePlan(raw: unknown): WorkoutPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const blocks = parseList(raw.blocks, parseBlock)
  if (!blocks || blocks.length === 0) return null
  const start = parseStart(raw.start, blocks)
  return start === false ? null : { id: raw.id as WorkoutPlanId, name: raw.name, blocks, start }
}

/** A version 1 plan's days become its one block, of the default length, and its cycle has not started. */
function parseLegacyPlan(raw: unknown): WorkoutPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const days = parseList(raw.days, parseDay)
  if (!days) return null
  const block = { ...newBlock(`${raw.id}-b1` as WorkoutBlockId, 'Bloco A'), days }
  return { id: raw.id as WorkoutPlanId, name: raw.name, blocks: [block], start: null }
}

const isUnique = (ids: readonly string[]) => new Set(ids).size === ids.length

/** Versions 1 and 2. Block ids are unique across the document and day ids within a plan, as version 1 required; the active plan must be one of the plans, and is null only when there are none. */
export function parseWorkoutPlans(raw: unknown): WorkoutPlanState | null {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== WORKOUT_PLANS_SCHEMA_VERSION)) return null
  const plans = parseList(raw.plans, raw.version === 1 ? parseLegacyPlan : parsePlan, (p) => p.id)
  if (!plans) return null
  if (!isUnique(plans.flatMap((p) => p.blocks.map((b) => b.id)))) return null
  if (!plans.every((p) => isUnique(p.blocks.flatMap((b) => b.days.map((d) => d.id))))) return null
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

function parseAfterEffect(raw: unknown, session: { date: IsoDate; exercises: readonly SessionExercise[] }): AfterEffect | null {
  if (!isRecord(raw) || typeof raw.date !== 'string') return null
  const date = parseIsoDate(raw.date)
  const note = parseTimedNote(raw.note)
  const exerciseId = raw.exerciseId as ExerciseId | null
  if (!date || date <= session.date || !note || (exerciseId !== null && !session.exercises.some((e) => e.exerciseId === exerciseId))) return null
  return { date, exerciseId, note }
}

function parseSession(raw: unknown, legacy: boolean): WorkoutSession | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.date !== 'string') return null
  const date = parseIsoDate(raw.date)
  if (!date || (raw.workoutDayId !== null && !isId(raw.workoutDayId))) return null
  if (legacy && typeof raw.notes !== 'string') return null
  if (raw.feel !== undefined && !isRating(raw.feel)) return null
  const note = legacy ? legacyNote(raw.notes as string, date) : parseOptionalNote(raw.note)
  const exercises = parseList(raw.exercises, parseSessionExercise, (e) => e.exerciseId)
  if (!exercises || note === false) return null
  const after = raw.after === undefined ? [] : parseList(raw.after, (r) => parseAfterEffect(r, { date, exercises }), (a) => `${a.date} ${a.exerciseId}`)
  if (!after) return null
  return {
    id: raw.id as WorkoutSessionId,
    date,
    workoutDayId: raw.workoutDayId as WorkoutDayId | null,
    exercises,
    ...(note && { note }),
    ...(raw.feel !== undefined && { feel: raw.feel }),
    ...(after.length > 0 && { after }),
  }
}

/** Versions 1 and 2; null for anything else, including one bad session or two with the same id. */
export function parseWorkoutSessions(raw: unknown): WorkoutSession[] | null {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== WORKOUT_SESSIONS_SCHEMA_VERSION)) return null
  const legacy = raw.version === 1
  return parseList(raw.sessions, (r) => parseSession(r, legacy), (s) => s.id)
}
