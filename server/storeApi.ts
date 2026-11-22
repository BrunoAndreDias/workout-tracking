import { existsSync, mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { endCompressed } from './compress.ts'
import { toIsoDate } from '../src/domain/dates.ts'
import { isStoreKey, STORE_KEYS } from '../src/domain/storeKeys.ts'
import type { StoreKey } from '../src/domain/storeKeys.ts'

/** A store's document as the app wrote it, opaque here, and how many writes it has had. */
export interface Stored {
  readonly doc: string
  readonly rev: number
}

/** `current` is null when the store has never been written. */
export type PutResult = { readonly ok: true; readonly rev: number } | { readonly ok: false; readonly current: Stored | null }

export interface Stores {
  all(): Partial<Record<StoreKey, Stored>>
  get(key: StoreKey): Stored | null
  /** Writes when `baseRev` is the current rev (null for a store never written), or when `doc` is already the current doc. */
  put(key: StoreKey, doc: string, baseRev: number | null): PutResult
  /** Empties the database. Only the test server's API reaches it. */
  reset(): void
  close(): void
}

/**
 * The database the app keeps: `WORKOUT_DB`, else a file in the home directory, outside every checkout.
 */
export function dbPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.WORKOUT_DB) return env.WORKOUT_DB
  if (env.WORKOUT_TEST === '1') throw new Error('WORKOUT_TEST=1 needs its own WORKOUT_DB: tests never open the real database')
  return join(homedir(), '.workout-tracking', 'workout.sqlite')
}

/**
 * The file and its directory are created by the first write, never by a read, so a server pointed at a path that holds
 * nothing yet leaves nothing behind. Each write keeps, once per local day, the document as it was before that day's
 * first write, so a bad day can be undone from `snapshots`. `now` is injectable for tests.
 */
