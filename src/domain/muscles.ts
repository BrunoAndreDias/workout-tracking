import { catalogEntry, MUSCLE_LABEL } from './exerciseCatalog.ts'
import type { Muscle } from './exerciseCatalog.ts'
import type { ExerciseId } from './types.ts'
import { doneSets } from './workouts.ts'
import type { WorkoutDay, WorkoutSession } from './workouts.ts'

/** Every muscle group, in the order of the picker's filters. */
export const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

/** Some sets of one Exercise, by its name. */
export interface NamedSets {
  readonly name: string
  readonly sets: number
}

export interface MuscleSets {
  /** Every muscle group, untrained ones at 0 sets. */
  readonly muscles: Readonly<Record<Muscle, number>>
  /** The user's own Exercises, which have no muscle group, with their sets, in the order first met. */
  readonly ungrouped: readonly NamedSets[]
}

/** The sets of each muscle group. A set counts in full for every primary muscle of its catalog Exercise. */
export function muscleSets(items: readonly NamedSets[]): MuscleSets {
  const muscles = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  const ungrouped = new Map<string, number>()
  for (const { name, sets } of items) {
    if (sets === 0) continue
    const entry = catalogEntry(name)
    if (!entry) ungrouped.set(name, (ungrouped.get(name) ?? 0) + sets)
    else for (const m of entry.primary) muscles[m] += sets
  }
  return { muscles, ungrouped: [...ungrouped].map(([name, n]) => ({ name, sets: n })) }
}

const planned = (day: WorkoutDay, nameOf: (id: ExerciseId) => string): NamedSets[] => day.exercises.map((p) => ({ name: nameOf(p.exerciseId), sets: p.sets }))

/** The done sets of each muscle group over some Workout Sessions. */
export const doneMuscleSets = (sessions: readonly WorkoutSession[], nameOf: (id: ExerciseId) => string): MuscleSets =>
  muscleSets(sessions.flatMap((s) => s.exercises.map((e) => ({ name: nameOf(e.exerciseId), sets: doneSets(e) }))))

export interface DayMuscle {
  readonly muscle: Muscle
  /** Planned sets that day. */
  readonly sets: number
}

/** The muscle groups a day's catalog Exercises train, with their sets, in the picker's order. */
export function dayMuscleSets(day: WorkoutDay, nameOf: (id: ExerciseId) => string): DayMuscle[] {
  const { muscles } = muscleSets(planned(day, nameOf))
  return MUSCLES.filter((m) => muscles[m] > 0).map((muscle) => ({ muscle, sets: muscles[muscle] }))
}

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
  readonly ungrouped: readonly NamedSets[]
}

/** The weekly planned sets of each muscle group over a block's days. */
export function blockMuscles(days: readonly WorkoutDay[], nameOf: (id: ExerciseId) => string): BlockMuscles {
  const week = muscleSets(days.flatMap((d) => planned(d, nameOf)))
  const trains = days.map((d) => ({ name: d.name, muscles: dayMuscleSets(d, nameOf).map((m) => m.muscle) }))
  return {
    muscles: MUSCLES.map((muscle) => ({ muscle, sets: week.muscles[muscle], days: trains.filter((d) => d.muscles.includes(muscle)).map((d) => d.name) })),
    ungrouped: week.ungrouped,
  }
}
