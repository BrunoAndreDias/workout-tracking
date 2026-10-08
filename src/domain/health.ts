import { parseIsoDate } from './days.ts'
import { isRecord } from './persistence.ts'
import type { IsoDate } from './types.ts'

/**
 * What the Apple Watch reports per day. `show` writes one value as the Corpo card reads it, from the value already formatted.
 * `unit` is null when the formatted value needs none: steps are a plain count, and sleep reads as `7 h 32 min`.
 */
export const HEALTH_METRICS = [
  { key: 'standHours', label: 'Horas em pé', unit: 'h', show: (v: string) => `Em pé ${v} h` },
  { key: 'standMinutes', label: 'Tempo em pé', unit: 'min', show: (v: string) => `Em pé ${v} min` },
  { key: 'steps', label: 'Passos', unit: null, show: (v: string) => `${v} passos` },
  { key: 'activeEnergy', label: 'Energia ativa', unit: 'kcal', show: (v: string) => `${v} kcal ativas` },
  { key: 'exerciseMinutes', label: 'Exercício', unit: 'min', show: (v: string) => `Exercício ${v} min` },
  { key: 'sleepMinutes', label: 'Sono', unit: null, show: (v: string) => `Sono ${v}` },
  { key: 'restingHeartRate', label: 'FC em repouso', unit: 'bpm', show: (v: string) => `FC em repouso ${v} bpm` },
] as const

export type HealthMetric = (typeof HEALTH_METRICS)[number]['key']

export const isHealthMetric = (v: unknown): v is HealthMetric => HEALTH_METRICS.some((m) => m.key === v)
export const healthMetric = (key: HealthMetric) => HEALTH_METRICS.find((m) => m.key === key)!

export interface HealthSample {
  readonly date: IsoDate
  readonly metric: HealthMetric
  readonly value: number
}

/** One value per (date, metric), so the log is keyed by both and a repeated import cannot duplicate one. */
export type HealthLog = Readonly<Record<IsoDate, Readonly<Partial<Record<HealthMetric, number>>>>>

const isValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** Why a row is not a Health Sample, or the sample. */
function readSample(raw: unknown): HealthSample | string {
  if (!isRecord(raw)) return 'não é um objeto { "date", "metric", "value" }'
  const date = typeof raw.date === 'string' ? parseIsoDate(raw.date) : null
  if (!date) return `a data ${JSON.stringify(raw.date)} não é AAAA-MM-DD`
  if (!isHealthMetric(raw.metric)) return `a métrica ${JSON.stringify(raw.metric)} não existe`
  if (!isValue(raw.value)) return `o valor ${JSON.stringify(raw.value)} não é um número maior ou igual a zero`
  return { date, metric: raw.metric, value: raw.value }
}

/** Every row read, or why the first bad one is not; a (date, metric) twice in one list is bad too. Rows count from 1. */
export function readSamples(rows: readonly unknown[]): { ok: true; samples: HealthSample[] } | { ok: false; row: number; reason: string } {
  const seen = new Set<string>()
  const samples = []
  for (const [i, raw] of rows.entries()) {
    const sample = readSample(raw)
    if (typeof sample === 'string') return { ok: false, row: i + 1, reason: sample }
    const key = `${sample.date} ${sample.metric}`
    if (seen.has(key)) return { ok: false, row: i + 1, reason: `${sample.metric} de ${sample.date} já veio antes` }
    seen.add(key)
    samples.push(sample)
  }
  return { ok: true, samples }
}

export type ImportedSamples = readonly [HealthSample, ...HealthSample[]]

export type ParsedImport = { ok: true; samples: ImportedSamples } | { ok: false; error: string }

const NOTHING_CHANGED = 'Não foi alterado nada.'

/**
 * The text of the iOS Shortcut: `{ "samples": [...] }`, the bare list, or one sample on its own, which the installed
 * Shortcut posts once per metric because a flat JSON body is the shape Shortcuts builds most reliably. Any bad row
 * rejects the whole text.
 */
export function parseHealthImport(text: string): ParsedImport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: `O texto não é JSON válido. ${NOTHING_CHANGED}` }
  }
  const rows = Array.isArray(raw) ? raw : !isRecord(raw) ? null : Array.isArray(raw.samples) ? raw.samples : 'metric' in raw ? [raw] : null
  if (!rows) return { ok: false, error: `Esperava { "samples": [ … ] }, uma lista de valores ou um só valor. ${NOTHING_CHANGED}` }
  const read = readSamples(rows)
  if (!read.ok) return { ok: false, error: `Valor n.º ${read.row}: ${read.reason}. ${NOTHING_CHANGED}` }
  const [first, ...rest] = read.samples
  return first ? { ok: true, samples: [first, ...rest] } : { ok: false, error: 'Não há valores para importar.' }
}

/** The log with each sample written over what was there: importing the same samples again changes nothing. */
export function upsertSamples(log: HealthLog, samples: readonly HealthSample[]): HealthLog {
  const next: Record<IsoDate, Partial<Record<HealthMetric, number>>> = { ...log }
  for (const { date, metric, value } of samples) next[date] = { ...next[date], [metric]: value }
  return next
}

/** For a Backup merge: `incoming` only fills a (date, metric) that `current` lacks. */
export function fillMissing(current: HealthLog, incoming: HealthLog): HealthLog {
  const next: Record<IsoDate, Partial<Record<HealthMetric, number>>> = { ...incoming }
  for (const [date, values] of Object.entries(current) as [IsoDate, HealthLog[IsoDate]][]) next[date] = { ...incoming[date], ...values }
  return next
}

/** Every sample, by date and then in the order of HEALTH_METRICS. */
export function logSamples(log: HealthLog): HealthSample[] {
  return (Object.keys(log) as IsoDate[]).sort().flatMap((date) => samplesOn(log, date))
}

export function samplesOn(log: HealthLog, date: IsoDate): HealthSample[] {
  const values = log[date] ?? {}
  return HEALTH_METRICS.flatMap(({ key }) => (values[key] === undefined ? [] : [{ date, metric: key, value: values[key] }]))
}

/** The latest date with a value, or null for an empty log. */
export const latestSampleDate = (log: HealthLog): IsoDate | null =>
  (Object.keys(log) as IsoDate[])
    .filter((date) => Object.keys(log[date]).length > 0)
    .sort()
    .at(-1) ?? null

export const countSamples = (log: HealthLog): number => Object.values(log).reduce((n, values) => n + Object.keys(values).length, 0)

/** How many samples and the dates they span. */
export function importSpan(samples: ImportedSamples): { count: number; from: IsoDate; to: IsoDate } {
  const dates = samples.map((s) => s.date).sort()
  return { count: samples.length, from: dates[0], to: dates[dates.length - 1] }
}
