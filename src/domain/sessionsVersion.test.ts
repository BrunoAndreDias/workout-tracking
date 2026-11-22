import { describe, expect, it } from 'vitest'
import { loadStore, saveStore, STORES } from './stores.ts'
import { parseWorkoutSessions, WORKOUT_SESSIONS_SCHEMA_VERSION } from './workoutStorage.ts'

function enumerableStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  }
}

const KEY = STORES.workoutSessions.key
const copies = (data: Record<string, string>, kind: 'migrated' | 'unreadable') =>
  Object.entries(data)
    .filter(([k]) => k.startsWith(`${KEY}:${kind}:`))
    .map(([, v]) => v)

const note = (text: string, at: string) => ({ text, createdAt: at, updatedAt: at })
const FULL = {
  id: 's1',
  date: '2026-10-06',
  workoutDayId: 'd1',
  exercises: [
    {
      exerciseId: 'e1',
      sets: [{ done: true, kg: 10, reps: 12, rir: 2 }],
      target: { kg: 10, reps: 12, rir: 3, rirMax: 5, light: true },
      note: note('Pulso', '2026-10-06T19:12:00'),
    },
  ],
  note: note('Bom treino', '2026-10-06T19:30:00'),
  feel: 4,
  after: [{ date: '2026-10-07', exerciseId: 'e1', note: note('Pulso ainda dói', '2026-10-07T08:10:00') }],
}

describe('workout sessions at version 4', () => {
  it('saves every optional key and reads each one back', () => {
    const storage = enumerableStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 4, sessions: [FULL] })!, storage)
    expect(JSON.parse(storage.data[KEY])).toEqual({ version: 4, sessions: [FULL] })
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([FULL])
  })

  it('reads a version 3 document with all its keys, keeping its text aside before saving it as version 4', () => {
    const v3 = JSON.stringify({ version: 3, sessions: [FULL] })
    const storage = enumerableStorage({ [KEY]: v3 })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    expect(copies(storage.data, 'migrated')).toEqual([v3])
    expect(JSON.parse(storage.data[KEY])).toEqual({ version: 4, sessions: [FULL] })
  })

  it('is refused, not rewritten, by a build that knows only an older version', () => {
    const newer = JSON.stringify({ version: WORKOUT_SESSIONS_SCHEMA_VERSION + 1, sessions: [{ ...FULL, later: true }] })
    const storage = enumerableStorage({ [KEY]: newer })
    const loaded = loadStore(STORES.workoutSessions, storage)
    expect(loaded).toEqual([])
    expect(saveStore(STORES.workoutSessions, loaded, storage)).toBe(true)
    expect(copies(storage.data, 'unreadable')).toEqual([newer])
    expect(storage.data[KEY]).toBe(newer)
  })

  it('leaves a newer Workout Plans document in place when the app saves its empty plans as it starts', () => {
    const newer = JSON.stringify({ version: STORES.workoutPlans.version + 1, plans: [{ id: 'p1' }], activePlanId: 'p1' })
    const storage = enumerableStorage({ [STORES.workoutPlans.key]: newer })
    const { plans, activePlanId } = loadStore(STORES.workoutPlans, storage)
    expect(saveStore(STORES.workoutPlans, { plans, activePlanId }, storage)).toBe(true)
    expect(storage.data[STORES.workoutPlans.key]).toBe(newer)
  })

  it('writes over a refused document once the user changes that store', () => {
    const newer = JSON.stringify({ version: WORKOUT_SESSIONS_SCHEMA_VERSION + 1, sessions: [] })
    const storage = enumerableStorage({ [KEY]: newer })
    loadStore(STORES.workoutSessions, storage)
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 4, sessions: [FULL] })!, storage)
    expect(JSON.parse(storage.data[KEY])).toEqual({ version: 4, sessions: [FULL] })
    expect(copies(storage.data, 'unreadable')).toEqual([newer])
  })
})
