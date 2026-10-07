import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { dbPath, openStores, storeHandler } from './storeApi.ts'
import type { Stores } from './storeApi.ts'

const PLANS = 'nutrition-tracking:plans'
const SLEEP = 'nutrition-tracking:sleep'
const HEALTH = 'nutrition-tracking:health'

let close = () => {}
afterEach(() => {
  close()
  close = () => {}
})

/** A real HTTP server on a temp database; `clock.now` is the time each write sees. */
async function start({ allowReset = false, wrap = (stores: Stores) => stores, shortcut }: { allowReset?: boolean; wrap?: (stores: Stores) => Stores; shortcut?: (postUrl: string) => Promise<Buffer> } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'plano-store-')), 'plano.sqlite')
  const clock = { now: new Date(2026, 9, 6, 9, 0) }
  const stores = openStores(file, () => clock.now)
  const server = createServer(storeHandler(() => wrap(stores), { allowReset, shortcut }))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  close = () => {
    server.close()
    stores.close()
  }
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/stores`
  const put = async (key: string, doc: string, baseRev: number | null) => {
    const res = await fetch(`${base}/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ doc, baseRev }) })
    return { status: res.status, body: await res.json() }
  }
  const get = async () => (await fetch(base)).json()
  const postHealth = async (body: string) => {
    const res = await fetch(base.replace('/api/stores', '/api/health'), { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    return { status: res.status, body: await res.json() }
  }
  const snapshots = () => new DatabaseSync(file).prepare('SELECT day, key, doc FROM snapshots ORDER BY day').all()
  return { base, clock, put, get, postHealth, snapshots }
}

describe('store API', () => {
  it('starts empty', async () => {
    const api = await start()
    expect(await api.get()).toEqual({})
  })

  it('returns a written doc with rev 1, then rev 2 after a write on rev 1', async () => {
    const api = await start()
    expect(await api.put(PLANS, '{"version":3}', null)).toEqual({ status: 200, body: { rev: 1 } })
    expect(await api.get()).toEqual({ [PLANS]: { doc: '{"version":3}', rev: 1 } })
    expect(await api.put(PLANS, '{"version":3,"x":1}', 1)).toEqual({ status: 200, body: { rev: 2 } })
    expect(await api.get()).toEqual({ [PLANS]: { doc: '{"version":3,"x":1}', rev: 2 } })
  })

  it('returns one store by key, and null at rev 0 for one never written', async () => {
    const api = await start()
    await api.put(PLANS, '{"version":3}', null)
    const one = async (key: string) => (await fetch(`${api.base}/${encodeURIComponent(key)}`)).json()
    expect(await one(PLANS)).toEqual({ doc: '{"version":3}', rev: 1 })
    expect(await one(SLEEP)).toEqual({ doc: null, rev: 0 })
  })

  it('answers a stale rev with 409 and the current doc, and changes nothing', async () => {
    const api = await start()
    await api.put(SLEEP, '{"a":1}', null)
    await api.put(SLEEP, '{"a":2}', 1)
    expect(await api.put(SLEEP, '{"a":3}', 1)).toEqual({ status: 409, body: { doc: '{"a":2}', rev: 2 } })
    expect(await api.put(SLEEP, '{"a":3}', null)).toEqual({ status: 409, body: { doc: '{"a":2}', rev: 2 } })
    expect(await api.get()).toEqual({ [SLEEP]: { doc: '{"a":2}', rev: 2 } })
  })

  it('accepts a retried write of the current doc at its current rev', async () => {
    const api = await start()
    await api.put(SLEEP, '{"a":1}', null)
    expect(await api.put(SLEEP, '{"a":1}', null)).toEqual({ status: 200, body: { rev: 1 } })
  })

  it('answers 409 with no doc for a rev on a store never written', async () => {
    const api = await start()
    expect(await api.put(SLEEP, '{"a":1}', 4)).toEqual({ status: 409, body: { doc: null, rev: 0 } })
  })

  it('rejects an unknown key with 404 and a body that is not { doc: JSON text, baseRev } with 400', async () => {
    const api = await start()
    expect((await api.put('nutrition-tracking:theme', '"dark"', null)).status).toBe(404)
    expect((await api.put(PLANS, '{not json', null)).status).toBe(400)
    const raw = await fetch(`${api.base}/${encodeURIComponent(PLANS)}`, { method: 'PUT', body: '{"doc":{"version":3},"baseRev":null}' })
    expect(raw.status).toBe(400)
    expect(await api.get()).toEqual({})
  })

  it('keeps the doc as it was before the first write of each day, once', async () => {
    const api = await start()
    await api.put(PLANS, '"mon-1"', null)
    await api.put(PLANS, '"mon-2"', 1)
    await api.put(PLANS, '"mon-3"', 2)
    api.clock.now = new Date(2026, 9, 7, 0, 30)
    await api.put(PLANS, '"tue-1"', 3)
    await api.put(PLANS, '"tue-2"', 4)
    expect(api.snapshots()).toEqual([
      { day: '2026-10-06', key: PLANS, doc: '"mon-1"' },
      { day: '2026-10-07', key: PLANS, doc: '"mon-3"' },
    ])
  })

  it('empties the database through DELETE only on a server that allows reset', async () => {
    const real = await start()
    await real.put(PLANS, '{}', null)
    expect((await fetch(real.base, { method: 'DELETE' })).status).toBe(405)
    expect(await real.get()).toEqual({ [PLANS]: { doc: '{}', rev: 1 } })
    close()
    close = () => {}
    const test = await start({ allowReset: true })
    await test.put(PLANS, '{}', null)
    expect((await fetch(test.base, { method: 'DELETE' })).status).toBe(200)
    expect(await test.get()).toEqual({})
  })
})

describe('POST /api/health', () => {
  const SHORTCUT = JSON.stringify({
    samples: [
      { date: '2026-10-05', metric: 'steps', value: 8123 },
      { date: '2026-10-05', metric: 'standHours', value: 9 },
      { date: '2026-10-04', metric: 'restingHeartRate', value: 54 },
    ],
  })
  const MERGED =
    '{"version":1,"samples":[{"date":"2026-10-04","metric":"restingHeartRate","value":54},{"date":"2026-10-05","metric":"standHours","value":9},{"date":"2026-10-05","metric":"steps","value":8123}]}'

  it('creates the health store from the Shortcut text, as the browser would save it', async () => {
    const api = await start()
    expect(await api.postHealth(SHORTCUT)).toEqual({ status: 200, body: { count: 3, from: '2026-10-04', to: '2026-10-05' } })
    expect(await api.get()).toEqual({ [HEALTH]: { doc: MERGED, rev: 1 } })
  })

  it('changes nothing, not even the rev, when the same text comes again', async () => {
    const api = await start()
    await api.postHealth(SHORTCUT)
    expect(await api.postHealth(SHORTCUT)).toEqual({ status: 200, body: { count: 3, from: '2026-10-04', to: '2026-10-05' } })
    expect(await api.get()).toEqual({ [HEALTH]: { doc: MERGED, rev: 1 } })
  })

  it('replaces the value of a date and metric it sends again and keeps every other', async () => {
    const api = await start()
    await api.postHealth(SHORTCUT)
    expect(await api.postHealth('[{"date":"2026-10-05","metric":"steps","value":9001},{"date":"2026-10-06","metric":"sleepMinutes","value":452}]')).toEqual({
      status: 200,
      body: { count: 2, from: '2026-10-05', to: '2026-10-06' },
    })
    expect(await api.get()).toEqual({
      [HEALTH]: {
        doc: '{"version":1,"samples":[{"date":"2026-10-04","metric":"restingHeartRate","value":54},{"date":"2026-10-05","metric":"standHours","value":9},{"date":"2026-10-05","metric":"steps","value":9001},{"date":"2026-10-06","metric":"sleepMinutes","value":452}]}',
        rev: 2,
      },
    })
    expect(api.snapshots()).toEqual([{ day: '2026-10-06', key: HEALTH, doc: MERGED }])
  })

  it('rejects a bad row with the paste’s message and leaves the store as it was', async () => {
    const api = await start()
    await api.postHealth(SHORTCUT)
    expect(await api.postHealth('[{"date":"2026-10-06","metric":"steps","value":1},{"date":"2026-10-06","metric":"sittingHours","value":6}]')).toEqual({
      status: 400,
      body: { error: 'Valor n.º 2: a métrica "sittingHours" não existe. Não foi alterado nada.' },
    })
    expect(await api.postHealth('{not json')).toEqual({ status: 400, body: { error: 'O texto não é JSON válido. Não foi alterado nada.' } })
    expect(await api.get()).toEqual({ [HEALTH]: { doc: MERGED, rev: 1 } })
  })

  it('does not overwrite a stored health doc it cannot read', async () => {
    const api = await start()
    await api.put(HEALTH, '{"version":1,"samples":[{"date":"2026-10-05","metric":"steps","value":-1}]}', null)
    expect(await api.postHealth(SHORTCUT)).toEqual({
      status: 409,
      body: { error: 'Os valores do relógio guardados no servidor não se conseguem ler. Abre a app para os recuperar. Não foi alterado nada.' },
    })
    expect(await api.get()).toEqual({ [HEALTH]: { doc: '{"version":1,"samples":[{"date":"2026-10-05","metric":"steps","value":-1}]}', rev: 1 } })
  })

  it('merges into what another writer saved between its read and its write', async () => {
    const OTHER = '{"version":1,"samples":[{"date":"2026-10-03","metric":"steps","value":5000}]}'
    let raced = false
    const api = await start({
      wrap: (stores) => ({
        ...stores,
        get(key) {
          const seen = stores.get(key)
          if (!raced) {
            raced = true
            stores.put(HEALTH, OTHER, null)
          }
          return seen
        },
      }),
    })
    expect((await api.postHealth(SHORTCUT)).status).toBe(200)
    expect(await api.get()).toEqual({
      [HEALTH]: {
        doc: '{"version":1,"samples":[{"date":"2026-10-03","metric":"steps","value":5000},{"date":"2026-10-04","metric":"restingHeartRate","value":54},{"date":"2026-10-05","metric":"standHours","value":9},{"date":"2026-10-05","metric":"steps","value":8123}]}',
        rev: 2,
      },
    })
  })

  it('answers any other method with 405', async () => {
    const api = await start()
    expect((await fetch(api.base.replace('/api/stores', '/api/health'))).status).toBe(405)
    expect(await api.get()).toEqual({})
  })
})

describe('GET /api/health/shortcut', () => {
  const canSign = process.platform === 'darwin' && spawnSync('shortcuts', ['--help']).status === 0
  const shortcutUrl = (base: string, url: string) => `${base.replace('/api/stores', '/api/health/shortcut')}?url=${encodeURIComponent(url)}`

  it.each([
    ['a missing url', ''],
    ['another path', 'http://192.168.1.5:4173/api/stores'],
    ['a query after /api/health', 'http://192.168.1.5:4173/api/health?x=1'],
    ['another scheme', 'ftp://192.168.1.5/api/health'],
    ['text that is no address', 'api/health'],
  ])('refuses %s with 400 and signs nothing', async (_, url) => {
    const signed: string[] = []
    const api = await start({ shortcut: async (postUrl) => (signed.push(postUrl), Buffer.from('x')) })
    const res = await fetch(shortcutUrl(api.base, url))
    expect([res.status, await res.json(), signed]).toEqual([400, { error: 'url tem de ser um endereço http(s) que acaba em /api/health' }, []])
  })

  it('answers 503 with a message for the panel where the Shortcut cannot be signed', async () => {
    const api = await start({ shortcut: () => Promise.reject(new Error('spawn shortcuts ENOENT')) })
    const res = await fetch(shortcutUrl(api.base, 'http://192.168.1.5:4173/api/health'))
    expect([res.status, await res.json()]).toEqual([
      503,
      { error: 'Este servidor não consegue assinar o atalho: só um Mac com a app Atalhos o consegue. Usa o Colar manualmente.' },
    ])
  })

  it.runIf(canSign)('answers the signed Shortcut as a download on a Mac', async () => {
    const api = await start()
    const res = await fetch(shortcutUrl(api.base, 'https://mac.tail1234.ts.net/api/health'))
    const body = Buffer.from(await res.arrayBuffer())
    expect([res.status, res.headers.get('content-type'), res.headers.get('content-disposition'), body.subarray(0, 4).toString()]).toEqual([
      200,
      'application/octet-stream',
      'attachment; filename="Plano - Saude.shortcut"',
      'AEA1',
    ])
  }, 30_000)
})

describe('a database that does not exist yet', () => {
  it('is not created by a read, only by the first write', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'plano-store-')), 'fresh')
    const file = join(dir, 'plano.sqlite')
    const stores = openStores(file)
    const server = createServer(storeHandler(() => stores))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/stores`
    expect(await (await fetch(base)).json()).toEqual({})
    expect(existsSync(file)).toBe(false)
    expect(existsSync(dir)).toBe(false)
    const put = await fetch(`${base}/${encodeURIComponent(PLANS)}`, { method: 'PUT', body: JSON.stringify({ doc: '{"version":3}', baseRev: null }) })
    expect(await put.json()).toEqual({ rev: 1 })
    expect(existsSync(file)).toBe(true)
    expect(await (await fetch(base)).json()).toEqual({ [PLANS]: { doc: '{"version":3}', rev: 1 } })
    server.close()
    stores.close()
  })
})

describe('dbPath', () => {
  it('uses PLANO_DB, refuses the default under PLANO_TEST, else lives in the home directory', () => {
    expect(dbPath({ PLANO_DB: '/tmp/x.sqlite', PLANO_TEST: '1' })).toBe('/tmp/x.sqlite')
    expect(() => dbPath({ PLANO_TEST: '1' })).toThrow('PLANO_TEST=1 needs its own PLANO_DB')
    expect(dbPath({}).endsWith('/.plano-alimentar/plano.sqlite')).toBe(true)
  })
})
