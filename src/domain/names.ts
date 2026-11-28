import type { ExerciseId } from './types.ts'
import type { Exercise } from './workouts.ts'

export const nameKey = (name: string) => name.trim().toLocaleLowerCase('pt')

export function nameMatcher(query: string): (name: string) => boolean {
  const words = nameKey(query).split(/\s+/).filter(Boolean)
  return (name) => {
    const key = nameKey(name)
    return words.every((w) => key.includes(w))
  }
}

export const findExercise = (exercises: readonly Exercise[], name: string): Exercise | undefined =>
  exercises.find((e) => nameKey(e.name) === nameKey(name))

export function resolveExercise(exercises: readonly Exercise[], name: string, newId: ExerciseId): { exercises: readonly Exercise[]; id: ExerciseId } | null {
  const trimmed = name.trim()
  if (trimmed === '') return null
  const found = findExercise(exercises, trimmed)
  return found ? { exercises, id: found.id } : { exercises: [...exercises, { id: newId, name: trimmed }], id: newId }
}
