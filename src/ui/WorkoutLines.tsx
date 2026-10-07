import type { IsoDate } from '../domain/types.ts'
import { loggedCounts, sessionsOn } from '../domain/workouts.ts'
import type { WorkoutState } from '../domain/workouts.ts'
import { formatLoggedCounts, sessionTitle } from './format.ts'

/** One link per Workout Session on the date, to that date on Treino. */
export function WorkoutLines({ date, workouts }: { date: IsoDate; workouts: WorkoutState }) {
  return sessionsOn(workouts.sessions, date).map((s) => (
    <a key={s.id} className="workout-line" href={`#treino/${date}`}>
      <span className="sos-tag">Treino</span>
      <span className="workout-line-name">{sessionTitle(s, workouts.plans)}</span>
      <span>{formatLoggedCounts(loggedCounts(s))}</span>
    </a>
  ))
}
