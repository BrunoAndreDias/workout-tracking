import { describe, expect, it } from 'vitest'
import type { CatalogId } from './exerciseCatalog.ts'
import { blockMuscles, dayMuscles } from './muscles.ts'
import { templateBlock } from './splits.ts'
import type { ExerciseId, WorkoutBlockId, WorkoutDayId } from './types.ts'
import type { Exercise, WorkoutDay } from './workouts.ts'

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

  it('Push trains chest, shoulders, triceps and abs', () => {
    const { block, exercises } = ppf()
    expect(dayMuscles(block.days[0], namer(exercises))).toEqual(['chest', 'shoulders', 'triceps', 'abs'])
  })

  it('an Exercise of the user’s own has no group: its sets count apart', () => {
    const exercises = [{ id: 'mine' as ExerciseId, name: 'Supino' }]
    const day: WorkoutDay = { id: 'd' as WorkoutDayId, name: 'Push', exercises: [{ exerciseId: 'mine' as ExerciseId, role: 'main', sets: 4, reps: { min: 6, max: 8 } }] }
    const { muscles, ungrouped } = blockMuscles([day], namer(exercises))
    expect(ungrouped).toEqual([{ name: 'Supino', sets: 4 }])
    expect(muscles.every((m) => m.sets === 0 && m.days.length === 0)).toBe(true)
    expect(dayMuscles(day, namer(exercises))).toEqual([])
  })
})
