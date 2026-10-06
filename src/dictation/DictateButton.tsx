import { useEffect, useRef, useState } from 'react'
import { MicIcon, StopIcon } from '../ui/icons'
import { appendDictation } from './appendDictation'
import { transcribe, warmUp, type Progress } from './transcriber'

type Dictation =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'loading'; loaded: number; total: number }
  | { kind: 'transcribing' }
  | { kind: 'error'; message: string }

const SAMPLE_RATE = 16000
const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const mb = (bytes: number) => Math.round(bytes / 1e6)

function statusText(d: Dictation): string {
  switch (d.kind) {
    case 'idle': return ''
    case 'recording': return 'A ouvir…'
    case 'loading': return d.total > 0 ? `A descarregar o modelo de voz: ${mb(d.loaded)} / ${mb(d.total)} MB (só da primeira vez)` : 'A preparar o modelo de voz…'
    case 'transcribing': return 'A transcrever…'
    case 'error': return d.message
  }
}

async function decode(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
  try {
    return (await ctx.decodeAudioData(await blob.arrayBuffer())).getChannelData(0)
  } finally {
    void ctx.close()
  }
}

/** A mic button for a note field. Absolutely placed by `.note-field`; the status line sits under the field. */
export function DictateButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [state, setState] = useState<Dictation>({ kind: 'idle' })
  const latest = useRef({ value, onChange })
  useEffect(() => { latest.current = { value, onChange } })
  const recorder = useRef<MediaRecorder | null>(null)

  useEffect(() => () => {
    // A note closed mid-recording must not leave the microphone on.
    const r = recorder.current
    if (r && r.state !== 'inactive') { r.onstop = null; r.stop() }
    r?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  if (!supported) return null

  async function start() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState({ kind: 'error', message: 'Sem acesso ao microfone.' })
      return
    }
    const chunks: Blob[] = []
    const r = new MediaRecorder(stream)
    recorder.current = r
    r.ondataavailable = (e) => chunks.push(e.data)

    // Loading overlaps with the user talking; only what is left after they stop is shown.
    let progress: Progress = { loaded: 0, total: 0 }
    let stopped = false
    const warm = warmUp((p) => {
      progress = p
      if (stopped) setState({ kind: 'loading', ...p })
    })
    warm.catch(() => {}) // surfaced below, once the user stops

    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      recorder.current = null
      stopped = true
      try {
        setState({ kind: 'loading', ...progress })
        const [audio] = await Promise.all([decode(new Blob(chunks, { type: chunks[0]?.type })), warm])
        setState({ kind: 'transcribing' })
        const text = await transcribe(audio, () => {})
        latest.current.onChange(appendDictation(latest.current.value, text))
        setState({ kind: 'idle' })
      } catch {
        setState({ kind: 'error', message: 'Não foi possível transcrever. Tenta outra vez.' })
      }
    }
    r.start()
    setState({ kind: 'recording' })
  }

  const recording = state.kind === 'recording'
  const busy = state.kind === 'loading' || state.kind === 'transcribing'

  return (
    <>
      <button
        type="button"
        className={`icon-btn dictate-btn${recording ? ' recording' : ''}`}
        aria-label={recording ? 'Parar ditado' : 'Ditar nota'}
        aria-pressed={recording}
        disabled={busy}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
      >
        {recording ? <StopIcon /> : <MicIcon />}
      </button>
      <p className="dictate-status hint muted" role="status" aria-live="polite">{statusText(state)}</p>
    </>
  )
}
