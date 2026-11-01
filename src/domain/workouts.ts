import type { Rating } from './body.ts'
import { addDays, mondayOf } from './days.ts'
import { resolveExercise } from './exerciseCatalog.ts'
import { editNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import { suggestTarget } from './progression.ts'
import type { Suggestion } from './progression.ts'
import { blockDayId, DEFAULT_SETS, mapDays, ROLE_REPS, templateBlock } from './splits.ts'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'

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
  readonly rir: readonly (RirTarget | null)[]
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

/** What the session suggested when it started: the next session reads `rir` as what these sets aimed at. */
export interface SetTarget {
  readonly kg: number | null
  readonly reps: number
  readonly rir: number
}

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

/** The smallest load step the suggestion moves by. */
export const LOAD_INCREMENT = 2.5

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

export const isRirTarget = (r: RirTarget): boolean => Number.isInteger(r.min) && Number.isInteger(r.max) && r.min >= 0 && r.max >= r.min && r.max <= MAX_RIR

export function parseRir(text: string): RirTarget | null {
  const r = parseRange(text)
  return r && isRirTarget(r) ? r : null
}

/** The one rule for what counts: a set is logged when it is done. */
export const isDone = (set: LoggedSet): set is DoneSet => set.done

export const doneSets = (exercise: SessionExercise): number => exercise.sets.filter(isDone).length

/** What a session holds once the sets not done are left out. */
export function loggedCounts(session: WorkoutSession): { exercises: number; sets: number } {
  const done = session.exercises.map(doneSets)
  return { exercises: done.filter((n) => n > 0).length, sets: done.reduce((a, b) => a + b, 0) }
}

/**
 * The done sets of `exerciseId` in the latest session on or before `date` that has any, on the same date the one
 * logged last, with the RIR they aimed at when the session knew it. Null when none.
 */
export function lastDoneSets(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate): { sets: DoneSet[]; targetRir: number | null } | null {
  let found: { sets: DoneSet[]; targetRir: number | null } | null = null
  let foundDate: IsoDate | null = null
  for (const session of sessions) {
    if (session.date > date || (foundDate !== null && session.date < foundDate)) continue
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId)
    const sets = exercise?.sets.filter(isDone) ?? []
    if (sets.length === 0) continue
    found = { sets, targetRir: exercise?.target?.rir ?? null }
    foundDate = session.date
  }
  return found
}

/** The sessions logged before `session`: earlier dates, and on its date the ones logged before it. */
export function sessionsBefore(sessions: readonly WorkoutSession[], session: WorkoutSession): WorkoutSession[] {
  const index = sessions.indexOf(session)
  return sessions.filter((s, i) => s.date < session.date || (s.date === session.date && i < index))
}

/** How close to failure a role goes in a week: the week's lowest RIR, never under 1 for compounds; 2 when the week has none. */
export function targetRir(role: Role, week: RirTarget | null): number {
  if (!week) return 2
  return role === 'main' || role === 'secondary' ? Math.max(1, week.min) : week.min
}

/** The suggested target for `exerciseId` on `date`, from the last time it was done; null when it never was. */
export function suggestion(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate, nextRir: number, range: RepRange): Suggestion | null {
  const last = lastDoneSets(sessions, exerciseId, date)
  return last && suggestTarget({ sets: last.sets, previousRir: last.targetRir ?? nextRir, nextRir, range, increment: LOAD_INCREMENT })
}

/**
 * A session from a Workout Day has one row per Planned Exercise, each set pending at the suggested target, which is
 * kept; an Exercise never done starts with empty sets. `week` is the RIR target of the week the date falls in.
 */
export function startSession(id: WorkoutSessionId, date: IsoDate, day: WorkoutDay | null, week: RirTarget | null, sessions: readonly WorkoutSession[]): WorkoutSession {
  const exercises = (day?.exercises ?? []).map((p): SessionExercise => {
    const rir = targetRir(p.role, week)
    const s = suggestion(sessions, p.exerciseId, date, rir, p.reps)
    if (!s) return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(EMPTY_SET) }
    const set: PendingSet = { done: false, kg: s.kg, reps: s.reps, rir: null }
    return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(set), target: { kg: s.kg, reps: s.reps, rir } }
  })
  return { id, date, workoutDayId: day?.id ?? null, exercises }
}

export const sessionsOn = (sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] => sessions.filter((s) => s.date === date)

/** An injury can show a day or two late, so a session stays open to After-effects for this many days after it. */
export const AFTER_EFFECT_DAYS = 3

