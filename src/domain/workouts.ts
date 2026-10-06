import { editNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'

export interface Exercise {
  readonly id: ExerciseId
  readonly name: string
}

export interface RepRange {
  readonly min: number
  readonly max: number
}

/** What a Workout Day prescribes for one Exercise. An Exercise appears at most once in a day. */
export interface PlannedExercise {
  readonly exerciseId: ExerciseId
  readonly sets: number
  readonly reps: RepRange
}

export interface WorkoutDay {
  readonly id: WorkoutDayId
  readonly name: string
  readonly exercises: readonly PlannedExercise[]
}

export interface WorkoutPlan {
  readonly id: WorkoutPlanId
  readonly name: string
  readonly days: readonly WorkoutDay[]
}

/** `reps` null is a set not filled in yet; `kg` null is bodyweight. */
export interface LoggedSet {
  readonly reps: number | null
  readonly kg: number | null
}

/** One Exercise's sets in a session. An Exercise appears at most once in a session. */
export interface SessionExercise {
  readonly exerciseId: ExerciseId
  readonly sets: readonly LoggedSet[]
}

/** `workoutDayId` is the day it started from, null for a blank session; the day may since have been deleted. */
export interface WorkoutSession {
  readonly id: WorkoutSessionId
  readonly date: IsoDate
  readonly workoutDayId: WorkoutDayId | null
  readonly exercises: readonly SessionExercise[]
  /** About the workout as a whole. */
  readonly note?: TimedNote
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

export const EMPTY_SET: LoggedSet = { reps: null, kg: null }

/** Two Exercise names with the same key are the same Exercise. */
export const exerciseKey = (name: string) => name.trim().toLocaleLowerCase('pt')

export const findExercise = (exercises: readonly Exercise[], name: string): Exercise | undefined =>
  exercises.find((e) => exerciseKey(e.name) === exerciseKey(name))

/** The Exercise with this name, ignoring case, or a new one under `newId`. Null for a blank name. */
function resolveExercise(exercises: readonly Exercise[], name: string, newId: ExerciseId): { exercises: readonly Exercise[]; id: ExerciseId } | null {
  const trimmed = name.trim()
  if (trimmed === '') return null
  const found = findExercise(exercises, trimmed)
  return found ? { exercises, id: found.id } : { exercises: [...exercises, { id: newId, name: trimmed }], id: newId }
}

/** "8-12", "8–12" or "8" as typed: null unless the minimum is at least 1 and not above the maximum. */
export function parseRepRange(text: string): RepRange | null {
  const m = /^\s*(\d+)\s*(?:[-–a]\s*(\d+)\s*)?$/.exec(text)
  if (!m) return null
  const min = Number(m[1])
  const max = m[2] === undefined ? min : Number(m[2])
  return min >= 1 && max >= min ? { min, max } : null
}

const isFilled = (set: LoggedSet) => set.reps !== null

/** The filled sets of `exerciseId` in the latest session on or before `date`; on the same date, the one logged last. Null when none. */
export function lastLoggedSets(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate): readonly LoggedSet[] | null {
  let found: readonly LoggedSet[] | null = null
  let foundDate: IsoDate | null = null
  for (const session of sessions) {
    if (session.date > date || (foundDate !== null && session.date < foundDate)) continue
    const filled = session.exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter(isFilled) ?? []
    if (filled.length === 0) continue
    found = filled
    foundDate = session.date
  }
  return found
}

/** `count` sets copied from the last time, the last set repeating when there were fewer; empty sets when never logged. */
export function prefillSets(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate, count: number): LoggedSet[] {
  const last = lastLoggedSets(sessions, exerciseId, date)
  return Array.from({ length: count }, (_, i) => (last ? (last[i] ?? last[last.length - 1]) : EMPTY_SET))
}

export function startSession(id: WorkoutSessionId, date: IsoDate, day: WorkoutDay | null, sessions: readonly WorkoutSession[]): WorkoutSession {
  const exercises = (day?.exercises ?? []).map((p) => ({ exerciseId: p.exerciseId, sets: prefillSets(sessions, p.exerciseId, date, p.sets) }))
  return { id, date, workoutDayId: day?.id ?? null, exercises }
}

/** What a session holds once the unfilled sets are left out. */
export function loggedCounts(session: WorkoutSession): { exercises: number; sets: number } {
  const filled = session.exercises.map((e) => e.sets.filter(isFilled).length)
  return { exercises: filled.filter((n) => n > 0).length, sets: filled.reduce((a, b) => a + b, 0) }
}

export const sessionsOn = (sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] => sessions.filter((s) => s.date === date)

export function findDay(plans: readonly WorkoutPlan[], dayId: WorkoutDayId): WorkoutDay | undefined {
  for (const plan of plans) {
    const day = plan.days.find((d) => d.id === dayId)
    if (day) return day
  }
  return undefined
}

export const emptyWorkouts = (): WorkoutState => ({ exercises: [], plans: [], activePlanId: null, sessions: [] })

export type WorkoutAction =
  | { type: 'createPlan'; planId: WorkoutPlanId; name: string }
  | { type: 'renamePlan'; planId: WorkoutPlanId; name: string }
  | { type: 'deletePlan'; planId: WorkoutPlanId }
  | { type: 'activatePlan'; planId: WorkoutPlanId }
  | { type: 'addDay'; planId: WorkoutPlanId; dayId: WorkoutDayId; name: string }
  | { type: 'renameDay'; planId: WorkoutPlanId; dayId: WorkoutDayId; name: string }
  | { type: 'removeDay'; planId: WorkoutPlanId; dayId: WorkoutDayId }
  | { type: 'addPlannedExercise'; planId: WorkoutPlanId; dayId: WorkoutDayId; name: string; newExerciseId: ExerciseId }
  | { type: 'setPlannedExercise'; planId: WorkoutPlanId; dayId: WorkoutDayId; planned: PlannedExercise }
  | { type: 'removePlannedExercise'; planId: WorkoutPlanId; dayId: WorkoutDayId; exerciseId: ExerciseId }
  | { type: 'startSession'; sessionId: WorkoutSessionId; date: IsoDate; day: WorkoutDay | null }
  | { type: 'addSessionExercise'; sessionId: WorkoutSessionId; name: string; newExerciseId: ExerciseId }
  | { type: 'removeSessionExercise'; sessionId: WorkoutSessionId; exerciseId: ExerciseId }
  | { type: 'addSet'; sessionId: WorkoutSessionId; exerciseId: ExerciseId }
  | { type: 'setSet'; sessionId: WorkoutSessionId; exerciseId: ExerciseId; index: number; set: LoggedSet }
  | { type: 'removeSet'; sessionId: WorkoutSessionId; exerciseId: ExerciseId; index: number }
  | { type: 'setSessionNote'; sessionId: WorkoutSessionId; text: string; now: LocalDateTime }
  | { type: 'deleteSession'; sessionId: WorkoutSessionId }

/** `note` set, or the key left out when there is none, so a stored document never holds `note: undefined`. */
function withNote<T extends { note?: TimedNote }>(item: T, note: TimedNote | undefined): T {
  if (note === item.note) return item
  const { note: _, ...rest } = item
  return (note ? { ...rest, note } : rest) as T
}

const DEFAULT_PLANNED = { sets: 3, reps: { min: 8, max: 12 } } as const

function updatePlan(state: WorkoutState, planId: WorkoutPlanId, fn: (plan: WorkoutPlan) => WorkoutPlan): WorkoutState {
  return { ...state, plans: state.plans.map((p) => (p.id === planId ? fn(p) : p)) }
}

function updateDay(state: WorkoutState, planId: WorkoutPlanId, dayId: WorkoutDayId, fn: (day: WorkoutDay) => WorkoutDay): WorkoutState {
  return updatePlan(state, planId, (p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? fn(d) : d)) }))
}

