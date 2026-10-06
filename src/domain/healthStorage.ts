import { readSamples, upsertSamples } from './health.ts'
import type { HealthLog } from './health.ts'
import { isRecord } from './persistence.ts'

export const HEALTH_SCHEMA_VERSION = 1

/** Stored as the import's own rows; the current version only, and null for one bad row or a (date, metric) twice. */
export function parseHealth(raw: unknown): HealthLog | null {
  if (!isRecord(raw) || raw.version !== HEALTH_SCHEMA_VERSION || !Array.isArray(raw.samples)) return null
  const read = readSamples(raw.samples)
  return read.ok ? upsertSamples({}, read.samples) : null
}
