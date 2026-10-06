import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import type { ExerciseId, WorkoutDayId, WorkoutPlanId } from '../domain/types.ts'
import { parseRepRange } from '../domain/workouts.ts'
import type { RepRange, WorkoutAction, WorkoutState } from '../domain/workouts.ts'
import { CountField } from './CountField.tsx'
import { ExerciseAdder } from './ExerciseAdder.tsx'
import { CloseIcon } from './icons.tsx'
import { InlineName } from './InlineName.tsx'

function RepsField({ value, label, onCommit }: { value: RepRange; label: string; onCommit: (reps: RepRange) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      className="count-input reps-input"
      type="text"
      aria-label={label}
      value={text ?? (value.min === value.max ? `${value.min}` : `${value.min}–${value.max}`)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        const reps = parseRepRange(e.target.value)
        if (reps) onCommit(reps)
      }}
      onBlur={() => setText(null)}
    />
  )
}

export function WorkoutPlanEditor({ state, dispatch }: { state: WorkoutState; dispatch: Dispatch<WorkoutAction> }) {
  const plan = state.plans.find((p) => p.id === state.activePlanId)
  const names = new Map(state.exercises.map((e) => [e.id, e.name]))
  const createPlan = () => dispatch({ type: 'createPlan', planId: newId<WorkoutPlanId>(), name: `Plano de treino ${state.plans.length + 1}` })

  if (!plan) {
    return (
      <section className="card day-empty" aria-labelledby="sem-plano-treino">
        <h2 id="sem-plano-treino" className="session-title">Sem plano de treino</h2>
        <p className="muted">Escreve aqui o teu plano: os dias de treino e, em cada um, os exercícios com séries e repetições.</p>
        <div className="day-start">
          <button type="button" className="primary" onClick={createPlan}>
            Criar plano de treino
          </button>
        </div>
      </section>
    )
  }

  const planId = plan.id
  return (
    <>
      <div className="plan-bar">
        <nav className="tabs" aria-label="Planos de treino">
          {state.plans.map((p) => (
            <button key={p.id} type="button" className="tab" aria-current={p.id === planId ? 'page' : undefined} onClick={() => dispatch({ type: 'activatePlan', planId: p.id })}>
              {p.name}
            </button>
          ))}
          <button type="button" className="tab tab-add" onClick={createPlan}>
            + Novo plano
          </button>
        </nav>
        <div className="plan-actions">
          <button
            type="button"
            className="quiet-btn danger"
            onClick={() => {
              if (window.confirm(`Eliminar o plano de treino "${plan.name}"? Os treinos registados ficam.`)) dispatch({ type: 'deletePlan', planId })
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      <h2 className="workout-plan-title">
        <InlineName name={plan.name} label="Nome do plano de treino" onRename={(name) => dispatch({ type: 'renamePlan', planId, name })} />
      </h2>
      <p className="muted workout-plan-note">O plano ativo é o que aparece ao começar um treino.</p>

      {plan.days.map((day) => {
        const dayId = day.id
        return (
          <section key={dayId} className="card workout-day" aria-label={day.name}>
            <header className="session-head">
              <h3 className="session-title">
                <InlineName name={day.name} label="Nome do dia de treino" onRename={(name) => dispatch({ type: 'renameDay', planId, dayId, name })} />
              </h3>
              <button
                type="button"
                className="link-btn danger"
                onClick={() => {
                  if (window.confirm(`Remover o dia "${day.name}"?`)) dispatch({ type: 'removeDay', planId, dayId })
                }}
              >
                Remover dia
              </button>
            </header>
            {day.exercises.length === 0 && <p className="muted workout-empty">Sem exercícios. Escreve o nome de um abaixo.</p>}
            <ul className="planned-list">
              {day.exercises.map((p) => {
                const name = names.get(p.exerciseId) ?? 'Exercício desconhecido'
                const set = (change: Partial<typeof p>) => dispatch({ type: 'setPlannedExercise', planId, dayId, planned: { ...p, ...change } })
                return (
                  <li key={p.exerciseId} className="planned">
                    <span className="planned-name">{name}</span>
                    <span className="planned-fields">
                      <CountField value={p.sets} required label={`Séries de ${name}`} onCommit={(n) => n && set({ sets: n })} />
                      <span className="unit">×</span>
                      <RepsField value={p.reps} label={`Repetições de ${name}`} onCommit={(reps) => set({ reps })} />
                      <span className="unit">reps</span>
                    </span>
                    <button type="button" className="icon-btn" aria-label={`Remover ${name} de ${day.name}`} onClick={() => dispatch({ type: 'removePlannedExercise', planId, dayId, exerciseId: p.exerciseId })}>
                      <CloseIcon />
                    </button>
                  </li>
                )
              })}
            </ul>
            <ExerciseAdder exercises={state.exercises} onAdd={(name) => dispatch({ type: 'addPlannedExercise', planId, dayId, name, newExerciseId: newId<ExerciseId>() })} />
          </section>
        )
      })}

      <button type="button" className="add-meal" onClick={() => dispatch({ type: 'addDay', planId, dayId: newId<WorkoutDayId>(), name: `Dia ${plan.days.length + 1}` })}>
        + Adicionar dia
      </button>
    </>
  )
}
