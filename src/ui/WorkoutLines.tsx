import type { IsoDate } from '../domain/types.ts'
import { activityLabel, watchWorkoutsOn } from '../domain/watchWorkouts.ts'
import type { WatchWorkout, WatchWorkoutLog } from '../domain/watchWorkouts.ts'
import { loggedCounts, sessionsOn } from '../domain/workouts.ts'
import type { WorkoutState } from '../domain/workouts.ts'
import { formatLoggedCounts, formatWatchWorkout, sessionTitle } from './format.ts'

/** "Relógio · Força tradicional · 18:02 · 52 min · 311 kcal", read only: the watch recorded it. */
export function WatchWorkoutLine({ workout }: { workout: WatchWorkout }) {
  return (
    <>
      <span className="sos-tag">Relógio</span>
      <span className="workout-line-name">{activityLabel(workout.activity)}</span>
      <span>{formatWatchWorkout(workout)}</span>
    </>
  )
}

/** One link per Workout Session and per Watch Workout on the date, to that date on Treino. */
export function WorkoutLines({ date, workouts, watch }: { date: IsoDate; workouts: WorkoutState; watch: WatchWorkoutLog }) {
  return (
    <>
      {sessionsOn(workouts.sessions, date).map((s) => (
        <a key={s.id} className="workout-line" href={`#treino/${date}`}>
          <span className="sos-tag">Treino</span>
          <span className="workout-line-name">{sessionTitle(s, workouts.plans)}</span>
          <span>{formatLoggedCounts(loggedCounts(s))}</span>
        </a>
      ))}
      {watchWorkoutsOn(watch, date).map((w) => (
        <a key={w.id} className="workout-line" href={`#treino/${date}`}>
          <WatchWorkoutLine workout={w} />
        </a>
      ))}
    </>
  )
}
