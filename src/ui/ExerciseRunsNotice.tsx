import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/ids.ts'
import type { ExerciseId, IsoDate, WorkoutPlanId } from '../domain/types.ts'
import { nameLookup } from '../domain/workouts.ts'
import { RUN_EXTENSION, runExtended } from '../domain/blocks.ts'
import type { Exercise, WorkoutBlock, WorkoutDay } from '../domain/workouts.ts'
import type { ExerciseRun } from '../domain/blocks.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { ExercisePicker } from './ExercisePicker.tsx'
import { plural } from './format.ts'

interface Props {
  planId: WorkoutPlanId
  block: WorkoutBlock
  /** The block's Exercise Runs that are due; the notice shows nothing when there are none. */
  due: readonly ExerciseRun[]
  exercises: readonly Exercise[]
  today: IsoDate
  dispatch: Dispatch<WorkoutAction>
}

/** Each due Exercise is kept longer or swapped on every day of the block it is planned in. */
export function ExerciseRunsNotice({ planId, block, due, exercises, today, dispatch }: Props) {
  const [swapping, setSwapping] = useState<ExerciseRun | null>(null)
  if (due.length === 0) return null
  const nameOf = nameLookup(exercises)
  const blockId = block.id
  const days: readonly WorkoutDay[] = block.days
  const daysOf = (run: ExerciseRun) => days.filter((d) => run.dayIds.includes(d.id))
  const extend = (run: ExerciseRun) => {
    const weeks = runExtended(run)
    for (const day of daysOf(run)) {
      const planned = day.exercises.find((p) => p.exerciseId === run.exerciseId)
      if (planned) dispatch({ type: 'setPlannedExercise', planId, blockId, dayId: day.id, planned: { ...planned, weeks } })
    }
  }
  const swap = (run: ExerciseRun, name: string) => {
    const newExerciseId = newId<ExerciseId>()
    for (const dayId of run.dayIds) dispatch({ type: 'swapPlannedExercise', planId, blockId, dayId, exerciseId: run.exerciseId, name, newExerciseId, today })
  }

  return (
    <section className="block-notice" aria-label="Exercícios a rever">
      <p className="block-notice-title">Exercícios a rever</p>
      <ul className="run-list">
        {due.map((run) => {
          const name = nameOf(run.exerciseId)
          return (
            <li key={run.exerciseId} className="run-row">
              <span>
                {name} · {plural(run.done, 'semana feita', 'semanas feitas')}
              </span>
              <span className="run-actions">
                <button type="button" className="secondary" aria-label={`Trocar ${name}`} onClick={() => setSwapping(run)}>
                  Trocar
                </button>
                <button type="button" className="secondary" aria-label={`Mais ${RUN_EXTENSION} semanas de ${name}`} onClick={() => extend(run)}>
                  Mais {RUN_EXTENSION} semanas
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      {swapping && (
        <ExercisePicker
          eyebrow={`Trocar ${nameOf(swapping.exerciseId)}`}
          current={nameOf(swapping.exerciseId)}
          exercises={exercises}
          taken={daysOf(swapping).flatMap((d) => d.exercises.map((p) => nameOf(p.exerciseId)))}
          onPick={(name) => swap(swapping, name)}
          onClose={() => setSwapping(null)}
        />
      )}
    </section>
  )
}
