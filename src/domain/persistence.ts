/** `key` and `length` let the unreadable-copy check find a copy it already made; without them a copy is made on every load. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'key' | 'length'>>
/** What a transaction needs: it must put back a key that did not exist. */
export type RemovableStorage = StorageLike & Pick<Storage, 'removeItem'>

/** What the app's storage offers: localStorage, or the sync layer's write-through copy of it. */
export type BrowserStorage = RemovableStorage & Pick<Storage, 'key' | 'length'>

let installed: BrowserStorage | null = null

/** main.tsx installs the storage that also sends each store to the server; until then, and in tests, it is localStorage. */
export function installStorage(storage: BrowserStorage): void {
  installed = storage
}

export function defaultStorage(): BrowserStorage | null {
  if (installed) return installed
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export { isRecord } from './records.ts'
export const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/**
 * Copies a document aside under `<key>:<reason>:<ISO time>` before something replaces it: `unreadable`, a document this
 * build cannot read, before the fresh state's first save; `unsynced`, a browser's own document it never sent, before
 * the server's copy replaces it; `migrated`, an older version this build converts, before the converted state's first
 * save. The copy is device-local, never a store. Idempotent per text.
 */
export function preserveCopy(storage: StorageLike, key: string, text: string, reason: 'unreadable' | 'unsynced' | 'migrated'): void {
  try {
    const prefix = `${key}:${reason}:`
    for (let i = 0; i < (storage.length ?? 0); i++) {
      const other = storage.key?.(i)
      if (other?.startsWith(prefix) && storage.getItem(other) === text) return
    }
    const base = `${prefix}${new Date().toISOString()}`
    let copyKey = base
    for (let n = 2; storage.getItem(copyKey) !== null; n++) copyKey = `${base}#${n}`
    storage.setItem(copyKey, text)
  } catch {
    // a full or blocked storage cannot keep the copy; the original is still untouched until the next save
  }
}
