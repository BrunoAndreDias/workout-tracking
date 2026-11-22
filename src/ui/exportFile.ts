import { exportBackup } from '../domain/backup.ts'
import { toIsoDate } from '../domain/dates.ts'
import type { StorageLike } from '../domain/persistence.ts'
import type { StoreName } from '../domain/stores.ts'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadBackup(storage: StorageLike): readonly StoreName[] {
  const { file, skipped } = exportBackup(storage)
  download(`treino-${toIsoDate(new Date())}.json`, JSON.stringify(file, null, 2))
  return skipped
}
