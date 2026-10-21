import { describe, expect, it } from 'vitest'
import { suggestTarget } from './progression.ts'
import type { DoneSet } from './workouts.ts'

const MAIN = { min: 6, max: 8 }
const sets = (kg: number | null, reps: number[], rir: number | null): DoneSet[] => reps.map((r) => ({ done: true, kg, reps: r, rir }))
const suggest = (done: DoneSet[], previousRir: number, nextRir: number, range = MAIN) => suggestTarget({ sets: done, previousRir, nextRir, range, increment: 2.5 })

describe('suggestTarget', () => {
  it('drops a rep at the same load when the last session was harder than its RIR target', () => {
    expect(suggest(sets(80, [8, 8, 8], 1), 2, 2)).toMatchObject({ kg: 80, change: 'keep', reps: 7 })
  })

  it('adds a rep when the RIR target stays the same and the sets went as planned', () => {
    expect(suggest(sets(80, [6, 6, 6], 2), 2, 2)).toMatchObject({ kg: 80, change: 'keep', reps: 7 })
  })

  it('adds reps as the week’s RIR target gets harder', () => {
    expect(suggest(sets(80, [6, 6, 6], 4), 4, 3)).toMatchObject({ kg: 80, change: 'keep', reps: 7 })
  })

  it('adds the smallest load increment when the reps pass the top of the range', () => {
    const target = suggest(sets(80, [8, 8, 8], 3), 3, 2)
    expect(target).toMatchObject({ kg: 82.5, change: 'up' })
    expect(target!.reps).toBeGreaterThanOrEqual(MAIN.min)
    expect(target!.reps).toBeLessThanOrEqual(MAIN.max)
  })

  it('reduces the load when the reps would fall below the range', () => {
    const target = suggest(sets(80, [6, 5, 4], 0), 2, 2)
    expect(target?.change).toBe('down')
    expect(target!.kg).toBeLessThan(80)
    expect(target?.reps).toBe(MAIN.min)
  })

  it('assumes the RIR aimed at when none was logged', () => {
    expect(suggest(sets(20, [12, 12, 12], null), 2, 1, { min: 10, max: 15 })).toMatchObject({ kg: 20, change: 'keep', reps: 13 })
  })

  it('lets isolation work reach 0 RIR in the peak week', () => {
    expect(suggest(sets(20, [12, 12, 12], 1), 1, 0, { min: 10, max: 15 })).toMatchObject({ kg: 20, reps: 13 })
  })

  it('moves only the reps of a bodyweight set, within the range', () => {
    expect(suggest(sets(null, [10, 10, 10], 3), 2, 2)).toMatchObject({ kg: null, change: 'keep', reps: 8 })
    expect(suggest(sets(null, [6, 6], 2), 2, 2)).toMatchObject({ kg: null, change: 'keep', reps: 7 })
  })

  it('reads the sets at the last set’s load only', () => {
    expect(suggest([...sets(60, [3], 0), ...sets(80, [6, 6], 2)], 2, 2)).toMatchObject({ kg: 80, reps: 7 })
  })

  it('says in Portuguese what was done last time and what to do now', () => {
    expect(suggest(sets(60, [8, 8], 2), 2, 2, { min: 8, max: 10 })?.note).toBe('Última: 60 kg × 8/8 · RIR 2. Faz 9 com 60 kg.')
    expect(suggest(sets(62.5, [7], null), 3, 2)?.note).toBe('Última: 62,5 kg × 7. Mais esforço: RIR 2 (era 3). Faz 8 com 62,5 kg.')
    expect(suggest(sets(80, [8, 8, 8], 3), 3, 2)?.note).toMatch(/^Última: 80 kg × 8\/8\/8 · RIR 3\. Mais esforço: RIR 2 \(era 3\)\. Sobram repetições acima de 6–8, por isso sobe para 82,5 kg e faz \d\.$/)
  })

  it('suggests nothing without done sets', () => {
    expect(suggest([], 2, 2)).toBe(null)
  })
})
