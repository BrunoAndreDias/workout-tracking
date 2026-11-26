import type { ExerciseId } from './types.ts'
import type { Exercise } from './workouts.ts'
import { CATALOG } from './catalogEntries.ts'
import type { CatalogId } from './catalogEntries.ts'

export type Muscle = 'abs' | 'back' | 'biceps' | 'calves' | 'chest' | 'forearms' | 'glutes' | 'hamstrings' | 'quadriceps' | 'shoulders' | 'triceps'

export type Pattern =
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'quad_dominant'
  | 'hip_hamstring_dominant'
  | 'calves_accessories'
  | 'core'

export interface CatalogEntry {
  readonly id: string
  readonly name: string
  /** The group it is listed under. */
  readonly muscle: Muscle
  readonly primary: readonly Muscle[]
  readonly pattern: Pattern
  readonly kind: 'compound' | 'isolation'
}

/** Two Exercise names with the same key are the same Exercise. */
export const exerciseKey = (name: string) => name.trim().toLocaleLowerCase('pt')

export const findExercise = (exercises: readonly Exercise[], name: string): Exercise | undefined =>
  exercises.find((e) => exerciseKey(e.name) === exerciseKey(name))

/** The Exercise with this name, ignoring case, or a new one under `newId`. Null for a blank name. */
export function resolveExercise(exercises: readonly Exercise[], name: string, newId: ExerciseId): { exercises: readonly Exercise[]; id: ExerciseId } | null {
  const trimmed = name.trim()
  if (trimmed === '') return null
  const found = findExercise(exercises, trimmed)
  return found ? { exercises, id: found.id } : { exercises: [...exercises, { id: newId, name: trimmed }], id: newId }
}

/** The order the muscle-group filters show in. */
export const MUSCLE_LABEL: Readonly<Record<Muscle, string>> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdominais',
  glutes: 'Glúteos',
  calves: 'Gémeos',
}

type CatalogItem = (typeof CATALOG)[number]

const byKey = new Map<string, CatalogItem>(CATALOG.map((e) => [exerciseKey(e.name), e]))
const byId = new Map<CatalogId, CatalogItem>(CATALOG.map((e) => [e.id, e]))

/** The catalog entry of an Exercise named like it, ignoring case; undefined for the user's own names. */
export const catalogEntry = (name: string): CatalogItem | undefined => byKey.get(exerciseKey(name))

export const catalogById = (id: CatalogId): CatalogItem => byId.get(id)!

/**
 * The entries whose name holds every word of `query`, of `muscle` when given. Swapping `current` lists the other
 * entries of its movement pattern as `same`, so the first choices train what the swapped one did.
 */
export function pickerList(query: string, muscle: Muscle | null, current: string | null): { same: CatalogEntry[]; others: CatalogEntry[] } {
  const words = exerciseKey(query).split(/\s+/).filter(Boolean)
  const swapped = current === null ? undefined : catalogEntry(current)
  const found = CATALOG.filter((e: CatalogEntry) => {
    const key = exerciseKey(e.name)
    return e !== swapped && words.every((w) => key.includes(w)) && (muscle === null || e.muscle === muscle || e.primary.includes(muscle))
  })
  const same = swapped ? found.filter((e) => e.pattern === swapped.pattern) : []
  return { same, others: found.filter((e) => !same.includes(e)) }
}
