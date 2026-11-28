import type { ExerciseId } from '../domain/types.ts'
import type { AfterEffect, WorkoutSession } from '../domain/workouts.ts'
import { formatAfterDay, formatNoteTimes } from './format.ts'

interface Props {
  session: WorkoutSession
  effects: readonly AfterEffect[]
  nameOf: (id: ExerciseId) => string
}

/** After-effects read only, by date, the whole session before its Exercises in the session's order. */
export function AfterEffects({ session, effects, nameOf }: Props) {
  const order = (a: AfterEffect) => (a.exerciseId === null ? -1 : session.exercises.findIndex((e) => e.exerciseId === a.exerciseId))
  const sorted = [...effects].sort((a, b) => a.date.localeCompare(b.date) || order(a) - order(b))
  return (
    <ul className="after-list">
      {sorted.map((a) => (
        <li key={`${a.date} ${a.exerciseId}`} className="after-item">
          <span className="after-head">
            <span className="after-when">{formatAfterDay(session.date, a.date)}</span>
            {a.exerciseId === null ? 'Treino' : nameOf(a.exerciseId)}
          </span>
          <span className="after-text">{a.note.text}</span>
          <span className="note-times">{formatNoteTimes(a.note)}</span>
        </li>
      ))}
    </ul>
  )
}
