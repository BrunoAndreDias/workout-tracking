import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import type { ExerciseId } from '../domain/types.ts'
import type { Exercise, PlannedExercise, WorkoutAction, WorkoutDay, WorkoutSession } from '../domain/workouts.ts'
import { CountField } from './CountField.tsx'
import { ExerciseAdder } from './ExerciseAdder.tsx'
import { formatPlanned } from './format.ts'
import { CloseIcon, PlusIcon } from './icons.tsx'

interface Props {
  session: WorkoutSession
  /** The Workout Day it started from, as the plan has it now; undefined when blank or since deleted. */
  day: WorkoutDay | undefined
  title: string
  exercises: readonly Exercise[]
  dispatch: Dispatch<WorkoutAction>
}

export function WorkoutSessionCard({ session, day, title, exercises, dispatch }: Props) {
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const planned = new Map<ExerciseId, PlannedExercise>(day?.exercises.map((p) => [p.exerciseId, p]))
  const sessionId = session.id
  return (
    <section className="card session" aria-label={title}>
      <header className="session-head">
        <h2 className="session-title">{title}</h2>
        <button
          type="button"
          className="link-btn danger"
          onClick={() => {
            if (window.confirm(`Eliminar o treino "${title}"?`)) dispatch({ type: 'deleteSession', sessionId })
          }}
        >
          Eliminar treino
        </button>
      </header>

      {session.exercises.map(({ exerciseId, sets }) => {
        const name = names.get(exerciseId) ?? 'Exercício desconhecido'
        const target = planned.get(exerciseId)
        return (
          <div key={exerciseId} className="lift" role="group" aria-label={name}>
            <div className="lift-head">
              <h3 className="lift-name">{name}</h3>
              {target && <span className="lift-target">Plano {formatPlanned(target)}</span>}
              <button type="button" className="icon-btn" aria-label={`Remover ${name}`} onClick={() => dispatch({ type: 'removeSessionExercise', sessionId, exerciseId })}>
                <CloseIcon />
              </button>
            </div>
            <ol className="sets">
              {sets.map((set, index) => (
                <li key={index} className="set-row">
                  <span className="set-num">{index + 1}</span>
                  <label className="set-field">
                    <CountField value={set.reps} label={`Repetições da série ${index + 1} de ${name}`} onCommit={(reps) => dispatch({ type: 'setSet', sessionId, exerciseId, index, set: { ...set, reps } })} />
                    <span className="unit">reps</span>
                  </label>
                  <label className="set-field">
                    <CountField
                      value={set.kg}
                      decimal
                      placeholder="—"
                      label={`Kg da série ${index + 1} de ${name}`}
                      onCommit={(kg) => dispatch({ type: 'setSet', sessionId, exerciseId, index, set: { ...set, kg } })}
                    />
                    <span className="unit">kg</span>
                  </label>
                  <button type="button" className="icon-btn" aria-label={`Remover série ${index + 1} de ${name}`} onClick={() => dispatch({ type: 'removeSet', sessionId, exerciseId, index })}>
                    <CloseIcon size={14} />
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="text-btn" aria-label={`Adicionar série a ${name}`} onClick={() => dispatch({ type: 'addSet', sessionId, exerciseId })}>
              <PlusIcon />
              Série
            </button>
          </div>
        )
      })}

      <div className="session-foot">
        <ExerciseAdder exercises={exercises} onAdd={(name) => dispatch({ type: 'addSessionExercise', sessionId, name, newExerciseId: newId<ExerciseId>() })} />
        <p className="hint muted">Sem kg é peso corporal.</p>
        <textarea
          className="notes-input"
          aria-label="Notas do treino"
          placeholder="Como correu, dores, ajustes"
          rows={2}
          value={session.notes}
          onChange={(e) => dispatch({ type: 'setSessionNotes', sessionId, notes: e.target.value })}
        />
      </div>
    </section>
  )
}