export function openStores(path: string, now: () => Date = () => new Date()): Stores {
  const open = () => {
    mkdirSync(dirname(path), { recursive: true })
    const db = new DatabaseSync(path)
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS stores (key TEXT PRIMARY KEY, doc TEXT NOT NULL, rev INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots (day TEXT NOT NULL, key TEXT NOT NULL, doc TEXT NOT NULL, PRIMARY KEY (day, key));
    `)
    return {
      db,
      selectAll: db.prepare('SELECT key, doc, rev FROM stores'),
      selectOne: db.prepare('SELECT doc, rev FROM stores WHERE key = ?'),
      snapshot: db.prepare('INSERT OR IGNORE INTO snapshots (day, key, doc) VALUES (?, ?, ?)'),
      upsert: db.prepare(
        'INSERT INTO stores (key, doc, rev, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET doc = excluded.doc, rev = excluded.rev, updated_at = excluded.updated_at',
      ),
    }
  }
  let opened: ReturnType<typeof open> | undefined
  const existing = () => opened ?? (existsSync(path) ? (opened = open()) : undefined)

  return {
    all() {
      const out: Partial<Record<StoreKey, Stored>> = {}
      for (const row of (existing()?.selectAll.all() ?? []) as { key: string; doc: string; rev: number }[]) {
        if (isStoreKey(row.key)) out[row.key] = { doc: row.doc, rev: row.rev }
      }
      return out
    },
    get(key) {
      return (existing()?.selectOne.get(key) as Stored | undefined) ?? null
    },
    put(key, doc, baseRev) {
      const { db, selectOne, snapshot, upsert } = (opened ??= open())
      db.exec('BEGIN IMMEDIATE')
      try {
        const current = (selectOne.get(key) as Stored | undefined) ?? null
        // A retry of a write whose answer was lost carries a stale rev but the same doc.
        if (current && current.doc === doc) {
          db.exec('COMMIT')
          return { ok: true, rev: current.rev }
        }
        if ((current?.rev ?? null) !== baseRev) {
          db.exec('COMMIT')
          return { ok: false, current }
        }
        const at = now()
        if (current) snapshot.run(toIsoDate(at), key, current.doc)
        const rev = (current?.rev ?? 0) + 1
        upsert.run(key, doc, rev, at.toISOString())
        db.exec('COMMIT')
        return { ok: true, rev }
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    reset() {
      existing()?.db.exec('DELETE FROM stores; DELETE FROM snapshots;')
    },
    close() {
      opened?.db.close()
    },
  }
}

const MAX_BODY_BYTES = 64 * 1024 * 1024

/**
 * `have` lists the client's copies as `key:rev,…`. A store still at that rev goes back as `{ rev }` alone, so a reopen
 * with nothing new downloads none of the year of stores it already holds.
 */
function unchangedWithoutDoc(all: Partial<Record<StoreKey, Stored>>, have: string | null): Record<string, Stored | { rev: number }> {
  const revs = new Map((have ?? '').split(',').map((pair) => [pair.slice(0, pair.lastIndexOf(':')), Number(pair.slice(pair.lastIndexOf(':') + 1))]))
  return Object.fromEntries(Object.entries(all).map(([key, stored]) => [key, revs.get(key) === stored.rev ? { rev: stored.rev } : stored]))
}

function send(res: ServerResponse, status: number, body: unknown) {
  endCompressed(res.req, res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** `{ doc, baseRev }` where `doc` is JSON text; null for anything else. */
function parsePut(text: string): { doc: string; baseRev: number | null } | null {
  try {
    const body: unknown = JSON.parse(text)
    if (typeof body !== 'object' || body === null) return null
    const { doc, baseRev } = body as Record<string, unknown>
    if (typeof doc !== 'string' || (baseRev !== null && !(typeof baseRev === 'number' && Number.isInteger(baseRev) && baseRev > 0))) return null
    JSON.parse(doc)
    return { doc, baseRev }
  } catch {
    return null
  }
}

/**
 * The store API, for any request under `/api/`:
 * `GET /api/stores` → `{ [key]: { doc, rev } }`; `GET /api/stores/:key` → `{ doc, rev }` (null and 0 for a store never
 * written); `PUT /api/stores/:key` with `{ doc, baseRev }` → `{ rev }`, or 409
 * `{ doc, rev }` (null and 0 for a store never written) when another device wrote first. `DELETE /api/stores` empties
 * the database only when `allowReset`, which only the test server sets.
 */
export function storeHandler(stores: () => Stores, { allowReset = false } = {}) {
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    if (path === '/api/stores') {
      if (req.method === 'GET') return send(res, 200, unchangedWithoutDoc(stores().all(), url.searchParams.get('have')))
      if (req.method === 'DELETE' && allowReset) {
        stores().reset()
        return send(res, 200, {})
      }
      return send(res, 405, { error: 'method not allowed' })
    }
    const match = /^\/api\/stores\/([^/]+)$/.exec(path)
    if (!match) return send(res, 404, { error: 'not found' })
    const key = decodeKey(match[1])
    if (key === null) return send(res, 400, { error: 'bad store key' })
    if (!isStoreKey(key)) return send(res, 404, { error: `unknown store ${key}`, stores: STORE_KEYS })
    if (req.method === 'GET') return send(res, 200, stores().get(key) ?? { doc: null, rev: 0 })
    if (req.method !== 'PUT') return send(res, 405, { error: 'method not allowed' })
    const text = await readBody(req)
    const body = text === null ? null : parsePut(text)
    if (!body) return send(res, 400, { error: 'expected { doc: <JSON text>, baseRev: <rev> | null }' })
    const result = stores().put(key, body.doc, body.baseRev)
    if (result.ok) return send(res, 200, { rev: result.rev })
    return send(res, 409, { doc: result.current?.doc ?? null, rev: result.current?.rev ?? 0 })
  }
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      await handle(req, res)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) send(res, 500, { error: 'internal' })
      else res.end()
    }
  }
}

function decodeKey(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}
