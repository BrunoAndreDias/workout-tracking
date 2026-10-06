import { useState } from 'react'
import { importSpan, parseHealthImport } from '../domain/health.ts'
import type { HealthSample, ImportedSamples } from '../domain/health.ts'
import { formatShortDate } from './format.ts'
import { Panel } from './Panel.tsx'

interface Props {
  onImport: (samples: readonly HealthSample[]) => void
}

/** "3 valores, de 4/10 a 5/10" */
function describeSamples(samples: ImportedSamples): string {
  const { count, from, to } = importSpan(samples)
  const values = `${count} ${count === 1 ? 'valor' : 'valores'}`
  return from === to ? `${values}, de ${formatShortDate(from)}` : `${values}, de ${formatShortDate(from)} a ${formatShortDate(to)}`
}

export function HealthImport({ onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [clipboardNote, setClipboardNote] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const parsed = text.trim() === '' ? null : parseHealthImport(text)

  const close = () => {
    setOpen(false)
    setText('')
    setClipboardNote(null)
  }

  const paste = async () => {
    setClipboardNote(null)
    try {
      setText(await navigator.clipboard.readText())
    } catch {
      setClipboardNote('O navegador não deixou ler a área de transferência. Cola o texto na caixa.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setDone(null)
          setOpen(true)
        }}
      >
        Importar do Apple Watch
      </button>
      {done && (
        <p className="backup-done" role="status">
          {done}
        </p>
      )}
      {open && (
        <Panel eyebrow="Apple Watch" title="Importar do Apple Watch" onClose={close}>
          <div className="panel-body backup-body health-import">
            <p className="goals-hint">Corre o Atalho no iPhone e cola aqui o que ele copiou. Importar outra vez os mesmos dias só substitui os valores.</p>
            <button type="button" className="secondary" onClick={() => void paste()}>
              Colar da área de transferência
            </button>
            {clipboardNote && (
              <p className="goals-hint" role="status">
                {clipboardNote}
              </p>
            )}
            <textarea
              className="notes-input health-text"
              aria-label="Dados do Apple Watch"
              placeholder='{ "samples": [ { "date": "2026-10-05", "metric": "steps", "value": 8123 } ] }'
              rows={8}
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {parsed?.ok === true && <p className="backup-summary">{describeSamples(parsed.samples)}</p>}
            {parsed?.ok === false && (
              <p className="backup-error" role="alert">
                {parsed.error}
              </p>
            )}
          </div>
          <div className="panel-foot form-actions">
            <button
              type="button"
              className="primary"
              disabled={parsed?.ok !== true}
              onClick={() => {
                if (parsed?.ok !== true) return
                onImport(parsed.samples)
                setDone(`Importados ${describeSamples(parsed.samples)}.`)
                close()
              }}
            >
              Importar
            </button>
            <button type="button" className="secondary" onClick={close}>
              Cancelar
            </button>
          </div>
        </Panel>
      )}
    </>
  )
}
