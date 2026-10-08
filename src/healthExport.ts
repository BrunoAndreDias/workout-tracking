import { exportReader } from './domain/watchWorkouts.ts'
import type { ExportRead } from './domain/watchWorkouts.ts'
import { isZip, openEntry, zipEntries } from './zip.ts'

const NO_EXPORT = 'O zip não tem o export.xml. Escolhe o export.zip que o Saúde criou.'
const READ_FAILED = 'Não deu para ler o ficheiro até ao fim. Exporta outra vez no iPhone e tenta de novo.'

/** The largest .xml that is not the clinical export_cda.xml: that is export.xml, whatever the phone's language calls it. */
const exportEntry = <T extends { name: string; size: number }>(entries: readonly T[]): T | undefined =>
  entries.filter((e) => /\.xml$/i.test(e.name) && !/_cda\.xml$/i.test(e.name)).sort((a, b) => b.size - a.size)[0]

/**
 * The Watch Workouts in the Health export the user picked, `export.zip` or the `export.xml` inside it, streamed so a
 * multi-GB file never sits in memory. `onProgress` gets the share of the XML read so far, from 0 to 1. Rejects with a
 * pt-PT message.
 */
export async function readHealthExport(file: Blob, onProgress?: (share: number) => void, signal?: AbortSignal): Promise<ExportRead> {
  let bytes: ReadableStream<Uint8Array<ArrayBuffer>> = file.stream()
  let total = file.size
  if (await isZip(file)) {
    const entry = exportEntry(await zipEntries(file))
    if (!entry) throw new Error(NO_EXPORT)
    bytes = await openEntry(file, entry)
    total = entry.size
  }
  let read = 0
  const counted = new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
    transform(chunk, controller) {
      read += chunk.byteLength
      onProgress?.(read / Math.max(total, 1))
      controller.enqueue(chunk)
    },
  })
  const workouts = exportReader()
  const text = bytes.pipeThrough(counted).pipeThrough(new TextDecoderStream()).getReader()
  try {
    for (;;) {
      if (signal?.aborted) {
        await text.cancel()
        throw signal.reason
      }
      const { done, value } = await text.read()
      if (done) break
      workouts.push(value)
    }
  } catch (e) {
    throw signal?.aborted ? e : new Error(READ_FAILED)
  }
  return workouts.finish()
}
