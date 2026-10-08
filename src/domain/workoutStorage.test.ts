import { describe, expect, it } from 'vitest'
import type { ExerciseId } from './types.ts'
import { parseWorkoutPlans, parseWorkoutSessions } from './workoutStorage.ts'
import { loadAll, loadStore, saveStore, STORES } from './stores.ts'

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

const AFTER = [
  { date: '2026-10-07', exerciseId: null, note: { text: 'Pernas pesadas', createdAt: '2026-10-07T08:10:00', updatedAt: '2026-10-07T08:10:00' } },
  { date: '2026-10-08', exerciseId: 'e1', note: { text: 'Pulso ainda dói', createdAt: '2026-10-08T09:00:00', updatedAt: '2026-10-08T09:20:00' } },
]

describe('workout storage', () => {
  it('reads back what it saved', () => {
    const storage = memoryStorage()
    saveStore(STORES.exercises, [{ id: 'e1' as ExerciseId, name: 'Supino' }], storage)
    saveStore(STORES.workoutPlans, parseWorkoutPlans({ version: 1, plans: [PLAN], activePlanId: 'p1' })!, storage)
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 2, sessions: [SESSION] })!, storage)
    const { exercises, workoutPlans, workoutSessions } = loadAll(storage)
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [{ id: 'e1', name: 'Supino' }], workoutPlans: { plans: [PLAN], activePlanId: 'p1' }, workoutSessions: [SESSION] })
  })

  it('reads back a session’s end feel and After-effects', () => {
    const storage = memoryStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 2, sessions: [{ ...SESSION, feel: 4, after: AFTER }] })!, storage)
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([{ ...SESSION, feel: 4, after: AFTER }])
  })

  it('reads a session stored before end feel and After-effects with neither key', () => {
    const [session] = parseWorkoutSessions({ version: 2, sessions: [SESSION] })!
    expect(['feel' in session, 'after' in session]).toEqual([false, false])
  })

  it('reads an empty After-effects list as none', () => {
    const [session] = parseWorkoutSessions({ version: 2, sessions: [{ ...SESSION, after: [] }] })!
    expect(session).toEqual(SESSION)
  })

  it('starts empty when nothing was saved', () => {
    const { exercises, workoutPlans, workoutSessions } = loadAll(memoryStorage())
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [] })
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
    ['an end feel of 0', { version: 2, sessions: [{ ...SESSION, feel: 0 }] }],
    ['an end feel of null', { version: 2, sessions: [{ ...SESSION, feel: null }] }],
    ['After-effects that are not a list', { version: 2, sessions: [{ ...SESSION, after: {} }] }],
    ['an After-effect on the session’s own date', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], date: '2026-10-06' }] }] }],
    ['an After-effect on an Exercise not in the session', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], exerciseId: 'e9' }] }] }],
    ['an After-effect with no exerciseId key', { version: 2, sessions: [{ ...SESSION, after: [{ date: '2026-10-07', note: AFTER[0].note }] }] }],
    ['an After-effect with a blank note', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], note: { ...AFTER[0].note, text: ' ' } }] }] }],
    ['two After-effects on one date and Exercise', { version: 2, sessions: [{ ...SESSION, after: [AFTER[1], { ...AFTER[1], note: AFTER[0].note }] }] }],
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
    const storage = memoryStorage({ [STORES.workoutSessions.key]: text })
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([])
    const copies = Object.entries(storage.data).filter(([k]) => k.startsWith(`${STORES.workoutSessions.key}:unreadable:`))
    expect(copies.map(([, v]) => v)).toEqual([text])
  })
})
