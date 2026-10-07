import type { Rating } from './body.ts'
import { addDays } from './days.ts'
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

/** An injury can show a day or two late, so a session stays open to After-effects for this many days after it. */
export const AFTER_EFFECT_DAYS = 3

/** The sessions 1 to AFTER_EFFECT_DAYS days before `date`, newest first. */
export function recentSessions(sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] {
  const from = addDays(date, -AFTER_EFFECT_DAYS)
  return sessions.filter((s) => s.date >= from && s.date < date).sort((a, b) => b.date.localeCompare(a.date))
}

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
  | { type: 'setExerciseNote'; sessionId: WorkoutSessionId; exerciseId: ExerciseId; text: string; now: LocalDateTime }
  | { type: 'setSessionNote'; sessionId: WorkoutSessionId; text: string; now: LocalDateTime }
  | { type: 'setSessionFeel'; sessionId: WorkoutSessionId; feel: Rating | null }
  | { type: 'setAfterEffect'; sessionId: WorkoutSessionId; date: IsoDate; exerciseId: ExerciseId | null; text: string; now: LocalDateTime }
  | { type: 'deleteSession'; sessionId: WorkoutSessionId }

/** `key` set, or left out when `value` is undefined, so a stored document never holds `key: undefined`. */
function withOptional<T, K extends keyof T>(item: T, key: K, value: T[K] | undefined): T {
  if (value === item[key]) return item
  const { [key]: _, ...rest } = item
  return (value === undefined ? rest : { ...rest, [key]: value }) as T
}

/** Blank text removes the After-effect, and the session's list goes when it empties. */
function editAfterEffect(session: WorkoutSession, date: IsoDate, exerciseId: ExerciseId | null, text: string, now: LocalDateTime): WorkoutSession {
  if (date <= session.date || (exerciseId !== null && !session.exercises.some((e) => e.exerciseId === exerciseId))) return session
  const after = session.after ?? []
  const i = after.findIndex((a) => a.date === date && a.exerciseId === exerciseId)
  const note = editNote(after[i]?.note, text, now)
  if (note === after[i]?.note) return session
  const rest = after.filter((_, j) => j !== i)
  const next = !note ? rest : i === -1 ? [...after, { date, exerciseId, note }] : after.map((a, j) => (j === i ? { ...a, note } : a))
  return withOptional(session, 'after', next.length > 0 ? next : undefined)
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

function updateExercise(state: WorkoutState, sessionId: WorkoutSessionId, exerciseId: ExerciseId, fn: (exercise: SessionExercise) => SessionExercise): WorkoutState {
  return updateSession(state, sessionId, (s) => ({ ...s, exercises: s.exercises.map((e) => (e.exerciseId === exerciseId ? fn(e) : e)) }))
}

function updateSets(state: WorkoutState, sessionId: WorkoutSessionId, exerciseId: ExerciseId, fn: (sets: readonly LoggedSet[]) => readonly LoggedSet[]): WorkoutState {
  return updateExercise(state, sessionId, exerciseId, (e) => ({ ...e, sets: fn(e.sets) }))
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
      return updateSession(state, action.sessionId, (s) => {
        const after = s.after?.filter((a) => a.exerciseId !== action.exerciseId)
        return withOptional({ ...s, exercises: s.exercises.filter((e) => e.exerciseId !== action.exerciseId) }, 'after', after?.length ? after : undefined)
      })
    case 'addSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => [...sets, sets[sets.length - 1] ?? EMPTY_SET])
    case 'setSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => sets.map((s, i) => (i === action.index ? action.set : s)))
    case 'removeSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => sets.filter((_, i) => i !== action.index))
    case 'setExerciseNote':
      return updateExercise(state, action.sessionId, action.exerciseId, (e) => withOptional(e, 'note', editNote(e.note, action.text, action.now)))
    case 'setSessionNote':
      return updateSession(state, action.sessionId, (s) => withOptional(s, 'note', editNote(s.note, action.text, action.now)))
    case 'setSessionFeel':
      return updateSession(state, action.sessionId, (s) => withOptional(s, 'feel', action.feel ?? undefined))
    case 'setAfterEffect':
      return updateSession(state, action.sessionId, (s) => editAfterEffect(s, action.date, action.exerciseId, action.text, action.now))
    case 'deleteSession':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.sessionId) }
  }
}
