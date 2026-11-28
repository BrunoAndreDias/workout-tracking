import { useContext, useState } from 'react'
import type { Dispatch } from 'react'
import { missingAt } from '../domain/equipment.ts'
import { MUSCLE_LABEL } from '../domain/exerciseCatalog.ts'
import { dayMuscleSets } from '../domain/muscles.ts'
import type { DayMuscle } from '../domain/muscles.ts'
import { newId } from '../domain/ids.ts'
import { defaultRole, ROLE_LABEL, ROLES } from '../domain/splits.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from '../domain/types.ts'
import { isRunDue, isRunWeeks, weeksRun } from '../domain/blocks.ts'
import { nameLookup } from '../domain/workouts.ts'
import type { Role, WorkoutDay, WorkoutSession, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { CountField } from './CountField.tsx'
import { EquipmentContext } from './equipmentContext.ts'
import { ExercisePicker } from './ExercisePicker.tsx'
import { materialText, plural } from './format.ts'
import { CloseIcon, PlusIcon } from './icons.tsx'
import { RangeField } from './RangeField.tsx'

function DayMuscles({ day, muscles }: { day: string; muscles: readonly DayMuscle[] }) {
  const most = Math.max(...muscles.map((m) => m.sets))
  return (
    <aside className="day-muscle-sets" aria-label={`Músculos de ${day}`}>
      <h4 className="day-muscles-title">Músculos neste dia</h4>
      <ul className="day-muscle-rows">
        {muscles.map((m) => (
          <li key={m.muscle} className="day-muscle">
            <span className="muscle-name">{MUSCLE_LABEL[m.muscle]}</span>
            <span className="muscle-sets">{plural(m.sets, 'série', 'séries')}</span>
            <span className="track muscle-track" aria-hidden="true">
              <span style={{ width: `${(m.sets / most) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

interface DayProps {
  planId: WorkoutPlanId
  blockId: WorkoutBlockId
  day: WorkoutDay
  before: ReadonlySet<ExerciseId> | null
  exercises: WorkoutState['exercises']
  runs: readonly WorkoutSession[] | null
  today: IsoDate
  dispatch: Dispatch<WorkoutAction>
}

function RunLine({ weeks, done }: { weeks: number | null; done: number }) {
  if (isRunDue(weeks, done)) return <span className="missing-line">Rever: {plural(done, 'semana feita', 'semanas feitas')}</span>
  return <span className="run-line">{weeks === null ? `semana ${done + 1} · sem limite` : `semana ${done + 1} de ${weeks}`}</span>
}

export function DayEditor({ planId, blockId, day, before, exercises, runs, today, dispatch }: DayProps) {
  const [picking, setPicking] = useState<{ swapping: ExerciseId | null } | null>(null)
  const { state: equipment } = useContext(EquipmentContext)
  const dayId: WorkoutDayId = day.id
  const nameOf = nameLookup(exercises)
  const muscles = dayMuscleSets(day, nameOf)
  const onPick = (name: string) => {
    const swapping = picking?.swapping ?? null
    if (swapping === null) dispatch({ type: 'addPlannedExercise', planId, blockId, dayId, name, role: defaultRole(name), newExerciseId: newId<ExerciseId>(), today })
    else dispatch({ type: 'swapPlannedExercise', planId, blockId, dayId, exerciseId: swapping, name, newExerciseId: newId<ExerciseId>(), today })
  }

  return (
    <section className={muscles.length > 0 ? 'card workout-day day-trains' : 'card workout-day'} aria-label={day.name}>
      {muscles.length > 0 && <DayMuscles day={day.name} muscles={muscles} />}
      <div className="day-planned">
        {day.exercises.length === 0 && <p className="muted workout-empty">Sem exercícios. Adiciona o primeiro abaixo.</p>}
        <ul className="planned-list">
          {day.exercises.map((p) => {
            const name = nameOf(p.exerciseId)
            const isNew = before !== null && !before.has(p.exerciseId)
            const missing = missingAt(equipment, name)
            const set = (change: Partial<typeof p>) => dispatch({ type: 'setPlannedExercise', planId, blockId, dayId, planned: { ...p, ...change } })
            return (
              <li key={p.exerciseId} className="planned">
                <span className="planned-main">
                  <span className="role-pick">
                    <span className="role-label">{ROLE_LABEL[p.role]}</span>
                    <span className="stepper-caret" aria-hidden="true">
                      ▾
                    </span>
                    <select aria-label={`Função de ${name}`} value={p.role} onChange={(e) => set({ role: e.target.value as Role })}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className={isNew ? 'planned-name planned-new' : 'planned-name'}>
                    {name}
                    {isNew && ' · novo'}
                  </span>
                  {missing.length > 0 && <span className="missing-line">Falta: {materialText(equipment, missing)}</span>}
                  {runs && <RunLine weeks={p.weeks} done={weeksRun(p, runs, today)} />}
                </span>
                <span className="planned-fields">
                  <CountField value={p.sets} required label={`Séries de ${name}`} min={1} onCommit={(sets) => set({ sets })} />
                  <span className="unit">×</span>
                  <RangeField value={p.reps} label={`Repetições de ${name}`} onCommit={(reps) => set({ reps })} />
                  <span className="unit">reps</span>
                  <CountField value={p.weeks} placeholder="∞" label={`Semanas de ${name}`} onCommit={(weeks) => isRunWeeks(weeks) && set({ weeks })} />
                  <span className="unit">semanas</span>
                </span>
                <button type="button" className="icon-btn planned-swap" aria-label={`Trocar ${name}`} onClick={() => setPicking({ swapping: p.exerciseId })}>
                  ⇄
                </button>
                <button type="button" className="icon-btn" aria-label={`Remover ${name} de ${day.name}`} onClick={() => dispatch({ type: 'removePlannedExercise', planId, blockId, dayId, exerciseId: p.exerciseId })}>
                  <CloseIcon />
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className="text-btn add-exercise" onClick={() => setPicking({ swapping: null })}>
          <PlusIcon />
          Exercício
        </button>
      </div>
      {picking && (
        <ExercisePicker
          eyebrow={day.name}
          current={picking.swapping === null ? null : nameOf(picking.swapping)}
          exercises={exercises}
          taken={day.exercises.map((p) => nameOf(p.exerciseId))}
          onPick={onPick}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  )
}
