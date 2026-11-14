import { parseIsoDate } from './dates.ts'
import { isRecord } from './persistence.ts'
import type { IsoDate, LocalDateTime } from './types.ts'

/** A note the user wrote, never blank: a note cleared to blank is no note at all. */
export interface TimedNote {
  readonly text: string
  /** When the note first held text. */
  readonly createdAt: LocalDateTime
  /** When its text last changed. */
  readonly updatedAt: LocalDateTime
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDateTime(d: Date): LocalDateTime {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` as LocalDateTime
}

/** `time` is 'HH:MM'. */
export const atTime = (date: IsoDate, time: string): LocalDateTime => `${date}T${time}:00` as LocalDateTime

export function parseLocalDateTime(s: unknown): LocalDateTime | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.exec(s)
  return m && parseIsoDate(m[1]) ? (s as LocalDateTime) : null
}

/** The one rule for every timed note: blank text removes it, the first text stamps both times, a change stamps `updatedAt`. */
export function editNote(prev: TimedNote | undefined, text: string, now: LocalDateTime): TimedNote | undefined {
  if (text.trim() === '') return undefined
  if (prev?.text === text) return prev
  return { text, createdAt: prev?.createdAt ?? now, updatedAt: now }
}

/**
 * `incoming`'s lines that `prev` lacks, appended after its text; `prev` itself when it has them all, so appending
 * the same note twice changes nothing. The result spans both notes' times.
 */
export function appendNote(prev: TimedNote | undefined, incoming: TimedNote): TimedNote {
  if (!prev) return incoming
  const have = new Set(prev.text.split('\n'))
  const missing = incoming.text.split('\n').filter((line) => line.trim() !== '' && !have.has(line))
  if (missing.length === 0) return prev
  return {
    text: [prev.text, ...missing].join('\n'),
    createdAt: prev.createdAt < incoming.createdAt ? prev.createdAt : incoming.createdAt,
    updatedAt: prev.updatedAt > incoming.updatedAt ? prev.updatedAt : incoming.updatedAt,
  }
}

export function parseTimedNote(raw: unknown): TimedNote | null {
  if (!isRecord(raw) || typeof raw.text !== 'string' || raw.text.trim() === '') return null
  const createdAt = parseLocalDateTime(raw.createdAt)
  const updatedAt = parseLocalDateTime(raw.updatedAt)
  return createdAt && updatedAt && { text: raw.text, createdAt, updatedAt }
}

/** An optional note field: absent is no note, present must parse. `false` when present and bad. */
export function parseOptionalNote(raw: unknown): TimedNote | undefined | false {
  if (raw === undefined) return undefined
  return parseTimedNote(raw) ?? false
}
