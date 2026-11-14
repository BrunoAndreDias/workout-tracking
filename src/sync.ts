import { preserveCopy } from './domain/persistence.ts'
import type { BrowserStorage } from './domain/persistence.ts'
import { isStoreKey, STORE_KEYS } from './domain/storeKeys.ts'
import type { StoreKey } from './domain/storeKeys.ts'

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

const SYNC_META_KEY = 'nutrition-tracking:sync'

export interface Sync {
  /** localStorage, plus: each change to a store is sent to the server shortly after. */
  readonly storage: BrowserStorage
  readonly status: () => SyncStatus
  readonly subscribe: (listener: () => void) => () => void
  /** Sends every changed store now; for the browser's `online` event. */
  readonly flush: () => Promise<void>
  /** Forgets this browser's changes to the conflicting stores, so the next start takes the server's copies. */
  readonly dropConflicts: () => void
  /**
   * Takes the server's newer copy of each of `keys` that has no change waiting here, and resolves to the keys whose
   * local copy changed. Only for stores whose caller then re-reads them: an app state still holding the old copy would
   * save it back over the new one.
   */
  readonly refresh: (keys: readonly StoreKey[]) => Promise<StoreKey[]>
}

export interface SyncOptions {
  readonly storage: BrowserStorage
  readonly fetch?: typeof fetch
  readonly base?: string
  readonly debounceMs?: number
  readonly timeoutMs?: number
}

type Remote = Partial<Record<StoreKey, { doc: string; rev: number }>>

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

/** `unchanged` gives the doc of a store the server left out because this browser already has it at that rev. */
function parseRemote(raw: unknown, unchanged: (key: StoreKey, rev: number) => string | null = () => null): Remote | null {
  if (typeof raw !== 'object' || raw === null) return null
  const remote: Remote = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isStoreKey(key) || typeof value !== 'object' || value === null) continue
    const { doc, rev } = value as Record<string, unknown>
    if (!Number.isInteger(rev)) continue
    const known = typeof doc === 'string' ? doc : doc === undefined ? unchanged(key, rev as number) : null
    if (known !== null) remote[key] = { doc: known, rev: rev as number }
  }
  return remote
}

/**
 * Brings localStorage in step with the server before the app reads it: a store changed here and not yet sent is sent
 * (it may conflict), any other store the server has replaces the local one (a local one this browser never synced is
 * first kept under `<key>:unsynced:<ISO time>`), and a store only this browser has is
 * uploaded, which is how data from before the server arrives there. With no server it changes nothing and starts
 * `offline`. Then every change to a store through `storage` is sent after `debounceMs`, except the first write of a
 * store this browser did not have: that is the app saving its default, and uploading it could replace another
 * browser's real data. Such a store is sent once a later write changes it.
 */
export async function startSync({ storage, fetch: request = globalThis.fetch, base = '/api/stores', debounceMs = 300, timeoutMs = 4000 }: SyncOptions): Promise<Sync> {
  const meta = readMeta(storage)
  const conflicts = new Set<StoreKey>()
  const listeners = new Set<() => void>()
  let status: SyncStatus = 'ligado'

  const saveMeta = () => {
    try {
      storage.setItem(SYNC_META_KEY, JSON.stringify(meta))
    } catch {
      // a full storage loses only the bookkeeping: the next start pulls or re-sends
    }
  }
  const setStatus = (next: SyncStatus) => {
    if (status === 'conflito' || status === next) return
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
    let res: Response
    try {
      res = await request(`${base}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc, baseRev: meta.revs[key] ?? null }),
      })
    } catch {
      return 'offline'
    }
    if (res.status === 409) {
      conflicts.add(key)
      return 'conflict'
    }
    if (!res.ok) return 'offline'
    const { rev } = (await res.json()) as { rev: number }
    meta.revs[key] = rev
    if (storage.getItem(key) === doc) unpend(key)
    return 'sent'
  }

  async function pushPending() {
    const keys = meta.pending.filter((k) => !conflicts.has(k))
    if (keys.length === 0) return
    const outcomes = []
    for (const key of keys) outcomes.push(await push(key))
    saveMeta()
    setStatus(outcomes.includes('conflict') ? 'conflito' : outcomes.includes('offline') ? 'offline' : 'ligado')
  }

  let queue = Promise.resolve()
  const flush = () => (queue = queue.then(pushPending))
  let timer: ReturnType<typeof setTimeout> | undefined
  const markPending = (key: StoreKey) => {
    if (!meta.pending.includes(key)) {
      meta.pending = [...meta.pending, key]
      saveMeta()
    }
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  }

  async function fetchRemote(): Promise<Remote | null> {
    try {
      const held = STORE_KEYS.filter((key) => meta.revs[key] !== undefined && storage.getItem(key) !== null)
      const url = held.length === 0 ? base : `${base}?have=${encodeURIComponent(held.map((key) => `${key}:${meta.revs[key]}`).join(','))}`
      const res = await request(url, { signal: AbortSignal.timeout(timeoutMs) })
      return res.ok ? parseRemote(await res.json(), (key, rev) => (meta.revs[key] === rev ? storage.getItem(key) : null)) : null
    } catch {
      return null
    }
  }

  function take(key: StoreKey, server: { doc: string; rev: number }) {
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

  async function fetchOne(key: StoreKey): Promise<{ doc: string; rev: number } | null> {
    try {
      const res = await request(`${base}/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(timeoutMs) })
      return res.ok ? (parseRemote({ [key]: await res.json() })?.[key] ?? null) : null
    } catch {
      return null
    }
  }

  /** Fetches only `keys`, so a refresh on focus never downloads the whole history. */
  async function pull(keys: readonly StoreKey[]): Promise<StoreKey[]> {
    const remote = await Promise.all(keys.map(fetchOne))
    const changed: StoreKey[] = []
    for (const [i, key] of keys.entries()) {
      const server = remote[i]
      const rev = meta.revs[key]
      // Checked after the request: a change made here while it was in flight must win over the server's older view.
      if (!server || meta.pending.includes(key) || conflicts.has(key) || (rev !== undefined && server.rev <= rev)) continue
      const before = storage.getItem(key)
      take(key, server)
      if (storage.getItem(key) !== before) changed.push(key)
    }
    saveMeta()
    return changed
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
    status = 'offline'
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
    refresh(keys) {
      const pulled = queue.then(() => pull(keys))
      queue = pulled.then(() => undefined)
      return pulled
    },
  }
}
