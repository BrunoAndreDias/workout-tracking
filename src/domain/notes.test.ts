import { describe, expect, it } from 'vitest'
import { appendNote, editNote, parseTimedNote, toLocalDateTime } from './notes.ts'
import type { TimedNote } from './notes.ts'
import type { LocalDateTime } from './types.ts'

const at = (s: string) => s as LocalDateTime
const T1 = at('2026-10-06T18:50:12')
const T2 = at('2026-10-06T19:02:40')

describe('timed notes', () => {
  it('stamps both times when a note first gets text', () => {
    expect(editNote(undefined, 'Cansado', T1)).toEqual({ text: 'Cansado', createdAt: '2026-10-06T18:50:12', updatedAt: '2026-10-06T18:50:12' })
  })

  it('keeps createdAt and moves updatedAt on every change', () => {
    const first = editNote(undefined, 'Cansado', T1)
    expect(editNote(first, 'Cansado mas bem', T2)).toEqual({ text: 'Cansado mas bem', createdAt: '2026-10-06T18:50:12', updatedAt: '2026-10-06T19:02:40' })
  })

  it('leaves the note as it is when the text did not change', () => {
    const first = editNote(undefined, 'Cansado', T1)
    expect(editNote(first, 'Cansado', T2)).toBe(first)
  })

  it('removes a note cleared to blank, and does not start one for blank text', () => {
    expect(editNote(editNote(undefined, 'Cansado', T1), '  \n', T2)).toBe(undefined)
    expect(editNote(undefined, ' ', T1)).toBe(undefined)
  })

  it('writes a local date and time to the second', () => {
    expect(toLocalDateTime(new Date(2026, 9, 6, 8, 5, 9))).toBe('2026-10-06T08:05:09')
  })

  it('parses a stored note and rejects blank text or a bad time', () => {
    expect(parseTimedNote({ text: 'Bem', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' })).toEqual({ text: 'Bem', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' })
    expect(parseTimedNote({ text: ' ', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' })).toBe(null)
    expect(parseTimedNote({ text: 'Bem', createdAt: '2026-02-30T12:00:00', updatedAt: '2026-10-06T12:00:00' })).toBe(null)
    expect(parseTimedNote({ text: 'Bem', createdAt: '2026-10-06T24:00:00', updatedAt: '2026-10-06T12:00:00' })).toBe(null)
  })

  it('appends only the lines a note lacks, so appending twice changes nothing', () => {
    const mood: TimedNote = { text: 'Bem disposto', createdAt: at('2026-10-06T09:00:00'), updatedAt: at('2026-10-06T21:00:00') }
    const pain: TimedNote = { text: 'Dor: Lombar 5/10 · 14:00', createdAt: at('2026-10-06T14:00:00'), updatedAt: at('2026-10-06T14:00:00') }
    const once = appendNote(mood, pain)
    expect(once).toEqual({ text: 'Bem disposto\nDor: Lombar 5/10 · 14:00', createdAt: '2026-10-06T09:00:00', updatedAt: '2026-10-06T21:00:00' })
    expect(appendNote(once, pain)).toBe(once)
    expect(appendNote(undefined, pain)).toBe(pain)
  })
})
