export type WorkerRequest =
  | { type: 'warmUp' }
  | { type: 'transcribe'; id: number; audio: Float32Array }

export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }
