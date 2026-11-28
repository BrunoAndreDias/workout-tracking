import type { Muscle } from './catalogEntries.ts'
import type { MuscleVolume } from './muscles.ts'

/** The Reference Range: the weekly sets a muscle group commonly gets to grow. It only informs: nothing is held to it. */
export const REFERENCE_RANGE = { low: 10, high: 20 } as const

export type VolumeZone = 'below' | 'within' | 'above'

/** Where some weekly sets fall against the reference range; null for none. */
export function volumeZone(sets: number): VolumeZone | null {
  if (sets === 0) return null
  if (sets < REFERENCE_RANGE.low) return 'below'
  return sets > REFERENCE_RANGE.high ? 'above' : 'within'
}

/** The trained groups, most sets first; equal sets keep the picker's order. */
export const rankedVolumes = (muscles: readonly MuscleVolume[]): MuscleVolume[] => muscles.filter((m) => m.sets > 0).toSorted((a, b) => b.sets - a.sets)

/** Pairs that pull against each other, so a large gap between them is worth a look. */
const PAIRS: readonly (readonly [Muscle, Muscle])[] = [
  ['chest', 'back'],
  ['quadriceps', 'hamstrings'],
  ['biceps', 'triceps'],
]

/** How many times more sets one of a pair gets before it is noted. */
const PAIR_RATIO = 1.5

export type VolumeNote =
  | { readonly kind: 'untrained' | 'below' | 'above'; readonly muscles: readonly MuscleVolume[] }
  | { readonly kind: 'uneven'; readonly more: MuscleVolume; readonly less: MuscleVolume; readonly ratio: number }

/** What may be worth a look in a week's sets, for information only: untrained groups, groups outside the reference range, uneven pairs. */
export function volumeNotes(muscles: readonly MuscleVolume[]): VolumeNote[] {
  const notes: VolumeNote[] = []
  const add = (kind: 'untrained' | 'below' | 'above', of: (m: MuscleVolume) => boolean) => {
    const found = muscles.filter(of)
    if (found.length > 0) notes.push({ kind, muscles: found })
  }
  add('untrained', (m) => m.sets === 0)
  add('below', (m) => volumeZone(m.sets) === 'below')
  add('above', (m) => volumeZone(m.sets) === 'above')
  for (const [a, b] of PAIRS) {
    const [x, y] = [muscles.find((m) => m.muscle === a), muscles.find((m) => m.muscle === b)]
    if (!x?.sets || !y?.sets) continue
    const [more, less] = x.sets >= y.sets ? [x, y] : [y, x]
    const ratio = more.sets / less.sets
    if (ratio >= PAIR_RATIO) notes.push({ kind: 'uneven', more, less, ratio })
  }
  return notes
}
