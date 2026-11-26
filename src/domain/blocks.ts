import { mondayOf } from './dates.ts'
import type { ExerciseId, IsoDate, WorkoutDayId } from './types.ts'
import { isBlockWeeks, isDone, MAX_BLOCK_WEEKS } from './workouts.ts'
import type { PlannedExercise, WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutSession } from './workouts.ts'

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

/** The week an Exercise Run starts, or null when it has not: an Exercise from before runs starts the week it was first done. */
function runStart(planned: PlannedExercise, sessions: readonly WorkoutSession[]): IsoDate | null {
  if (planned.since) return mondayOf(planned.since)
  let first: IsoDate | null = null
  for (const s of sessions) {
    if ((first === null || s.date < first) && s.exercises.some((e) => e.exerciseId === planned.exerciseId && e.sets.some(isDone))) first = s.date
  }
  return first && mondayOf(first)
}

/** The training weeks a Planned Exercise's run holds before the week of `date`, counted as a Training Block counts them. */
export function weeksRun(planned: PlannedExercise, sessions: readonly WorkoutSession[], date: IsoDate): number {
  const from = runStart(planned, sessions)
  return from === null ? 0 : trainedWeeks(sessions, from, mondayOf(date)).size
}

export const isRunDue = (weeks: number | null, done: number): boolean => weeks !== null && done >= weeks

export const isRunWeeks = (weeks: unknown): weeks is number | null => weeks === null || isBlockWeeks(weeks)

/** One Exercise's run across the days of a block it is planned in. */
export interface ExerciseRun {
  readonly exerciseId: ExerciseId
  readonly dayIds: readonly WorkoutDayId[]
  readonly weeks: number | null
  /** Training weeks run before the week asked about, so the week asked about is `done + 1`. */
  readonly done: number
  readonly due: boolean
}

/** "Mais 4 semanas": a due Exercise kept on runs this many weeks from now. */
export const RUN_EXTENSION = 4

export const runExtended = (run: ExerciseRun): number => Math.min(MAX_BLOCK_WEEKS, run.done + RUN_EXTENSION)

/** An Exercise planned on several days runs as long as its longest run there, up to its shortest limit there. */
export function exerciseRuns(block: WorkoutBlock, sessions: readonly WorkoutSession[], date: IsoDate): ExerciseRun[] {
  const runs = new Map<ExerciseId, Omit<ExerciseRun, 'due'>>()
  for (const day of blockDays(block)) {
    for (const p of day.exercises) {
      const done = weeksRun(p, sessions, date)
      const run = runs.get(p.exerciseId)
      const weeks = run === undefined || run.weeks === null ? p.weeks : p.weeks === null ? run.weeks : Math.min(run.weeks, p.weeks)
      runs.set(p.exerciseId, { exerciseId: p.exerciseId, dayIds: [...(run?.dayIds ?? []), day.id], weeks, done: Math.max(run?.done ?? 0, done) })
    }
  }
  return [...runs.values()].map((r) => ({ ...r, due: isRunDue(r.weeks, r.done) }))
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
  return { block, week, movedFrom: moved ? blocks[(index + blocks.length - 1) % blocks.length] : null }
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
