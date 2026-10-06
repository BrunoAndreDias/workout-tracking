import { describe, expect, it } from 'vitest'
import { loadMoods, MOODS_STORAGE_KEY, saveMoods } from './bodyStorage.ts'
import { loadWorkoutSessions, saveWorkoutSessions, WORKOUT_SESSIONS_STORAGE_KEY } from './workoutStorage.ts'
import { loadUnits, UNITS_STORAGE_KEY } from './unitsStorage.ts'
import { loadState, saveState, STORAGE_KEY } from './persistence.ts'
import { DAYS_STORAGE_KEY, loadDays, saveDays } from './daysStorage.ts'
import { FOODS_STORAGE_KEY, loadCustomFoods, saveCustomFoods } from './customFoodsStorage.ts'
import { NUTRIENTS } from './types.ts'

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
const PLANS_V2 = JSON.stringify({
  version: 2,
  state: { plans: [{ id: 'p1', name: 'Plano', meals: [{ id: 'm1', name: 'Almoço', entries: [{ id: 'e1', foodId: '430', grams: 60 }] }] }], selectedId: 'p1' },
})
const DAYS_V1 = JSON.stringify({
  version: 1,
  days: [{ date: '2026-10-05', planId: null, meals: [{ id: 'm1', name: 'Almoço', entries: [{ id: 'e1', foodId: '430', grams: 60 }] }], baseline: [] }],
})
const FOODS_V1 = JSON.stringify({
  version: 1,
  foods: [
    {
      id: 'custom:bolo',
      name: 'Bolo da avó',
      basedOn: null,
      source: 'custom',
      basis: 'per100g',
      category: 'Os meus alimentos',
      per100: Object.fromEntries(NUTRIENTS.map(({ key }) => [key, key === 'energyKcal' ? 350 : null])),
    },
  ],
})

describe('a stored document of an older version', () => {
  it('keeps the version 2 plans aside before the converted plans are saved over them', () => {
    const storage = enumerableStorage({ [STORAGE_KEY]: PLANS_V2 })
    saveState(loadState(storage), storage)
    expect(copies(storage.data, STORAGE_KEY)).toEqual([PLANS_V2])
    const saved = JSON.parse(storage.data[STORAGE_KEY])
    expect(saved.version).toBe(3)
    expect(saved.state.plans[0].meals[0].options[0].entries).toEqual([{ id: 'e1', foodId: '430', grams: 60 }])
  })

  it('keeps the version 1 days aside before the converted days are saved over them', () => {
    const storage = enumerableStorage({ [DAYS_STORAGE_KEY]: DAYS_V1 })
    saveDays(loadDays(storage), storage)
    expect(copies(storage.data, DAYS_STORAGE_KEY)).toEqual([DAYS_V1])
    const saved = JSON.parse(storage.data[DAYS_STORAGE_KEY])
    expect(saved.version).toBe(2)
    expect(saved.days[0].meals[0].options[0].entries).toEqual([{ id: 'e1', foodId: '430', grams: 60 }])
  })

  it('keeps the version 1 custom foods aside before the converted foods are saved over them', () => {
    const storage = enumerableStorage({ [FOODS_STORAGE_KEY]: FOODS_V1 })
    saveCustomFoods(loadCustomFoods(storage), storage)
    expect(copies(storage.data, FOODS_STORAGE_KEY)).toEqual([FOODS_V1])
    const saved = JSON.parse(storage.data[FOODS_STORAGE_KEY])
    expect(saved.version).toBe(2)
    expect(saved.foods[0]).toMatchObject({ id: 'custom:bolo', name: 'Bolo da avó', basedOn: null, kind: 'label' })
    expect(saved.foods[0].per100.energyKcal).toBe(350)
  })

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
