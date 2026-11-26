import { isRating } from './rating.ts'
import { parseIsoDate } from './dates.ts'
import { atTime, parseOptionalNote, parseTimedNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import { isId } from './persistence.ts'
import { isRecord } from './records.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { exerciseKey } from './exerciseCatalog.ts'
import { ROLE_WEEKS, ROLES, splitForDayCount, SPLITS } from './splits.ts'
import { MAX_BLOCK_WEEKS, MAX_RIR } from './workouts.ts'
import { isRunWeeks } from './blocks.ts'
import type { AfterEffect, CycleStart, Exercise, LoggedSet, PlannedExercise, Role, SessionExercise, SetTarget, Split, WorkoutDay, WorkoutPlan, WorkoutPlanState, WorkoutSession } from './workouts.ts'

export const EXERCISES_SCHEMA_VERSION = 1
export const WORKOUT_PLANS_SCHEMA_VERSION = 4
export const WORKOUT_SESSIONS_SCHEMA_VERSION = 4

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isKg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isRir = (v: unknown): v is number => isCount(v) && v <= MAX_RIR

/** Every item parsed, or null when one fails or, given `key`, two share a key. */
function parseList<T>(raw: unknown, parse: (raw: unknown, index: number) => T | null, key?: (item: T) => string): T[] | null {
  if (!Array.isArray(raw)) return null
  const items = []
  for (const [i, r] of raw.entries()) {
    const item = parse(r, i)
    if (!item) return null
    items.push(item)
  }
  return key && new Set(items.map(key)).size !== items.length ? null : items
}

function parseExercise(raw: unknown): Exercise | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || raw.name.trim() === '') return null
  return { id: raw.id as ExerciseId, name: raw.name }
}

const EXERCISE_VERSIONS = [1] as const

/** Version 1; null for anything else, including one bad exercise or two with the same id or name. */
export function parseExercises(raw: unknown): Exercise[] | null {
  const version = isRecord(raw) ? EXERCISE_VERSIONS.find((v) => v === raw.version) : undefined
  if (!isRecord(raw) || version === undefined) return null
  const exercises = parseList(raw.exercises, parseExercise, (e) => e.id)
  return exercises && new Set(exercises.map((e) => exerciseKey(e.name))).size === exercises.length ? exercises : null
}

const isRole = (v: unknown): v is Role => ROLES.includes(v as Role)
const isSplit = (v: unknown): v is Split => typeof v === 'string' && Object.hasOwn(SPLITS, v)

/**
 * Before version 3 a Planned Exercise had no role. A store cannot see the Exercises' names, so the role is guessed
 * from the place in the day: the first is the main lift and the rest are isolation work, which the user can change.
 */
function parsePlanned(raw: unknown, legacyIndex: number | null): PlannedExercise | null {
  if (!isRecord(raw) || !isId(raw.exerciseId) || !isCount(raw.sets) || raw.sets < 1 || !isRecord(raw.reps)) return null
  const { min, max } = raw.reps
  if (!isCount(min) || !isCount(max) || min < 1 || max < min) return null
  const role = legacyIndex === null ? raw.role : legacyIndex === 0 ? 'main' : 'isolation'
  if (!isRole(role)) return null
  const weeks = raw.weeks === undefined ? ROLE_WEEKS[role] : raw.weeks
  const since = typeof raw.since === 'string' ? parseIsoDate(raw.since) : null
  if (!isRunWeeks(weeks) || (raw.since !== undefined && raw.since !== null && since === null)) return null
  return { exerciseId: raw.exerciseId as ExerciseId, role, sets: raw.sets, reps: { min, max }, weeks, since }
}

function parseDay(raw: unknown, legacy: boolean): WorkoutDay | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const exercises = parseList(raw.exercises, (r, i) => parsePlanned(r, legacy ? i : null), (p) => p.exerciseId)
  return exercises && { id: raw.id as WorkoutDayId, name: raw.name, exercises }
}

/** A block or plan as read, before its days are checked against a split. */
interface ReadBlock {
  readonly id: WorkoutBlockId
  readonly name: string
  readonly weeks: number
  readonly light: boolean
  readonly days: readonly WorkoutDay[]
}

interface ReadPlan {
  readonly id: WorkoutPlanId
  readonly name: string
  readonly split: Split | null
  readonly blocks: readonly ReadBlock[]
  readonly start: CycleStart | null
}

function parseBlock(raw: unknown, version: 2 | 3 | 4): ReadBlock | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || !isCount(raw.weeks) || raw.weeks < 1 || raw.weeks > MAX_BLOCK_WEEKS) return null
  if (version === 4 && typeof raw.light !== 'boolean') return null
  const days = parseList(raw.days, (r) => parseDay(r, version === 2))
  return days && { id: raw.id as WorkoutBlockId, name: raw.name, weeks: raw.weeks, light: raw.light === true && version === 4, days }
}

function parseStart(raw: unknown, blocks: readonly ReadBlock[]): CycleStart | null | false {
  if (raw === null) return null
  if (!isRecord(raw) || typeof raw.since !== 'string' || !blocks.some((b) => b.id === raw.blockId)) return false
  const since = parseIsoDate(raw.since)
  return since !== null && { blockId: raw.blockId as WorkoutBlockId, since }
}

