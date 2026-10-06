import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { dbPath, openStores, storeHandler } from './storeApi.ts'

const PLANS = 'nutrition-tracking:plans'
const SLEEP = 'nutrition-tracking:sleep'

let close = () => {}
afterEach(() => {
  close()
  close = () => {}
})

/** A real HTTP server on a temp database; `clock.now` is the time each write sees. */
async function start({ allowReset = false } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'plano-store-')), 'plano.sqlite')
  const clock = { now: new Date(2026, 9, 6, 9, 0) }
  const stores = openStores(file, () => clock.now)
  const server = createServer(storeHandler(() => stores, { allowReset }))
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
  const snapshots = () => new DatabaseSync(file).prepare('SELECT day, key, doc FROM snapshots ORDER BY day').all()
  return { base, clock, put, get, snapshots }
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

describe('dbPath', () => {
  it('uses PLANO_DB, refuses the default under PLANO_TEST, else lives in the home directory', () => {
    expect(dbPath({ PLANO_DB: '/tmp/x.sqlite', PLANO_TEST: '1' })).toBe('/tmp/x.sqlite')
    expect(() => dbPath({ PLANO_TEST: '1' })).toThrow('PLANO_TEST=1 needs its own PLANO_DB')
    expect(dbPath({}).endsWith('/.plano-alimentar/plano.sqlite')).toBe(true)
  })
})
