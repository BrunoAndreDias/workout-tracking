import { useSyncExternalStore } from 'react'
import type { Sync } from '../sync.ts'
import { Notice } from './Notice.tsx'

/** Says nothing while every change reaches the server. */
export function SyncLine({ sync }: { sync: Sync }) {
  const status = useSyncExternalStore(sync.subscribe, sync.status)
  if (status === 'ligado') return null
  if (status === 'offline') {
    return (
      <Notice tone="warning" className="sync-line">
        Sem ligação ao servidor. As alterações ficam neste navegador até voltar.
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
