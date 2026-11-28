import type { Rating } from './rating.ts'
import type { TimedNote } from './notes.ts'
import { MAX_TYPED } from './numbers.ts'
import { isRecord } from './records.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'

export interface Exercise {
  readonly id: ExerciseId
  readonly name: string
}

/** Each Exercise's name by its id; one since deleted reads "Exercício desconhecido". */
export function nameLookup(exercises: readonly Exercise[]): (id: ExerciseId) => string {
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  return (id) => names.get(id) ?? 'Exercício desconhecido'
}

export interface RepRange {
  readonly min: number
  readonly max: number
}

/** A Training Split: Push · Pull · Full body over 3 days, or Upper · Lower · Upper · Lower over 4. */
export type Split = 'ppf' | 'ul'

/** What a Planned Exercise does in its day. It sets the default rep range and how close to failure it goes. */
export type Role = 'main' | 'secondary' | 'isolation' | 'abs'

/** What a Workout Day prescribes for one Exercise. An Exercise appears at most once in a day. */
export interface PlannedExercise {
  readonly exerciseId: ExerciseId
  readonly role: Role
  readonly sets: number
  readonly reps: RepRange
  /** How many training weeks its Exercise Run lasts, 1 to MAX_BLOCK_WEEKS; null is no limit. */
  readonly weeks: number | null
  /** When the Exercise came into this place. Null for one from before Exercise Runs: its run starts the week it was first done. */
  readonly since: IsoDate | null
}

export interface WorkoutDay {
  readonly id: WorkoutDayId
  readonly name: string
  readonly exercises: readonly PlannedExercise[]
}

export type DaysOf<S extends Split> = S extends 'ppf' ? readonly [WorkoutDay, WorkoutDay, WorkoutDay] : readonly [WorkoutDay, WorkoutDay, WorkoutDay, WorkoutDay]

export interface RirRange {
  readonly min: number
  readonly max: number
}

export interface RirTarget extends RirRange {
  readonly light: boolean
}

export const inTarget = (rir: number, target: RirRange): boolean => rir >= target.min && rir <= target.max

export interface BlockOf<S extends Split> {
  readonly id: WorkoutBlockId
  readonly name: string
  readonly weeks: number
  readonly light: boolean
  readonly days: DaysOf<S>
}

export interface CycleStart {
  readonly blockId: WorkoutBlockId
  readonly since: IsoDate
}

/** Every block of a plan has its split's days, so a plan cannot mix 3- and 4-day blocks. */
export interface PlanOf<S extends Split> {
  readonly id: WorkoutPlanId
  readonly name: string
  readonly split: S
  readonly blocks: readonly [BlockOf<S>, ...BlockOf<S>[]]
  readonly start: CycleStart | null
}

export type WorkoutPlan = PlanOf<'ppf'> | PlanOf<'ul'>
export type WorkoutBlock = WorkoutPlan['blocks'][number]

/** `kg` null is bodyweight. A pending set holds what was suggested or typed and counts for nothing until it is done. */
export type PendingSet = { readonly done: false; readonly kg: number | null; readonly reps: number | null; readonly rir: number | null }
/** A set the user marked done; it always has its reps. */
export type DoneSet = { readonly done: true; readonly kg: number | null; readonly reps: number; readonly rir: number | null }
export type LoggedSet = PendingSet | DoneSet

export interface SetTarget {
  readonly kg: number | null
  readonly reps: number
  readonly rir: number
  readonly rirMax?: number
  readonly light?: true
}

export const aimedAt = (t: SetTarget): RirTarget => ({ min: t.rir, max: t.rirMax ?? t.rir, light: t.light === true })

/** One Exercise's sets in a session. An Exercise appears at most once in a session. */
export interface SessionExercise {
  readonly exerciseId: ExerciseId
  readonly sets: readonly LoggedSet[]
  readonly target?: SetTarget
  /** Pain, discomfort or anything else about this Exercise in this session. */
  readonly note?: TimedNote
}

