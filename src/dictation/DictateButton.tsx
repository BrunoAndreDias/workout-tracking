import { MicIcon, StopIcon } from '../ui/icons'
import { appendDictation } from './appendDictation'
import { useDictation } from './useDictation'

/** A mic button for a note field. Absolutely placed by `.note-field`; the status line sits under the field. */
export function DictateButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dictation = useDictation((text) => onChange(appendDictation(value, text)))
  if (!dictation.supported) return null
  const { recording, busy, status, toggle } = dictation

  return (
    <>
      <button
        type="button"
        className={`icon-btn dictate-btn${recording ? ' recording' : ''}`}
        aria-label={recording ? 'Parar ditado' : 'Ditar nota'}
        aria-pressed={recording}
        disabled={busy}
        onClick={toggle}
      >
        {recording ? <StopIcon /> : <MicIcon />}
      </button>
      <p className="dictate-status hint muted" role="status" aria-live="polite">{status}</p>
    </>
  )
}
