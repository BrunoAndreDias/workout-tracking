import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startSync } from './sync.ts'

const PLANS = 'workout-tracking:workout-plans'
const SLEEP = 'workout-tracking:exercises'
const THEME = 'workout-tracking:theme'

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
    pulls: [] as string[],
    up: true,
    fetch: async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (!server.up) throw new TypeError('Failed to fetch')
      const [path, query] = String(url).split('?')
      server.pulls.push(String(url))
      if (!init?.method && path === '/api/stores') {
        const have = new URLSearchParams(query).get('have')?.split(',') ?? []
        return Response.json(Object.fromEntries([...stores].map(([key, s]) => [key, have.includes(`${key}:${s.rev}`) ? { rev: s.rev } : s])))
      }
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

const hang = (_url: string | URL | Request, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))

const revs = (storage: { data: Record<string, string> }) => JSON.parse(storage.data['workout-tracking:sync']).revs

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

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
    vi.setSystemTime(new Date('2026-10-06T08:00:00.000Z'))
    const server = fakeServer({ [PLANS]: { doc: '{"v":"server"}', rev: 3 }, [SLEEP]: { doc: '"same"', rev: 1 } })
    const storage = memoryStorage({ [PLANS]: '{"v":"local"}', [SLEEP]: '"same"' })
    await startSync({ storage, fetch: server.fetch })
    await startSync({ storage, fetch: server.fetch })
    const { 'workout-tracking:sync': _meta, ...docs } = storage.data
    expect(docs).toEqual({
      [PLANS]: '{"v":"server"}',
      [SLEEP]: '"same"',
      'workout-tracking:workout-plans:unsynced:2026-10-06T08:00:00.000Z': '{"v":"local"}',
    })
    expect(Object.fromEntries(server.stores)).toEqual({ [PLANS]: { doc: '{"v":"server"}', rev: 3 }, [SLEEP]: { doc: '"same"', rev: 1 } })
  })

  it('keeps no copy when a synced browser takes another device’s newer copy', async () => {
    const server = fakeServer({ [PLANS]: { doc: '{"v":"one"}', rev: 1 } })
    const storage = memoryStorage()
    await startSync({ storage, fetch: server.fetch })
    server.stores.set(PLANS, { doc: '{"v":"two"}', rev: 2 })
    await startSync({ storage, fetch: server.fetch })
    const { 'workout-tracking:sync': _meta, ...docs } = storage.data
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
  it('downloads only the stores that changed since this browser last had them', async () => {
    const server = fakeServer({ [PLANS]: { doc: '{"v":"one"}', rev: 1 }, [SLEEP]: { doc: '{"s":1}', rev: 1 } })
    const storage = memoryStorage()
    await startSync({ storage, fetch: server.fetch })
    server.stores.set(SLEEP, { doc: '{"s":2}', rev: 2 })
    server.pulls.length = 0
    await startSync({ storage, fetch: server.fetch })
    const body = await (await server.fetch(server.pulls[0])).json()
    expect(body).toEqual({ [PLANS]: { rev: 1 }, [SLEEP]: { doc: '{"s":2}', rev: 2 } })
    expect(storage.data[PLANS]).toBe('{"v":"one"}')
    expect(storage.data[SLEEP]).toBe('{"s":2}')
  })

  it('goes offline on a 200 answer that is not JSON, and still starts and sends later', async () => {
    const server = fakeServer()
    let broken = true
    const request = (url: string | URL | Request, init?: RequestInit) => (broken && init?.method === 'PUT' ? Promise.resolve(new Response('<html>', { status: 200 })) : server.fetch(url, init))
    const storage = memoryStorage({ [SLEEP]: '"local"' })
    const sync = await startSync({ storage, fetch: request, debounceMs: 60_000 })
    expect(sync.status()).toBe('offline')
    await sync.flush()
    expect(sync.status()).toBe('offline')
    broken = false
    await sync.flush()
    expect(sync.status()).toBe('ligado')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"local"', rev: 1 })
  })

  it('goes offline on a 200 answer without a valid rev, and keeps the last good rev', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    let answer: unknown = { rev: -1 }
    const request = (url: string | URL | Request, init?: RequestInit) => (answer !== undefined && init?.method === 'PUT' ? Promise.resolve(Response.json(answer)) : server.fetch(url, init))
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: request, debounceMs: 60_000 })
    sync.storage.setItem(SLEEP, '"b"')
    for (const bad of [{ rev: -1 }, { rev: 1.5 }, { rev: '2' }, {}, null]) {
      answer = bad
      await sync.flush()
      expect(sync.status()).toBe('offline')
      expect(revs(storage)).toEqual({ [SLEEP]: 1 })
    }
    answer = undefined
    await sync.flush()
    expect(sync.status()).toBe('ligado')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"b"', rev: 2 })
  })

  it('goes offline when a request never answers, after its timeout', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    const stuck = await startSync({ storage: memoryStorage(), fetch: hang, pullTimeoutMs: 20 })
    expect(stuck.status()).toBe('offline')
    let hanging = false
    const request = (url: string | URL | Request, init?: RequestInit) => (hanging ? hang(url, init) : server.fetch(url, init))
    const sync = await startSync({ storage: memoryStorage(), fetch: request, debounceMs: 60_000, pushTimeoutMs: 20 })
    hanging = true
    sync.storage.setItem(SLEEP, '"b"')
    await sync.flush()
    expect(sync.status()).toBe('offline')
  })

  it('retries while offline, sends the waiting change once the server answers, and stops retrying', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    const sync = await startSync({ storage: memoryStorage(), fetch: server.fetch, debounceMs: 10, retryMs: 1000 })
    server.up = false
    sync.storage.setItem(SLEEP, '"b"')
    await vi.advanceTimersByTimeAsync(10)
    expect(sync.status()).toBe('offline')
    await vi.advanceTimersByTimeAsync(1000)
    expect(sync.status()).toBe('offline')
    server.up = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(sync.status()).toBe('ligado')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"b"', rev: 2 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('after a failed start, retries until the server answers, then says ligado', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    server.up = false
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: server.fetch, retryMs: 1000 })
    expect(sync.status()).toBe('offline')
    const seen: string[] = []
    sync.subscribe(() => seen.push(sync.status()))
    server.up = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(seen).toEqual(['ligado'])
    expect(storage.data[SLEEP]).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([400, 404])('says recusado on a %i to a change and never sends that store again until the next start', async (code) => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 }, [PLANS]: { doc: '"p"', rev: 1 } })
    const puts: string[] = []
    const request = (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'PUT') return server.fetch(url, init)
      puts.push(String(url))
      return String(url).endsWith(encodeURIComponent(SLEEP)) ? Promise.resolve(Response.json({ error: 'no' }, { status: code })) : server.fetch(url, init)
    }
    const storage = memoryStorage()
    const sync = await startSync({ storage, fetch: request, debounceMs: 10, retryMs: 1000 })
    sync.storage.setItem(SLEEP, '"b"')
    await vi.advanceTimersByTimeAsync(10)
    expect(sync.status()).toBe('recusado')
    expect(puts).toHaveLength(1)
    sync.storage.setItem(SLEEP, '"c"')
    await vi.advanceTimersByTimeAsync(5000)
    await sync.flush()
    expect(puts).toHaveLength(1)
    expect(JSON.parse(storage.data['workout-tracking:sync']).pending).toEqual([SLEEP])
    sync.storage.setItem(PLANS, '"q"')
    await vi.advanceTimersByTimeAsync(10)
    expect(server.stores.get(PLANS)).toEqual({ doc: '"q"', rev: 2 })
    expect(sync.status()).toBe('recusado')
    server.up = false
    sync.storage.setItem(PLANS, '"r"')
    await vi.advanceTimersByTimeAsync(10)
    expect(sync.status()).toBe('recusado')
    expect(vi.getTimerCount()).toBe(0)
    server.up = true
    const again = await startSync({ storage, fetch: request })
    expect(puts.filter((url) => url.endsWith(encodeURIComponent(SLEEP)))).toHaveLength(2)
    expect(again.status()).toBe('recusado')
  })

  it('goes offline on a 503 and retries until the server takes the change', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 } })
    let failing = true
    const request = (url: string | URL | Request, init?: RequestInit) => (failing && init?.method === 'PUT' ? Promise.resolve(new Response('busy', { status: 503 })) : server.fetch(url, init))
    const sync = await startSync({ storage: memoryStorage(), fetch: request, debounceMs: 10, retryMs: 1000 })
    sync.storage.setItem(SLEEP, '"b"')
    await vi.advanceTimersByTimeAsync(10)
    expect(sync.status()).toBe('offline')
    failing = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(sync.status()).toBe('ligado')
    expect(server.stores.get(SLEEP)).toEqual({ doc: '"b"', rev: 2 })
  })

  it('shows a conflict over a refused change, and either over offline', async () => {
    const server = fakeServer({ [SLEEP]: { doc: '"a"', rev: 1 }, [PLANS]: { doc: '"p"', rev: 1 } })
    const request = (url: string | URL | Request, init?: RequestInit) =>
      init?.method === 'PUT' && String(url).endsWith(encodeURIComponent(PLANS)) ? Promise.resolve(new Response(null, { status: 413 })) : server.fetch(url, init)
    const sync = await startSync({ storage: memoryStorage(), fetch: request, debounceMs: 60_000 })
    sync.storage.setItem(PLANS, '"q"')
    await sync.flush()
    expect(sync.status()).toBe('recusado')
    server.stores.set(SLEEP, { doc: '"other device"', rev: 2 })
    sync.storage.setItem(SLEEP, '"here"')
    await sync.flush()
    expect(sync.status()).toBe('conflito')
  })
})
