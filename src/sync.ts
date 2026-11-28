import { preserveCopy } from './domain/persistence.ts'
import type { BrowserStorage } from './domain/persistence.ts'
import { isRecord } from './domain/records.ts'
import { DEVICE_KEY, isStoreKey, STORE_KEYS } from './domain/storeKeys.ts'
import type { StoreKey } from './domain/storeKeys.ts'
import { formatHave, parsePutReply, parseStoreList } from './domain/storeProtocol.ts'
import type { PutBody, Stored, StoreList, StoreRevs } from './domain/storeProtocol.ts'

/**
 * `connected`: every change made here has reached the server or is on its way. `offline`: the server did not answer, it
 * failed (5xx), or its answer was not the expected JSON, and changes wait in this browser. `conflict`: another device
 * wrote a store this browser also changed (409), so this browser stops sending it until the user reloads the server's
 * copy. `refused`: the server refused a change (any other 4xx), so this browser keeps it pending and stops sending
 * that store until the next start ([ADR-0008](../docs/adr/0008-refused-changes-and-the-crash-page.md)). Only a reload
 * leaves `conflict` or `refused`, and either outranks `offline`.
 */
export type SyncStatus = 'connected' | 'offline' | 'conflict' | 'refused'

/**
 * Device-local bookkeeping: the server rev each store was last in step with, the stores changed here since, and the
 * stores whose local copy is only the app's default, which no side had before and the user has not changed yet.
 */
interface SyncMeta {
  revs: Partial<Record<StoreKey, number>>
  pending: StoreKey[]
  fresh: StoreKey[]
}

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

interface SyncOptions {
  readonly storage: BrowserStorage
  readonly fetch?: typeof fetch
  readonly base?: string
  readonly debounceMs?: number
  readonly retryMs?: number
  readonly pullTimeoutMs?: number
  readonly pushTimeoutMs?: number
}

type Answer<T> = { kind: 'ok'; body: T } | { kind: 'conflict' } | { kind: 'refused' } | { kind: 'offline' }

const RANK: Record<SyncStatus, number> = { connected: 0, offline: 1, refused: 2, conflict: 3 }

const worst = (statuses: readonly SyncStatus[]): SyncStatus => statuses.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'connected')

async function requestJson<T>(request: typeof fetch, url: string, init: RequestInit, check: (body: unknown) => T | null, timeoutMs: number): Promise<Answer<T>> {
  try {
    const res = await request(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    if (res.status === 409) return { kind: 'conflict' }
    if (res.status >= 400 && res.status < 500) return { kind: 'refused' }
    const body = res.ok ? check(await res.json()) : null
    return body === null ? { kind: 'offline' } : { kind: 'ok', body }
  } catch {
    return { kind: 'offline' }
  }
}

const emptyMeta = (): SyncMeta => ({ revs: {}, pending: [], fresh: [] })

function readMeta(storage: BrowserStorage): SyncMeta {
  try {
    const raw: unknown = JSON.parse(storage.getItem(DEVICE_KEY.sync) ?? 'null')
    if (!isRecord(raw)) return emptyMeta()
    const { revs, pending, fresh } = raw
    const keys = (list: unknown) => (Array.isArray(list) ? list.filter(isStoreKey) : [])
    const meta: SyncMeta = { revs: {}, pending: keys(pending), fresh: keys(fresh) }
    if (isRecord(revs)) {
      for (const [key, rev] of Object.entries(revs)) if (isStoreKey(key) && typeof rev === 'number' && Number.isInteger(rev)) meta.revs[key] = rev
    }
    return meta
  } catch {
    return emptyMeta()
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
  const refused = new Set<StoreKey>()
  const listeners = new Set<() => void>()
  let status: SyncStatus = 'connected'
  let retry: ReturnType<typeof setTimeout> | undefined

  const saveMeta = () => {
    try {
      storage.setItem(DEVICE_KEY.sync, JSON.stringify(meta))
    } catch {
      // a full storage loses only the bookkeeping: the next start pulls or re-sends
    }
  }
  const setStatus = (next: SyncStatus) => {
    if (RANK[status] > RANK.offline && RANK[next] <= RANK[status]) return
    clearTimeout(retry)
    if (next === 'offline') retry = setTimeout(() => void flush(), retryMs)
    if (status === next) return
    status = next
    for (const listener of listeners) listener()
  }
  const unpend = (key: StoreKey) => {
    meta.pending = meta.pending.filter((k) => k !== key)
  }

  async function push(key: StoreKey): Promise<SyncStatus> {
    const doc = storage.getItem(key)
    if (doc === null) {
      unpend(key)
      return 'connected'
    }
    const init = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doc, baseRev: meta.revs[key] ?? null } satisfies PutBody) }
    const answer = await requestJson(request, `${base}/${encodeURIComponent(key)}`, init, parsePutReply, pushTimeoutMs)
    if (answer.kind === 'conflict') conflicts.add(key)
    if (answer.kind === 'refused') refused.add(key)
    if (answer.kind !== 'ok') return answer.kind
    meta.revs[key] = answer.body.rev
    if (storage.getItem(key) === doc) unpend(key)
    return 'connected'
  }

  async function pushPending() {
    const keys = meta.pending.filter((k) => !conflicts.has(k) && !refused.has(k))
    if (keys.length === 0) {
      if (status === 'offline') setStatus((await fetchRemote()) ? 'connected' : 'offline')
      return
    }
    const outcomes: SyncStatus[] = []
    for (const key of keys) outcomes.push(await push(key))
    saveMeta()
    setStatus(worst(outcomes))
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
    const held: StoreRevs = {}
    for (const key of STORE_KEYS) if (meta.revs[key] !== undefined && storage.getItem(key) !== null) held[key] = meta.revs[key]
    const have = formatHave(held)
    const url = have === '' ? base : `${base}?have=${encodeURIComponent(have)}`
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
