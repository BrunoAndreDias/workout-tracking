import { catalogEntry, MUSCLE_LABEL } from './exerciseCatalog.ts'
import type { Muscle } from './exerciseCatalog.ts'
import type { ExerciseId } from './types.ts'
import type { WorkoutDay } from './workouts.ts'

export interface MuscleVolume {
  readonly muscle: Muscle
  /** Planned sets a week: each day of a block is trained once a training week. */
  readonly sets: number
  /** The names of the days that train it, in the block's order. */
  readonly days: readonly string[]
}

export interface BlockMuscles {
  /** Every muscle group, in the order of the picker's filters, untrained ones at 0 sets. */
  readonly muscles: readonly MuscleVolume[]
  /** The user's own Exercises, which have no muscle group, with their weekly sets. */
  readonly ungrouped: readonly { readonly name: string; readonly sets: number }[]
}

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

/** The muscle groups a day trains: each catalog Exercise's primary muscles, in the picker's order. */
export function dayMuscles(day: WorkoutDay, nameOf: (id: ExerciseId) => string): Muscle[] {
  const trained = new Set(day.exercises.flatMap((p) => catalogEntry(nameOf(p.exerciseId))?.primary ?? []))
  return MUSCLES.filter((m) => trained.has(m))
}

/** The weekly planned sets of each muscle group over a block's days. A set counts in full for every primary muscle. */
export function blockMuscles(days: readonly WorkoutDay[], nameOf: (id: ExerciseId) => string): BlockMuscles {
  const sets = new Map<Muscle, number>()
  const trainedOn = new Map<Muscle, Set<string>>()
  const ungrouped = new Map<string, number>()
  for (const day of days) {
    for (const p of day.exercises) {
      const name = nameOf(p.exerciseId)
      const entry = catalogEntry(name)
      if (!entry) {
        ungrouped.set(name, (ungrouped.get(name) ?? 0) + p.sets)
        continue
      }
      for (const m of entry.primary) {
        sets.set(m, (sets.get(m) ?? 0) + p.sets)
        trainedOn.set(m, (trainedOn.get(m) ?? new Set()).add(day.name))
      }
    }
  }
  return {
    muscles: MUSCLES.map((muscle) => ({ muscle, sets: sets.get(muscle) ?? 0, days: [...(trainedOn.get(muscle) ?? [])] })),
    ungrouped: [...ungrouped].map(([name, n]) => ({ name, sets: n })),
  }
}
