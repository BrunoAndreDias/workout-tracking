import { preserveCopy } from './domain/persistence.ts'
import type { BrowserStorage } from './domain/persistence.ts'
import { isStoreKey, STORE_KEYS } from './domain/storeKeys.ts'
import type { StoreKey } from './domain/storeKeys.ts'
import { parsePutReply, parseStoreList } from './domain/storeProtocol.ts'
import type { PutBody, Stored, StoreList } from './domain/storeProtocol.ts'

/**
 * `ligado`: every change made here has reached the server or is on its way. `offline`: the server did not answer, and
 * changes wait in this browser. `conflito`: another device wrote a store this browser also changed, so this browser
 * stops sending it until the user reloads the server's copy. Only a reload leaves `conflito`.
 */
export type SyncStatus = 'ligado' | 'offline' | 'conflito'

/**
 * Device-local bookkeeping: the server rev each store was last in step with, the stores changed here since, and the
 * stores whose local copy is only the app's default, which no side had before and the user has not changed yet.
 */
interface SyncMeta {
  revs: Partial<Record<StoreKey, number>>
  pending: StoreKey[]
  fresh: StoreKey[]
}

const SYNC_META_KEY = 'workout-tracking:sync'

export interface Sync {
  /** localStorage, plus: each change to a store is sent to the server shortly after. */
  readonly storage: BrowserStorage
  readonly status: () => SyncStatus
  readonly subscribe: (listener: () => void) => () => void
  /** Sends every changed store now, or while offline with none to send asks the server whether it answers again. */
  readonly flush: () => Promise<void>
  /** Forgets this browser's changes to the conflicting stores, so the next start takes the server's copies. */
  readonly dropConflicts: () => void
}

export interface SyncOptions {
  readonly storage: BrowserStorage
  readonly fetch?: typeof fetch
  readonly base?: string
  readonly debounceMs?: number
  readonly retryMs?: number
  readonly pullTimeoutMs?: number
  readonly pushTimeoutMs?: number
}

type Answer<T> = { kind: 'ok'; body: T } | { kind: 'conflict' } | { kind: 'offline' }

