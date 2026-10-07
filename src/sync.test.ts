import { describe, expect, it, vi } from 'vitest'
import { startSync } from './sync.ts'

const PLANS = 'nutrition-tracking:plans'
const SLEEP = 'nutrition-tracking:sleep'
const THEME = 'nutrition-tracking:theme'

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  }
}

/** The store API's rules over a map: a write needs the current rev, and `up: false` refuses every request. */
function fakeServer(initial: Record<string, { doc: string; rev: number }> = {}) {
  const stores = new Map(Object.entries(initial))
  const server = {
    stores,
    up: true,
    fetch: async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (!server.up) throw new TypeError('Failed to fetch')
      const path = String(url)
      if (!init?.method && path === '/api/stores') return Response.json(Object.fromEntries(stores))
      const key = decodeURIComponent(path.slice('/api/stores/'.length))
      if (!init?.method) return Response.json(stores.get(key) ?? { doc: null, rev: 0 })
      const { doc, baseRev } = JSON.parse(String(init.body)) as { doc: string; baseRev: number | null }
      const current = stores.get(key)
      if (current?.doc !== doc && (current?.rev ?? null) !== baseRev) return Response.json({ doc: current?.doc ?? null, rev: current?.rev ?? 0 }, { status: 409 })
      const rev = current?.doc === doc ? current.rev : (current?.rev ?? 0) + 1
      stores.set(key, { doc, rev })
      return Response.json({ rev })
    },
  }
  return server
}

describe('startSync', () => {
  it('replaces a local store with the server copy, which wins', async () => {
    const server = fakeServer({ [PLANS]: { doc: '{"v":"server"}', rev: 3 } })
    const storage = memoryStorage({ [PLANS]: '{"v":"local"}' })
    const sync = await startSync({ storage, fetch: server.fetch })
    expect(storage.data[PLANS]).toBe('{"v":"server"}')
    expect(server.stores.get(PLANS)).toEqual({ doc: '{"v":"server"}', rev: 3 })
    expect(sync.status()).toBe('ligado')
  })

  it('keeps a never-synced browser’s own copy aside, unsent, before taking the server’s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'))
    const server = fakeServer({ [PLANS]: { doc: '{"v":"server"}', rev: 3 }, [SLEEP]: { doc: '"same"', rev: 1 } })
    const storage = memoryStorage({ [PLANS]: '{"v":"local"}', [SLEEP]: '"same"' })
    await startSync({ storage, fetch: server.fetch })
    await startSync({ storage, fetch: server.fetch })
    vi.useRealTimers()
    const { 'nutrition-tracking:sync': _meta, ...docs } = storage.data
    expect(docs).toEqual({
      [PLANS]: '{"v":"server"}',
      [SLEEP]: '"same"',
      'nutrition-tracking:plans:unsynced:2026-10-06T08:00:00.000Z': '{"v":"local"}',
    })
    expect(Object.fromEntries(server.stores)).toEqual({ [PLANS]: { doc: '{"v":"server"}', rev: 3 }, [SLEEP]: { doc: '"same"', rev: 1 } })
  })

  it('keeps no copy when a synced browser takes another device’s newer copy', async () => {
    const server = fakeServer({ [PLANS]: { doc: '{"v":"one"}', rev: 1 } })
    const storage = memoryStorage()
    await startSync({ storage, fetch: server.fetch })
    server.stores.set(PLANS, { doc: '{"v":"two"}', rev: 2 })
    await startSync({ storage, fetch: server.fetch })
    const { 'nutrition-tracking:sync': _meta, ...docs } = storage.data
    expect(docs).toEqual({ [PLANS]: '{"v":"two"}' })
  })

  it('uploads a store only this browser has', async () => {
    const server = fakeServer()
    const storage = memoryStorage({ [SLEEP]: '{"version":1,"entries":[]}', [THEME]: 'dark' })
    await startSync({ storage, fetch: server.fetch })
    expect(Object.fromEntries(server.stores)).toEqual({ [SLEEP]: { doc: '{"version":1,"entries":[]}', rev: 1 } })
  })

  it('does not send the first write of a store neither side had, and sends the next one that changes it', async () => {
    const server = fakeServer()
    const sync = await startSync({ storage: memoryStorage(), fetch: server.fetch, debounceMs: 60_000 })
    sync.storage.setItem(PLANS, '{"name":"Plano 1"}')
    await sync.flush()
    expect(Object.fromEntries(server.stores)).toEqual({})
    sync.storage.setItem(PLANS, '{"name":"Plano do Bruno"}')
    await sync.flush()
    expect(Object.fromEntries(server.stores)).toEqual({ [PLANS]: { doc: '{"name":"Plano do Bruno"}', rev: 1 } })
  })

  it('does not upload an untouched default at a later start either', async () => {
    const server = fakeServer()
    const storage = memoryStorage()
    const first = await startSync({ storage, fetch: server.fetch, debounceMs: 60_000 })
    first.storage.setItem(PLANS, '{"name":"Plano 1"}')
    await first.flush()
    await startSync({ storage, fetch: server.fetch })
    expect(Object.fromEntries(server.stores)).toEqual({})
    server.stores.set(PLANS, { doc: '{"name":"Plano do Bruno"}', rev: 4 })
    await startSync({ storage, fetch: server.fetch })
    expect(storage.data[PLANS]).toBe('{"name":"Plano do Bruno"}')
  })

  it('starts offline and keeps the local copy when the server does not answer', async () => {
    const server = fakeServer({ [PLANS]: { doc: '{"v":"server"}', rev: 3 } })
    server.up = false
    const storage = memoryStorage({ [PLANS]: '{"v":"local"}' })
    const sync = await startSync({ storage, fetch: server.fetch })
    expect(sync.status()).toBe('offline')
    expect(storage.data[PLANS]).toBe('{"v":"local"}')
  })

  it('sends each change to a store, and never a device-local key', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    const sync = await startSync({ storage: memoryStorage(), fetch: server.fetch, debounceMs: 60_000 })
    sync.storage.setItem(SLEEP, '"b"')
    sync.storage.setItem(THEME, 'dark')
    await sync.flush()
    expect(Object.fromEntries(server.stores)).toEqual({ [SLEEP]: { doc: '"b"', rev: 2 } })
  })

  it('keeps a change made offline and sends it, not the server copy, at the next start', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    const storage = memoryStorage()
    const first = await startSync({ storage, fetch: server.fetch, debounceMs: 60_000 })
    server.up = false
    first.storage.setItem(SLEEP, '"offline edit"')
    await first.flush()
    expect(first.status()).toBe('offline')
    server.up = true
    const second = await startSync({ storage, fetch: server.fetch })
    expect(storage.data[SLEEP]).toBe('"offline edit"')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"offline edit"', rev: 2 })
    expect(second.status()).toBe('ligado')
  })

  it('stops at a conflict, and after dropConflicts the next start takes the other device’s copy', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch, debounceMs: 60_000 })
    server.stores.set(SLEEP, { doc: '"other device"', rev: 2 })
    sync.storage.setItem(SLEEP, '"here"')
    await sync.flush()
    expect(sync.status()).toBe('conflito')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"other device"', rev: 2 })
    sync.dropConflicts()
    await startSync({ storage, fetch: server.fetch })
    expect(storage.data[SLEEP]).toBe('"other device"')
  })
})

