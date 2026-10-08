import { describe, expect, it } from 'vitest'
import { loadStore, saveStore, STORES } from './stores.ts'
import type { WatchWorkoutId } from './types.ts'
import { upsertWatchWorkouts } from './watchWorkouts.ts'
import type { WatchWorkout } from './watchWorkouts.ts'

const RUN: WatchWorkout = { id: '2026-10-04T06:30:00Z Running' as WatchWorkoutId, date: '2026-10-04' as WatchWorkout['date'], start: '07:30', activity: 'Running', minutes: 30, kcal: 310.7, km: 4.99 }
const LIFT: WatchWorkout = {
  id: '2026-10-06T17:02:11Z TraditionalStrengthTraining' as WatchWorkoutId,
  date: '2026-10-06' as WatchWorkout['date'],
  start: '18:02',
  activity: 'TraditionalStrengthTraining',
  minutes: 52.3,
  kcal: 310.5,
}

function memoryStorage() {
  const data: Record<string, string> = {}
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
}

describe('watch workouts store', () => {
  it('saves as a versioned list by date and reads it back', () => {
    const storage = memoryStorage()
    saveStore(STORES.watchWorkouts, upsertWatchWorkouts({}, [LIFT, RUN]), storage)
    expect(storage.data['nutrition-tracking:watch-workouts']).toBe(
      '{"version":1,"workouts":[{"id":"2026-10-04T06:30:00Z Running","date":"2026-10-04","start":"07:30","activity":"Running","minutes":30,"kcal":310.7,"km":4.99},' +
        '{"id":"2026-10-06T17:02:11Z TraditionalStrengthTraining","date":"2026-10-06","start":"18:02","activity":"TraditionalStrengthTraining","minutes":52.3,"kcal":310.5}]}',
    )
    expect(Object.keys(loadStore(STORES.watchWorkouts, storage))).toEqual(['2026-10-04T06:30:00Z Running', '2026-10-06T17:02:11Z TraditionalStrengthTraining'])
  })

  it.each([
    ['an id twice', [RUN, RUN]],
    ['negative minutes', [{ ...RUN, minutes: -1 }]],
    ['a start that is not HH:MM', [{ ...RUN, start: '7:30' }]],
  ])('rejects a stored document with %s', (_, rows) => {
    expect(STORES.watchWorkouts.parse({ version: 1, workouts: rows })).toBeNull()
    expect(STORES.watchWorkouts.parse({ version: 1, workouts: [RUN] })).toEqual({ [RUN.id]: RUN })
  })
})
