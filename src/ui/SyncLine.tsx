import { useSyncExternalStore } from 'react'
import type { Sync } from '../sync.ts'

/** Says nothing while every change reaches the server. */
export function SyncLine({ sync }: { sync: Sync }) {
  const status = useSyncExternalStore(sync.subscribe, sync.status)
  if (status === 'ligado') return null
  if (status === 'offline') {
    return (
      <p className="sync-line" role="status">
        Sem ligação ao servidor. As alterações ficam neste navegador até voltar.
      </p>
    )
  }
  return (
    <p className="sync-line conflict" role="alert">
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
    </p>
  )
}
