import { describe, expect, it } from 'vitest'
import { loadMoods, MOODS_STORAGE_KEY, saveMoods } from './bodyStorage.ts'
import { loadWorkoutSessions, saveWorkoutSessions, WORKOUT_SESSIONS_STORAGE_KEY } from './workoutStorage.ts'
import { loadUnits, UNITS_STORAGE_KEY } from './unitsStorage.ts'

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

const copies = (data: Record<string, string>, key: string) =>
  Object.entries(data)
    .filter(([k]) => k.startsWith(`${key}:migrated:`))
    .map(([, v]) => v)

const PAINS_V1 = JSON.stringify({
  version: 1,
  pains: [{ id: 'p1', date: '2026-10-05', region: 'lowerBack', intensity: 5, time: '14:00', note: 'Depois do treino' }],
})
const SESSIONS_V1 = JSON.stringify({
  version: 1,
  sessions: [{ id: 's1', date: '2026-10-05', workoutDayId: null, exercises: [], notes: 'Bom treino' }],
})

describe('a stored document of an older version', () => {
  it('keeps the version 1 pains aside before the converted Mood Notes are saved over them', () => {
    const storage = enumerableStorage({ [MOODS_STORAGE_KEY]: PAINS_V1 })
    saveMoods(loadMoods(storage), storage)
    expect(copies(storage.data, MOODS_STORAGE_KEY)).toEqual([PAINS_V1])
    expect(JSON.parse(storage.data[MOODS_STORAGE_KEY]).version).toBe(2)
  })

  it('keeps the version 1 sessions aside before the converted sessions are saved over them', () => {
    const storage = enumerableStorage({ [WORKOUT_SESSIONS_STORAGE_KEY]: SESSIONS_V1 })
    saveWorkoutSessions(loadWorkoutSessions(storage), storage)
    expect(copies(storage.data, WORKOUT_SESSIONS_STORAGE_KEY)).toEqual([SESSIONS_V1])
    expect(JSON.parse(storage.data[WORKOUT_SESSIONS_STORAGE_KEY]).version).toBe(2)
  })

  it('keeps one copy when this build starts again after converting', () => {
    const storage = enumerableStorage({ [MOODS_STORAGE_KEY]: PAINS_V1 })
    saveMoods(loadMoods(storage), storage)
    saveMoods(loadMoods(storage), storage)
    expect(copies(storage.data, MOODS_STORAGE_KEY)).toEqual([PAINS_V1])
  })

  it('keeps both version 1 texts when an older device writes its pains after this build converted them', () => {
    const storage = enumerableStorage({ [MOODS_STORAGE_KEY]: PAINS_V1 })
    saveMoods(loadMoods(storage), storage)
    const olderDevice = JSON.stringify({ version: 1, pains: [] })
    storage.data[MOODS_STORAGE_KEY] = olderDevice
    loadMoods(storage)
    expect(copies(storage.data, MOODS_STORAGE_KEY).sort()).toEqual([PAINS_V1, olderDevice].sort())
  })

  it('keeps nothing for a current document or a store with no older version', () => {
    const storage = enumerableStorage({
      [MOODS_STORAGE_KEY]: JSON.stringify({ version: 2, moods: [] }),
      [UNITS_STORAGE_KEY]: '{"version":1,"units":[]}',
    })
    loadMoods(storage)
    loadUnits(storage)
    expect(Object.keys(storage.data).sort()).toEqual([MOODS_STORAGE_KEY, UNITS_STORAGE_KEY].sort())
  })
})
