import { logSamples, readSamples, upsertSamples } from './health.ts'
import type { HealthLog } from './health.ts'
import { defaultStorage, isRecord, loadStore, saveStore } from './persistence.ts'
import type { StorageLike } from './persistence.ts'

export const HEALTH_STORAGE_KEY = 'nutrition-tracking:health'
export const HEALTH_SCHEMA_VERSION = 1

/** Stored as the import's own rows; the current version only, and null for one bad row or a (date, metric) twice. */
export function parseHealth(raw: unknown): HealthLog | null {
  if (!isRecord(raw) || raw.version !== HEALTH_SCHEMA_VERSION || !Array.isArray(raw.samples)) return null
  const read = readSamples(raw.samples)
  return read.ok ? upsertSamples({}, read.samples) : null
}

export const loadHealth = (storage: StorageLike | null = defaultStorage()): HealthLog => loadStore(storage, HEALTH_STORAGE_KEY, parseHealth, () => ({}))

export const saveHealth = (log: HealthLog, storage: StorageLike | null = defaultStorage()): boolean =>
  saveStore(HEALTH_STORAGE_KEY, { version: HEALTH_SCHEMA_VERSION, samples: logSamples(log) }, storage)
