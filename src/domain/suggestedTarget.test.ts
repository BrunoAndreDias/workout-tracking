import { describe, expect, it } from 'vitest'
import type { WorkoutDayId } from './types.ts'
import type { LoggedSet, PlannedExercise, RepRange, SetTarget } from './workouts.ts'
import { SUPINO, S1, created, date, done, planned, run, session } from './workoutFixtures.ts'

const MAIN: RepRange = { min: 6, max: 8 }
const ISOLATION: RepRange = { min: 10, max: 15 }

/** Starts a session from a day with one planned Exercise, after a session that logged `sets` aiming at `aimed`. */
function next(role: PlannedExercise['role'], range: RepRange, sets: LoggedSet[], aimed?: SetTarget) {
  const day = { id: 'd' as WorkoutDayId, name: 'Dia', exercises: [planned(SUPINO, role, 3, range)] }
  const last = session('s0', '2026-10-01', [{ exerciseId: SUPINO, sets, ...(aimed && { target: aimed }) }])
  const s = run([{ type: 'startSession', sessionId: S1, date: date('2026-10-06'), day, light: false }], { ...created, sessions: [last] })
  const exercise = s.sessions[1].exercises[0]
  const set = exercise.sets[0]
  expect(exercise.sets.every((s) => s.kg === set.kg && s.reps === set.reps && !s.done)).toBe(true)
  return { kg: set.kg, reps: set.reps }
}

const TWO: SetTarget = { kg: 60, reps: 7, rir: 2 }
const ONE_TO_THREE: SetTarget = { kg: 10, reps: 12, rir: 1, rirMax: 3 }

describe('the Suggested Target follows the RIR table', () => {
  it('adds one rep at the same load for a set anywhere inside its RIR Target', () => {
    for (const rir of [1, 2, 3]) expect(next('isolation', ISOLATION, [done(12, 10, rir)], ONE_TO_THREE)).toEqual({ kg: 10, reps: 13 })
    expect(next('main', MAIN, [done(6, 60, 2), done(6, 60, 2)], TWO)).toEqual({ kg: 60, reps: 7 })
  })

  it('counts a set with no RIR logged as on target', () => {
    expect(next('main', MAIN, [done(6, 60), done(6, 60)], TWO)).toEqual({ kg: 60, reps: 7 })
    expect(next('isolation', ISOLATION, [done(12, 20)])).toEqual({ kg: 20, reps: 13 })
  })

  it('adds two reps at the same load when the sets were easier than the target', () => {
    expect(next('main', MAIN, [done(6, 60, 4), done(6, 60, 4)], TWO)).toEqual({ kg: 60, reps: 8 })
    expect(next('isolation', ISOLATION, [done(11, 10, 5)], ONE_TO_THREE)).toEqual({ kg: 10, reps: 13 })
  })

  it('keeps the same kg × reps when a set was harder than the target but short of failure', () => {
    expect(next('main', MAIN, [done(7, 60, 1), done(7, 60, 1)], TWO)).toEqual({ kg: 60, reps: 7 })
  })

  it('backs off one rep at the same load after a set to failure', () => {
    expect(next('main', MAIN, [done(8, 60, 0)], TWO)).toEqual({ kg: 60, reps: 7 })
    expect(next('isolation', ISOLATION, [done(12, 10, 0)], ONE_TO_THREE)).toEqual({ kg: 10, reps: 11 })
  })

  it('lets the hardest set decide, so every set gets its kg × reps', () => {
    expect(next('main', MAIN, [done(7, 60, 2), done(7, 60, 2), done(7, 60, 0)], TWO)).toEqual({ kg: 60, reps: 6 })
  })
  it('shifts the reps by the change of target, never rising more than 2 over the lowest done reps', () => {
    expect(next('isolation', ISOLATION, [done(12, 10, 4), done(13, 10, 4)], { kg: 10, reps: 12, rir: 4 })).toEqual({ kg: 10, reps: 14 })
    expect(next('main', MAIN, [done(7, 60, 0)], { kg: 60, reps: 7, rir: 0 })).toEqual({ kg: 60, reps: 6 })
  })
  it('goes up one load step past the top of the range: 1 kg under 25 kg, 2,5 kg from 25 kg', () => {
    const up = (kg: number) => next('isolation', ISOLATION, [done(15, kg, 2)], { ...ONE_TO_THREE, kg }).kg
    expect([up(10), up(24), up(25)]).toEqual([11, 25, 27.5])
  })

  it('never goes up more than one load step, however easy the sets were, re-estimating the reps in the range', () => {
    const { kg, reps } = next('main', MAIN, [done(8, 80, 5), done(8, 80, 5)], TWO)
    expect(kg).toBe(82.5)
    expect(reps).toBeGreaterThanOrEqual(MAIN.min)
    expect(reps).toBeLessThanOrEqual(MAIN.max)
  })

  it('goes down one load step below the bottom of the range', () => {
    expect(next('main', MAIN, [done(6, 25, 0), done(5, 25, 0)], { ...TWO, kg: 25 })).toEqual({ kg: 22.5, reps: 6 })
    expect(next('main', MAIN, [done(6, 80, 0), done(5, 80, 0)], TWO)).toEqual({ kg: 77.5, reps: 6 })
  })
  it('moves only the reps of a bodyweight Exercise, within the range', () => {
    const bodyweight = { ...TWO, kg: null }
    expect(next('main', MAIN, [done(6, null, 2), done(6, null, 2)], bodyweight)).toEqual({ kg: null, reps: 7 })
    expect(next('main', MAIN, [done(8, null, 3)], bodyweight)).toEqual({ kg: null, reps: 8 })
    expect(next('main', MAIN, [done(5, null, 0)], bodyweight)).toEqual({ kg: null, reps: 6 })
  })

  it('reads only the sets at the last set’s load', () => {
    expect(next('main', MAIN, [done(3, 60, 0), done(6, 80, 2), done(6, 80, 2)], { ...TWO, kg: 80 })).toEqual({ kg: 80, reps: 7 })
  })
})