/** The sessions 1 to AFTER_EFFECT_DAYS days before `date`, newest first. */
export function recentSessions(sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] {
  const from = addDays(date, -AFTER_EFFECT_DAYS)
  return sessions.filter((s) => s.date >= from && s.date < date).sort((a, b) => b.date.localeCompare(a.date))
}

const blockDays = (block: WorkoutBlock): readonly WorkoutDay[] => block.days

export function findDay(plans: readonly WorkoutPlan[], dayId: WorkoutDayId): WorkoutDay | undefined {
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const day = blockDays(block).find((d) => d.id === dayId)
      if (day) return day
    }
  }
  return undefined
}

export interface BlockPosition {
  readonly block: WorkoutBlock
  readonly week: number
  readonly rir: RirTarget | null
  readonly movedFrom: WorkoutBlock | null
}

/** A week with no done set does not count, so it pauses the block instead of using one of its weeks. */
function trainedWeeks(sessions: readonly WorkoutSession[], from: IsoDate, until: IsoDate): Set<IsoDate> {
  const weeks = new Set<IsoDate>()
  for (const s of sessions) {
    const week = mondayOf(s.date)
    if (week >= from && week < until && s.exercises.some((e) => e.sets.some(isDone))) weeks.add(week)
  }
  return weeks
}

export function blockPosition(plan: WorkoutPlan, sessions: readonly WorkoutSession[], date: IsoDate): BlockPosition | null {
  if (!plan.start) return null
  const from = mondayOf(plan.start.since)
  const current = mondayOf(date)
  if (current < from) return null
  const trained = trainedWeeks(sessions, from, current)
  const blocks: readonly WorkoutBlock[] = plan.blocks
  let index = Math.max(0, blocks.findIndex((b) => b.id === plan.start?.blockId))
  let week = trained.size + 1
  while (week > blocks[index].weeks) {
    week -= blocks[index].weeks
    index = (index + 1) % blocks.length
  }
  const block = blocks[index]
  const moved = week === 1 && trained.size > 0 && blocks.length > 1
  return { block, week, rir: block.rir[week - 1] ?? null, movedFrom: moved ? blocks[(index + blocks.length - 1) % blocks.length] : null }
}

export function currentBlock(plan: WorkoutPlan, sessions: readonly WorkoutSession[], date: IsoDate): { block: WorkoutBlock; position: BlockPosition | null } {
  const position = blockPosition(plan, sessions, date)
  return { block: position?.block ?? plan.blocks[0], position }
}

/**
 * The day to train next: the one after the latest session's day on or before `date`, counted by its place in its
 * block so the rotation carries over into a new block, and the first day when no session started from this plan.
 */
export function nextDay(plan: WorkoutPlan, sessions: readonly WorkoutSession[], date: IsoDate): WorkoutDay {
  const days = blockDays(currentBlock(plan, sessions, date).block)
  const places = new Map<WorkoutDayId, number>()
  for (const block of plan.blocks) blockDays(block).forEach((d, i) => places.set(d.id, i))
  let place = -1
  let placeDate: IsoDate | null = null
  for (const s of sessions) {
    const i = s.workoutDayId === null ? undefined : places.get(s.workoutDayId)
    if (i === undefined || s.date > date || (placeDate !== null && s.date < placeDate)) continue
    place = i
    placeDate = s.date
  }
  return days[(place + 1) % days.length]
}

export function blockExercises(block: WorkoutBlock): ExerciseId[] {
  return [...new Set(blockDays(block).flatMap((d) => d.exercises.map((p) => p.exerciseId)))]
}

export function blockChanges(previous: WorkoutBlock, block: WorkoutBlock): { entering: ExerciseId[]; leaving: ExerciseId[] } {
  const before = blockExercises(previous)
  const after = blockExercises(block)
  return { entering: after.filter((e) => !before.includes(e)), leaving: before.filter((e) => !after.includes(e)) }
}

export const emptyWorkouts = (): WorkoutState => ({ exercises: [], plans: [], activePlanId: null, sessions: [] })

/** What the user types or taps into a set; whether it is done is set apart. */
export interface SetValues {
  readonly kg: number | null
  readonly reps: number | null
  readonly rir: number | null
}

