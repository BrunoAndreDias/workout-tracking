import { useRef, useState } from 'react'
import { describeBackup, mergeBackup, parseBackup, writeAll } from '../domain/backup.ts'
import { defaultStorage } from '../domain/persistence.ts'
import { loadAll, STORES } from '../domain/stores.ts'
import type { AppData } from '../domain/stores.ts'
import { downloadBackup } from './exportFile.ts'
import { Notice } from './Notice.tsx'
import { Panel } from './Panel.tsx'

/**
 * Every store is read once at start, so writing storage and reloading is the one way that cannot leave a stale
 * reducer state saving over the imported data a moment later.
 */
const reloadApp = () => window.location.reload()

export function BackupSection() {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<AppData | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setWarning(null)
    try {
      const result = parseBackup(JSON.parse(await file.text()))
      if (result.ok) setIncoming(result.data)
      else setError(result.error)
    } catch {
      setError('Não foi possível ler o ficheiro: não é um JSON válido. Não foi alterado nada.')
    }
  }

  const exportData = () => {
    const storage = defaultStorage()
    if (!storage) return setError('O armazenamento do navegador não está disponível.')
    const skipped = downloadBackup(storage)
    setWarning(skipped.length > 0 ? `Não foi possível exportar: ${skipped.map((name) => STORES[name].label).join(', ')}. Os dados guardados no navegador não são válidos e ficaram de fora do ficheiro.` : null)
  }

  const apply = (mode: 'merge' | 'replace') => {
    const storage = defaultStorage()
    if (!storage || !incoming) return setError('O armazenamento do navegador não está disponível.')
    const current = loadAll(storage)
    if (mode === 'replace' && !window.confirm(`Substituir tudo?\n\nVais perder o que tens agora: ${describeBackup(current)}.\nFicas com o que está no ficheiro: ${describeBackup(incoming)}.`)) return
    const result = writeAll(mode === 'replace' ? incoming : mergeBackup(current, incoming), storage)
    if (!result.ok) return setError(result.error)
    reloadApp()
  }

  return (
    <section className="backup" aria-label="Dados">
      <div className="backup-actions">
        <button type="button" className="secondary" onClick={exportData}>
          Exportar dados
        </button>
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          Importar dados
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Ficheiro de dados"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {warning && <Notice tone="warning">{warning}</Notice>}
      {incoming && (
        <Panel eyebrow="Importar dados" title="Cópia de segurança" onClose={() => setIncoming(null)}>
          <div className="panel-body backup-body">
            <p className="backup-summary">{describeBackup(incoming)}</p>
            <p className="hint-text">
              “Juntar” mantém os teus planos de treino, treinos e material; do ficheiro só entram os que ainda não tens. “Substituir tudo” apaga o que tens agora.
            </p>
          </div>
          <div className="panel-foot form-actions">
            <button type="button" className="primary" onClick={() => apply('merge')}>
              Juntar aos meus dados
            </button>
            <button type="button" className="secondary" onClick={() => apply('replace')}>
              Substituir tudo
            </button>
          </div>
        </Panel>
      )}
    </section>
  )
}
