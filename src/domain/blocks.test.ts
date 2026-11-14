import { describe, expect, it } from 'vitest'
import type { ExerciseId, WorkoutBlockId, WorkoutDayId } from './types.ts'
import { blockChanges, exerciseRuns, nextDay } from './blocks.ts'
import type { BlockOf, PlannedExercise, WorkoutSession, WorkoutState } from './workouts.ts'
import { SUPINO, REMO, SQUAT, date, done, pending, session, planned, run, P, B, TODAY, created, PUSH, block, BLOCK_A, BLOCK_B, cycle, trained, where, MONDAY } from './workoutFixtures.ts'

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
    const history = { ...run([{ type: 'createPlan', planId: P, blockId: B, name: 'Força', split: 'ppf', today: date('2026-09-01') }]), sessions }
    const dueOn = (s: WorkoutState, blockIndex = 0) => exerciseRuns(s.plans[0].blocks[blockIndex], s.sessions, TODAY).filter((r) => r.due && r.exerciseId === raises).map((r) => r.exerciseId)
    expect(dueOn({ ...created, sessions })).toEqual([])
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
