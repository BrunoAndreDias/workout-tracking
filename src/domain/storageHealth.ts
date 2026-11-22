import type { StoreKey } from './storeKeys.ts'

const failing = new Set<StoreKey>()
const listeners = new Set<() => void>()

export function reportSave(key: StoreKey, saved: boolean): void {
  if (saved === !failing.has(key)) return
  if (saved) failing.delete(key)
  else failing.add(key)
  for (const listener of listeners) listener()
}

export const storageFull = (): boolean => failing.size > 0

export function subscribeStorageHealth(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