describe('refresh', () => {
  const HEALTH = 'nutrition-tracking:health'

  it('takes another writer’s newer copy of the stores it is given and of no other', async () => {
    const server = fakeServer({ [HEALTH]: { doc: '"h1"', rev: 1 }, [SLEEP]: { doc: '"s1"', rev: 1 } })
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch })
    server.stores.set(HEALTH, { doc: '"h2"', rev: 2 })
    server.stores.set(SLEEP, { doc: '"s2"', rev: 2 })
    expect(await sync.refresh([HEALTH])).toEqual([HEALTH])
    expect(storage.data[HEALTH]).toBe('"h2"')
    expect(storage.data[SLEEP]).toBe('"s1"')
    expect(await sync.refresh([HEALTH])).toEqual([])
  })

  it('takes a store this browser did not have yet, and a later change here is sent on its rev', async () => {
    const server = fakeServer()
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch, debounceMs: 60_000 })
    server.stores.set(HEALTH, { doc: '"h1"', rev: 1 })
    expect(await sync.refresh([HEALTH])).toEqual([HEALTH])
    sync.storage.setItem(HEALTH, '"h1 edited"')
    await sync.flush()
    expect(server.stores.get(HEALTH)).toEqual({ doc: '"h1 edited"', rev: 2 })
    expect(sync.status()).toBe('ligado')
  })

  it('keeps a change made here and not yet sent, which then conflicts as before', async () => {
    const server = fakeServer({ [HEALTH]: { doc: '"h1"', rev: 1 } })
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch, debounceMs: 60_000 })
    sync.storage.setItem(HEALTH, '"here"')
    server.stores.set(HEALTH, { doc: '"h2"', rev: 2 })
    expect(await sync.refresh([HEALTH])).toEqual([])
    expect(storage.data[HEALTH]).toBe('"here"')
    await sync.flush()
    expect(sync.status()).toBe('conflito')
    expect(await sync.refresh([HEALTH])).toEqual([])
    expect(storage.data[HEALTH]).toBe('"here"')
  })

  it('keeps a change made here while its request was in flight', async () => {
    const server = fakeServer({ [HEALTH]: { doc: '"h1"', rev: 1 } })
    let release = () => {}
    let gated = false
    const fetch: typeof server.fetch = async (url, init) => {
      if (gated && !init?.method) await new Promise<void>((resolve) => (release = resolve))
      return server.fetch(url, init)
    }
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch, debounceMs: 60_000 })
    server.stores.set(HEALTH, { doc: '"h2"', rev: 2 })
    gated = true
    const refreshed = sync.refresh([HEALTH])
    await new Promise((resolve) => setTimeout(resolve, 0))
    sync.storage.setItem(HEALTH, '"typed meanwhile"')
    release()
    expect(await refreshed).toEqual([])
    expect(storage.data[HEALTH]).toBe('"typed meanwhile"')
  })

  it('does not go back to an older copy than the one this browser last sent', async () => {
    const server = fakeServer({ [HEALTH]: { doc: '"h1"', rev: 1 } })
    let stale: Response | null = null
    const fetch: typeof server.fetch = async (url, init) => (!init?.method && stale ? stale.clone() : server.fetch(url, init))
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch, debounceMs: 60_000 })
    stale = await server.fetch(`/api/stores/${encodeURIComponent(HEALTH)}`)
    sync.storage.setItem(HEALTH, '"h2 here"')
    await sync.flush()
    expect(await sync.refresh([HEALTH])).toEqual([])
    expect(storage.data[HEALTH]).toBe('"h2 here"')
  })

  it('changes nothing when the server does not answer', async () => {
    const server = fakeServer({ [HEALTH]: { doc: '"h1"', rev: 1 } })
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch })
    server.stores.set(HEALTH, { doc: '"h2"', rev: 2 })
    server.up = false
    expect(await sync.refresh([HEALTH])).toEqual([])
    expect(storage.data[HEALTH]).toBe('"h1"')
  })
})
