import { MicIcon, StopIcon } from '../ui/icons'
import { Notice } from '../ui/Notice'
import { appendDictation } from './appendDictation'
import { useDictation } from './useDictation'

/** A mic button for a note field. Absolutely placed by `.note-field`; the status line sits under the field. */
export function DictateButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dictation = useDictation((text) => onChange(appendDictation(value, text)))
  if (!dictation.supported) return null
  const { recording, busy, failed, status, toggle } = dictation

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
      <Notice tone={failed ? 'error' : 'info'} className="dictate-status">
        {status}
      </Notice>
    </>
  )
}