function updateSession(state: WorkoutState, sessionId: WorkoutSessionId, fn: (session: WorkoutSession) => WorkoutSession): WorkoutState {
  return { ...state, sessions: state.sessions.map((s) => (s.id === sessionId ? fn(s) : s)) }
}

function updateSets(state: WorkoutState, sessionId: WorkoutSessionId, exerciseId: ExerciseId, fn: (sets: readonly LoggedSet[]) => readonly LoggedSet[]): WorkoutState {
  return updateSession(state, sessionId, (s) => ({ ...s, exercises: s.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: fn(e.sets) } : e)) }))
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'createPlan':
      return { ...state, plans: [...state.plans, { id: action.planId, name: action.name, days: [] }], activePlanId: action.planId }
    case 'renamePlan':
      return updatePlan(state, action.planId, (p) => ({ ...p, name: action.name }))
    case 'deletePlan': {
      const plans = state.plans.filter((p) => p.id !== action.planId)
      const activePlanId = state.activePlanId === action.planId ? (plans[0]?.id ?? null) : state.activePlanId
      return { ...state, plans, activePlanId }
    }
    case 'activatePlan':
      return state.plans.some((p) => p.id === action.planId) ? { ...state, activePlanId: action.planId } : state
    case 'addDay':
      return updatePlan(state, action.planId, (p) => ({ ...p, days: [...p.days, { id: action.dayId, name: action.name, exercises: [] }] }))
    case 'renameDay':
      return updateDay(state, action.planId, action.dayId, (d) => ({ ...d, name: action.name }))
    case 'removeDay':
      return updatePlan(state, action.planId, (p) => ({ ...p, days: p.days.filter((d) => d.id !== action.dayId) }))
    case 'addPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: [...d.exercises, { exerciseId: resolved.id, ...DEFAULT_PLANNED }] },
      )
    }
    case 'setPlannedExercise':
      return updateDay(state, action.planId, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((p) => (p.exerciseId === action.planned.exerciseId ? action.planned : p)),
      }))
    case 'removePlannedExercise':
      return updateDay(state, action.planId, action.dayId, (d) => ({ ...d, exercises: d.exercises.filter((p) => p.exerciseId !== action.exerciseId) }))
    case 'startSession':
      return { ...state, sessions: [...state.sessions, startSession(action.sessionId, action.date, action.day, state.sessions)] }
    case 'addSessionExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateSession({ ...state, exercises: resolved.exercises }, action.sessionId, (s) => {
        if (s.exercises.some((e) => e.exerciseId === resolved.id)) return s
        const sets = lastLoggedSets(state.sessions, resolved.id, s.date) ?? [EMPTY_SET]
        return { ...s, exercises: [...s.exercises, { exerciseId: resolved.id, sets }] }
      })
    }
    case 'removeSessionExercise':
      return updateSession(state, action.sessionId, (s) => ({ ...s, exercises: s.exercises.filter((e) => e.exerciseId !== action.exerciseId) }))
    case 'addSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => [...sets, sets[sets.length - 1] ?? EMPTY_SET])
    case 'setSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => sets.map((s, i) => (i === action.index ? action.set : s)))
    case 'removeSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => sets.filter((_, i) => i !== action.index))
    case 'setSessionNote':
      return updateSession(state, action.sessionId, (s) => withNote(s, editNote(s.note, action.text, action.now)))
    case 'deleteSession':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.sessionId) }
  }
}
