import { catalogById, catalogEntry } from './exerciseCatalog.ts'
import { resolveExercise } from './names.ts'
import type { CatalogId } from './catalogEntries.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId } from './types.ts'
import type { BlockOf, DaysOf, Exercise, RepRange, RirRange, RirTarget, Role, Split, WorkoutDay } from './workouts.ts'

interface SlotSpec {
  readonly role: Role
  readonly exercise: CatalogId
}

interface DaySpec {
  readonly name: string
  readonly slots: readonly SlotSpec[]
}

/** One DaySpec per day of the split's tuple, so a template cannot have more or fewer days than its plans. */
type Each<T, V> = { readonly [K in keyof T]: V }
type DaySpecsOf<S extends Split> = Each<DaysOf<S>, DaySpec>

const main = (exercise: CatalogId): SlotSpec => ({ role: 'main', exercise })
const secondary = (exercise: CatalogId): SlotSpec => ({ role: 'secondary', exercise })
const isolation = (exercise: CatalogId): SlotSpec => ({ role: 'isolation', exercise })
const abs = (exercise: CatalogId): SlotSpec => ({ role: 'abs', exercise })

const PPF_DAYS: DaySpecsOf<'ppf'> = [
  {
    name: 'Push',
    slots: [main('flat-barbell-bench-press'), secondary('standing-overhead-barbell-press'), isolation('dumbbell-lateral-raises'), isolation('cable-press-downs'), abs('cable-crunches')],
  },
  {
    name: 'Pull',
    slots: [main('bent-over-barbell-rows'), secondary('pull-ups'), isolation('dumbbell-rear-delt-flyes'), isolation('standing-barbell-curls'), abs('hanging-leg-raises')],
  },
  {
    name: 'Full body',
    slots: [
      main('flat-barbell-bench-press'),
      main('pull-ups'),
      main('barbell-squats'),
      secondary('bent-over-barbell-rows'),
      secondary('standing-overhead-barbell-press'),
      secondary('barbell-romanian-deadlifts'),
      isolation('standing-barbell-curls'),
      isolation('cable-press-downs'),
      isolation('standing-calf-raises'),
    ],
  },
]

// just-workout's upper and lower supersets, flattened: main lifts first, then secondary, isolation and abs.
const UL_DAYS: DaySpecsOf<'ul'> = [
  {
    name: 'Upper A',
    slots: [
      main('flat-barbell-bench-press'),
      main('bent-over-barbell-rows'),
      secondary('pull-ups'),
      secondary('standing-overhead-barbell-press'),
      isolation('standing-barbell-curls'),
      isolation('cable-press-downs'),
      abs('cable-crunches'),
      abs('hanging-leg-raises'),
    ],
  },
  {
    name: 'Lower A',
    slots: [
      main('barbell-squats'),
      main('barbell-romanian-deadlifts'),
      secondary('leg-curls'),
      secondary('leg-press'),
      isolation('leg-extensions'),
      isolation('standing-calf-raises'),
      abs('cable-crunches'),
      abs('hanging-leg-raises'),
    ],
  },
  {
    name: 'Upper B',
    slots: [
      main('standing-overhead-barbell-press'),
      main('pull-ups'),
      secondary('seated-cable-rows'),
      secondary('incline-dumbbell-bench-press'),
      isolation('dumbbell-lateral-raises'),
      isolation('hammer-curls'),
      abs('cable-crunches'),
      abs('hanging-leg-raises'),
    ],
  },
  {
    name: 'Lower B',
    slots: [
      main('barbell-romanian-deadlifts'),
      main('barbell-squats'),
      secondary('dumbbell-split-squats'),
      secondary('leg-curls'),
      isolation('leg-extensions'),
      isolation('standing-calf-raises'),
      abs('cable-crunches'),
      abs('hanging-leg-raises'),
    ],
  },
]

/** The only list of Training Splits. */
export const SPLITS: { readonly [S in Split]: { readonly label: string; readonly days: DaySpecsOf<S> } } = {
  ppf: { label: '3 dias', days: PPF_DAYS },
  ul: { label: '4 dias', days: UL_DAYS },
}

