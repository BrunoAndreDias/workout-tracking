import { describe, expect, it } from 'vitest'
import { loadStore, saveStore, STORES } from './stores.ts'
import { memoryStorage } from './memoryStorage.ts'

const copies = (data: Record<string, string>, key: string) =>
  Object.entries(data)
    .filter(([k]) => k.startsWith(`${key}:migrated:`))
    .map(([, v]) => v)

const SESSIONS_V1 = JSON.stringify({
  version: 1,
  sessions: [{ id: 's1', date: '2026-10-05', workoutDayId: null, exercises: [], notes: 'Bom treino' }],
})
const WORKOUT_PLANS_V1 = JSON.stringify({
  version: 1,
  plans: [{ id: 'wp1', name: 'Força', days: ['wd1', 'wd2', 'wd3'].map((id) => ({ id, name: id, exercises: [{ exerciseId: 'x1', sets: 3, reps: { min: 8, max: 12 } }] })) }],
  activePlanId: 'wp1',
})
const WORKOUT_PLANS_V2 = JSON.stringify({
  version: 2,
  plans: [{ id: 'wp1', name: 'Cinco dias', blocks: [{ id: 'b1', name: 'Bloco A', weeks: 1, rir: [null], days: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id, exercises: [] })) }], start: null }],
  activePlanId: 'wp1',
})

const WORKOUT_PLANS_V3 = JSON.stringify({
  version: 3,
  plans: [{ id: 'wp1', name: 'Força', split: 'ppf', blocks: [{ id: 'b1', name: 'Bloco A', weeks: 2, rir: [{ min: 4, max: 5 }, null], days: ['a', 'b', 'c'].map((id) => ({ id, name: id, exercises: [] })) }], start: null }],
  activePlanId: 'wp1',
})

describe('a stored document of an older version', () => {
  it('keeps the version 1 workout plans aside before the plans with a split are saved over them', () => {
    const storage = memoryStorage({ [STORES.workoutPlans.key]: WORKOUT_PLANS_V1 })
    saveStore(STORES.workoutPlans, loadStore(STORES.workoutPlans, storage), storage)
    expect(copies(storage.data, STORES.workoutPlans.key)).toEqual([WORKOUT_PLANS_V1])
    const saved = JSON.parse(storage.data[STORES.workoutPlans.key])
    expect(saved.version).toBe(4)
    expect(saved.plans[0].split).toBe('ppf')
    expect(saved.plans[0].blocks.map((b: { id: string; name: string; days: { id: string }[] }) => [b.id, b.name, b.days[0].id])).toEqual([['wp1-b1', 'Bloco A', 'wd1']])
  })

  it('keeps a version 2 plan that fits no split aside before the plans without it are saved over them', () => {
    const storage = memoryStorage({ [STORES.workoutPlans.key]: WORKOUT_PLANS_V2 })
    saveStore(STORES.workoutPlans, loadStore(STORES.workoutPlans, storage), storage)
    expect(copies(storage.data, STORES.workoutPlans.key)).toEqual([WORKOUT_PLANS_V2])
    expect(JSON.parse(storage.data[STORES.workoutPlans.key])).toEqual({ version: 4, plans: [], activePlanId: null })
  })

  it('keeps the version 3 plans aside before the blocks without their RIR per week are saved over them', () => {
    const storage = memoryStorage({ [STORES.workoutPlans.key]: WORKOUT_PLANS_V3 })
    saveStore(STORES.workoutPlans, loadStore(STORES.workoutPlans, storage), storage)
    expect(copies(storage.data, STORES.workoutPlans.key)).toEqual([WORKOUT_PLANS_V3])
    const saved = JSON.parse(storage.data[STORES.workoutPlans.key])
    expect([saved.version, saved.plans[0].blocks[0]]).toEqual([4, { id: 'b1', name: 'Bloco A', weeks: 2, light: false, days: ['a', 'b', 'c'].map((id) => ({ id, name: id, exercises: [] })) }])
  })

  it('keeps the version 1 sessions aside before the converted sessions are saved over them', () => {
    const storage = memoryStorage({ [STORES.workoutSessions.key]: SESSIONS_V1 })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    expect(copies(storage.data, STORES.workoutSessions.key)).toEqual([SESSIONS_V1])
    expect(JSON.parse(storage.data[STORES.workoutSessions.key]).version).toBe(4)
  })

  it('keeps one copy when this build starts again after converting', () => {
    const storage = memoryStorage({ [STORES.workoutSessions.key]: SESSIONS_V1 })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    expect(copies(storage.data, STORES.workoutSessions.key)).toEqual([SESSIONS_V1])
  })

  it('keeps both version 1 texts when an older device writes its sessions after this build converted them', () => {
    const storage = memoryStorage({ [STORES.workoutSessions.key]: SESSIONS_V1 })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    const olderDevice = JSON.stringify({ version: 1, sessions: [] })
    storage.data[STORES.workoutSessions.key] = olderDevice
    loadStore(STORES.workoutSessions, storage)
    expect(copies(storage.data, STORES.workoutSessions.key).sort()).toEqual([SESSIONS_V1, olderDevice].sort())
  })

  it('keeps nothing for a current document or a store with no older version', () => {
    const storage = memoryStorage({
      [STORES.workoutSessions.key]: JSON.stringify({ version: 4, sessions: [] }),
      [STORES.exercises.key]: '{"version":1,"exercises":[]}',
    })
    loadStore(STORES.workoutSessions, storage)
    loadStore(STORES.exercises, storage)
    expect(Object.keys(storage.data).sort()).toEqual([STORES.workoutSessions.key, STORES.exercises.key].sort())
  })
})
