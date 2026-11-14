import type { HealthLog, HealthSample } from '../domain/health.ts'
import type { IsoDate } from '../domain/types.ts'
import type { WatchWorkout, WatchWorkoutLog } from '../domain/watchWorkouts.ts'
import { DateStepper } from './DateStepper.tsx'
import { HealthImport } from './HealthImport.tsx'
import { WatchCard } from './WatchCard.tsx'

interface Props {
  date: IsoDate
  today: IsoDate
  onDate: (date: IsoDate) => void
  health: HealthLog
  onImport: (samples: readonly HealthSample[]) => void
  watchWorkouts: WatchWorkoutLog
  onImportWorkouts: (workouts: readonly WatchWorkout[]) => void
}

/** The Relógio tab: the Apple Watch values of the picked date, and the way they come in. */
export function WatchView({ date, today, onDate, health, onImport, watchWorkouts, onImportWorkouts }: Props) {
  return (
    <>
      <h1 className="sr-only">Relógio</h1>
      <DateStepper date={date} today={today} onDate={onDate} label="Data do relógio" />
      <WatchCard date={date} today={today} health={health} />
      <div className="watch-import">
        <HealthImport log={health} onImport={onImport} watchWorkouts={watchWorkouts} onImportWorkouts={onImportWorkouts} />
      </div>
    </>
  )
}
