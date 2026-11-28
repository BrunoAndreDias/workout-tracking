import { describe, expect, it } from 'vitest'
import type { Muscle } from './catalogEntries.ts'
import { MUSCLES } from './muscles.ts'
import type { MuscleVolume } from './muscles.ts'
import { rankedVolumes, volumeNotes, volumeZone } from './volume.ts'

/** Every group, with the sets given and 0 for the rest. */
const week = (sets: Partial<Record<Muscle, number>>): MuscleVolume[] => MUSCLES.map((muscle) => ({ muscle, sets: sets[muscle] ?? 0, days: [] }))
const names = (ms: readonly MuscleVolume[]) => ms.map((m) => m.muscle)

/** The 3-day template's week (muscles.test.ts). */
const TEMPLATE = { chest: 6, back: 12, shoulders: 12, quadriceps: 3, hamstrings: 3, biceps: 6, triceps: 6, abs: 6, glutes: 3, calves: 3 }

describe('weekly volume against the reference range', () => {
  it('reads below under 10 sets, within from 10 to 20, above over 20, and nothing at 0', () => {
    expect([0, 1, 9, 10, 20, 21].map(volumeZone)).toEqual([null, 'below', 'below', 'within', 'within', 'above'])
  })

  it('ranks the trained groups by their sets, equal sets in the picker’s order, untrained ones left out', () => {
    expect(names(rankedVolumes(week(TEMPLATE)))).toEqual(['back', 'shoulders', 'chest', 'biceps', 'triceps', 'abs', 'quadriceps', 'hamstrings', 'glutes', 'calves'])
  })

  it('notes the untrained groups, those below and above the range, and a pair 1.5 times apart', () => {
    const notes = volumeNotes(week({ ...TEMPLATE, glutes: 24 }))
    expect(notes.map((n) => (n.kind === 'uneven' ? [n.kind, n.more.muscle, n.less.muscle, n.ratio] : [n.kind, ...names(n.muscles)]))).toEqual([
      ['untrained', 'forearms'],
      ['below', 'chest', 'quadriceps', 'hamstrings', 'biceps', 'triceps', 'abs', 'calves'],
      ['above', 'glutes'],
      ['uneven', 'back', 'chest', 2],
    ])
  })

  it('leaves a pair alone under 1.5 times apart, or when one side is untrained', () => {
    expect(volumeNotes(week({ chest: 10, back: 14, quadriceps: 12, biceps: 10, triceps: 10, shoulders: 10, forearms: 10, abs: 10, glutes: 10, calves: 10 }))).toEqual([
      { kind: 'untrained', muscles: [{ muscle: 'hamstrings', sets: 0, days: [] }] },
    ])
  })

  it('has nothing to note when every group is within the range and the pairs are even', () => {
    expect(volumeNotes(week(Object.fromEntries(MUSCLES.map((m) => [m, 12]))))).toEqual([])
  })
})