function parsePlan(raw: unknown, version: 2 | 3 | 4): ReadPlan | null {
  const legacy = version === 2
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  if (!legacy && !isSplit(raw.split)) return null
  const blocks = parseList(raw.blocks, (r) => parseBlock(r, version))
  if (!blocks || blocks.length === 0) return null
  const start = parseStart(raw.start, blocks)
  return start === false ? null : { id: raw.id as WorkoutPlanId, name: raw.name, split: legacy ? null : (raw.split as Split), blocks, start }
}

function parsePlanV1(raw: unknown): ReadPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const days = parseList(raw.days, (r) => parseDay(r, true))
  if (!days) return null
  const block = { id: `${raw.id}-b1` as WorkoutBlockId, name: 'Bloco A', weeks: 6, light: false, days }
  return { id: raw.id as WorkoutPlanId, name: raw.name, split: null, blocks: [block], start: null }
}

/** The plan as its split, given or found from the first block's day count; null when a block has another count. */
function asSplit(plan: ReadPlan): WorkoutPlan | null {
  const split = plan.split ?? splitForDayCount(plan.blocks[0].days.length)
  if (!split || plan.blocks.some((b) => b.days.length !== SPLITS[split].days.length)) return null
  // Every block's day count was just checked against the split's.
  return { ...plan, split } as WorkoutPlan
}

const isUnique = (ids: readonly string[]) => new Set(ids).size === ids.length

const PLAN_VERSIONS = [1, 2, 3, 4] as const

export function parseWorkoutPlans(raw: unknown): WorkoutPlanState | null {
  const version = isRecord(raw) ? PLAN_VERSIONS.find((v) => v === raw.version) : undefined
  if (!isRecord(raw) || version === undefined) return null
  const legacy = version < 3
  const read = parseList(raw.plans, version === 1 ? parsePlanV1 : (r) => parsePlan(r, version), (p) => p.id)
  if (!read) return null
  if (!isUnique(read.flatMap((p) => p.blocks.map((b) => b.id)))) return null
  if (!read.every((p) => isUnique(p.blocks.flatMap((b) => b.days.map((d) => d.id))))) return null
  if (read.length > 0 ? !read.some((p) => p.id === raw.activePlanId) : raw.activePlanId !== null) return null
  const fitting = read.map(asSplit)
  if (!legacy && fitting.includes(null)) return null
  const plans = fitting.filter((p) => p !== null)
  const active = plans.find((p) => p.id === raw.activePlanId) ?? plans[0]
  return { plans, activePlanId: active?.id ?? null }
}

/** Before version 3 a set with reps counted as logged, so it reads as done. */
function parseSet(raw: unknown, legacy: boolean): LoggedSet | null {
  if (!isRecord(raw) || (raw.reps !== null && !isCount(raw.reps)) || (raw.kg !== null && !isKg(raw.kg))) return null
  if (legacy) return raw.reps === null ? { done: false, kg: raw.kg, reps: null, rir: null } : { done: true, kg: raw.kg, reps: raw.reps, rir: null }
  if (raw.rir !== null && !isRir(raw.rir)) return null
  if (raw.done === true && raw.reps !== null) return { done: true, kg: raw.kg, reps: raw.reps, rir: raw.rir }
  return raw.done === false ? { done: false, kg: raw.kg, reps: raw.reps, rir: raw.rir } : null
}

function parseTarget(raw: unknown): SetTarget | null {
  if (!isRecord(raw) || (raw.kg !== null && !isKg(raw.kg)) || !isCount(raw.reps) || !isRir(raw.rir)) return null
  if (raw.rirMax !== undefined && (!isRir(raw.rirMax) || raw.rirMax <= raw.rir)) return null
  if (raw.light !== undefined && raw.light !== true) return null
  return { kg: raw.kg, reps: raw.reps, rir: raw.rir, ...(raw.rirMax !== undefined && { rirMax: raw.rirMax }), ...(raw.light && { light: true }) }
}

function parseSessionExercise(raw: unknown, legacy: boolean): SessionExercise | null {
  if (!isRecord(raw) || !isId(raw.exerciseId)) return null
  const sets = parseList(raw.sets, (r) => parseSet(r, legacy))
  const note = parseOptionalNote(raw.note)
  const target = raw.target === undefined || legacy ? undefined : parseTarget(raw.target)
  if (!sets || note === false || target === null) return null
  return { exerciseId: raw.exerciseId as ExerciseId, sets, ...(target && { target }), ...(note && { note }) }
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

const SESSION_VERSIONS = [1, 2, 3, 4] as const

function parseSession(raw: unknown, version: (typeof SESSION_VERSIONS)[number]): WorkoutSession | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.date !== 'string') return null
  const date = parseIsoDate(raw.date)
  if (!date || (raw.workoutDayId !== null && !isId(raw.workoutDayId))) return null
  if (version === 1 && typeof raw.notes !== 'string') return null
  if (raw.feel !== undefined && !isRating(raw.feel)) return null
  const note = version === 1 ? legacyNote(raw.notes as string, date) : parseOptionalNote(raw.note)
  const exercises = parseList(raw.exercises, (r) => parseSessionExercise(r, version < 3), (e) => e.exerciseId)
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

/** Versions 1 to 4; null for anything else, including one bad session or two with the same id. */
export function parseWorkoutSessions(raw: unknown): WorkoutSession[] | null {
  const version = isRecord(raw) ? SESSION_VERSIONS.find((v) => v === raw.version) : undefined
  if (!isRecord(raw) || version === undefined) return null
  return parseList(raw.sessions, (r) => parseSession(r, version), (s) => s.id)
}
