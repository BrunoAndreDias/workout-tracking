import { describe, expect, it } from 'vitest'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import {
  blockChanges,
  blockPosition,
  emptyWorkouts,
  exerciseRuns,
  findDay,
  lastDoneSets,
  loggedCounts,
  nextDay,
  parseRepRange,
  parseRir,
  recentSessions,
  sessionsBefore,
  startSession,
  targetRir,
  workoutReducer,
} from './workouts.ts'
import type { BlockOf, LoggedSet, PlanOf, PlannedExercise, WorkoutAction, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from './workouts.ts'

const SUPINO = 'ex-supino' as ExerciseId
const REMO = 'ex-remo' as ExerciseId
const SQUAT = 'ex-agachamento' as ExerciseId
const date = (s: string) => s as IsoDate
const done = (reps: number, kg: number | null, rir: number | null = null): LoggedSet => ({ done: true, reps, kg, rir })
const pending = (reps: number | null, kg: number | null, rir: number | null = null): LoggedSet => ({ done: false, reps, kg, rir })

const session = (id: string, on: string, exercises: WorkoutSession['exercises'], workoutDayId: string | null = null): WorkoutSession => ({
  id: id as WorkoutSessionId,
  date: date(on),
  workoutDayId: workoutDayId as WorkoutDayId | null,
  exercises,
})

const planned = (exerciseId: ExerciseId, role: PlannedExercise['role'], sets = 3, reps = { min: 6, max: 8 }): PlannedExercise => ({ exerciseId, role, sets, reps, weeks: null, since: null })

const PEITO: WorkoutDay = { id: 'd-peito' as WorkoutDayId, name: 'Peito', exercises: [planned(SUPINO, 'main', 4), planned(REMO, 'isolation', 2, { min: 10, max: 15 })] }

const HISTORY = [
  session('s1', '2026-10-01', [{ exerciseId: SUPINO, sets: [done(8, 60), done(7, 60)] }]),
  session('s2', '2026-10-03', [{ exerciseId: SUPINO, sets: [done(7, 62.5, 2), done(7, 62.5, 2), pending(7, 62.5)], target: { kg: 62.5, reps: 7, rir: 2 } }]),
  session('s3', '2026-10-05', [{ exerciseId: SUPINO, sets: [pending(9, 65)] }]),
  session('s4', '2026-10-09', [{ exerciseId: SUPINO, sets: [done(10, 70)] }]),
]

const run = (actions: WorkoutAction[], from: WorkoutState = emptyWorkouts()) => actions.reduce(workoutReducer, from)

describe('the suggested target', () => {
  it('reads the done sets of the latest earlier session that has any, and the RIR it aimed at', () => {
    expect(lastDoneSets(HISTORY, SUPINO, date('2026-10-06'))).toEqual({ sets: [done(7, 62.5, 2), done(7, 62.5, 2)], targetRir: 2 })
    expect(lastDoneSets(HISTORY, SUPINO, date('2026-10-02'))).toEqual({ sets: [done(8, 60), done(7, 60)], targetRir: null })
    expect(lastDoneSets(HISTORY, SUPINO, date('2026-09-30'))).toBe(null)
  })

  it('on the same date, the session logged last wins', () => {
    const sameDay = [...HISTORY, session('s5', '2026-10-03', [{ exerciseId: SUPINO, sets: [done(12, null)] }])]
    expect(lastDoneSets(sameDay, SUPINO, date('2026-10-04'))?.sets).toEqual([done(12, null)])
  })

  it('the sessions before one are the earlier dates and those logged before it on its date', () => {
    const sameDay = [...HISTORY, session('s5', '2026-10-03', [])]
    expect(sessionsBefore(sameDay, sameDay[4]).map((s) => s.id)).toEqual(['s1', 's2'])
    expect(sessionsBefore(sameDay, sameDay[1]).map((s) => s.id)).toEqual(['s1'])
  })

  it('aims at the week’s lowest RIR, never under 1 for compounds, and 2 when the week has no target', () => {
    expect(targetRir('main', { min: 0, max: 1 })).toBe(1)
    expect(targetRir('secondary', { min: 3, max: 4 })).toBe(3)
    expect(targetRir('isolation', { min: 0, max: 1 })).toBe(0)
    expect(targetRir('abs', null)).toBe(2)
  })

  it('a session from a Workout Day fills each planned set, pending, with the suggestion, and keeps it as the target', () => {
    expect(startSession('new' as WorkoutSessionId, date('2026-10-06'), PEITO, { min: 2, max: 3 }, HISTORY)).toEqual({
      id: 'new',
      date: '2026-10-06',
      workoutDayId: 'd-peito',
      exercises: [
        { exerciseId: SUPINO, sets: Array(4).fill(pending(8, 62.5)), target: { kg: 62.5, reps: 8, rir: 2 } },
        { exerciseId: REMO, sets: [pending(null, null), pending(null, null)] },
      ],
    })
  })

  it('a blank session starts with no exercises', () => {
    expect(startSession('b' as WorkoutSessionId, date('2026-10-06'), null, null, HISTORY)).toEqual({ id: 'b', date: '2026-10-06', workoutDayId: null, exercises: [] })
  })

  it('counts only done sets', () => {
    expect(loggedCounts(HISTORY[1])).toEqual({ exercises: 1, sets: 2 })
    expect(loggedCounts(HISTORY[2])).toEqual({ exercises: 0, sets: 0 })
  })
})

const P = 'p1' as WorkoutPlanId
const B = 'b1' as WorkoutBlockId
const S1 = 's1' as WorkoutSessionId
const created = run([{ type: 'createPlan', planId: P, blockId: B, name: 'Força', split: 'ppf' }])
const PUSH = created.plans[0].blocks[0].days[0]
const BENCH = PUSH.exercises[0].exerciseId
const day = (state: WorkoutState, i = 0) => state.plans[0].blocks[0].days[i]
const TODAY = date('2026-11-02')

describe('Workout Plans', () => {
  it('a new plan is its split’s template in one Bloco A, and becomes the active plan', () => {
    const plan = created.plans[0]
    expect(plan).toMatchObject({ id: 'p1', name: 'Força', split: 'ppf', start: null })
    expect(plan.blocks.map((b) => [b.id, b.name, b.weeks])).toEqual([['b1', 'Bloco A', 6]])
    expect(plan.blocks[0].days.map((d) => [d.id, d.name])).toEqual([
      ['b1-d1', 'Push'],
      ['b1-d2', 'Pull'],
      ['b1-d3', 'Full body'],
    ])
    expect(created.exercises.find((e) => e.id === BENCH)?.name).toBe('Flat Barbell Bench Press')
    expect(created.activePlanId).toBe('p1')
  })

  it('a second plan reuses the Exercises the first one created', () => {
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, blockId: 'b2' as WorkoutBlockId, name: 'Outro', split: 'ul' }], created)
    expect(two.plans[1].blocks[0].days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(two.plans[1].blocks[0].days[0].exercises[0].exerciseId).toBe(BENCH)
    expect(new Set(two.exercises.map((e) => e.name)).size).toBe(two.exercises.length)
  })

  it('adds an Exercise with a role, its rep range and its run of weeks from today, reusing one named the same ignoring case', () => {
    const s = run(
      [
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: ' Supino ', role: 'secondary', newExerciseId: 'e1' as ExerciseId, today: TODAY },
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: 'supino', role: 'isolation', newExerciseId: 'e2' as ExerciseId, today: TODAY },
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: '  ', role: 'isolation', newExerciseId: 'e3' as ExerciseId, today: TODAY },
      ],
      created,
    )
    expect(day(s).exercises.slice(PUSH.exercises.length)).toEqual([{ exerciseId: 'e1', role: 'secondary', sets: 3, reps: { min: 8, max: 10 }, weeks: 8, since: TODAY }])
    expect(s.exercises.at(-1)).toEqual({ id: 'e1', name: 'Supino' })
  })

  it('swapping keeps the role, sets, reps, weeks and place, starts the run today, and does nothing when the new Exercise is already in the day', () => {
    const edited = run([{ type: 'setPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, planned: { ...PUSH.exercises[0], sets: 5, weeks: 12 } }], created)
    const swapped = run([{ type: 'swapPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, exerciseId: BENCH, name: 'Flat Dumbbell Bench Press', newExerciseId: 'db' as ExerciseId, today: TODAY }], edited)
    expect(day(swapped).exercises[0]).toEqual({ exerciseId: 'db', role: 'main', sets: 5, reps: { min: 6, max: 8 }, weeks: 12, since: TODAY })
    expect(day(swapped).exercises.slice(1)).toEqual(PUSH.exercises.slice(1))
    const into = PUSH.exercises[1].exerciseId
    const same = run([{ type: 'swapPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, exerciseId: BENCH, name: created.exercises.find((e) => e.id === into)!.name, newExerciseId: 'x' as ExerciseId, today: TODAY }], created)
    expect(day(same)).toEqual(PUSH)
  })

  it('an Exercise Run lasts 1 to 52 weeks or has no limit', () => {
    const weeks = (n: number | null) => day(run([{ type: 'setPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, planned: { ...PUSH.exercises[1], weeks: n } }], created)).exercises[1].weeks
    expect([weeks(1), weeks(52), weeks(null), weeks(0), weeks(53), weeks(2.5)]).toEqual([1, 52, null, 8, 8, 8])
  })

  it('deleting the active plan activates the next one, and the last leaves none', () => {
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, blockId: 'b2' as WorkoutBlockId, name: 'Outro', split: 'ul' }], created)
    expect(two.activePlanId).toBe('p2')
    const one = run([{ type: 'deletePlan', planId: 'p2' as WorkoutPlanId }], two)
    expect(one.activePlanId).toBe('p1')
    expect(run([{ type: 'deletePlan', planId: P }], one).activePlanId).toBe(null)
  })

  it('a new block copies the selected one, its days under new ids, and takes the next free letter', () => {
    const s = run(
      [
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockRir', planId: P, blockId: B, week: 1, rir: { min: 5, max: 6 } },
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B },
        { type: 'renameBlock', planId: P, blockId: 'b2' as WorkoutBlockId, name: 'Bloco C' },
        { type: 'addBlock', planId: P, blockId: 'b3' as WorkoutBlockId, copyOf: 'gone' as WorkoutBlockId },
      ],
      created,
    )
    const [a, c] = s.plans[0].blocks
    expect(s.plans[0].blocks.map((b) => [b.id, b.name, b.weeks])).toEqual([
      ['b1', 'Bloco A', 3],
      ['b2', 'Bloco C', 3],
    ])
    expect(c.rir).toEqual([{ min: 5, max: 6 }, { min: 3, max: 3 }, { min: 2, max: 3 }])
    expect(c.days.map((d) => d.id)).toEqual(['b2-d1', 'b2-d2', 'b2-d3'])
    expect(c.days.map((d) => d.exercises)).toEqual(a.days.map((d) => d.exercises))
    expect(findDay(s.plans, 'b2-d1' as WorkoutDayId)?.name).toBe('Push')
  })

  it('more weeks pad the RIR targets with none, fewer drop the last ones, and a week out of range is not set', () => {
    const s = run(
      [
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 2 },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockRir', planId: P, blockId: B, week: 4, rir: { min: 1, max: 1 } },
        { type: 'setBlockRir', planId: P, blockId: B, week: 1, rir: { min: 3, max: 11 } },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 0 },
      ],
      created,
    )
    expect(s.plans[0].blocks[0].rir).toEqual([{ min: 4, max: 5 }, { min: 3, max: 3 }, null])
  })

  it('removing the block the cycle started on moves the start to the first block left, keeping its date, and the last block stays', () => {
    const since = date('2026-10-05')
    const two = run(
      [
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B },
        { type: 'setCycleStart', planId: P, blockId: B, since },
        { type: 'removeBlock', planId: P, blockId: B },
      ],
      created,
    )
    expect(two.plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
    expect(two.plans[0].start).toEqual({ blockId: 'b2', since })
    expect(run([{ type: 'removeBlock', planId: P, blockId: 'b2' as WorkoutBlockId }], two).plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
  })
})

describe('logging sets', () => {
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [pending(8, 60), pending(8, 60), pending(8, 60)] }])] }
  const sets = (s: WorkoutState) => s.sessions[0].exercises[0].sets
  const tick = (index: number, isDone = true): WorkoutAction => ({ type: 'setSetDone', sessionId: S1, exerciseId: SUPINO, index, done: isDone })
  const type = (index: number, set: { kg: number | null; reps: number | null; rir: number | null }): WorkoutAction => ({ type: 'setSet', sessionId: S1, exerciseId: SUPINO, index, set })

  it('one tap marks a set done as shown, again is the same, and un-marking keeps its values', () => {
    expect(sets(run([tick(0), tick(0)], start))).toEqual([done(8, 60), pending(8, 60), pending(8, 60)])
    expect(sets(run([tick(0), tick(0, false)], start))).toEqual(sets(start))
  })

  it('a set with no reps cannot be done', () => {
    const empty = run([type(1, { kg: 60, reps: null, rir: null }), tick(1)], start)
    expect(sets(empty)[1]).toEqual(pending(null, 60))
  })

  it('editing kg or reps never marks a set done, and keeps a done one done while it has reps', () => {
    const s = run([type(0, { kg: 62.5, reps: 7, rir: null }), tick(1), type(1, { kg: 60, reps: 9, rir: null })], start)
    expect(sets(s).slice(0, 2)).toEqual([pending(7, 62.5), done(9, 60)])
    expect(sets(run([type(1, { kg: 60, reps: null, rir: null })], s))[1]).toEqual(pending(null, 60))
  })

  it('a new RIR fills the next pending set that has none', () => {
    const s = run([tick(0), type(0, { kg: 60, reps: 8, rir: 2 }), type(1, { kg: 60, reps: 8, rir: 1 })], start)
    expect(sets(s)).toEqual([done(8, 60, 2), pending(8, 60, 1), pending(8, 60, 1)])
  })

  it('a new set copies the last one, pending', () => {
    expect(sets(run([tick(2), { type: 'addSet', sessionId: S1, exerciseId: SUPINO }], start)).at(-1)).toEqual(pending(8, 60))
  })

  it('an Exercise added to a session copies its last done sets, pending', () => {
    const s = run([{ type: 'addSessionExercise', sessionId: S1, name: 'Remo', newExerciseId: REMO }], {
      ...start,
      exercises: [{ id: REMO, name: 'Remo' }],
      sessions: [session('s0', '2026-10-01', [{ exerciseId: REMO, sets: [done(10, 40, 1), pending(10, 40)] }]), ...start.sessions],
    })
    expect(s.sessions[1].exercises[1]).toEqual({ exerciseId: REMO, sets: [pending(10, 40)] })
  })

  it('starting a session suggests from the history in the state, at the week’s RIR', () => {
    const history = { ...created, sessions: [session('s0', '2026-10-01', [{ exerciseId: BENCH, sets: [done(7, 60, 2)] }])] }
    const s = run([{ type: 'startSession', sessionId: S1, date: date('2026-10-06'), day: PUSH, week: { min: 2, max: 3 } }], history)
    expect(s.sessions[1].exercises[0]).toEqual({ exerciseId: BENCH, sets: Array(3).fill(pending(8, 60)), target: { kg: 60, reps: 8, rir: 2 } })
  })
})

const day3 = (prefix: string, exercises: ExerciseId[]): BlockOf<'ppf'>['days'] => [
  { id: `${prefix}1` as WorkoutDayId, name: `${prefix}1`, exercises: exercises.map((e) => planned(e, 'main')) },
  { id: `${prefix}2` as WorkoutDayId, name: `${prefix}2`, exercises: [] },
  { id: `${prefix}3` as WorkoutDayId, name: `${prefix}3`, exercises: [] },
]
const block = (id: string, weeks: number, days: BlockOf<'ppf'>['days']): BlockOf<'ppf'> => ({
  id: id as WorkoutBlockId,
  name: `Bloco ${id}`,
  weeks,
  rir: Array.from({ length: weeks }, (_, i) => ({ min: weeks - 1 - i, max: weeks - i })),
  days,
})
const BLOCK_A = block('A', 2, day3('a', [SQUAT, SUPINO]))
const BLOCK_B = block('B', 1, day3('b', [SQUAT, REMO]))
const cycle = (startOn: string | null, blocks: PlanOf<'ppf'>['blocks'] = [BLOCK_A, BLOCK_B], blockId = 'A'): WorkoutPlan => ({
  id: 'p' as WorkoutPlanId,
  name: 'Força',
  split: 'ppf',
  blocks,
  start: startOn === null ? null : { blockId: blockId as WorkoutBlockId, since: date(startOn) },
})
const trained = (on: string, dayId: string | null = null) => session(`s-${on}`, on, [{ exerciseId: SQUAT, sets: [done(5, 100)] }], dayId)
const where = (plan: WorkoutPlan, sessions: WorkoutSession[], on: string) => {
  const p = blockPosition(plan, sessions, date(on))
  return p && { block: p.block.name, week: p.week, rir: p.rir, movedFrom: p.movedFrom?.name ?? null }
}

const MONDAY = '2026-10-05'

describe('blockPosition', () => {
  it('is nowhere before the cycle starts or before the week it started', () => {
    expect(where(cycle(null), [], '2026-10-07')).toBe(null)
    expect(where(cycle('2026-10-07'), [], '2026-10-04')).toBe(null)
  })

  it('counts the week the cycle started from its Monday, with that week’s RIR and nothing before it', () => {
    expect(where(cycle('2026-10-07'), [], MONDAY)).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: null })
  })

  it('a week without a done set pauses the block, and two sessions in one week count once', () => {
    const sessions = [trained('2026-10-06'), trained('2026-10-08'), session('empty', '2026-10-13', [{ exerciseId: SQUAT, sets: [pending(5, 80)] }])]
    expect(where(cycle(MONDAY), sessions, '2026-10-21')).toEqual({ block: 'Bloco A', week: 2, rir: { min: 0, max: 1 }, movedFrom: null })
  })

  it('ignores sessions before the start and the sessions of the week asked about', () => {
    const sessions = [trained('2026-09-29'), trained('2026-10-12')]
    expect(where(cycle(MONDAY), sessions, '2026-10-12')?.week).toBe(1)
  })

  it('moves into the next block after the block’s training weeks, naming the one before on its week 1', () => {
    const sessions = [trained(MONDAY), trained('2026-10-12')]
    expect(where(cycle(MONDAY), sessions, '2026-10-19')).toEqual({ block: 'Bloco B', week: 1, rir: { min: 0, max: 1 }, movedFrom: 'Bloco A' })
  })

  it('wraps to the first block after the last', () => {
    const sessions = [MONDAY, '2026-10-12', '2026-10-19', '2026-10-26'].map((d) => trained(d))
    expect(where(cycle(MONDAY), sessions, '2026-11-02')).toEqual({ block: 'Bloco A', week: 2, rir: { min: 0, max: 1 }, movedFrom: null })
    expect(where(cycle(MONDAY), sessions.slice(0, 3), '2026-10-26')).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: 'Bloco B' })
  })

  it('starts from the block named in the start, and from the first when that block is gone', () => {
    expect(where(cycle(MONDAY, [BLOCK_A, BLOCK_B], 'B'), [trained(MONDAY)], '2026-10-12')?.block).toBe('Bloco A')
    expect(where(cycle(MONDAY, [BLOCK_A, BLOCK_B], 'gone'), [], '2026-10-12')?.block).toBe('Bloco A')
  })

  it('a plan with one block has no block before it', () => {
    expect(where(cycle(MONDAY, [BLOCK_A]), [MONDAY, '2026-10-12'].map((d) => trained(d)), '2026-10-19')).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: null })
  })
})

