import type { Rating } from './body.ts'
import { addDays, weekdayOf } from './days.ts'
import { editNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'

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

/** Reps in reserve aimed at for one week of a block; min === max is a single target. 0 to 10. */
export interface RirTarget {
  readonly min: number
  readonly max: number
}

/** A Training Block: `weeks` training weeks (1 to 52) of its own Workout Days. `rir` has one entry per week, null for no target. */
export interface WorkoutBlock {
  readonly id: WorkoutBlockId
  readonly name: string
  readonly weeks: number
  readonly rir: readonly (RirTarget | null)[]
  readonly days: readonly WorkoutDay[]
}

/** Where the cycle was (re)started: `blockId`'s week 1 counts from the calendar week holding `since`. */
export interface CycleStart {
  readonly blockId: WorkoutBlockId
  readonly since: IsoDate
}

/** `blocks` is never empty; `start` null is a cycle not started yet. Day ids are unique across every block of every plan. */
export interface WorkoutPlan {
  readonly id: WorkoutPlanId
  readonly name: string
  readonly blocks: readonly WorkoutBlock[]
  readonly start: CycleStart | null
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

function parseRange(text: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)\s*(?:[-–a]\s*(\d+)\s*)?$/.exec(text)
  if (!m) return null
  const min = Number(m[1])
  return { min, max: m[2] === undefined ? min : Number(m[2]) }
}

/** "8-12", "8–12", "8 a 12" or "8" as typed: null unless the minimum is at least 1 and not above the maximum. */
export function parseRepRange(text: string): RepRange | null {
  const r = parseRange(text)
  return r && r.min >= 1 && r.max >= r.min ? r : null
}

export const MAX_RIR = 10

export const isRirTarget = (r: RirTarget): boolean => Number.isInteger(r.min) && Number.isInteger(r.max) && r.min >= 0 && r.max >= r.min && r.max <= MAX_RIR

/** "3", "5-6", "5–6" or "5 a 6" as typed: null unless both are 0 to 10 and the minimum is not above the maximum. */
export function parseRir(text: string): RirTarget | null {
  const r = parseRange(text)
  return r && isRirTarget(r) ? r : null
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

export const filledSets = (exercise: SessionExercise): number => exercise.sets.filter(isFilled).length

/** What a session holds once the unfilled sets are left out. */
export function loggedCounts(session: WorkoutSession): { exercises: number; sets: number } {
  const filled = session.exercises.map(filledSets)
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
    for (const block of plan.blocks) {
      const day = block.days.find((d) => d.id === dayId)
      if (day) return day
    }
  }
  return undefined
}

/** The Monday of the calendar week holding `date`. */
const weekOf = (date: IsoDate): IsoDate => addDays(date, -weekdayOf(date))

export interface BlockPosition {
  readonly block: WorkoutBlock
  /** 1-based within the block. */
  readonly week: number
  readonly rir: RirTarget | null
  /** The block before it in the cycle, on week 1 of a block the cycle moved into; else null. */
  readonly previous: WorkoutBlock | null
}

/**
 * Where the cycle is on `date`: null before it starts. Only training weeks count, calendar weeks (Monday to Sunday)
 * holding a session with a filled set, so a week without one pauses the block. The week of `date` is the one after
 * the training weeks before it, whether or not it holds a session yet. After the last block the cycle wraps to the first.
 */
export function blockPosition(plan: WorkoutPlan, sessions: readonly WorkoutSession[], date: IsoDate): BlockPosition | null {
  if (!plan.start) return null
  const from = weekOf(plan.start.since)
  const current = weekOf(date)
  if (current < from) return null
  const trained = new Set<IsoDate>()
  for (const s of sessions) {
    const week = weekOf(s.date)
    if (week >= from && week < current && s.exercises.some((e) => e.sets.some(isFilled))) trained.add(week)
  }
  const blocks = plan.blocks
  let index = Math.max(0, blocks.findIndex((b) => b.id === plan.start?.blockId))
  let week = trained.size + 1
  while (week > blocks[index].weeks) {
    week -= blocks[index].weeks
    index = (index + 1) % blocks.length
  }
  const block = blocks[index]
  const moved = week === 1 && trained.size > 0 && blocks.length > 1
  return { block, week, rir: block.rir[week - 1] ?? null, previous: moved ? blocks[(index + blocks.length - 1) % blocks.length] : null }
}

/** The Exercises of `block`'s days, in order, each once. */
export function blockExercises(block: WorkoutBlock): ExerciseId[] {
  return [...new Set(block.days.flatMap((d) => d.exercises.map((p) => p.exerciseId)))]
}

/** What changes from `previous` to `block`: the Exercises that come in and those that go. */
export function blockChanges(previous: WorkoutBlock, block: WorkoutBlock): { entering: ExerciseId[]; leaving: ExerciseId[] } {
  const before = blockExercises(previous)
  const after = blockExercises(block)
  return { entering: after.filter((e) => !before.includes(e)), leaving: before.filter((e) => !after.includes(e)) }
}

export const emptyWorkouts = (): WorkoutState => ({ exercises: [], plans: [], activePlanId: null, sessions: [] })

export type WorkoutAction =
  | { type: 'createPlan'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string }
  | { type: 'renamePlan'; planId: WorkoutPlanId; name: string }
  | { type: 'deletePlan'; planId: WorkoutPlanId }
  | { type: 'activatePlan'; planId: WorkoutPlanId }
  | { type: 'addBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; copyOf: WorkoutBlockId | null; dayIds: readonly WorkoutDayId[] }
  | { type: 'renameBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string }
  | { type: 'setBlockWeeks'; planId: WorkoutPlanId; blockId: WorkoutBlockId; weeks: number }
  | { type: 'setBlockRir'; planId: WorkoutPlanId; blockId: WorkoutBlockId; week: number; rir: RirTarget | null }
  | { type: 'removeBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId }
  | { type: 'setCycleStart'; planId: WorkoutPlanId; blockId: WorkoutBlockId; since: IsoDate }
  | { type: 'addDay'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; name: string }
  | { type: 'renameDay'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; name: string }
  | { type: 'removeDay'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId }
  | { type: 'addPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; name: string; newExerciseId: ExerciseId }
  | { type: 'setPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; planned: PlannedExercise }
  | { type: 'removePlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; exerciseId: ExerciseId }
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

export const DEFAULT_BLOCK_WEEKS = 6
export const MAX_BLOCK_WEEKS = 52

const newBlock = (id: WorkoutBlockId, name: string): WorkoutBlock => ({ id, name, weeks: DEFAULT_BLOCK_WEEKS, rir: Array(DEFAULT_BLOCK_WEEKS).fill(null), days: [] })

/** "Bloco B" for a plan with one block, and so on, skipping names the plan already uses. */
function nextBlockName(blocks: readonly WorkoutBlock[]): string {
  const taken = new Set(blocks.map((b) => b.name))
  for (let i = blocks.length; ; i++) {
    const name = `Bloco ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`
    if (!taken.has(name)) return name
  }
}

function addBlock(plan: WorkoutPlan, blockId: WorkoutBlockId, copyOf: WorkoutBlockId | null, dayIds: readonly WorkoutDayId[]): WorkoutPlan {
  const source = plan.blocks.find((b) => b.id === copyOf)
  if (source && dayIds.length !== source.days.length) return plan
  const name = nextBlockName(plan.blocks)
  const block = source ? { ...source, id: blockId, name, days: source.days.map((d, i) => ({ ...d, id: dayIds[i] })) } : newBlock(blockId, name)
  return { ...plan, blocks: [...plan.blocks, block] }
}

function removeBlock(plan: WorkoutPlan, blockId: WorkoutBlockId): WorkoutPlan {
  const blocks = plan.blocks.filter((b) => b.id !== blockId)
  if (blocks.length === 0 || blocks.length === plan.blocks.length) return plan
  const start = plan.start?.blockId === blockId ? { ...plan.start, blockId: blocks[0].id } : plan.start
  return { ...plan, blocks, start }
}

const resized = <T>(items: readonly T[], length: number, fill: T): T[] => Array.from({ length }, (_, i) => (i < items.length ? items[i] : fill))

function updatePlan(state: WorkoutState, planId: WorkoutPlanId, fn: (plan: WorkoutPlan) => WorkoutPlan): WorkoutState {
  return { ...state, plans: state.plans.map((p) => (p.id === planId ? fn(p) : p)) }
}

function updateBlock(state: WorkoutState, planId: WorkoutPlanId, blockId: WorkoutBlockId, fn: (block: WorkoutBlock) => WorkoutBlock): WorkoutState {
  return updatePlan(state, planId, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }))
}

function updateDay(state: WorkoutState, planId: WorkoutPlanId, blockId: WorkoutBlockId, dayId: WorkoutDayId, fn: (day: WorkoutDay) => WorkoutDay): WorkoutState {
  return updateBlock(state, planId, blockId, (b) => ({ ...b, days: b.days.map((d) => (d.id === dayId ? fn(d) : d)) }))
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
      return { ...state, plans: [...state.plans, { id: action.planId, name: action.name, blocks: [newBlock(action.blockId, 'Bloco A')], start: null }], activePlanId: action.planId }
    case 'renamePlan':
      return updatePlan(state, action.planId, (p) => ({ ...p, name: action.name }))
    case 'deletePlan': {
      const plans = state.plans.filter((p) => p.id !== action.planId)
      const activePlanId = state.activePlanId === action.planId ? (plans[0]?.id ?? null) : state.activePlanId
      return { ...state, plans, activePlanId }
    }
    case 'activatePlan':
      return state.plans.some((p) => p.id === action.planId) ? { ...state, activePlanId: action.planId } : state
    case 'addBlock':
      return updatePlan(state, action.planId, (p) => addBlock(p, action.blockId, action.copyOf, action.dayIds))
    case 'renameBlock':
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, name: action.name }))
    case 'setBlockWeeks':
      if (!Number.isInteger(action.weeks) || action.weeks < 1 || action.weeks > MAX_BLOCK_WEEKS) return state
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, weeks: action.weeks, rir: resized(b.rir, action.weeks, null) }))
    case 'setBlockRir':
      if (action.rir && !isRirTarget(action.rir)) return state
      return updateBlock(state, action.planId, action.blockId, (b) =>
        action.week >= 1 && action.week <= b.weeks ? { ...b, rir: b.rir.map((r, i) => (i === action.week - 1 ? action.rir : r)) } : b,
      )
    case 'removeBlock':
      return updatePlan(state, action.planId, (p) => removeBlock(p, action.blockId))
    case 'setCycleStart':
      return updatePlan(state, action.planId, (p) => (p.blocks.some((b) => b.id === action.blockId) ? { ...p, start: { blockId: action.blockId, since: action.since } } : p))
    case 'addDay':
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, days: [...b.days, { id: action.dayId, name: action.name, exercises: [] }] }))
    case 'renameDay':
      return updateDay(state, action.planId, action.blockId, action.dayId, (d) => ({ ...d, name: action.name }))
    case 'removeDay':
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, days: b.days.filter((d) => d.id !== action.dayId) }))
    case 'addPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.blockId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: [...d.exercises, { exerciseId: resolved.id, ...DEFAULT_PLANNED }] },
      )
    }
    case 'setPlannedExercise':
      return updateDay(state, action.planId, action.blockId, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((p) => (p.exerciseId === action.planned.exerciseId ? action.planned : p)),
      }))
    case 'removePlannedExercise':
      return updateDay(state, action.planId, action.blockId, action.dayId, (d) => ({ ...d, exercises: d.exercises.filter((p) => p.exerciseId !== action.exerciseId) }))
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
