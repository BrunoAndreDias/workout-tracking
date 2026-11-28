import { exportBackup } from '../domain/backup.ts'
import { toIsoDate } from '../domain/dates.ts'
import type { StorageLike } from '../domain/persistence.ts'
import { STORES } from '../domain/stores.ts'
import type { StoreName } from '../domain/stores.ts'

export type ExportResult = { ok: true; skipped: readonly StoreName[] } | { ok: false; error: string }

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadBackup(storage: StorageLike): ExportResult {
  try {
    const { file, skipped } = exportBackup(storage)
    download(`treino-${toIsoDate(new Date())}.json`, JSON.stringify(file, null, 2))
    return { ok: true, skipped }
  } catch {
    return { ok: false, error: 'Não foi possível exportar os dados.' }
  }
}

export function exportProblem(result: ExportResult): string | null {
  if (!result.ok) return result.error
  if (result.skipped.length === 0) return null
  return `Não foi possível exportar: ${result.skipped.map((name) => STORES[name].label).join(', ')}. Os dados guardados no navegador não são válidos e ficaram de fora do ficheiro.`
}
