import type { Rating } from './rating.ts'
import { resolveExercise } from './exerciseCatalog.ts'
import { editNote } from './notes.ts'
import { blockDayId, DEFAULT_SETS, mapDays, ROLE_REPS, ROLE_WEEKS, templateBlock } from './splits.ts'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { isRunWeeks } from './blocks.ts'
import { lastDoneSets, startSession } from './sessions.ts'
import { afterEffectFits, EMPTY_SET, isBlockWeeks } from './workouts.ts'
import type { BlockOf, Exercise, LoggedSet, PendingSet, PlannedExercise, PlanOf, Role, SessionExercise, Split, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from './workouts.ts'

/** What the user types or taps into a set; whether it is done is set apart. */
export interface SetValues {
  readonly kg: number | null
  readonly reps: number | null
  readonly rir: number | null
}

export type WorkoutAction =
  | { type: 'createPlan'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string; split: Split; today: IsoDate }
  | { type: 'renamePlan'; planId: WorkoutPlanId; name: string }
  | { type: 'deletePlan'; planId: WorkoutPlanId }
  | { type: 'activatePlan'; planId: WorkoutPlanId }
  | { type: 'addBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; copyOf: WorkoutBlockId }
  | { type: 'renameBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId; name: string }
  | { type: 'setBlockWeeks'; planId: WorkoutPlanId; blockId: WorkoutBlockId; weeks: number }
  | { type: 'setBlockLight'; planId: WorkoutPlanId; blockId: WorkoutBlockId; light: boolean }
  | { type: 'removeBlock'; planId: WorkoutPlanId; blockId: WorkoutBlockId }
  | { type: 'setCycleStart'; planId: WorkoutPlanId; blockId: WorkoutBlockId; since: IsoDate }
  | { type: 'addPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; name: string; role: Role; newExerciseId: ExerciseId; today: IsoDate }
  | { type: 'swapPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; exerciseId: ExerciseId; name: string; newExerciseId: ExerciseId; today: IsoDate }
  | { type: 'setPlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; planned: PlannedExercise }
  | { type: 'removePlannedExercise'; planId: WorkoutPlanId; blockId: WorkoutBlockId; dayId: WorkoutDayId; exerciseId: ExerciseId }
  | { type: 'startSession'; sessionId: WorkoutSessionId; date: IsoDate; day: WorkoutDay | null; light: boolean }
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
  if (!afterEffectFits(session, date, exerciseId)) return session
  const after = session.after ?? []
  const i = after.findIndex((a) => a.date === date && a.exerciseId === exerciseId)
  const note = editNote(after[i]?.note, text, now)
  if (note === after[i]?.note) return session
  const rest = after.filter((_, j) => j !== i)
  const next = !note ? rest : i === -1 ? [...after, { date, exerciseId, note }] : after.map((a, j) => (j === i ? { ...a, note } : a))
  return withOptional(session, 'after', next.length > 0 ? next : undefined)
}

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
    const made = templateBlock('ppf', blockId, 'Bloco A', action.today, exercises, exerciseId)
    return { plan: { id: planId, name, split: 'ppf', blocks: [made.block], start: null }, exercises: made.exercises }
  }
  const made = templateBlock('ul', blockId, 'Bloco A', action.today, exercises, exerciseId)
  return { plan: { id: planId, name, split: 'ul', blocks: [made.block], start: null }, exercises: made.exercises }
}

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
      if (!isBlockWeeks(action.weeks)) return state
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, weeks: action.weeks }))
    case 'setBlockLight':
      return updateBlock(state, action.planId, action.blockId, (b) => ({ ...b, light: action.light }))
    case 'removeBlock':
      return updatePlan(state, action.planId, removeBlock(action.blockId))
    case 'setCycleStart':
      return updatePlan(state, action.planId, (p) => (p.blocks.some((b) => b.id === action.blockId) ? { ...p, start: { blockId: action.blockId, since: action.since } } : p))
    case 'addPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      const planned: PlannedExercise = { exerciseId: resolved.id, role: action.role, sets: DEFAULT_SETS, reps: ROLE_REPS[action.role], weeks: ROLE_WEEKS[action.role], since: action.today }
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.blockId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: [...d.exercises, planned] },
      )
    }
    case 'swapPlannedExercise': {
      const resolved = resolveExercise(state.exercises, action.name, action.newExerciseId)
      if (!resolved) return state
      return updateDay({ ...state, exercises: resolved.exercises }, action.planId, action.blockId, action.dayId, (d) =>
        d.exercises.some((p) => p.exerciseId === resolved.id) ? d : { ...d, exercises: d.exercises.map((p) => (p.exerciseId === action.exerciseId ? { ...p, exerciseId: resolved.id, since: action.today } : p)) },
      )
    }
    case 'setPlannedExercise':
      if (!isRunWeeks(action.planned.weeks)) return state
      return updateDay(state, action.planId, action.blockId, action.dayId, (d) => ({
        ...d,
        exercises: d.exercises.map((p) => (p.exerciseId === action.planned.exerciseId ? action.planned : p)),
      }))
    case 'removePlannedExercise':
      return updateDay(state, action.planId, action.blockId, action.dayId, (d) => ({ ...d, exercises: d.exercises.filter((p) => p.exerciseId !== action.exerciseId) }))
    case 'startSession':
      return { ...state, sessions: [...state.sessions, startSession(action.sessionId, action.date, action.day, action.light, state.sessions)] }
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