describe('nextDay', () => {
  it('is the first day before any session of the plan', () => {
    expect(nextDay(cycle(null), [trained('2026-10-01')], date('2026-10-06')).id).toBe('a1')
  })

  it('is the day after the latest session’s day, wrapping after the last', () => {
    expect(nextDay(cycle(null), [trained('2026-10-01', 'a2'), trained('2026-10-03', 'a1')], date('2026-10-06')).id).toBe('a2')
    expect(nextDay(cycle(null), [trained('2026-10-03', 'a3')], date('2026-10-06')).id).toBe('a1')
  })

  it('ignores sessions after the date, and carries the rotation into a new block by the day’s place', () => {
    expect(nextDay(cycle(null), [trained('2026-10-01', 'a1'), trained('2026-10-09', 'a2')], date('2026-10-06')).id).toBe('a2')
    const sessions = [trained(MONDAY, 'a1'), trained('2026-10-13', 'a2')]
    expect(nextDay(cycle(MONDAY), sessions, date('2026-10-19')).id).toBe('b3')
  })
})

describe('exerciseRuns', () => {
  const row = (exerciseId: ExerciseId, weeks: number | null, since: string | null): PlannedExercise => ({ ...planned(exerciseId, 'isolation'), weeks, since: since === null ? null : date(since) })
  const runBlock = (one: PlannedExercise[], two: PlannedExercise[] = []) =>
    block('R', 6, [
      { id: 'r1' as WorkoutDayId, name: 'r1', exercises: one },
      { id: 'r2' as WorkoutDayId, name: 'r2', exercises: two },
      { id: 'r3' as WorkoutDayId, name: 'r3', exercises: [] },
    ])
  const runs = (b: BlockOf<'ppf'>, sessions: WorkoutSession[], on: string) => exerciseRuns(b, sessions, date(on)).map((r) => [r.exerciseId, r.done, r.due])

  it('counts the training weeks from the week the Exercise came in, of any Exercise, before the week asked about; a week without training pauses it', () => {
    const b = runBlock([row(REMO, 2, '2026-10-07')])
    const sessions = [trained(MONDAY), trained('2026-10-20')]
    expect(runs(b, sessions, '2026-10-21')).toEqual([[REMO, 1, false]])
    expect(runs(b, sessions, '2026-10-26')).toEqual([[REMO, 2, true]])
  })

  it('an Exercise from before runs started the week it was first done, and one never done has run no weeks', () => {
    const b = runBlock([row(REMO, 1, null), row(SUPINO, 1, null)])
    const sessions = [session('pending-remo', '2026-10-06', [{ exerciseId: REMO, sets: [pending(8, 40)] }]), trained(MONDAY), session('remo', '2026-10-14', [{ exerciseId: REMO, sets: [done(8, 40)] }]), trained('2026-10-19')]
    expect(runs(b, sessions, '2026-10-26')).toEqual([
      [REMO, 2, true],
      [SUPINO, 0, false],
    ])
  })

  it('an Exercise with no limit is never due', () => {
    const sessions = ['2026-09-07', '2026-09-14', '2026-09-21', MONDAY].map((d) => trained(d))
    expect(runs(runBlock([row(SQUAT, null, '2026-09-01')]), sessions, '2026-10-12')).toEqual([[SQUAT, 4, false]])
  })

  it('an Exercise on two days is one run, as long as its longest there and due at its shortest limit', () => {
    const b = runBlock([row(REMO, 3, '2026-10-12')], [row(REMO, 1, MONDAY)])
    const [remo] = exerciseRuns(b, [trained(MONDAY), trained('2026-10-12')], date('2026-10-19'))
    expect(remo).toEqual({ exerciseId: REMO, dayIds: ['r1', 'r2'], weeks: 1, done: 2, due: true })
  })

  it('swapping an Exercise that is due starts a new run, and a copied block carries the run on', () => {
    const raises = PUSH.exercises[2].exerciseId
    const sessions = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', MONDAY, '2026-10-12', '2026-10-19', '2026-10-26'].map((d, i) => session(`w${i}`, d, [{ exerciseId: raises, sets: [done(12, 8)] }]))
    const history = { ...created, sessions }
    const dueOn = (s: WorkoutState, blockIndex = 0) => exerciseRuns(s.plans[0].blocks[blockIndex], s.sessions, TODAY).filter((r) => r.due).map((r) => r.exerciseId)
    expect(dueOn(history)).toEqual([raises])
    expect(dueOn(run([{ type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B }], history), 1)).toEqual([raises])
    const swapped = run([{ type: 'swapPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, exerciseId: raises, name: 'Cable Lateral Raises', newExerciseId: 'clr' as ExerciseId, today: TODAY }], history)
    expect(dueOn(swapped)).toEqual([])
  })
})

describe('blockChanges', () => {
  it('lists the Exercises that come in and those that go', () => {
    expect(blockChanges(BLOCK_A, BLOCK_B)).toEqual({ entering: [REMO], leaving: [SUPINO] })
  })
})

describe('parseRir', () => {
  it.each([
    ['3', { min: 3, max: 3 }],
    ['5-6', { min: 5, max: 6 }],
    ['5–6', { min: 5, max: 6 }],
    ['5 a 6', { min: 5, max: 6 }],
    ['0', { min: 0, max: 0 }],
    ['6-5', null],
    ['11', null],
    ['', null],
  ])('%s', (text, rir) => {
    expect(parseRir(text)).toEqual(rir)
  })
})

describe('parseRepRange', () => {
  it.each([
    ['8-12', { min: 8, max: 12 }],
    [' 8 – 12 ', { min: 8, max: 12 }],
    ['6 a 8', { min: 6, max: 8 }],
    ['10', { min: 10, max: 10 }],
    ['12-8', null],
    ['8-', null],
    ['0', null],
    ['', null],
  ])('reads "%s"', (text, expected) => {
    expect(parseRepRange(text)).toEqual(expected)
  })
})

describe('exercise notes', () => {
  const at = (s: string) => s as LocalDateTime
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [] }, { exerciseId: REMO, sets: [] }])] }

  it('gives one exercise its own note with when it was written and last edited, leaving the others alone', () => {
    const s = run(
      [
        { type: 'setExerciseNote', sessionId: S1, exerciseId: SUPINO, text: 'Ombro esq. a picar', now: at('2026-10-06T18:40:00') },
        { type: 'setExerciseNote', sessionId: S1, exerciseId: SUPINO, text: 'Ombro esq. a picar na 3.ª série', now: at('2026-10-06T18:47:30') },
      ],
      start,
    )
    expect(s.sessions[0].exercises).toEqual([
      { exerciseId: SUPINO, sets: [], note: { text: 'Ombro esq. a picar na 3.ª série', createdAt: '2026-10-06T18:40:00', updatedAt: '2026-10-06T18:47:30' } },
      { exerciseId: REMO, sets: [] },
    ])
  })

  it('removes the note, key and all, when cleared to blank', () => {
    const s = run(
      [
        { type: 'setExerciseNote', sessionId: S1, exerciseId: REMO, text: 'Bem', now: at('2026-10-06T18:40:00') },
        { type: 'setExerciseNote', sessionId: S1, exerciseId: REMO, text: '', now: at('2026-10-06T18:41:00') },
      ],
      start,
    )
    expect(Object.keys(s.sessions[0].exercises[1])).toEqual(['exerciseId', 'sets'])
  })
})

