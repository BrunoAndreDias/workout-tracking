import { describe, expect, it } from 'vitest'
import type { WorkoutSessionId } from './types.ts'
import { loggedCounts } from './workouts.ts'
import { lastDoneSets, sessionsBefore, startSession } from './sessions.ts'
import { SUPINO, REMO, date, done, pending, session, PEITO, HISTORY } from './workoutFixtures.ts'

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

  it('a session from a Workout Day fills each planned set, pending, with the suggestion, and keeps it as the target', () => {
    expect(startSession('new' as WorkoutSessionId, date('2026-10-06'), PEITO, HISTORY)).toEqual({
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
    expect(startSession('b' as WorkoutSessionId, date('2026-10-06'), null, HISTORY)).toEqual({ id: 'b', date: '2026-10-06', workoutDayId: null, exercises: [] })
  })

  it('counts only done sets', () => {
    expect(loggedCounts(HISTORY[1])).toEqual({ exercises: 1, sets: 2 })
    expect(loggedCounts(HISTORY[2])).toEqual({ exercises: 0, sets: 0 })
  })
})
