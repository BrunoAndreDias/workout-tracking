import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import type { IsoDate, WorkoutSessionId } from '../domain/types.ts'
import { watchWorkoutsOn } from '../domain/watchWorkouts.ts'
import type { WatchWorkoutLog } from '../domain/watchWorkouts.ts'
import { blockChanges, currentBlock, findDay, sessionsOn } from '../domain/workouts.ts'
import type { BlockPosition, Exercise, WorkoutAction, WorkoutBlock, WorkoutDay, WorkoutState } from '../domain/workouts.ts'
import { DateStepper } from './DateStepper.tsx'
import { RecentSessions } from './RecentSessions.tsx'
import { formatRange, sessionTitle } from './format.ts'
import { WatchWorkoutLine } from './WorkoutLines.tsx'
import { WorkoutPlanEditor } from './WorkoutPlanEditor.tsx'
import { WorkoutSessionCard } from './WorkoutSessionCard.tsx'

interface Props {
  state: WorkoutState
  dispatch: Dispatch<WorkoutAction>
  date: IsoDate
  today: IsoDate
  onDate: (date: IsoDate) => void
  watch: WatchWorkoutLog
}

function blockLine(block: WorkoutBlock, position: BlockPosition | null): string {
  if (!position) return block.name
  return [block.name, `semana ${position.week} de ${block.weeks}`, ...(position.rir ? [`RIR ${formatRange(position.rir)}`] : [])].join(' · ')
}

function BlockNotice({ block, previous, exercises }: { block: WorkoutBlock; previous: WorkoutBlock; exercises: readonly Exercise[] }) {
  const { entering, leaving } = blockChanges(previous, block)
  const names = (ids: readonly string[]) => ids.map((id) => exercises.find((e) => e.id === id)?.name ?? 'Exercício desconhecido').join(', ')
  return (
    <section className="block-notice" aria-label="Novo bloco">
      <p className="block-notice-title">Começa o {block.name} esta semana.</p>
      {entering.length > 0 && <p>Entram: {names(entering)}</p>}
      {leaving.length > 0 && <p>Saem: {names(leaving)}</p>}
    </section>
  )
}

const TABS = [
  { id: 'registo', label: 'Registo' },
  { id: 'plano', label: 'Plano de treino' },
] as const

export function WorkoutView({ state, dispatch, date, today, onDate, watch }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('registo')
  const [adding, setAdding] = useState(false)
  const sessions = sessionsOn(state.sessions, date)
  const watched = watchWorkoutsOn(watch, date)
  const activePlan = state.plans.find((p) => p.id === state.activePlanId)
  const { block, position } = activePlan ? currentBlock(activePlan, state.sessions, date) : { block: undefined, position: null }
  const goTo = (next: IsoDate) => {
    setAdding(false)
    onDate(next)
  }
  const start = (day: WorkoutDay | null) => {
    dispatch({ type: 'startSession', sessionId: newId<WorkoutSessionId>(), date, day })
    setAdding(false)
  }

  return (
    <>
      <h1 className="sr-only">Treino</h1>
      <div className="plan-bar">
        <nav className="tabs" aria-label="Treino">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={t.id === tab ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'plano' ? (
        <WorkoutPlanEditor state={state} dispatch={dispatch} today={today} />
      ) : (
        <>
          <DateStepper date={date} today={today} onDate={goTo} label="Data do treino" />
          {date <= today && <RecentSessions state={state} date={date} dispatch={dispatch} />}

          {watched.length > 0 && (
            <ul className="watch-workouts" aria-label="Treinos do relógio">
              {watched.map((w) => (
                <li key={w.id} className="workout-line">
                  <WatchWorkoutLine workout={w} />
                </li>
              ))}
            </ul>
          )}

          {sessions.map((s) => {
            const day = s.workoutDayId === null ? undefined : findDay(state.plans, s.workoutDayId)
            return <WorkoutSessionCard key={s.id} session={s} day={day} title={sessionTitle(s, state.plans)} exercises={state.exercises} dispatch={dispatch} />
          })}

          {sessions.length > 0 && !adding ? (
            <button type="button" className="add-meal" onClick={() => setAdding(true)}>
              + Outro treino neste dia
            </button>
          ) : (
            <section className="card day-empty" aria-labelledby="comecar-treino">
              {date <= today && position?.movedFrom && <BlockNotice block={position.block} previous={position.movedFrom} exercises={state.exercises} />}
              {date <= today && block && <p className="block-line">{blockLine(block, position)}</p>}
              <h2 id="comecar-treino" className="session-title">
                {sessions.length > 0 ? 'Outro treino' : watched.length > 0 ? 'Registar as séries' : 'Sem treino registado'}
              </h2>
              {date > today ? (
                <p className="muted">Dia futuro. Só podes registar até hoje.</p>
              ) : (
                <>
                  <p className="muted">
                    {activePlan && block && block.days.length > 0
                      ? `Começa por um dia de ${activePlan.name}: as séries vêm preenchidas com o que fizeste da última vez.`
                      : 'Ainda não tens dias de treino. Escreve-os em Plano de treino, ou regista um treino livre.'}
                  </p>
                  <div className="day-start">
                    {block?.days.map((d, i) => (
                      <button key={d.id} type="button" className={i === 0 ? 'primary' : 'secondary'} onClick={() => start(d)}>
                        {d.name}
                      </button>
                    ))}
                    <button type="button" className="secondary" onClick={() => start(null)}>
                      Treino livre
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  )
}
