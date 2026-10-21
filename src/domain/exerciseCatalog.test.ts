import { describe, expect, it } from 'vitest'
import { CATALOG, catalogEntry, pickerList } from './exerciseCatalog.ts'

const names = (list: readonly { name: string }[]) => list.map((e) => e.name)

describe('exercise catalog', () => {
  it('has one entry per id and per name', () => {
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length)
    expect(new Set(CATALOG.map((e) => e.name.toLowerCase())).size).toBe(CATALOG.length)
  })

  it('finds an entry by name ignoring case and spaces, and none for a name of the user’s own', () => {
    expect(catalogEntry('  flat barbell BENCH press ')?.id).toBe('flat-barbell-bench-press')
    expect(catalogEntry('Supino')).toBe(undefined)
  })

  it('searches by every word of the query, within a muscle group', () => {
    expect(names(pickerList('lat pull-downs', null, null).others)).toEqual(['Lat Pull-Downs'])
    expect(names(pickerList('grip wide', null, null).others)).toEqual(['Wide-Grip Lat Pulldown'])
    expect(names(pickerList('curl', 'hamstrings', null).others)).toEqual(['Leg Curls'])
    expect(pickerList('', 'calves', null).others.every((e) => e.muscle === 'calves' || e.primary.includes('calves'))).toBe(true)
  })

  it('swapping lists the other exercises of the same movement first, without the one swapped', () => {
    const { same, others } = pickerList('', null, 'Pull-Ups')
    expect(same.length).toBeGreaterThan(0)
    expect(same.every((e) => e.pattern === 'vertical_pull')).toBe(true)
    expect(names(same)).not.toContain('Pull-Ups')
    expect(others.some((e) => e.pattern === 'vertical_pull')).toBe(false)
    expect(same.length + others.length).toBe(CATALOG.length - 1)
  })

  it('swapping an Exercise of the user’s own has no same-movement list', () => {
    expect(pickerList('', null, 'Supino').same).toEqual([])
  })
})
