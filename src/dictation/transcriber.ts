import type { WorkerRequest, WorkerResponse } from './protocol'

export type Progress = { loaded: number; total: number }

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void }

let worker: Worker | undefined
let ready: Promise<void> | undefined
let settleReady: { resolve: () => void; reject: (e: Error) => void } | undefined
let nextId = 0
const pending = new Map<number, Pending>()
const progressListeners = new Set<(p: Progress) => void>()

function start(): Worker {
  if (worker) return worker
  // Created on first use, so the model runtime costs nothing until the user dictates.
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
    const m = e.data
    if (m.type === 'progress') progressListeners.forEach((l) => l(m))
    else if (m.type === 'ready') settleReady?.resolve()
    else if (m.type === 'result') { pending.get(m.id)?.resolve(m.text); pending.delete(m.id) }
    else if (m.id === undefined) { settleReady?.reject(new Error(m.message)); ready = undefined }
    else { pending.get(m.id)?.reject(new Error(m.message)); pending.delete(m.id) }
  })
  worker.addEventListener('error', (e) => {
    const err = new Error(e.message || 'O modelo de voz falhou.')
    settleReady?.reject(err)
    pending.forEach((p) => p.reject(err))
    pending.clear()
    worker?.terminate()
    worker = undefined
    ready = undefined
  })
  return worker
}

const post = (message: WorkerRequest, transfer: Transferable[] = []) => start().postMessage(message, transfer)

/** Loads the model (downloading it the first time). Safe to call repeatedly; the load happens once. */
export function warmUp(onProgress: (p: Progress) => void): Promise<void> {
  progressListeners.add(onProgress)
  if (!ready) {
    ready = new Promise<void>((resolve, reject) => { settleReady = { resolve, reject } })
    post({ type: 'warmUp' })
  }
  return ready.finally(() => progressListeners.delete(onProgress))
}

export function transcribe(audio: Float32Array, onProgress: (p: Progress) => void): Promise<string> {
  const id = nextId++
  progressListeners.add(onProgress)
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    post({ type: 'transcribe', id, audio }, [audio.buffer])
  }).finally(() => progressListeners.delete(onProgress))
}
