import { useSyncExternalStore } from 'react'
import { storageFull, subscribeStorageHealth } from '../domain/storageHealth.ts'
import type { Sync } from '../sync.ts'
import { Notice } from './Notice.tsx'

const noSync = () => () => {}
const connected = () => 'ligado' as const

function SyncStatus({ sync }: { sync: Sync | null }) {
  const status = useSyncExternalStore(sync?.subscribe ?? noSync, sync?.status ?? connected)
  if (!sync || status === 'ligado') return null
  if (status === 'offline') {
    return (
      <Notice tone="warning" className="sync-line">
        Sem ligação ao servidor. As alterações ficam neste navegador até voltar.
      </Notice>
    )
  }
  if (status === 'recusado') {
    return (
      <Notice tone="error" className="sync-line">
        O servidor recusou uma alteração. Fica guardada neste navegador. Exporta os dados e recarrega.{' '}
        <button type="button" className="link-btn" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </Notice>
    )
  }
  return (
    <Notice tone="error" className="sync-line">
      Os dados mudaram noutro dispositivo.{' '}
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          sync.dropConflicts()
          window.location.reload()
        }}
      >
        Recarregar
      </button>
    </Notice>
  )
}

/** Says nothing while every change is saved in this browser and reaches the server. */
export function SyncLine({ sync }: { sync: Sync | null }) {
  const full = useSyncExternalStore(subscribeStorageHealth, storageFull)
  return (
    <div className="sync-lines">
      {full && (
        <Notice tone="error" className="sync-line">
          Não foi possível guardar neste navegador: o armazenamento está cheio. Exporta os dados.
        </Notice>
      )}
      <SyncStatus sync={sync} />
    </div>
  )
}
