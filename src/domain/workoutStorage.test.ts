import { describe, expect, it } from 'vitest'
import type { ExerciseId } from './types.ts'
import { loadWorkouts, parseWorkoutPlans, parseWorkoutSessions, saveExercises, saveWorkoutPlans, saveWorkoutSessions, WORKOUT_SESSIONS_STORAGE_KEY } from './workoutStorage.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    get length() {
      return Object.keys(data).length
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
  }
}

const SESSION = {
  id: 's1',
  date: '2026-10-06',
  workoutDayId: 'd1',
  exercises: [
    {
      exerciseId: 'e1',
      sets: [{ reps: 8, kg: 62.5 }, { reps: 10, kg: null }, { reps: null, kg: null }],
      note: { text: 'Pulso dir. a doer na última', createdAt: '2026-10-06T19:12:00', updatedAt: '2026-10-06T19:12:00' },
    },
  ],
  note: { text: 'Ombro ok', createdAt: '2026-10-06T19:30:00', updatedAt: '2026-10-06T19:41:00' },
}
const PLAN = { id: 'p1', name: 'Força', days: [{ id: 'd1', name: 'Peito', exercises: [{ exerciseId: 'e1', sets: 4, reps: { min: 6, max: 6 } }] }] }

describe('workout storage', () => {
  it('reads back what it saved', () => {
    const storage = memoryStorage()
    saveExercises([{ id: 'e1' as ExerciseId, name: 'Supino' }], storage)
    saveWorkoutPlans(parseWorkoutPlans({ version: 1, plans: [PLAN], activePlanId: 'p1' })!, storage)
    saveWorkoutSessions(parseWorkoutSessions({ version: 2, sessions: [SESSION] })!, storage)
    expect(loadWorkouts(storage)).toEqual({ exercises: [{ id: 'e1', name: 'Supino' }], plans: [PLAN], activePlanId: 'p1', sessions: [SESSION] })
  })

  it('starts empty when nothing was saved', () => {
    expect(loadWorkouts(memoryStorage())).toEqual({ exercises: [], plans: [], activePlanId: null, sessions: [] })
  })

  it('reads a version 1 plain-text note as written at midday of the session, and an empty one as no note', () => {
    const { note: _, ...bare } = SESSION
    expect(parseWorkoutSessions({ version: 1, sessions: [{ ...bare, notes: 'Ombro ok' }, { ...bare, id: 's2', notes: '' }] })).toEqual([
      { ...bare, note: { text: 'Ombro ok', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' } },
      { ...bare, id: 's2' },
    ])
  })

  it.each([
    ['an unknown version', { version: 3, sessions: [] }],
    ['a bad date', { version: 2, sessions: [{ ...SESSION, date: '2026-02-30' }] }],
    ['negative kg', { version: 2, sessions: [{ ...SESSION, exercises: [{ exerciseId: 'e1', sets: [{ reps: 5, kg: -1 }] }] }] }],
    ['an exercise twice', { version: 2, sessions: [{ ...SESSION, exercises: [SESSION.exercises[0], SESSION.exercises[0]] }] }],
    ['a repeated session id', { version: 2, sessions: [SESSION, SESSION] }],
    ['a blank note', { version: 2, sessions: [{ ...SESSION, note: { ...SESSION.note, text: '' } }] }],
    ['an exercise note with no times', { version: 2, sessions: [{ ...SESSION, exercises: [{ ...SESSION.exercises[0], note: { text: 'x' } }] }] }],
    ['a version 1 session without notes', { version: 1, sessions: [{ ...SESSION, note: undefined }] }],
  ])('rejects sessions with %s', (_, raw) => {
    expect(parseWorkoutSessions(raw)).toBe(null)
  })

  it.each([
    ['a rep range upside down', { version: 1, plans: [{ ...PLAN, days: [{ ...PLAN.days[0], exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 12, max: 8 } }] }] }], activePlanId: 'p1' }],
    ['zero sets', { version: 1, plans: [{ ...PLAN, days: [{ ...PLAN.days[0], exercises: [{ exerciseId: 'e1', sets: 0, reps: { min: 8, max: 8 } }] }] }], activePlanId: 'p1' }],
    ['no active plan while there are plans', { version: 1, plans: [PLAN], activePlanId: null }],
    ['an active plan while there are none', { version: 1, plans: [], activePlanId: 'p1' }],
  ])('rejects plans with %s', (_, raw) => {
    expect(parseWorkoutPlans(raw)).toBe(null)
  })

  it('keeps an unreadable sessions document aside before starting empty', () => {
    const text = JSON.stringify({ version: 1, sessions: [{ ...SESSION, notes: 3 }] })
    const storage = memoryStorage({ [WORKOUT_SESSIONS_STORAGE_KEY]: text })
    expect(loadWorkouts(storage).sessions).toEqual([])
    const copies = Object.entries(storage.data).filter(([k]) => k.startsWith(`${WORKOUT_SESSIONS_STORAGE_KEY}:unreadable:`))
    expect(copies.map(([, v]) => v)).toEqual([text])
  })
})
