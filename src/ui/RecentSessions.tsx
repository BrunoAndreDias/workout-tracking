import { useId, useState } from 'react'
import type { Dispatch } from 'react'
import { ratingWord } from '../domain/rating.ts'
import type { ExerciseId, IsoDate, LocalDateTime } from '../domain/types.ts'
import { doneSets } from '../domain/workouts.ts'
import { recentSessions } from '../domain/sessions.ts'
import type { AfterEffect, WorkoutSession, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { AfterEffects } from './AfterEffects.tsx'
import { formatDaysAgo, plural, sessionTitle } from './format.ts'
import { TimedNoteField } from './TimedNoteField.tsx'

interface Props {
  state: WorkoutState
  date: IsoDate
  dispatch: Dispatch<WorkoutAction>
}

/** The morning after: each session of the last few days, to write how it feels on `date`. Absent when there is none. */
export function RecentSessions({ state, date, dispatch }: Props) {
  const sessions = recentSessions(state.sessions, date)
  if (sessions.length === 0) return null
  const names = new Map(state.exercises.map((e) => [e.id, e.name]))
  return (
    <section className="card session" aria-labelledby="treinos-anteriores">
      <h2 id="treinos-anteriores" className="session-title">Treinos anteriores</h2>
      {sessions.map((s) => (
        <Recent key={`${s.id} ${date}`} session={s} title={sessionTitle(s, state.plans)} date={date} names={names} dispatch={dispatch} />
      ))}
    </section>
  )
}

interface RecentProps {
  session: WorkoutSession
  title: string
  date: IsoDate
  names: ReadonlyMap<ExerciseId, string>
  dispatch: Dispatch<WorkoutAction>
}

function Recent({ session, title, date, names, dispatch }: RecentProps) {
  const forDate = new Map((session.after ?? []).filter((a) => a.date === date).map((a) => [a.exerciseId, a]))
  const earlier = (session.after ?? []).filter((a) => a.date !== date)
  const edit = (exerciseId: ExerciseId | null) => (text: string, now: LocalDateTime) =>
    dispatch({ type: 'setAfterEffect', sessionId: session.id, date, exerciseId, text, now })
  const ago = formatDaysAgo(session.date, date)
  return (
    <div className="recent-session" role="group" aria-label={`${title}, ${ago}`}>
      <h3 className="recent-head">
        <span className="lift-name">{title}</span>
        <span className="recent-meta">
          {ago}
          {session.feel !== undefined && ` · no fim: ${ratingWord(session.feel)}`}
        </span>
      </h3>
      <span className="rating-label" aria-hidden="true">Como está o corpo</span>
      <TimedNoteField note={forDate.get(null)?.note} label="Como está o corpo" placeholder="Dores, cansaço, recuperação" onEdit={edit(null)} />
      {session.exercises.map((e) => (
        <ExerciseAfter key={e.exerciseId} name={names.get(e.exerciseId) ?? 'Exercício desconhecido'} sets={doneSets(e)} effect={forDate.get(e.exerciseId)} onEdit={edit(e.exerciseId)} />
      ))}
      {earlier.length > 0 && (
        <>
          <span className="rating-label">Noutros dias</span>
          <AfterEffects session={session} effects={earlier} names={names} />
        </>
      )}
    </div>
  )
}

interface ExerciseAfterProps {
  name: string
  sets: number
  effect: AfterEffect | undefined
  onEdit: (text: string, now: LocalDateTime) => void
}

function ExerciseAfter({ name, sets, effect, onEdit }: ExerciseAfterProps) {
  const [open, setOpen] = useState(effect !== undefined)
  const noteId = useId()
  return (
    <div className="recent-lift">
      <div className="recent-lift-head">
        <span className="recent-lift-name">{name}</span>
        <span className="muted">{plural(sets, 'série', 'séries')}</span>
        <button type="button" className="text-btn quiet" aria-label={`Nota de ${name}`} aria-expanded={open} aria-controls={noteId} onClick={() => setOpen(!open)}>
          Nota
          {!open && effect && <span className="notes-dot" aria-hidden="true" />}
        </button>
      </div>
      {open && <TimedNoteField id={noteId} note={effect?.note} label={`Nota de ${name}`} placeholder="Dores, desconforto neste exercício" onEdit={onEdit} />}
    </div>
  )
}
