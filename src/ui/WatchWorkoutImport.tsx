import { useEffect, useRef, useState } from 'react'
import { latestWatchWorkoutDate } from '../domain/watchWorkouts.ts'
import type { ExportRead, WatchWorkout, WatchWorkoutLog } from '../domain/watchWorkouts.ts'
import { readHealthExport } from '../healthExport.ts'
import { formatDayMonth, formatShortDate, plural } from './format.ts'

interface Props {
  log: WatchWorkoutLog
  onImport: (workouts: readonly WatchWorkout[]) => void
  onDone: (message: string) => void
}

type Reading = { phase: 'idle' } | { phase: 'reading'; percent: number } | { phase: 'read'; result: ExportRead } | { phase: 'failed'; error: string }

/** "132 treinos do relógio, de 3/1 a 6/10" */
function describeWorkouts(workouts: readonly WatchWorkout[]): string {
  const count = plural(workouts.length, 'treino do relógio', 'treinos do relógio')
  const from = workouts[0].date
  const to = workouts[workouts.length - 1].date
  return from === to ? `${count}, de ${formatShortDate(from)}` : `${count}, de ${formatShortDate(from)} a ${formatShortDate(to)}`
}

/** "12 novos. 3 treinos não se leram e ficam de fora." */
function describeRead({ workouts, skipped }: ExportRead, log: WatchWorkoutLog): string {
  const fresh = workouts.filter((w) => !log[w.id]).length
  const news = workouts.length === 0 ? '' : fresh === 0 ? 'Já estão todos na app.' : fresh === workouts.length ? '' : `${plural(fresh, 'novo', 'novos')}.`
  const left = skipped === 0 ? '' : `${plural(skipped, 'treino não se leu e fica de fora', 'treinos não se leram e ficam de fora')}.`
  return [news, left].filter(Boolean).join(' ')
}

/**
 * Shortcuts cannot read workouts, so they come from the Health app's own export, picked here as `export.zip` or the
 * `export.xml` inside it. The file is read in this browser and never sent anywhere; only the workouts are kept.
 */
export function WatchWorkoutImport({ log, onImport, onDone }: Props) {
  const [reading, setReading] = useState<Reading>({ phase: 'idle' })
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const latest = latestWatchWorkoutDate(log)

  useEffect(() => () => controller.current?.abort(), [])

  const read = async (file: File | undefined) => {
    if (!file) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    let shown = 0
    setReading({ phase: 'reading', percent: 0 })
    try {
      const result = await readHealthExport(
        file,
        (share) => {
          const percent = Math.floor(share * 100)
          if (percent !== shown) setReading({ phase: 'reading', percent: (shown = percent) })
        },
        current.signal,
      )
      if (!current.signal.aborted) setReading({ phase: 'read', result })
    } catch (e) {
      if (!current.signal.aborted) setReading({ phase: 'failed', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const found = reading.phase === 'read' ? reading.result : null

  return (
    <section className="health-workouts" aria-labelledby="treinos-do-relogio">
      <h3 id="treinos-do-relogio" className="health-workouts-title">
        Treinos do relógio
      </h3>
      <p className="goals-hint">{latest ? `Último treino importado: ${formatDayMonth(latest)}.` : 'Ainda não importaste treinos do relógio.'} O Atalho não consegue ler os treinos, por isso vêm da exportação do Saúde. O ficheiro é lido aqui e não sai deste dispositivo.</p>
      <ol className="health-steps">
        <li>
          No iPhone, abre a app Saúde e toca na tua foto de perfil.
        </li>
        <li>
          Toca em <strong>Exportar todos os dados de saúde</strong> e espera que acabe.
        </li>
        <li>Guarda o ficheiro em Ficheiros, ou envia-o por AirDrop para o Mac.</li>
        <li>
          Escolhe aqui o <strong>export.zip</strong>. Importar outra vez só junta os treinos novos.
        </li>
      </ol>
      <button type="button" className="secondary" disabled={reading.phase === 'reading'} onClick={() => input.current?.click()}>
        Escolher ficheiro
      </button>
      <input
        ref={input}
        type="file"
        accept=".zip,.xml,application/zip,text/xml"
        hidden
        aria-label="Exportação do Saúde"
        onChange={(e) => {
          void read(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {reading.phase === 'reading' && (
        <p className="goals-hint" role="status">
          A ler o ficheiro… {reading.percent} %
        </p>
      )}
      {reading.phase === 'failed' && (
        <p className="backup-error" role="alert">
          {reading.error}
        </p>
      )}
      {found && (
        <>
          <p className="backup-summary">{found.workouts.length > 0 ? describeWorkouts(found.workouts) : 'O ficheiro não tem treinos.'}</p>
          {describeRead(found, log) && <p className="goals-hint">{describeRead(found, log)}</p>}
          <button
            type="button"
            className="primary"
            disabled={found.workouts.length === 0}
            onClick={() => {
              onImport(found.workouts)
              onDone(`Importados ${describeWorkouts(found.workouts)}.`)
            }}
          >
            Importar treinos
          </button>
        </>
      )}
    </section>
  )
}