describe('end feel and After-effects', () => {
  const at = (s: string) => s as LocalDateTime
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [] }, { exerciseId: REMO, sets: [] }])] }
  const after = (on: string, exerciseId: ExerciseId | null, text: string, now: string): WorkoutAction => ({ type: 'setAfterEffect', sessionId: S1, date: date(on), exerciseId, text, now: at(now) })

  it('rates how the session felt at its end, and null removes the key', () => {
    const rated = run([{ type: 'setSessionFeel', sessionId: S1, feel: 2 }, { type: 'setSessionFeel', sessionId: S1, feel: 4 }], start)
    expect(rated.sessions[0].feel).toBe(4)
    expect(Object.keys(run([{ type: 'setSessionFeel', sessionId: S1, feel: null }], rated).sessions[0])).toEqual(['id', 'date', 'workoutDayId', 'exercises'])
  })

  it('keeps one After-effect per later date and Exercise, with when it was written and last edited', () => {
    const s = run(
      [
        after('2026-10-07', null, 'Pernas pesadas', '2026-10-07T08:00:00'),
        after('2026-10-07', SUPINO, 'Ombro dói', '2026-10-07T08:05:00'),
        after('2026-10-08', SUPINO, 'Ombro melhor', '2026-10-08T09:00:00'),
        after('2026-10-07', SUPINO, 'Ombro dói ao levantar o braço', '2026-10-07T21:30:00'),
      ],
      start,
    )
    expect(s.sessions[0].after).toEqual([
      { date: '2026-10-07', exerciseId: null, note: { text: 'Pernas pesadas', createdAt: '2026-10-07T08:00:00', updatedAt: '2026-10-07T08:00:00' } },
      { date: '2026-10-07', exerciseId: SUPINO, note: { text: 'Ombro dói ao levantar o braço', createdAt: '2026-10-07T08:05:00', updatedAt: '2026-10-07T21:30:00' } },
      { date: '2026-10-08', exerciseId: SUPINO, note: { text: 'Ombro melhor', createdAt: '2026-10-08T09:00:00', updatedAt: '2026-10-08T09:00:00' } },
    ])
  })

  it('removes an After-effect cleared to blank, and the key with the last one', () => {
    const two = run([after('2026-10-07', null, 'Pernas pesadas', '2026-10-07T08:00:00'), after('2026-10-08', REMO, 'Costas ok', '2026-10-08T08:00:00')], start)
    const one = run([after('2026-10-07', null, ' ', '2026-10-07T09:00:00')], two)
    expect(one.sessions[0].after?.map((a) => a.note.text)).toEqual(['Costas ok'])
    expect('after' in run([after('2026-10-08', REMO, '', '2026-10-08T09:00:00')], one).sessions[0]).toBe(false)
  })

  it('ignores an After-effect on the session’s own date or on an Exercise it does not have', () => {
    const s = run([after('2026-10-06', null, 'Hoje', '2026-10-06T20:00:00'), after('2026-10-07', 'ex-outro' as ExerciseId, 'Outro', '2026-10-07T08:00:00')], start)
    expect(s.sessions[0]).toEqual(start.sessions[0])
  })

  it('removing an Exercise from the session removes its After-effects', () => {
    const s = run([after('2026-10-07', SUPINO, 'Ombro dói', '2026-10-07T08:00:00'), after('2026-10-07', REMO, 'Costas ok', '2026-10-07T08:00:00'), { type: 'removeSessionExercise', sessionId: S1, exerciseId: SUPINO }], start)
    expect(s.sessions[0].after?.map((a) => [a.exerciseId, a.note.text])).toEqual([[REMO, 'Costas ok']])
  })

  it('lists the sessions one to three days before a date, newest first', () => {
    expect(recentSessions(HISTORY, date('2026-10-06')).map((s) => s.id)).toEqual(['s3', 's2'])
    expect(recentSessions(HISTORY, date('2026-10-04')).map((s) => s.id)).toEqual(['s2', 's1'])
    expect(recentSessions(HISTORY, date('2026-10-05')).map((s) => s.id)).toEqual(['s2'])
  })
})