export type WorkoutAction =
  | { type: 'createPlan'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string; split: Split }
  | { type: 'renamePlan'; planId: WorkoutPlanId; name: string }
  | { type: 'deletePlan'; planId: WorkoutPlanId }
  | { type: 'activatePlan'; planId: WorkoutPlanId }
  | { type: 'addBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; copyOf: WorkoutBlockId }
  | { type: 'renameBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string }
  | { type: 'setBlockWeeks'; planId: WorkoutPlanId; blockId: WorkoutBlockId; weeks: number }
  | { type: 'setBlockRir'; planId: WorkoutPlanId; blockId: WorkoutBlockId; week: number; rir: RirTarget | null }
  | { type: 'removeBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId }
  | { type: 'setCycleStart'; planId: WorkoutPlanId; blockId: WorkoutBlockId; since: IsoDate }
  | { type: 'addPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; name: string; role: Role; newExerciseId: ExerciseId }
  | { type: 'swapPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; exerciseId: ExerciseId; name: string; newExerciseId: ExerciseId }
  | { type: 'setPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; planned: PlannedExercise }
  | { type: 'removePlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; exerciseId: ExerciseId }
  | { type: 'startSession'; sessionId: WorkoutSessionId; date: IsoDate; day: WorkoutDay | null; week: RirTarget | null }
  | { type: 'addSessionExercise'; sessionId: WorkoutSessionId; name: string; newExerciseId: ExerciseId }
  | { type: 'removeSessionExercise'; sessionId: WorkoutSessionId; exerciseId: ExerciseId }
  | { type: 'addSet'; sessionId: WorkoutSessionId; exerciseId: ExerciseId }
  | { type: 'setSet'; sessionId: WorkoutSessionId; exerciseId: ExerciseId; index: number; set: SetValues }
  | { type: 'setSetDone'; sessionId: WorkoutSessionId; exerciseId: ExerciseId; index: number; done: boolean }
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

export const MAX_BLOCK_WEEKS = 52

function nextBlockName(blocks: readonly { name: string }[]): string {
  const taken = new Set(blocks.map((b) => b.name))
  for (let i = blocks.length; ; i++) {
    const name = `Bloco ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`
    if (!taken.has(name)) return name
  }
}

/** A function the reducer applies to a plan of either split, giving back a plan of the same split. */
type PlanFn = <S extends Split>(plan: PlanOf<S>) => PlanOf<S>
type BlockFn = <S extends Split>(block: BlockOf<S>) => BlockOf<S>

const onPlan = (plan: WorkoutPlan, fn: PlanFn): WorkoutPlan => (plan.split === 'ppf' ? fn(plan) : fn(plan))

const mapBlocks = <S extends Split>(blocks: PlanOf<S>['blocks'], fn: (block: BlockOf<S>) => BlockOf<S>): PlanOf<S>['blocks'] => {
  const [first, ...rest] = blocks
  return [fn(first), ...rest.map(fn)]
}

/** Every day of every block of the plan through `fn`. */
export const mapPlanDays = (plan: WorkoutPlan, fn: (day: WorkoutDay) => WorkoutDay): WorkoutPlan =>
  onPlan(plan, (p) => ({ ...p, blocks: mapBlocks(p.blocks, (b) => ({ ...b, days: mapDays(b, fn) })) }))

const addBlock =
  (blockId: WorkoutBlockId, copyOf: WorkoutBlockId): PlanFn =>
  (plan) => {
    const source = plan.blocks.find((b) => b.id === copyOf)
    if (!source) return plan
    const block = { ...source, id: blockId, name: nextBlockName(plan.blocks), days: mapDays(source, (d, i) => ({ ...d, id: blockDayId(blockId, i) })) }
    return { ...plan, blocks: [...plan.blocks, block] }
  }

const removeBlock =
  (blockId: WorkoutBlockId): PlanFn =>
  (plan) => {
    const [first, ...rest] = plan.blocks.filter((b) => b.id !== blockId)
    if (!first || rest.length + 1 === plan.blocks.length) return plan
    const start = plan.start?.blockId === blockId ? { ...plan.start, blockId: first.id } : plan.start
    return { ...plan, blocks: [first, ...rest], start }
  }

function newPlan(action: Extract<WorkoutAction, { type: 'createPlan' }>, exercises: readonly Exercise[]): { plan: WorkoutPlan; exercises: readonly Exercise[] } {
  const { planId, blockId, name } = action
  const exerciseId = (catalogId: string) => `${blockId}-${catalogId}` as ExerciseId
  if (action.split === 'ppf') {
    const made = templateBlock('ppf', blockId, 'Bloco A', exercises, exerciseId)
    return { plan: { id: planId, name, split: 'ppf', blocks: [made.block], start: null }, exercises: made.exercises }
  }
  const made = templateBlock('ul', blockId, 'Bloco A', exercises, exerciseId)
  return { plan: { id: planId, name, split: 'ul', blocks: [made.block], start: null }, exercises: made.exercises }
}

const resized = <T>(items: readonly T[], length: number, fill: T): T[] => Array.from({ length }, (_, i) => (i < items.length ? items[i] : fill))

function updatePlan(state: WorkoutState, planId: WorkoutPlanId, fn: PlanFn): WorkoutState {
  return { ...state, plans: state.plans.map((p) => (p.id === planId ? onPlan(p, fn) : p)) }
}

function updateBlock(state: WorkoutState, planId: WorkoutPlanId, blockId: WorkoutBlockId, fn: BlockFn): WorkoutState {
  return updatePlan(state, planId, (p) => ({ ...p, blocks: mapBlocks(p.blocks, (b) => (b.id === blockId ? fn(b) : b)) }))
}

function updateDay(state: WorkoutState, planId: WorkoutPlanId, blockId: WorkoutBlockId, dayId: WorkoutDayId, fn: (day: WorkoutDay) => WorkoutDay): WorkoutState {
  return updateBlock(state, planId, blockId, (b) => ({ ...b, days: mapDays(b, (d) => (d.id === dayId ? fn(d) : d)) }))
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

/** A done set stays done while it has reps. A new RIR also fills the next pending set that has none, as the next set is usually as hard. */
function setValues(sets: readonly LoggedSet[], index: number, values: SetValues): readonly LoggedSet[] {
  const old = sets[index]
  if (!old) return sets
  const set: LoggedSet = old.done && values.reps !== null ? { ...values, done: true, reps: values.reps } : { ...values, done: false }
  const forward = values.rir !== null && values.rir !== old.rir ? sets.findIndex((s, i) => i > index && !s.done && s.rir === null) : -1
  return sets.map((s, i) => (i === index ? set : i === forward ? { ...s, rir: values.rir } : s))
}

function setDone(sets: readonly LoggedSet[], index: number, done: boolean): readonly LoggedSet[] {
  return sets.map((s, i): LoggedSet => {
    if (i !== index || s.done === done) return s
    if (!done) return { ...s, done: false }
    return s.reps === null ? s : { ...s, done: true, reps: s.reps }
  })
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'createPlan': {
      const { plan, exercises } = newPlan(action, state.exercises)
      return { ...state, exercises, plans: [...state.plans, plan], activePlanId: action.planId }
    }
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
      return updatePlan(state, action.planId, addBlock(action.blockId, action.copyOf))
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
      return updatePlan(state, action.planId, removeBlock(action.blockId))
    case 'setCycleStart':
      return updatePlan(state, action.planId, (p) => (p.blocks.some((b) => b.id === action.blockId) ? { ...p, start: { blockId: action.blockId, since: action.since } } : p))
    case 'addPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      const planned: PlannedExercise = { exerciseId: resolved.id, role: action.role, sets: DEFAULT_SETS, reps: ROLE_REPS[action.role] }
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.blockId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: [...d.exercises, planned] },
      )
    }
    case 'swapPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.blockId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: d.exercises.map((p) => (p.exerciseId === action.exerciseId ? { ...p, exerciseId: resolved.id } : p)) },
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
      return { ...state, sessions: [...state.sessions, startSession(action.sessionId, action.date, action.day, action.week, state.sessions)] }
    case 'addSessionExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateSession({ ...state, exercises: resolved.exercises }, action.sessionId, (s) => {
        if (s.exercises.some((e) => e.exerciseId === resolved.id)) return s
        const last = lastDoneSets(state.sessions, resolved.id, s.date)?.sets
        const sets = last?.map((d): PendingSet => ({ done: false, kg: d.kg, reps: d.reps, rir: null })) ?? [EMPTY_SET]
        return { ...s, exercises: [...s.exercises, { exerciseId: resolved.id, sets }] }
      })
    }
    case 'removeSessionExercise':
      return updateSession(state, action.sessionId, (s) => {
        const after = s.after?.filter((a) => a.exerciseId !== action.exerciseId)
        return withOptional({ ...s, exercises: s.exercises.filter((e) => e.exerciseId !== action.exerciseId) }, 'after', after?.length ? after : undefined)
      })
    case 'addSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => {
        const last = sets[sets.length - 1]
        return [...sets, last ? { ...last, done: false } : EMPTY_SET]
      })
    case 'setSet':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => setValues(sets, action.index, action.set))
    case 'setSetDone':
      return updateSets(state, action.sessionId, action.exerciseId, (sets) => setDone(sets, action.index, action.done))
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
