import { describe, expect, it } from 'vitest'
import { loadCustomFoods, FOODS_STORAGE_KEY } from './customFoodsStorage.ts'
import { DAYS_STORAGE_KEY, loadDays } from './daysStorage.ts'
import { loadState, STORAGE_KEY } from './persistence.ts'
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

const copies = (data: Record<string, string>, key: string) => Object.entries(data).filter(([k]) => k.startsWith(`${key}:unreadable:`))

describe('an unreadable stored document', () => {
  it.each([
    ['plans', STORAGE_KEY, '{"version":99,"state":{"plans":[]}}', loadState],
    ['foods', FOODS_STORAGE_KEY, '{"version":99,"foods":[]}', loadCustomFoods],
    ['units', UNITS_STORAGE_KEY, '{"version":99,"units":[]}', loadUnits],
    ['days', DAYS_STORAGE_KEY, '{"version":99,"days":[]}', loadDays],
    ['plans, corrupt JSON', STORAGE_KEY, '{nope', loadState],
  ])('is preserved under an unreadable key for %s, once across reloads', (_label, key, raw, load) => {
    const storage = enumerableStorage({ [key]: raw })
    load(storage)
    const [[copyKey, copy]] = copies(storage.data, key)
    expect(copy).toBe(raw)
    expect(copyKey).toMatch(/^.+:unreadable:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    load(storage)
    expect(copies(storage.data, key)).toHaveLength(1)
    expect(storage.data[key]).toBe(raw)
  })

  it('a v99 plans document loads as a fresh state and its raw text survives', () => {
    const raw = JSON.stringify({ version: 99, state: { plans: [{ id: 'a' }] } })
    const storage = enumerableStorage({ [STORAGE_KEY]: raw })
    expect(loadState(storage).plans.map((p) => p.name)).toEqual(['Plano 1'])
    expect(copies(storage.data, STORAGE_KEY).map(([, v]) => v)).toEqual([raw])
  })

  it('preserves a different unreadable text separately', () => {
    const storage = enumerableStorage({ [UNITS_STORAGE_KEY]: '{"version":98}' })
    loadUnits(storage)
    storage.data[UNITS_STORAGE_KEY] = '{"version":99}'
    loadUnits(storage)
    expect(copies(storage.data, UNITS_STORAGE_KEY).map(([, v]) => v).sort()).toEqual(['{"version":98}', '{"version":99}'])
  })

  it('preserves nothing for a missing or valid document', () => {
    const storage = enumerableStorage({ [UNITS_STORAGE_KEY]: '{"version":1,"units":[]}' })
    loadUnits(storage)
    loadState(storage)
    expect(Object.keys(storage.data)).toEqual([UNITS_STORAGE_KEY])
  })
})
