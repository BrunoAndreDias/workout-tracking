import type { BrowserStorage } from './domain/persistence.ts'
import { isStoreKey, STORE_KEYS } from './domain/storeKeys.ts'
import type { StoreKey } from './domain/storeKeys.ts'

/**
 * `ligado`: every change made here has reached the server or is on its way. `offline`: the server did not answer, and
 * changes wait in this browser. `conflito`: another device wrote a store this browser also changed, so this browser
 * stops sending it until the user reloads the server's copy. Only a reload leaves `conflito`.
 */
export type SyncStatus = 'ligado' | 'offline' | 'conflito'

/** Device-local bookkeeping: the server rev each store was last in step with, and the stores changed here since. */
interface SyncMeta {
  revs: Partial<Record<StoreKey, number>>
  pending: StoreKey[]
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
    if (typeof raw !== 'object' || raw === null) return { revs: {}, pending: [] }
    const { revs, pending } = raw as Record<string, unknown>
    const meta: SyncMeta = { revs: {}, pending: Array.isArray(pending) ? pending.filter(isStoreKey) : [] }
    if (typeof revs === 'object' && revs !== null) {
      for (const [key, rev] of Object.entries(revs)) if (isStoreKey(key) && Number.isInteger(rev)) meta.revs[key] = rev as number
    }
    return meta
  } catch {
    return { revs: {}, pending: [] }
  }
}

function parseRemote(raw: unknown): Remote | null {
  if (typeof raw !== 'object' || raw === null) return null
  const remote: Remote = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isStoreKey(key) || typeof value !== 'object' || value === null) continue
    const { doc, rev } = value as Record<string, unknown>
    if (typeof doc === 'string' && Number.isInteger(rev)) remote[key] = { doc, rev: rev as number }
  }
  return remote
}

/**
 * Brings localStorage in step with the server before the app reads it: a store changed here and not yet sent is sent
 * (it may conflict), any other store the server has replaces the local one, and a store only this browser has is
 * uploaded, which is how data from before the server arrives there. With no server it changes nothing and starts
 * `offline`. Then every change to a store through `storage` is sent after `debounceMs`.
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

  let remote: Remote | null = null
  try {
    const res = await request(base, { signal: AbortSignal.timeout(timeoutMs) })
    if (res.ok) remote = parseRemote(await res.json())
  } catch {
    // unreachable: start from this browser's copy
  }
  if (remote) {
    for (const key of STORE_KEYS) {
      const local = storage.getItem(key)
      const server = remote[key]
      if (local !== null && meta.pending.includes(key)) continue
      if (server) {
        try {
          storage.setItem(key, server.doc)
          meta.revs[key] = server.rev
          unpend(key)
        } catch {
          // a full storage keeps the old copy and its old rev, so a later change here conflicts instead of overwriting
        }
      } else if (local !== null) {
        delete meta.revs[key]
        meta.pending = [...meta.pending, key]
      }
    }
    saveMeta()
    await flush()
  } else {
    status = 'offline'
  }

  return {
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem(key, value) {
        const changed = isStoreKey(key) && storage.getItem(key) !== value
        storage.setItem(key, value)
        if (changed) markPending(key)
      },
      removeItem(key) {
        const changed = isStoreKey(key) && storage.getItem(key) !== null
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
