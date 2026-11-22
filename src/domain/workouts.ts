import type { Rating } from './rating.ts'
import type { TimedNote } from './notes.ts'
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

export interface RirTarget {
  readonly min: number
  readonly max: number
}

export interface BlockOf<S extends Split> {
  readonly id: WorkoutBlockId
  readonly name: string
  readonly weeks: number
  /** A light block, such as a deload: every Role's RIR Target is LIGHT_RIR_EXTRA further from failure. */
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

/**
 * What the session suggested when it started: the next session reads `rir` as what these sets aimed at. `rirMax` is
 * the top of the RIR Target when it is a range; without it the target is the single RIR `rir`.
 */
export interface SetTarget {
  readonly kg: number | null
  readonly reps: number
  readonly rir: number
  readonly rirMax?: number
}

/** The RIR range a kept target aimed at. */
export const targetRange = (t: SetTarget): RirTarget => ({ min: t.rir, max: t.rirMax ?? t.rir })

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

/** The load step the suggestion moves by, and the smaller one under 25 kg, so a step stays within ACSM's 2–10% (docs/research/progression-rate.md). */
export const LOAD_INCREMENT = 2.5
export const SMALL_LOAD_INCREMENT = 1
export const SMALL_LOAD_BELOW = 25

function parseRange(text: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)\s*(?:[-–a]\s*(\d+)\s*)?$/.exec(text)
  if (!m) return null
  const min = Number(m[1])
  return { min, max: m[2] === undefined ? min : Number(m[2]) }
}

export function parseRepRange(text: string): RepRange | null {
  const r = parseRange(text)
  return r && r.min >= 1 && r.max >= r.min ? r : null
}

export const MAX_RIR = 10

/** The one rule for what counts: a set is logged when it is done. */
export const isDone = (set: LoggedSet): set is DoneSet => set.done

export const doneSets = (exercise: SessionExercise): number => exercise.sets.filter(isDone).length

/** What a session holds once the sets not done are left out. */
export function loggedCounts(session: WorkoutSession): { exercises: number; sets: number } {
  const done = session.exercises.map(doneSets)
  return { exercises: done.filter((n) => n > 0).length, sets: done.reduce((a, b) => a + b, 0) }
}


export const emptyWorkouts = (): WorkoutState => ({ exercises: [], plans: [], activePlanId: null, sessions: [] })

export const MAX_BLOCK_WEEKS = 52
