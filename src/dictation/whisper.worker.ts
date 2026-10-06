import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { WorkerRequest, WorkerResponse } from './protocol'

const send = (message: WorkerResponse) => self.postMessage(message)

let loading: Promise<AutomaticSpeechRecognitionPipeline> | undefined

function load() {
  // Progress arrives per file, so keep each file's latest figures and report the sum.
  const files = new Map<string, { loaded: number; total: number }>()
  loading ??= (
    pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status !== 'progress' || !p.total) return
        files.set(p.file, { loaded: p.loaded, total: p.total })
        let loaded = 0
        let total = 0
        for (const f of files.values()) { loaded += f.loaded; total += f.total }
        send({ type: 'progress', loaded, total })
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>
  ).catch((e) => {
    loading = undefined // a failed download must be retryable
    throw e
  })
  return loading
}

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const request = e.data
  try {
    const asr = await load()
    if (request.type === 'warmUp') return send({ type: 'ready' })
    const out = await asr(request.audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30 })
    const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
    send({ type: 'result', id: request.id, text: text.trim() })
  } catch (err) {
    send({ type: 'error', id: request.type === 'transcribe' ? request.id : undefined, message: err instanceof Error ? err.message : String(err) })
  }
})