/** How a session felt on a later date: soreness, pain, recovery. `exerciseId` null is the session as a whole. */
export interface AfterEffect {
  readonly date: IsoDate
  readonly exerciseId: ExerciseId | null
  readonly note: TimedNote
}

/** `workoutDayId` is the day it started from, null for a blank session; the day may since have been deleted. */
export interface WorkoutSession {
  readonly id: WorkoutSessionId
  readonly date: IsoDate
  readonly workoutDayId: WorkoutDayId | null
  readonly exercises: readonly SessionExercise[]
  /** About the workout as a whole. */
  readonly note?: TimedNote
  /** How the user felt at the end of it. */
  readonly feel?: Rating
  /** At most one per date and Exercise, each dated after the session, on the session or one of its Exercises. Never empty. */
  readonly after?: readonly AfterEffect[]
}

export const afterEffectFits = (session: { readonly date: IsoDate; readonly exercises: readonly SessionExercise[] }, date: IsoDate, exerciseId: ExerciseId | null): boolean =>
  date > session.date && (exerciseId === null || session.exercises.some((e) => e.exerciseId === exerciseId))

export const afterEffectKey = (a: Pick<AfterEffect, 'date' | 'exerciseId'>): string => `${a.date} ${a.exerciseId}`

/** `activePlanId` is null only when there are no plans. */
export interface WorkoutPlanState {
  readonly plans: readonly WorkoutPlan[]
  readonly activePlanId: WorkoutPlanId | null
}

export interface WorkoutState extends WorkoutPlanState {
  readonly exercises: readonly Exercise[]
  readonly sessions: readonly WorkoutSession[]
}

export const EMPTY_SET: PendingSet = { done: false, reps: null, kg: null, rir: null }

export const LOAD_INCREMENT = 2.5
export const SMALL_LOAD_INCREMENT = 1
export const SMALL_LOAD_BELOW = 25
export const MAX_RIR = 10
export const MAX_BLOCK_WEEKS = 52

export function parseRepRange(text: string): RepRange | null {
  const m = /^\s*(\d+)\s*(?:[-–a]\s*(\d+)\s*)?$/.exec(text)
  if (!m) return null
  const min = Number(m[1])
  const range = { min, max: m[2] === undefined ? min : Number(m[2]) }
  return isRepRange(range) ? range : null
}

/** The one rule for what counts: a set is logged when it is done. */
export const isDone = (set: LoggedSet): set is DoneSet => set.done

export const doneSets = (exercise: SessionExercise): number => exercise.sets.filter(isDone).length

/** What a session holds once the sets not done are left out. */
export function loggedCounts(session: WorkoutSession): { exercises: number; sets: number } {
  const done = session.exercises.map(doneSets)
  return { exercises: done.filter((n) => n > 0).length, sets: done.reduce((a, b) => a + b, 0) }
}

export const emptyWorkouts = (): WorkoutState => ({ exercises: [], plans: [], activePlanId: null, sessions: [] })

const isWhole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export const isBlockWeeks = (v: unknown): v is number => isWhole(v, 1, MAX_BLOCK_WEEKS)

export const isKg = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_TYPED

export const isReps = (v: unknown): v is number => isWhole(v, 0, MAX_TYPED)

export const isRir = (v: unknown): v is number => isWhole(v, 0, MAX_RIR)

export const isSetValues = (set: { readonly kg: unknown; readonly reps: unknown; readonly rir: unknown }): boolean =>
  (set.kg === null || isKg(set.kg)) && (set.reps === null || isReps(set.reps)) && (set.rir === null || isRir(set.rir))

export const isSetCount = (v: unknown): v is number => isWhole(v, 1, MAX_TYPED)

export function isRepRange(v: unknown): v is RepRange {
  if (!isRecord(v)) return false
  const { min, max } = v
  return isWhole(min, 1, MAX_TYPED) && isWhole(max, min, MAX_TYPED)
}
