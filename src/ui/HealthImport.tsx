import { useEffect, useRef, useState } from 'react'
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
  const shortcutHref = `${window.location.origin}/api/health/shortcut?url=${encodeURIComponent(url)}`
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const latest = latestSampleDate(log)
  const thisComputerOnly = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

  // Signing takes seconds and works only on a Mac, so asking for the file on open warms the server's copy for the tap and
  // shows why it cannot be had instead of a link to an error page.
  useEffect(() => {
    if (!open) return
    let current = true
    void fetch(shortcutHref)
      .then(async (res) => (res.ok ? null : ((await res.json()) as { error: string }).error))
      .catch(() => 'Sem ligação ao servidor. Não deu para preparar o atalho.')
      .then((error) => current && setShortcutError(error))
    return () => {
      current = false
    }
  }, [open, shortcutHref])

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
            <p className="goals-hint">Um Atalho no iPhone envia os valores do relógio de ontem para a app todos os dias, sem tocar em nada. Enviar outra vez os mesmos dias só substitui os valores.</p>
            {shortcutError ? (
              <p className="backup-error" role="alert">
                {shortcutError}
              </p>
            ) : (
              <a className="primary health-install" href={shortcutHref}>
                Instalar atalho
              </a>
            )}
            <p className="goals-hint">
              {thisComputerOnly
                ? 'Aberta em localhost, a app dá um atalho que só funciona neste computador. Abre-a no iPhone pelo endereço do computador na rede Wi-Fi ou na VPN privada e instala o atalho daí.'
                : 'O iPhone tem de chegar a este endereço: na mesma rede Wi-Fi ou por uma VPN privada.'}
            </p>
            <ol className="health-steps">
              <li>
                Abre esta página no iPhone, toca em <strong>Instalar atalho</strong> e abre o ficheiro transferido.
              </li>
              <li>
                Toca em <strong>Adicionar atalho</strong>.
              </li>
              <li>
                Corre-o uma vez e toca em <strong>Permitir</strong> no pedido do Saúde.
              </li>
              <li>
                Em Atalhos → Automação, cria uma automação diária (<strong>Hora do dia</strong>, <strong>Executar imediatamente</strong>) com este atalho.
              </li>
            </ol>
            <p className="goals-hint">O atalho ainda não envia o sono nem as horas em pé.</p>
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
