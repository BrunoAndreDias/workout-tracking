import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import type { IsoDate, WorkoutSessionId } from '../domain/types.ts'
import { findDay, sessionsOn } from '../domain/workouts.ts'
import type { WorkoutAction, WorkoutDay, WorkoutState } from '../domain/workouts.ts'
import { DateStepper } from './DateStepper.tsx'
import { sessionTitle } from './format.ts'
import { WorkoutPlanEditor } from './WorkoutPlanEditor.tsx'
import { WorkoutSessionCard } from './WorkoutSessionCard.tsx'

interface Props {
  state: WorkoutState
  dispatch: Dispatch<WorkoutAction>
  date: IsoDate
  today: IsoDate
  onDate: (date: IsoDate) => void
}

const TABS = [
  { id: 'registo', label: 'Registo' },
  { id: 'plano', label: 'Plano de treino' },
] as const

export function WorkoutView({ state, dispatch, date, today, onDate }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('registo')
  const [adding, setAdding] = useState(false)
  const sessions = sessionsOn(state.sessions, date)
  const activePlan = state.plans.find((p) => p.id === state.activePlanId)
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
        <WorkoutPlanEditor state={state} dispatch={dispatch} />
      ) : (
        <>
          <DateStepper date={date} today={today} onDate={goTo} label="Data do treino" />

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
              <h2 id="comecar-treino" className="session-title">
                {sessions.length > 0 ? 'Outro treino' : 'Sem treino registado'}
              </h2>
              {date > today ? (
                <p className="muted">Dia futuro. Só podes registar até hoje.</p>
              ) : (
                <>
                  <p className="muted">
                    {activePlan && activePlan.days.length > 0
                      ? `Começa por um dia de ${activePlan.name}: as séries vêm preenchidas com o que fizeste da última vez.`
                      : 'Ainda não tens dias de treino. Escreve-os em Plano de treino, ou regista um treino livre.'}
                  </p>
                  <div className="day-start">
                    {activePlan?.days.map((d, i) => (
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
