import { describe, expect, it } from 'vitest'
import { loadStore, STORES } from './stores.ts'

function enumerableStorage(initial: Record<string, string>) {
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

const copies = (data: Record<string, string>, key: string) => Object.entries(data).filter(([k]) => k.startsWith(`${key}:unreadable:`))

describe('an unreadable stored document', () => {
  it.each([
    ['exercises', STORES.exercises.key, '{"version":99,"exercises":[]}', STORES.exercises],
    ['workout plans', STORES.workoutPlans.key, '{"version":99,"plans":[]}', STORES.workoutPlans],
    ['workout sessions', STORES.workoutSessions.key, '{"version":99,"sessions":[]}', STORES.workoutSessions],
    ['health', STORES.health.key, '{"version":99,"samples":[]}', STORES.health],
    ['workout sessions, corrupt JSON', STORES.workoutSessions.key, '{nope', STORES.workoutSessions],
  ])('is preserved under an unreadable key for %s, once across reloads', (_label, key, raw, def) => {
    const storage = enumerableStorage({ [key]: raw })
    loadStore<unknown>(def, storage)
    const [[copyKey, copy]] = copies(storage.data, key)
    expect(copy).toBe(raw)
    expect(copyKey).toMatch(/^.+:unreadable:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    loadStore<unknown>(def, storage)
    expect(copies(storage.data, key)).toHaveLength(1)
    expect(storage.data[key]).toBe(raw)
  })

  it('a v99 sessions document loads as no sessions and its raw text survives', () => {
    const raw = JSON.stringify({ version: 99, sessions: [{ id: 'a' }] })
    const storage = enumerableStorage({ [STORES.workoutSessions.key]: raw })
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([])
    expect(copies(storage.data, STORES.workoutSessions.key).map(([, v]) => v)).toEqual([raw])
  })

  it('preserves a different unreadable text separately', () => {
    const storage = enumerableStorage({ [STORES.exercises.key]: '{"version":98}' })
    loadStore(STORES.exercises, storage)
    storage.data[STORES.exercises.key] = '{"version":99}'
    loadStore(STORES.exercises, storage)
    expect(copies(storage.data, STORES.exercises.key).map(([, v]) => v).sort()).toEqual(['{"version":98}', '{"version":99}'])
  })

  it('preserves nothing for a missing or valid document', () => {
    const storage = enumerableStorage({ [STORES.exercises.key]: '{"version":1,"exercises":[]}' })
    loadStore(STORES.exercises, storage)
    loadStore(STORES.workoutSessions, storage)
    expect(Object.keys(storage.data)).toEqual([STORES.exercises.key])
  })
})
