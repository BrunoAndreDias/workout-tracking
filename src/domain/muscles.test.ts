import { describe, expect, it } from 'vitest'
import type { CatalogId } from './exerciseCatalog.ts'
import { blockMuscles, dayMuscleSets, doneMuscleSets } from './muscles.ts'
import { templateBlock } from './splits.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutSessionId } from './types.ts'
import type { Exercise, LoggedSet, WorkoutDay, WorkoutSession } from './workouts.ts'

const ppf = () => templateBlock('ppf', 'b1' as WorkoutBlockId, 'Bloco A', [], (id: CatalogId) => `x-${id}` as ExerciseId)
const namer = (exercises: readonly Exercise[]) => (id: ExerciseId) => exercises.find((e) => e.id === id)?.name ?? '?'

describe('muscle groups of a Training Block', () => {
  it('the 3-day template trains each group a week by its sets, on the days that train it', () => {
    const { block, exercises } = ppf()
    const rows = blockMuscles(block.days, namer(exercises)).muscles.map((m) => [m.muscle, m.sets, m.days.join(' · ')])
    expect(rows).toEqual([
      ['chest', 6, 'Push · Full body'],
      ['back', 12, 'Pull · Full body'],
      ['shoulders', 12, 'Push · Pull · Full body'],
      ['quadriceps', 3, 'Full body'],
      ['hamstrings', 3, 'Full body'],
      ['biceps', 6, 'Pull · Full body'],
      ['triceps', 6, 'Push · Full body'],
      ['forearms', 0, ''],
      ['abs', 6, 'Push · Pull'],
      ['glutes', 3, 'Full body'],
      ['calves', 3, 'Full body'],
    ])
  })

  const daySets = (day: WorkoutDay, exercises: readonly Exercise[]) => dayMuscleSets(day, namer(exercises)).map((m) => [m.muscle, m.sets])

  it('Push trains chest 3, shoulders 6, triceps 3 and abs 3 sets', () => {
    const { block, exercises } = ppf()
    expect(daySets(block.days[0], exercises)).toEqual([['chest', 3], ['shoulders', 6], ['triceps', 3], ['abs', 3]])
  })

  it('Full body trains nine groups, back twice over', () => {
    const { block, exercises } = ppf()
    expect(daySets(block.days[2], exercises)).toEqual([
      ['chest', 3],
      ['back', 6],
      ['shoulders', 3],
      ['quadriceps', 3],
      ['hamstrings', 3],
      ['biceps', 3],
      ['triceps', 3],
      ['glutes', 3],
      ['calves', 3],
    ])
  })

  it('a day with no Exercise trains no group', () => {
    const day: WorkoutDay = { id: 'd' as WorkoutDayId, name: 'Vazio', exercises: [] }
    expect(dayMuscleSets(day, namer([]))).toEqual([])
  })

  it('an Exercise of the user’s own has no group: its sets count apart', () => {
    const exercises = [{ id: 'mine' as ExerciseId, name: 'Supino' }]
    const day: WorkoutDay = { id: 'd' as WorkoutDayId, name: 'Push', exercises: [{ exerciseId: 'mine' as ExerciseId, role: 'main', sets: 4, reps: { min: 6, max: 8 }, weeks: null, since: null }] }
    const { muscles, ungrouped } = blockMuscles([day], namer(exercises))
    expect(ungrouped).toEqual([{ name: 'Supino', sets: 4 }])
    expect(muscles.every((m) => m.sets === 0 && m.days.length === 0)).toBe(true)
    expect(dayMuscleSets(day, namer(exercises))).toEqual([])
  })
})

describe('muscle groups of Workout Sessions', () => {
  const exercises = [
    { id: 'bench' as ExerciseId, name: 'Flat Barbell Bench Press' },
    { id: 'rdl' as ExerciseId, name: 'Barbell Romanian Deadlifts' },
    { id: 'mine' as ExerciseId, name: 'Supino' },
  ]
  const done: LoggedSet = { done: true, reps: 8, kg: 60, rir: null }
  const pending: LoggedSet = { done: false, reps: 8, kg: 60, rir: null }
  const session = (...lifts: [string, LoggedSet[]][]): WorkoutSession => ({
    id: 's' as WorkoutSessionId,
    date: '2026-10-05' as IsoDate,
    workoutDayId: null,
    exercises: lifts.map(([id, sets]) => ({ exerciseId: id as ExerciseId, sets })),
  })

  it('counts only done sets, each in full for every primary muscle', () => {
    const { muscles, ungrouped } = doneMuscleSets([session(['bench', [done, done, done, pending]], ['rdl', [done, done]])], namer(exercises))
    expect(Object.entries(muscles).filter(([, n]) => n > 0)).toEqual([['chest', 3], ['hamstrings', 2], ['glutes', 2]])
    expect(ungrouped).toEqual([])
  })

  it('adds up over sessions, the user’s own Exercises apart, and leaves out an Exercise with no done set', () => {
    const { muscles, ungrouped } = doneMuscleSets(
      [session(['bench', [done, done]], ['mine', [done]]), session(['bench', [done]], ['rdl', [pending]], ['mine', [done, pending]])],
      namer(exercises),
    )
    expect(Object.entries(muscles).filter(([, n]) => n > 0)).toEqual([['chest', 3]])
    expect(ungrouped).toEqual([{ name: 'Supino', sets: 2 }])
    expect(doneMuscleSets([session(['mine', [pending]])], namer(exercises)).ungrouped).toEqual([])
  })
})
