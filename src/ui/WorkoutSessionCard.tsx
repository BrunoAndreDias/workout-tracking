import { useId, useState } from 'react'
import type { Dispatch } from 'react'
import { MUSCLE_LABEL } from '../domain/exerciseCatalog.ts'
import { doneMuscleSets, MUSCLES } from '../domain/muscles.ts'
import { newId } from '../domain/plans.ts'
import { ROLE_REPS } from '../domain/splits.ts'
import type { ExerciseId, WorkoutSessionId } from '../domain/types.ts'
import { doneSets, nameLookup, suggestion } from '../domain/workouts.ts'
import type { Exercise, PlannedExercise, SessionExercise, SetValues, WorkoutAction, WorkoutDay, WorkoutSession } from '../domain/workouts.ts'
import { AfterEffects } from './AfterEffects.tsx'
import { CountField } from './CountField.tsx'
import { ExercisePicker } from './ExercisePicker.tsx'
import { formatPlanned, plural } from './format.ts'
import { CloseIcon, PlusIcon } from './icons.tsx'
import { RatingScale } from './RatingScale.tsx'
import { TimedNoteField } from './TimedNoteField.tsx'

interface Props {
  session: WorkoutSession
  /** The sessions logged before this one, which its suggestions come from. */
  before: readonly WorkoutSession[]
  /** The Workout Day it started from, as the plan has it now; undefined when blank or since deleted. */
  day: WorkoutDay | undefined
  title: string
  exercises: readonly Exercise[]
  dispatch: Dispatch<WorkoutAction>
}

export function WorkoutSessionCard({ session, before, day, title, exercises, dispatch }: Props) {
  const [picking, setPicking] = useState(false)
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const nameOf = nameLookup(exercises)
  const trained = doneMuscleSets([session], nameOf).muscles
  const muscles = MUSCLES.filter((m) => trained[m] > 0)
  const planned = new Map<ExerciseId, PlannedExercise>(day?.exercises.map((p) => [p.exerciseId, p]))
  const sessionId = session.id
  const total = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const done = session.exercises.reduce((n, e) => n + doneSets(e), 0)
  const current = session.exercises.find((e) => e.sets.some((s) => !s.done))?.exerciseId
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

      {session.exercises.map((exercise) => {
        const plan = planned.get(exercise.exerciseId)
        const target = exercise.target
        const note = target && suggestion(before, exercise.exerciseId, session.date, target.rir, plan?.reps ?? ROLE_REPS.isolation)?.note
        return (
          <Lift
            key={exercise.exerciseId}
            sessionId={sessionId}
            exercise={exercise}
            name={nameOf(exercise.exerciseId)}
            plan={plan}
            note={note ?? null}
            current={exercise.exerciseId === current}
            dispatch={dispatch}
          />
        )
      })}

      <div className="session-foot">
        {total > 0 && (
          <p className="sets-done" aria-live="polite">
            {done}/{total} séries feitas
          </p>
        )}
        {muscles.length > 0 && <p className="muted session-muscles">Músculos: {muscles.map((m) => `${MUSCLE_LABEL[m]} ${trained[m]}`).join(' · ')}</p>}
        <button type="button" className="text-btn add-exercise" onClick={() => setPicking(true)}>
          <PlusIcon />
          Exercício
        </button>
        {picking && (
          <ExercisePicker
            eyebrow={title}
            current={null}
            exercises={exercises}
            taken={session.exercises.map((e) => names.get(e.exerciseId) ?? '')}
            onPick={(name) => dispatch({ type: 'addSessionExercise', sessionId, name, newExerciseId: newId<ExerciseId>() })}
            onClose={() => setPicking(false)}
          />
        )}
        <p className="hint muted">Sem kg é peso corporal. ✓ marca a série feita como está.</p>
        <div className="rating-row" role="group" aria-label="No fim do treino">
          <span className="rating-label">No fim do treino</span>
          <RatingScale label="No fim do treino" value={session.feel} onPick={(feel) => dispatch({ type: 'setSessionFeel', sessionId, feel })} />
        </div>
        {session.after && (
          <div className="after" role="group" aria-label="Depois do treino">
            <span className="rating-label">Depois do treino</span>
            <AfterEffects session={session} effects={session.after} names={names} />
          </div>
        )}
        <TimedNoteField
          note={session.note}
          label="Notas do treino"
          placeholder="Como correu o treino, ajustes"
          onEdit={(text, now) => dispatch({ type: 'setSessionNote', sessionId, text, now })}
        />
      </div>
    </section>
  )
}

const RIR_CHIPS = [0, 1, 2, 3, 4, 5] as const

interface LiftProps {
  sessionId: WorkoutSessionId
  exercise: SessionExercise
  name: string
  plan: PlannedExercise | undefined
  /** Why the sets were prefilled as they are; null when there was no history. */
  note: string | null
  /** The first Exercise with a set to do, which shows the RIR chips. */
  current: boolean
  dispatch: Dispatch<WorkoutAction>
}

