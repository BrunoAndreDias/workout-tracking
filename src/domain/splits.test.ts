import { describe, expect, it } from 'vitest'
import { CATALOG } from './exerciseCatalog.ts'
import type { CatalogId } from './exerciseCatalog.ts'
import { defaultRole, mapDays, splitForDayCount, SPLITS, templateBlock } from './splits.ts'
import type { ExerciseId, WorkoutBlockId } from './types.ts'

const catalogIds = new Set<string>(CATALOG.map((e) => e.id))
const newId = (id: CatalogId) => `x-${id}` as ExerciseId

describe('Training Splits', () => {
  it('every template exercise is in the catalog, at most once a day', () => {
    for (const split of Object.values(SPLITS)) {
      for (const day of split.days) {
        const ids = day.slots.map((s) => s.exercise)
        expect(ids.filter((id) => !catalogIds.has(id))).toEqual([])
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('3 days a block is Push · Pull · Full body, 4 is Upper and Lower twice, and other counts have no split', () => {
    expect(splitForDayCount(3)).toBe('ppf')
    expect(splitForDayCount(4)).toBe('ul')
    expect([1, 2, 5].map(splitForDayCount)).toEqual([null, null, null])
    expect(SPLITS.ppf.days.map((d) => d.name)).toEqual(['Push', 'Pull', 'Full body'])
    expect(SPLITS.ul.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
  })

  it('a template block fills every day, with 3 sets at the role’s rep range and the 6-week RIR ramp', () => {
    const { block, exercises } = templateBlock('ppf', 'b1' as WorkoutBlockId, 'Bloco A', [], newId)
    expect(block.days.map((d) => d.id)).toEqual(['b1-d1', 'b1-d2', 'b1-d3'])
    expect(block.days[0].exercises[0]).toEqual({ exerciseId: 'x-flat-barbell-bench-press', role: 'main', sets: 3, reps: { min: 6, max: 8 } })
    expect(block.days[0].exercises.map((p) => p.role)).toEqual(['main', 'secondary', 'isolation', 'isolation', 'abs'])
    expect(block.rir.map((r) => r && `${r.min}-${r.max}`)).toEqual(['4-5', '3-3', '2-3', '2-2', '1-2', '0-1'])
    expect(block.weeks).toBe(6)
    expect(exercises.find((e) => e.id === 'x-pull-ups')?.name).toBe('Pull-Ups')
  })

  it('uses an Exercise the user already has under that name, and adds each new one once across days', () => {
    const mine = { id: 'mine' as ExerciseId, name: 'flat barbell bench press' }
    const { block, exercises } = templateBlock('ppf', 'b1' as WorkoutBlockId, 'Bloco A', [mine], newId)
    expect(block.days[0].exercises[0].exerciseId).toBe('mine')
    expect(block.days[2].exercises[0].exerciseId).toBe('mine')
    expect(exercises.filter((e) => e.name === 'Bent Over Barbell Rows')).toHaveLength(1)
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length)
  })

  it('an Exercise added by hand starts as abs for core work, secondary for a compound and isolation otherwise', () => {
    expect(['Planks', 'Leg Press', 'Hammer Curls', 'Supino'].map(defaultRole)).toEqual(['abs', 'secondary', 'isolation', 'isolation'])
  })

  it('mapDays keeps the block’s days in order', () => {
    const { block } = templateBlock('ul', 'b' as WorkoutBlockId, 'Bloco A', [], newId)
    expect(mapDays(block, (d, i) => ({ ...d, name: `${i}` })).map((d) => d.name)).toEqual(['0', '1', '2', '3'])
  })
})
