import { DictateButton } from '../dictation/DictateButton.tsx'
import { toLocalDateTime } from '../domain/notes.ts'
import type { TimedNote } from '../domain/notes.ts'
import type { LocalDateTime } from '../domain/types.ts'
import { formatNoteTimes } from './format.ts'

interface Props {
  note: TimedNote | undefined
  label: string
  placeholder: string
  rows?: number
  id?: string
  /** `now` is the clock at the moment of the edit, for the note's times. */
  onEdit: (text: string, now: LocalDateTime) => void
}

/** A note field with the mic button and, under it, when the note was written and last edited. */
export function TimedNoteField({ note, label, placeholder, rows = 2, id, onEdit }: Props) {
  const text = note?.text ?? ''
  const edit = (next: string) => onEdit(next, toLocalDateTime(new Date()))
  return (
    <div className="note-field">
      <textarea id={id} className="notes-input grows" aria-label={label} placeholder={placeholder} rows={rows} value={text} onChange={(e) => edit(e.target.value)} />
      <DictateButton value={text} onChange={edit} />
      {note && <p className="note-times">{formatNoteTimes(note)}</p>}
    </div>
  )
}