function Lift({ sessionId, exercise, name, plan, note, current, dispatch }: LiftProps) {
  const { exerciseId, sets, target } = exercise
  const [noteOpen, setNoteOpen] = useState(exercise.note !== undefined)
  const [reopened, setReopened] = useState(false)
  const noteId = useId()
  const done = doneSets(exercise)
  const complete = sets.length > 0 && done === sets.length
  const active = sets.findIndex((s) => !s.done)
  const edit = (index: number, set: SetValues) => dispatch({ type: 'setSet', sessionId, exerciseId, index, set })

  if (complete && !reopened) {
    return (
      <div className="lift lift-done" role="group" aria-label={name}>
        <button type="button" className="lift-summary" aria-expanded="false" onClick={() => setReopened(true)}>
          <span className="lift-name">{name}</span>
          <span className="lift-check">✓ {plural(sets.length, 'série', 'séries')}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="lift" role="group" aria-label={name}>
      <div className="lift-head">
        <h3 className="lift-name">{name}</h3>
        <span className="lift-count">
          {done}/{sets.length}
        </span>
        {complete && (
          <button type="button" className="text-btn quiet" aria-expanded="true" onClick={() => setReopened(false)}>
            Fechar
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={`Remover ${name}`} onClick={() => dispatch({ type: 'removeSessionExercise', sessionId, exerciseId })}>
          <CloseIcon />
        </button>
      </div>
      {(plan || note) && (
        <p className="lift-note">
          {plan && <span className="lift-target">Plano {formatPlanned(plan)}. </span>}
          {note}
        </p>
      )}
      <ol className="sets">
        {sets.map((set, index) => (
          <li key={index} className={set.done ? 'set-row set-done' : 'set-row'}>
            <span className="set-num">{index + 1}</span>
            <label className="set-field">
              <CountField value={set.kg} decimal placeholder="—" label={`Kg da série ${index + 1} de ${name}`} onCommit={(kg) => edit(index, { kg, reps: set.reps, rir: set.rir })} />
              <span className="unit">kg ×</span>
            </label>
            <label className="set-field">
              <CountField value={set.reps} label={`Repetições da série ${index + 1} de ${name}`} onCommit={(reps) => edit(index, { kg: set.kg, reps, rir: set.rir })} />
            </label>
            <span className="set-rir">{set.rir !== null && `RIR ${set.rir}`}</span>
            <button
              type="button"
              className="set-tick"
              aria-pressed={set.done}
              aria-label={`Série ${index + 1} de ${name} feita`}
              disabled={!set.done && set.reps === null}
              onClick={() => dispatch({ type: 'setSetDone', sessionId, exerciseId, index, done: !set.done })}
            >
              ✓
            </button>
            <button type="button" className="icon-btn" aria-label={`Remover série ${index + 1} de ${name}`} onClick={() => dispatch({ type: 'removeSet', sessionId, exerciseId, index })}>
              <CloseIcon size={14} />
            </button>
          </li>
        ))}
      </ol>
      {current && active !== -1 && (
        <div className="rir-chips" role="group" aria-label={`RIR da série ${active + 1} de ${name}`}>
          <span className="unit">RIR</span>
          {RIR_CHIPS.map((r) => (
            <button
              key={r}
              type="button"
              className={target?.rir === r ? 'filter-chip rir-chip rir-target' : 'filter-chip rir-chip'}
              aria-pressed={sets[active].rir === r}
              aria-label={`RIR ${r === 5 ? '5 ou mais' : r} na série ${active + 1} de ${name}`}
              onClick={() => edit(active, { kg: sets[active].kg, reps: sets[active].reps, rir: sets[active].rir === r ? null : r })}
            >
              {r === 5 ? '5+' : r}
            </button>
          ))}
        </div>
      )}
      <div className="lift-actions">
        <button type="button" className="text-btn" aria-label={`Adicionar série a ${name}`} onClick={() => dispatch({ type: 'addSet', sessionId, exerciseId })}>
          <PlusIcon />
          Série
        </button>
        <button type="button" className="text-btn quiet" aria-label={`Nota de ${name}`} aria-expanded={noteOpen} aria-controls={noteId} onClick={() => setNoteOpen(!noteOpen)}>
          Nota
          {!noteOpen && exercise.note && <span className="notes-dot" aria-hidden="true" />}
        </button>
      </div>
      {noteOpen && (
        <TimedNoteField
          id={noteId}
          note={exercise.note}
          label={`Nota de ${name}`}
          placeholder="Dores, desconforto, como correu"
          onEdit={(text, now) => dispatch({ type: 'setExerciseNote', sessionId, exerciseId, text, now })}
        />
      )}
    </div>
  )
}

