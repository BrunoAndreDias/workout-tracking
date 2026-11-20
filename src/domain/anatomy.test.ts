import { describe, expect, it } from 'vitest'
import { activationByName, mainSide, REGIONS, workedOn, workedRegions } from './anatomy.ts'
import { CATALOG } from './catalogEntries.ts'

describe('what each catalog Exercise works', () => {
  it('targets a region of every primary muscle group, and never lists a region as both target and assist', () => {
    for (const entry of CATALOG) {
      const { target, assist } = activationByName(entry.name)!
      const groups = new Set(target.map((r) => REGIONS[r].group))
      for (const m of entry.primary) expect(groups.has(m), `${entry.name} targets ${m}`).toBe(true)
      expect(target.filter((r) => assist.includes(r)), entry.name).toEqual([])
    }
  })

  it('tells a lateral raise from a rear delt fly, and an incline press from a flat one', () => {
    const regions = (name: string) => workedRegions(activationByName(name)!).map((w) => `${w.region}:${w.involvement}`)
    expect(regions('Dumbbell Lateral Raises')).toEqual(['delt-side:target', 'traps:assist'])
    expect(regions('Dumbbell Rear Delt Flyes')).toEqual(['delt-rear:target', 'upper-back:assist'])
    expect(regions('Incline Barbell Bench Press')[0]).toBe('chest-upper:target')
    expect(regions('flat barbell bench press')[0]).toBe('chest:target')
  })

  it('shows the figure of the side the target is on', () => {
    expect(mainSide(activationByName('Pull-Ups')!)).toBe('back')
    expect(mainSide(activationByName('Leg Extensions')!)).toBe('front')
  })

  it('splits what it works between the front and back figures, the side delt and traps on both', () => {
    const row = activationByName('Barbell Upright Rows')!
    const on = (side: 'front' | 'back') => workedOn(row, side).map((w) => w.region)
    expect(on('front')).toEqual(['traps', 'delt-side', 'delt-front', 'biceps'])
    expect(on('back')).toEqual(['traps', 'delt-side'])
  })

  it('has nothing for an Exercise of the user’s own', () => {
    expect(activationByName('Supino')).toBe(undefined)
  })
})
