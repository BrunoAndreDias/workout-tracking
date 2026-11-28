import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import type { EquipmentAction, EquipmentState } from '../domain/equipment.ts'
import { newId } from '../domain/ids.ts'
import type { IsoDate, WorkoutSessionId } from '../domain/types.ts'
import { blockChanges, currentBlock, exerciseRuns, findDay, nextDay } from '../domain/blocks.ts'
import { sessionsBefore, sessionsOn } from '../domain/sessions.ts'
import type { BlockPosition } from '../domain/blocks.ts'
import { nameLookup } from '../domain/workouts.ts'
import type { Exercise, WorkoutBlock, WorkoutDay, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { DateStepper } from './DateStepper.tsx'
import { EquipmentContext } from './equipmentContext.ts'
import { EquipmentView } from './EquipmentView.tsx'
import { ExerciseRunsNotice } from './ExerciseRunsNotice.tsx'
import { RecentSessions } from './RecentSessions.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { sessionTitle } from './format.ts'
import { WorkoutPlanEditor } from './WorkoutPlanEditor.tsx'
import { WorkoutSessionCard } from './WorkoutSessionCard.tsx'

interface Props {
  state: WorkoutState
  dispatch: Dispatch<WorkoutAction>
  date: IsoDate
  today: IsoDate
  onDate: (date: IsoDate) => void
  equipment: EquipmentState
  dispatchEquipment: Dispatch<EquipmentAction>
}

function blockLine(block: WorkoutBlock, position: BlockPosition | null): string {
  return [block.name, ...(position ? [`semana ${position.week} de ${block.weeks}`] : []), ...(block.light ? ['leve'] : [])].join(' · ')
}

function BlockNotice({ block, previous, exercises }: { block: WorkoutBlock; previous: WorkoutBlock; exercises: readonly Exercise[] }) {
  const { entering, leaving } = blockChanges(previous, block)
  const nameOf = nameLookup(exercises)
  return (
    <section className="block-notice" aria-label="Novo bloco">
      <p className="block-notice-title">Começa o {block.name} esta semana.</p>
      {entering.length > 0 && <p>Entram: {entering.map(nameOf).join(', ')}</p>}
      {leaving.length > 0 && <p>Saem: {leaving.map(nameOf).join(', ')}</p>}
    </section>
  )
}

const TABS = [
  { id: 'registo', label: 'Registo' },
  { id: 'plano', label: 'Plano de treino' },
  { id: 'material', label: 'Material' },
] as const

export function WorkoutView({ state, dispatch, date, today, onDate, equipment, dispatchEquipment }: Props) {
  const equipmentStore = useMemo(() => ({ state: equipment, dispatch: dispatchEquipment }), [equipment, dispatchEquipment])
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('registo')
  const [adding, setAdding] = useState(false)
  const sessions = sessionsOn(state.sessions, date)
  const activePlan = state.plans.find((p) => p.id === state.activePlanId)
  const { block, position } = activePlan ? currentBlock(activePlan, state.sessions, date) : { block: undefined, position: null }
  const next = activePlan && nextDay(activePlan, state.sessions, date)
  const days: readonly WorkoutDay[] = block?.days ?? []
  const goTo = (to: IsoDate) => {
    setAdding(false)
    onDate(to)
  }
  const start = (day: WorkoutDay | null) => {
    dispatch({ type: 'startSession', sessionId: newId<WorkoutSessionId>(), date, day, light: block?.light ?? false })
    setAdding(false)
  }

  return (
    <EquipmentContext value={equipmentStore}>
      <h1 className="sr-only">Treino</h1>
      <div className="plan-bar view-bar">
        <nav className="tabs" aria-label="Treino">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={t.id === tab ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <ThemeToggle />
      </div>

      {tab === 'material' ? (
        <EquipmentView exercises={state.exercises} />
      ) : tab === 'plano' ? (
        <WorkoutPlanEditor state={state} dispatch={dispatch} today={today} />
      ) : (
        <>
          <DateStepper date={date} today={today} onDate={goTo} label="Data do treino" />
          {date <= today && <RecentSessions state={state} date={date} dispatch={dispatch} />}

          {sessions.map((s) => {
            const day = s.workoutDayId === null ? undefined : findDay(state.plans, s.workoutDayId)
            return <WorkoutSessionCard key={s.id} session={s} before={sessionsBefore(state.sessions, s)} day={day} title={sessionTitle(s, state.plans)} exercises={state.exercises} dispatch={dispatch} />
          })}

          {sessions.length > 0 && !adding ? (
            <button type="button" className="add-session" onClick={() => setAdding(true)}>
              + Outro treino neste dia
            </button>
          ) : (
            <section className="card day-empty" aria-labelledby="comecar-treino">
              {date <= today && position?.movedFrom && <BlockNotice block={position.block} previous={position.movedFrom} exercises={state.exercises} />}
              {date <= today && activePlan && block && (
                <ExerciseRunsNotice
                  planId={activePlan.id}
                  block={block}
                  due={exerciseRuns(block, state.sessions, date).filter((r) => r.due)}
                  exercises={state.exercises}
                  today={today}
                  dispatch={dispatch}
                />
              )}
              {date <= today && block && <p className="block-line">{blockLine(block, position)}</p>}
              <h2 id="comecar-treino" className="session-title">
                {sessions.length > 0 ? 'Outro treino' : 'Sem treino registado'}
              </h2>
              {date > today ? (
                <p className="muted">Dia futuro. Só podes registar até hoje.</p>
              ) : (
                <>
                  <p className="muted">
                    {activePlan && next
                      ? 'As séries vêm com o alvo sugerido a partir da última vez. Um toque em ✓ marca cada série feita.'
                      : 'Ainda não tens plano de treino. Cria um em Plano de treino, ou regista um treino livre.'}
                  </p>
                  <div className="day-start">
                    {next && (
                      <button type="button" className="primary" onClick={() => start(next)}>
                        Começar {next.name}
                      </button>
                    )}
                    {days
                      .filter((d) => d.id !== next?.id)
                      .map((d) => (
                        <button key={d.id} type="button" className="secondary" onClick={() => start(d)}>
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
    </EquipmentContext>
  )
}
