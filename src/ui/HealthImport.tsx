import { useRef, useState } from 'react'
import { importSpan, latestSampleDate, parseHealthImport } from '../domain/health.ts'
import type { HealthLog, HealthSample, ImportedSamples } from '../domain/health.ts'
import { formatDayMonth, formatShortDate } from './format.ts'
import { Panel } from './Panel.tsx'

interface Props {
  log: HealthLog
  onImport: (samples: readonly HealthSample[]) => void
}

/** "3 valores, de 4/10 a 5/10" */
function describeSamples(samples: ImportedSamples): string {
  const { count, from, to } = importSpan(samples)
  const values = `${count} ${count === 1 ? 'valor' : 'valores'}`
  return from === to ? `${values}, de ${formatShortDate(from)}` : `${values}, de ${formatShortDate(from)} a ${formatShortDate(to)}`
}

/** The Shortcut posts to the server on its own each day; pasting what it copied stays for a phone that cannot reach it. */
export function HealthImport({ log, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [clipboardNote, setClipboardNote] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const urlField = useRef<HTMLInputElement>(null)
  const parsed = text.trim() === '' ? null : parseHealthImport(text)
  const url = `${window.location.origin}/api/health`
  const latest = latestSampleDate(log)
  const thisComputerOnly = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

  const close = () => {
    setOpen(false)
    setText('')
    setCopyNote(null)
    setClipboardNote(null)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyNote('Endereço copiado.')
    } catch {
      urlField.current?.select()
      setCopyNote('O navegador não deixou copiar. O endereço ficou selecionado.')
    }
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
        Ligar Apple Watch
      </button>
      {done && (
        <p className="backup-done" role="status">
          {done}
        </p>
      )}
      {open && (
        <Panel eyebrow="Apple Watch" title="Ligar Apple Watch" onClose={close}>
          <div className="panel-body backup-body health-import">
            <p className="health-latest">{latest ? `Último valor do relógio: ${formatDayMonth(latest)}` : 'Ainda não chegou nenhum valor do relógio.'}</p>
            <p className="goals-hint">Um Atalho no iPhone envia os valores do relógio para a app todos os dias, sem tocar em nada. Enviar outra vez os mesmos dias só substitui os valores.</p>
            <label className="health-url">
              <span className="health-url-label">Endereço do Atalho</span>
              <span className="health-url-row">
                <input ref={urlField} className="health-url-field" readOnly value={url} onFocus={(e) => e.target.select()} />
                <button type="button" className="secondary" onClick={() => void copy()}>
                  Copiar
                </button>
              </span>
            </label>
            {copyNote && (
              <p className="goals-hint" role="status">
                {copyNote}
              </p>
            )}
            <ol className="health-steps">
              <li>
                No Atalho, depois de juntar os valores, acrescenta <strong>Obter conteúdo do URL</strong> com este endereço, método <strong>POST</strong> e corpo <strong>JSON</strong> com os valores.
              </li>
              <li>
                Em Atalhos → Automação, cria uma <strong>Automação pessoal</strong> → <strong>Hora do dia</strong>, diariamente, de manhã.
              </li>
              <li>
                Escolhe <strong>Executar imediatamente</strong> e o Atalho.
              </li>
            </ol>
            <p className="goals-hint">
              {thisComputerOnly
                ? 'Este endereço só funciona neste computador. Abre a app pelo endereço do computador na rede Wi-Fi ou na VPN privada, e copia o endereço daí.'
                : 'O iPhone tem de chegar a este endereço: na mesma rede Wi-Fi ou por uma VPN privada.'}
            </p>
            <details className="health-manual">
              <summary>Colar manualmente</summary>
              <div className="health-import">
                <p className="goals-hint">Corre o Atalho no iPhone e cola aqui o que ele copiou.</p>
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
              </div>
            </details>
          </div>
        </Panel>
      )}
    </>
  )
}
