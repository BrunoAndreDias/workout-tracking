import { describe, expect, it } from 'vitest'
import { NUTRIENTS } from './types.ts'
import { loadStore, saveStore, STORES } from './stores.ts'

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
    const storage = enumerableStorage({ [STORES.plans.key]: PLANS_V2 })
    saveStore(STORES.plans, loadStore(STORES.plans, storage), storage)
    expect(copies(storage.data, STORES.plans.key)).toEqual([PLANS_V2])
    const saved = JSON.parse(storage.data[STORES.plans.key])
    expect(saved.version).toBe(3)
    expect(saved.state.plans[0].meals[0].options[0].entries).toEqual([{ id: 'e1', foodId: '430', grams: 60 }])
  })

  it('keeps the version 1 days aside before the converted days are saved over them', () => {
    const storage = enumerableStorage({ [STORES.days.key]: DAYS_V1 })
    saveStore(STORES.days, loadStore(STORES.days, storage), storage)
    expect(copies(storage.data, STORES.days.key)).toEqual([DAYS_V1])
    const saved = JSON.parse(storage.data[STORES.days.key])
    expect(saved.version).toBe(3)
    expect(saved.days[0].meals[0].options[0].entries).toEqual([{ id: 'e1', foodId: '430', grams: 60 }])
  })

  it('keeps the version 1 custom foods aside before the converted foods are saved over them', () => {
    const storage = enumerableStorage({ [STORES.foods.key]: FOODS_V1 })
    saveStore(STORES.foods, loadStore(STORES.foods, storage), storage)
    expect(copies(storage.data, STORES.foods.key)).toEqual([FOODS_V1])
    const saved = JSON.parse(storage.data[STORES.foods.key])
    expect(saved.version).toBe(2)
    expect(saved.foods[0]).toMatchObject({ id: 'custom:bolo', name: 'Bolo da avó', basedOn: null, kind: 'label' })
    expect(saved.foods[0].per100.energyKcal).toBe(350)
  })

  it('keeps the version 1 pains aside before the converted Mood Notes are saved over them', () => {
    const storage = enumerableStorage({ [STORES.moods.key]: PAINS_V1 })
    saveStore(STORES.moods, loadStore(STORES.moods, storage), storage)
    expect(copies(storage.data, STORES.moods.key)).toEqual([PAINS_V1])
    expect(JSON.parse(storage.data[STORES.moods.key]).version).toBe(2)
  })

  it('keeps the version 1 sessions aside before the converted sessions are saved over them', () => {
    const storage = enumerableStorage({ [STORES.workoutSessions.key]: SESSIONS_V1 })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    expect(copies(storage.data, STORES.workoutSessions.key)).toEqual([SESSIONS_V1])
    expect(JSON.parse(storage.data[STORES.workoutSessions.key]).version).toBe(2)
  })

  it('keeps one copy when this build starts again after converting', () => {
    const storage = enumerableStorage({ [STORES.moods.key]: PAINS_V1 })
    saveStore(STORES.moods, loadStore(STORES.moods, storage), storage)
    saveStore(STORES.moods, loadStore(STORES.moods, storage), storage)
    expect(copies(storage.data, STORES.moods.key)).toEqual([PAINS_V1])
  })

  it('keeps both version 1 texts when an older device writes its pains after this build converted them', () => {
    const storage = enumerableStorage({ [STORES.moods.key]: PAINS_V1 })
    saveStore(STORES.moods, loadStore(STORES.moods, storage), storage)
    const olderDevice = JSON.stringify({ version: 1, pains: [] })
    storage.data[STORES.moods.key] = olderDevice
    loadStore(STORES.moods, storage)
    expect(copies(storage.data, STORES.moods.key).sort()).toEqual([PAINS_V1, olderDevice].sort())
  })

  it('keeps nothing for a current document or a store with no older version', () => {
    const storage = enumerableStorage({
      [STORES.moods.key]: JSON.stringify({ version: 2, moods: [] }),
      [STORES.units.key]: '{"version":1,"units":[]}',
    })
    loadStore(STORES.moods, storage)
    loadStore(STORES.units, storage)
    expect(Object.keys(storage.data).sort()).toEqual([STORES.moods.key, STORES.units.key].sort())
  })
})
