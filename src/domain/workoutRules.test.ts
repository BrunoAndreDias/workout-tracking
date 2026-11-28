import { describe, expect, it } from 'vitest'
import type { ExerciseId, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from './types.ts'
import { suggestTarget } from './progression.ts'
import { emptyWorkouts, parseRepRange } from './workouts.ts'
import type { BlockOf, PlannedExercise, WorkoutState } from './workouts.ts'
import type { SetValues, WorkoutAction } from './workoutReducer.ts'
import { parseWorkoutSessions } from './workoutStorage.ts'
import { B, P, PUSH, REMO, S1, SUPINO, TODAY, block, created, cycle, day, done, pending, planned, run, session } from './workoutFixtures.ts'

const PLAN = 'p' as WorkoutPlanId
const BLOCK = 'A' as WorkoutBlockId
const twoDays: BlockOf<'ppf'>['days'] = [
  { id: 'a1' as WorkoutDayId, name: 'Push', exercises: [planned(SUPINO, 'main')] },
  { id: 'a2' as WorkoutDayId, name: 'Pull', exercises: [planned(REMO, 'secondary'), planned(SUPINO, 'secondary')] },
  { id: 'a3' as WorkoutDayId, name: 'Full body', exercises: [planned(REMO, 'main')] },
]
const withRuns: WorkoutState = {
  ...emptyWorkouts(),
  exercises: [
    { id: SUPINO, name: 'Supino' },
    { id: REMO, name: 'Remo' },
  ],
  plans: [cycle(null, [block('A', 6, twoDays)])],
  activePlanId: PLAN,
}
const ids = (s: WorkoutState) => s.plans[0].blocks[0].days.map((d) => d.exercises.map((p) => [p.exerciseId, p.weeks, p.since]))

describe('a due Exercise Run, block-wide', () => {
  it('Mais 4 semanas sets the run’s weeks on every day of the block it is planned in, and nothing else', () => {
    const s = run([{ type: 'extendExerciseRun', planId: PLAN, blockId: BLOCK, exerciseId: SUPINO, weeks: 12 }], withRuns)
    expect(ids(s)).toEqual([[[SUPINO, 12, null]], [[REMO, null, null], [SUPINO, 12, null]], [[REMO, null, null]]])
  })

  it('refuses run weeks outside 1 to 52', () => {
    for (const weeks of [0, 53, 2.5]) expect(run([{ type: 'extendExerciseRun', planId: PLAN, blockId: BLOCK, exerciseId: SUPINO, weeks }], withRuns)).toBe(withRuns)
  })

  it('Trocar swaps it on every day it is planned in for one new Exercise, from today, except a day that already has it', () => {
    const swap = (name: string): WorkoutAction => ({ type: 'swapExerciseRun', planId: PLAN, blockId: BLOCK, exerciseId: SUPINO, name, newExerciseId: 'e1' as ExerciseId, today: TODAY })
    const s = run([swap('Supino inclinado')], withRuns)
    const E1 = 'e1' as ExerciseId
    expect(ids(s)).toEqual([[[E1, null, TODAY]], [[REMO, null, null], [E1, null, TODAY]], [[REMO, null, null]]])
    expect(s.exercises.filter((e) => e.id === E1)).toEqual([{ id: E1, name: 'Supino inclinado' }])
    expect(ids(run([swap('remo')], withRuns))).toEqual([[[REMO, null, TODAY]], [[REMO, null, null], [SUPINO, null, null]], [[REMO, null, null]]])
  })
})

describe('the reducer refuses what the store would not read', () => {
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [pending(8, 60)] }])] }
  const type = (set: SetValues) => run([{ type: 'setSet', sessionId: S1, exerciseId: SUPINO, index: 0, set }], start)

  it('takes kg 0 to 9999, reps 0 to 9999 and RIR 0 to 10, each or none', () => {
    expect(type({ kg: 9999, reps: 9999, rir: 10 }).sessions[0].exercises[0].sets[0]).toEqual(pending(9999, 9999, 10))
    expect(type({ kg: null, reps: null, rir: null }).sessions[0].exercises[0].sets[0]).toEqual(pending(null, null))
  })

  it('refuses kg below 0, above 9999 or not finite', () => {
    for (const kg of [-1, 10000, Number.NaN, Number.POSITIVE_INFINITY]) expect(type({ kg, reps: 8, rir: null })).toBe(start)
  })

  it('refuses reps below 0, above 9999 or not whole', () => {
    for (const reps of [-1, 10000, 7.5]) expect(type({ kg: 60, reps, rir: null })).toBe(start)
  })

  it('refuses a RIR below 0, above 10 or not whole', () => {
    for (const rir of [-1, 11, 1.5]) expect(type({ kg: 60, reps: 8, rir })).toBe(start)
  })

  const plan = (edit: Partial<PlannedExercise>) => run([{ type: 'setPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, planned: { ...PUSH.exercises[0], ...edit } }], created)

  it('takes 1 to 9999 sets and a rep range inside 1 to 9999', () => {
    expect(day(plan({ sets: 9999, reps: { min: 1, max: 9999 } })).exercises[0]).toMatchObject({ sets: 9999, reps: { min: 1, max: 9999 } })
  })

  it('refuses a Planned Exercise’s sets below 1, above 9999 or not whole', () => {
    for (const sets of [0, 10000, 2.5]) expect(plan({ sets })).toBe(created)
  })

  it('refuses a rep range below 1, above 9999, upside down or not whole', () => {
    for (const reps of [
      { min: 0, max: 8 },
      { min: 8, max: 10000 },
      { min: 8, max: 6 },
      { min: 6.5, max: 8 },
    ])
      expect(plan({ reps })).toBe(created)
  })
})

describe('one limit for the field, the store and the suggestion', () => {
  it('a rep range typed above 9999 does not parse', () => {
    expect(parseRepRange('8-9999')).toEqual({ min: 8, max: 9999 })
    expect(parseRepRange('8-10000')).toBeNull()
  })

  it('a stored set above 9999 kg makes the sessions unreadable', () => {
    const stored = (kg: number) => ({ version: 4, sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [done(8, kg)] }])] })
    expect(parseWorkoutSessions(stored(9999))).not.toBeNull()
    expect(parseWorkoutSessions(stored(10000))).toBeNull()
  })

  it('the load never steps up past 9999 kg', () => {
    const target = { min: 2, max: 2, light: false }
    expect(suggestTarget({ sets: [{ done: true, kg: 9999, reps: 9, rir: null }], previous: target, next: target, range: { min: 6, max: 8 } })).toMatchObject({ kg: 9999, reps: 8, change: 'keep' })
  })
})