export const SPLIT_IDS = Object.keys(SPLITS) as Split[]

export const ROLE_REPS: { readonly [R in Role]: RepRange } = {
  main: { min: 6, max: 8 },
  secondary: { min: 8, max: 10 },
  isolation: { min: 10, max: 15 },
  abs: { min: 10, max: 15 },
}

/** How many training weeks an Exercise in each role runs before the app asks to review it; null is no limit. Main lifts stay, accessories rotate. */
export const ROLE_WEEKS: { readonly [R in Role]: number | null } = {
  main: null,
  secondary: 8,
  isolation: 8,
  abs: 8,
}

export const ROLE_LABEL: { readonly [R in Role]: string } = {
  main: 'Principal',
  secondary: 'Secundário',
  isolation: 'Isolamento',
  abs: 'Abs',
}

export const ROLES = Object.keys(ROLE_LABEL) as Role[]

export const DEFAULT_SETS = 3

const ROLE_RIR: { readonly [R in Role]: RirRange } = {
  main: { min: 2, max: 2 },
  secondary: { min: 2, max: 2 },
  isolation: { min: 1, max: 3 },
  abs: { min: 1, max: 3 },
}

export const LIGHT_RIR_EXTRA = 2

export function withLight(target: RirTarget, light: boolean): RirTarget {
  if (target.light === light) return target
  const shift = light ? LIGHT_RIR_EXTRA : -LIGHT_RIR_EXTRA
  return { min: target.min + shift, max: target.max + shift, light }
}

export const roleRir = (role: Role, light: boolean): RirTarget => withLight({ ...ROLE_RIR[role], light: false }, light)

const DEFAULT_BLOCK_WEEKS = 6

/** The role an Exercise added by hand starts with: core work is abs, a catalog compound secondary, anything else isolation. */
export function defaultRole(name: string): Role {
  const entry = catalogEntry(name)
  if (!entry) return 'isolation'
  return entry.pattern === 'core' ? 'abs' : entry.kind === 'compound' ? 'secondary' : 'isolation'
}

/** The split whose plans have `n` days a block, or null when none has. */
export const splitForDayCount = (n: number): Split | null => SPLIT_IDS.find((s) => SPLITS[s].days.length === n) ?? null

/** Every day of a block through `fn`, keeping the split's day count. */
export const mapDays = <S extends Split>(block: BlockOf<S>, fn: (day: WorkoutDay, index: number) => WorkoutDay): DaysOf<S> =>
  (block.days as readonly WorkoutDay[]).map(fn) as unknown as DaysOf<S>

/** Unique because the block's id is. */
export const blockDayId = (blockId: WorkoutBlockId, index: number) => `${blockId}-d${index + 1}` as WorkoutDayId

/**
 * A block with every day filled from the split's template. A template Exercise the user already has, by name ignoring
 * case, is that one; the others are added under `newExerciseId`.
 */
export function templateBlock<S extends Split>(
  split: S,
  blockId: WorkoutBlockId,
  name: string,
  since: IsoDate,
  exercises: readonly Exercise[],
  newExerciseId: (catalogId: CatalogId) => ExerciseId,
): { block: BlockOf<S>; exercises: readonly Exercise[] } {
  let known = exercises
  const idOf = (catalogId: CatalogId): ExerciseId => {
    const resolved = resolveExercise(known, catalogById(catalogId).name, newExerciseId(catalogId))!
    known = resolved.exercises
    return resolved.id
  }
  const specs = SPLITS[split].days as readonly DaySpec[]
  const days = specs.map((spec, i) => ({
    id: blockDayId(blockId, i),
    name: spec.name,
    exercises: spec.slots.map((slot) => ({ exerciseId: idOf(slot.exercise), role: slot.role, sets: DEFAULT_SETS, reps: ROLE_REPS[slot.role], weeks: ROLE_WEEKS[slot.role], since })),
  }))
  return { block: { id: blockId, name, weeks: DEFAULT_BLOCK_WEEKS, light: false, days: days as unknown as DaysOf<S> }, exercises: known }
}
