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
    ['plans', STORES.plans.key, '{"version":99,"state":{"plans":[]}}', STORES.plans],
    ['foods', STORES.foods.key, '{"version":99,"foods":[]}', STORES.foods],
    ['units', STORES.units.key, '{"version":99,"units":[]}', STORES.units],
    ['days', STORES.days.key, '{"version":99,"days":[]}', STORES.days],
    ['plans, corrupt JSON', STORES.plans.key, '{nope', STORES.plans],
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

  it('a v99 plans document loads as a fresh state and its raw text survives', () => {
    const raw = JSON.stringify({ version: 99, state: { plans: [{ id: 'a' }] } })
    const storage = enumerableStorage({ [STORES.plans.key]: raw })
    expect(loadStore(STORES.plans, storage).plans.map((p) => p.name)).toEqual(['Plano 1'])
    expect(copies(storage.data, STORES.plans.key).map(([, v]) => v)).toEqual([raw])
  })

  it('preserves a different unreadable text separately', () => {
    const storage = enumerableStorage({ [STORES.units.key]: '{"version":98}' })
    loadStore(STORES.units, storage)
    storage.data[STORES.units.key] = '{"version":99}'
    loadStore(STORES.units, storage)
    expect(copies(storage.data, STORES.units.key).map(([, v]) => v).sort()).toEqual(['{"version":98}', '{"version":99}'])
  })

  it('preserves nothing for a missing or valid document', () => {
    const storage = enumerableStorage({ [STORES.units.key]: '{"version":1,"units":[]}' })
    loadStore(STORES.units, storage)
    loadStore(STORES.plans, storage)
    expect(Object.keys(storage.data)).toEqual([STORES.units.key])
  })
})