async function requestJson<T>(request: typeof fetch, url: string, init: RequestInit, check: (body: unknown) => T | null, timeoutMs: number): Promise<Answer<T>> {
  try {
    const res = await request(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    if (res.status === 409) return { kind: 'conflict' }
    const body = res.ok ? check(await res.json()) : null
    return body === null ? { kind: 'offline' } : { kind: 'ok', body }
  } catch {
    return { kind: 'offline' }
  }
}

function readMeta(storage: BrowserStorage): SyncMeta {
  try {
    const raw: unknown = JSON.parse(storage.getItem(SYNC_META_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return { revs: {}, pending: [], fresh: [] }
    const { revs, pending, fresh } = raw as Record<string, unknown>
    const keys = (list: unknown) => (Array.isArray(list) ? list.filter(isStoreKey) : [])
    const meta: SyncMeta = { revs: {}, pending: keys(pending), fresh: keys(fresh) }
    if (typeof revs === 'object' && revs !== null) {
      for (const [key, rev] of Object.entries(revs)) if (isStoreKey(key) && Number.isInteger(rev)) meta.revs[key] = rev as number
    }
    return meta
  } catch {
    return { revs: {}, pending: [], fresh: [] }
  }
}

/**
 * Brings localStorage in step with the server before the app reads it: a store changed here and not yet sent is sent
 * (it may conflict), any other store the server has replaces the local one (a local one this browser never synced is
 * first kept under `<key>:unsynced:<ISO time>`), and a store only this browser has is
 * uploaded, which is how data from before the server arrives there. With no server it changes nothing and starts
 * `offline`, and while `offline` it tries again every `retryMs` until the server answers. Then every change to a store
 * through `storage` is sent after `debounceMs`, except the first write of a store this browser did not have: that is
 * the app saving its default, and uploading it could replace another browser's real data. Such a store is sent once a
 * later write changes it.
 */
export async function startSync({ storage, fetch: request = globalThis.fetch, base = '/api/stores', debounceMs = 300, retryMs = 15_000, pullTimeoutMs = 4000, pushTimeoutMs = 20_000 }: SyncOptions): Promise<Sync> {
  const meta = readMeta(storage)
  const conflicts = new Set<StoreKey>()
  const listeners = new Set<() => void>()
  let status: SyncStatus = 'ligado'
  let retry: ReturnType<typeof setTimeout> | undefined

  const saveMeta = () => {
    try {
      storage.setItem(SYNC_META_KEY, JSON.stringify(meta))
    } catch {
      // a full storage loses only the bookkeeping: the next start pulls or re-sends
    }
  }
  const setStatus = (next: SyncStatus) => {
    if (status === 'conflito') return
    clearTimeout(retry)
    if (next === 'offline') retry = setTimeout(() => void flush(), retryMs)
    if (status === next) return
    status = next
    for (const listener of listeners) listener()
  }
  const unpend = (key: StoreKey) => {
    meta.pending = meta.pending.filter((k) => k !== key)
  }

  async function push(key: StoreKey): Promise<'sent' | 'offline' | 'conflict'> {
    const doc = storage.getItem(key)
    if (doc === null) {
      unpend(key)
      return 'sent'
    }
    const init = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doc, baseRev: meta.revs[key] ?? null } satisfies PutBody) }
    const answer = await requestJson(request, `${base}/${encodeURIComponent(key)}`, init, parsePutReply, pushTimeoutMs)
    if (answer.kind === 'conflict') conflicts.add(key)
    if (answer.kind !== 'ok') return answer.kind
    meta.revs[key] = answer.body.rev
    if (storage.getItem(key) === doc) unpend(key)
    return 'sent'
  }

  async function pushPending() {
    const keys = meta.pending.filter((k) => !conflicts.has(k))
    if (keys.length === 0) {
      if (status === 'offline') setStatus((await fetchRemote()) ? 'ligado' : 'offline')
      return
    }
    const outcomes = []
    for (const key of keys) outcomes.push(await push(key))
    saveMeta()
    setStatus(outcomes.includes('conflict') ? 'conflito' : outcomes.includes('offline') ? 'offline' : 'ligado')
  }

  let queue = Promise.resolve()
  const flush = () => (queue = queue.then(pushPending).catch(() => setStatus('offline')))
  let timer: ReturnType<typeof setTimeout> | undefined
  const markPending = (key: StoreKey) => {
    if (!meta.pending.includes(key)) {
      meta.pending = [...meta.pending, key]
      saveMeta()
    }
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  }

  async function fetchRemote(): Promise<StoreList | null> {
    const held = STORE_KEYS.filter((key) => meta.revs[key] !== undefined && storage.getItem(key) !== null)
    const url = held.length === 0 ? base : `${base}?have=${encodeURIComponent(held.map((key) => `${key}:${meta.revs[key]}`).join(','))}`
    const answer = await requestJson(request, url, {}, (body) => parseStoreList(body, (key, rev) => (meta.revs[key] === rev ? storage.getItem(key) : null)), pullTimeoutMs)
    return answer.kind === 'ok' ? answer.body : null
  }

  function take(key: StoreKey, server: Stored) {
    const local = storage.getItem(key)
    if (local !== null && local !== server.doc && meta.revs[key] === undefined && !meta.fresh.includes(key)) preserveCopy(storage, key, local, 'unsynced')
    try {
      if (local !== server.doc) storage.setItem(key, server.doc)
      meta.revs[key] = server.rev
      unpend(key)
      meta.fresh = meta.fresh.filter((k) => k !== key)
    } catch {
      // a full storage keeps the old copy and its old rev, so a later change here conflicts instead of overwriting
    }
  }

  const remote = await fetchRemote()
  if (remote) {
    for (const key of STORE_KEYS) {
      const local = storage.getItem(key)
      const server = remote[key]
      if (local !== null && meta.pending.includes(key)) continue
      if (server) take(key, server)
      else if (local !== null && !meta.fresh.includes(key)) {
        delete meta.revs[key]
        meta.pending = [...meta.pending, key]
      }
    }
  } else {
    setStatus('offline')
  }
  for (const key of STORE_KEYS) if (storage.getItem(key) === null && !meta.fresh.includes(key)) meta.fresh = [...meta.fresh, key]
  saveMeta()
  if (remote) await flush()

  return {
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem(key, value) {
        const previous = storage.getItem(key)
        storage.setItem(key, value)
        if (!isStoreKey(key) || previous === value) return
        if (meta.fresh.includes(key)) {
          if (previous === null) return
          meta.fresh = meta.fresh.filter((k) => k !== key)
        }
        markPending(key)
      },
      removeItem(key) {
        const changed = isStoreKey(key) && !meta.fresh.includes(key) && storage.getItem(key) !== null
        storage.removeItem(key)
        if (changed) markPending(key)
      },
      key: (index) => storage.key(index),
      get length() {
        return storage.length
      },
    },
    status: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    flush,
    dropConflicts() {
      for (const key of conflicts) {
        unpend(key)
        delete meta.revs[key]
      }
      saveMeta()
    },
  }
}
