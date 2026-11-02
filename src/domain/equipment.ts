import { catalogEntry, exerciseKey } from './exerciseCatalog.ts'
import type { CatalogId } from './exerciseCatalog.ts'
import type { CustomEquipmentId, GymId } from './types.ts'

/** The material the app knows, in the order it lists it. */
export const EQUIPMENT = [
  { id: 'barbell', label: 'Barra' },
  { id: 'dumbbells', label: 'Halteres' },
  { id: 'bench', label: 'Banco plano' },
  { id: 'adjustable-bench', label: 'Banco ajustável' },
  { id: 'rack', label: 'Suporte de barra (rack)' },
  { id: 'smith-machine', label: 'Máquina Smith' },
  { id: 'cable', label: 'Polia' },
  { id: 'pull-up-bar', label: 'Barra de elevações' },
  { id: 'dip-bars', label: 'Paralelas' },
  { id: 'box', label: 'Caixa ou step' },
  { id: 'ab-wheel', label: 'Roda abdominal' },
  { id: 'preacher-bench', label: 'Banco Scott' },
  { id: 'hyperextension-bench', label: 'Banco de hiperextensões' },
  { id: 'ghd', label: 'GHD' },
  { id: 'landmine', label: 'Remo em T (landmine)' },
  { id: 'leg-press', label: 'Leg press' },
  { id: 'hack-squat', label: 'Hack squat' },
  { id: 'leg-extension', label: 'Cadeira extensora' },
  { id: 'leg-curl', label: 'Máquina de femorais' },
  { id: 'calf-raise-machine', label: 'Máquina de gémeos' },
  { id: 'chest-press-machine', label: 'Máquina de supino' },
  { id: 'pec-deck', label: 'Peck deck' },
  { id: 'lat-pulldown', label: 'Máquina de puxada' },
  { id: 'assisted-pull-up', label: 'Elevações assistidas' },
  { id: 'row-machine', label: 'Máquina de remo' },
  { id: 'shoulder-press-machine', label: 'Máquina de press de ombros' },
  { id: 'lateral-raise-machine', label: 'Máquina de elevações laterais' },
  { id: 'biceps-curl-machine', label: 'Máquina de bíceps' },
] as const

export type BuiltInEquipmentId = (typeof EQUIPMENT)[number]['id']
export type EquipmentId = BuiltInEquipmentId | CustomEquipmentId

/** What each catalog Exercise needs, all of it; [] is none. A first guess the user corrects per Exercise. */
export const DEFAULT_NEEDS = {
  'flat-barbell-bench-press': ['barbell', 'bench', 'rack'],
  'flat-dumbbell-bench-press': ['dumbbells', 'bench'],
  'incline-barbell-bench-press': ['barbell', 'adjustable-bench', 'rack'],
  'incline-dumbbell-bench-press': ['dumbbells', 'adjustable-bench'],
  'decline-barbell-bench-press': ['barbell', 'adjustable-bench', 'rack'],
  'decline-dumbbell-bench-press': ['dumbbells', 'adjustable-bench'],
  'flat-chest-press-machine': ['chest-press-machine'],
  'incline-chest-press-machine': ['chest-press-machine'],
  'decline-chest-press-machine': ['chest-press-machine'],
  'dips-parallel-bars-slight-forward-lean': ['dip-bars'],
  'push-ups': [],
  'flat-dumbbell-flyes': ['dumbbells', 'bench'],
  'incline-dumbbell-flyes': ['dumbbells', 'adjustable-bench'],
  'decline-dumbbell-flyes': ['dumbbells', 'adjustable-bench'],
  'pec-deck-machine': ['pec-deck'],
  'cable-crossovers-cable-flyes': ['cable'],
  'pull-ups': ['pull-up-bar'],
  'chin-ups': ['pull-up-bar'],
  'lat-pull-downs': ['lat-pulldown'],
  'neutral-grip-pulldown': ['lat-pulldown'],
  'assisted-pull-up': ['assisted-pull-up'],
  'wide-grip-lat-pulldown': ['lat-pulldown'],
  'close-grip-lat-pulldown': ['lat-pulldown'],
  'reverse-grip-lat-pulldown': ['lat-pulldown'],
  'close-neutral-grip-pulldown': ['lat-pulldown'],
  'medium-grip-lat-pulldown': ['lat-pulldown'],
  'bent-over-barbell-rows': ['barbell'],
  'bent-over-dumbbell-rows': ['dumbbells'],
  't-bar-rows': ['landmine'],
  'seated-cable-rows': ['cable'],
  'chest-supported-barbell-rows': ['barbell', 'bench'],
  'chest-supported-dumbbell-rows': ['dumbbells', 'adjustable-bench'],
  'chest-supported-machine-rows': ['row-machine'],
  'inverted-rows': ['barbell', 'rack'],
  'barbell-shrugs': ['barbell'],
  'dumbbell-shrugs': ['dumbbells'],
  'machine-shrugs': ['smith-machine'],
  'seated-overhead-barbell-press': ['barbell', 'adjustable-bench', 'rack'],
  'seated-overhead-dumbbell-press': ['dumbbells', 'adjustable-bench'],
  'standing-overhead-barbell-press': ['barbell', 'rack'],
  'standing-overhead-dumbbell-press': ['dumbbells'],
  'overhead-machine-press': ['shoulder-press-machine'],
  'arnold-press': ['dumbbells', 'adjustable-bench'],
  'barbell-upright-rows': ['barbell'],
  'dumbbell-upright-rows': ['dumbbells'],
  'machine-upright-rows': ['smith-machine'],
  'dumbbell-lateral-raises': ['dumbbells'],
  'cable-lateral-raises': ['cable'],
  'machine-lateral-raises': ['lateral-raise-machine'],
  'dumbbell-front-raises': ['dumbbells'],
  'cable-front-raises': ['cable'],
  'machine-front-raises': ['shoulder-press-machine'],
  'barbell-rear-delt-rows': ['barbell'],
  'dumbbell-rear-delt-rows': ['dumbbells'],
  'machine-rear-delt-rows': ['row-machine'],
  'dumbbell-rear-delt-raises': ['dumbbells'],
  'machine-rear-delt-raises': ['pec-deck'],
  'dumbbell-rear-delt-flyes': ['dumbbells'],
  'machine-rear-delt-flyes': ['pec-deck'],
  'barbell-squats': ['barbell', 'rack'],
  'dumbbell-squats': ['dumbbells'],
  'barbell-front-squats': ['barbell', 'rack'],
  'dumbbell-front-squats': ['dumbbells'],
  'barbell-split-squats': ['barbell', 'rack'],
  'dumbbell-split-squats': ['dumbbells'],
  'barbell-lunges': ['barbell', 'rack'],
  'dumbbell-lunges': ['dumbbells'],
  'barbell-step-ups': ['barbell', 'rack', 'box'],
  'dumbbell-step-ups': ['dumbbells', 'box'],
  'leg-press': ['leg-press'],
  'single-leg-press': ['leg-press'],
  'machine-squat-hack-squat': ['hack-squat'],
  'leg-extensions': ['leg-extension'],
  'barbell-romanian-deadlifts': ['barbell'],
  'dumbbell-romanian-deadlifts': ['dumbbells'],
  'barbell-straight-leg-deadlifts': ['barbell'],
  'dumbbell-straight-leg-deadlifts': ['dumbbells'],
  'barbell-sumo-deadlifts': ['barbell'],
  'dumbbell-sumo-deadlifts': ['dumbbells'],
  'glute-ham-raises': ['ghd'],
  hyperextensions: ['hyperextension-bench'],
  'cable-pull-throughs': ['cable'],
  'good-mornings': ['barbell', 'rack'],
  'leg-curls': ['leg-curl'],
  'standing-calf-raises': ['calf-raise-machine'],
  'standing-barbell-curls': ['barbell'],
  'standing-dumbbell-curls': ['dumbbells'],
  'barbell-preacher-curls': ['barbell', 'preacher-bench'],
  'dumbbell-preacher-curls': ['dumbbells', 'preacher-bench'],
  'seated-dumbbell-curls': ['dumbbells', 'bench'],
  'incline-dumbbell-curls': ['dumbbells', 'adjustable-bench'],
  'hammer-curls': ['dumbbells'],
  'concentration-curls': ['dumbbells', 'bench'],
  'cable-curls': ['cable'],
  'biceps-curl-machine': ['biceps-curl-machine'],
  'dips-elbows-close-no-forward-lean': ['dip-bars'],
  'flat-close-grip-bench-press': ['barbell', 'bench', 'rack'],
  'decline-close-grip-bench-press': ['barbell', 'adjustable-bench', 'rack'],
  'close-grip-push-ups': [],
  'laying-barbell-triceps-extensions': ['barbell', 'bench'],
  'laying-dumbbell-triceps-extensions': ['dumbbells', 'bench'],
  'skull-crushers': ['barbell', 'bench'],
  'overhead-barbell-triceps-extensions': ['barbell'],
  'overhead-dumbbell-triceps-extensions': ['dumbbells'],
  'cable-press-downs': ['cable'],
  'bench-dips': ['bench'],
  'cable-crunches': ['cable'],
  'hanging-leg-raises': ['pull-up-bar'],
  planks: [],
  'ab-wheel-rollouts': ['ab-wheel'],
  'dead-bugs': [],
  'reverse-crunches': [],
  'side-planks': [],
  'hollow-holds': [],
} as const satisfies Record<CatalogId, readonly BuiltInEquipmentId[]>

/** Material the user added to the list, such as "Elásticos". */
export interface CustomEquipment {
  readonly id: CustomEquipmentId
  readonly name: string
}

/** A place the user trains, such as "Ginásio" or "Casa", and the material it has. */
export interface Gym {
  readonly id: GymId
  readonly name: string
  readonly has: readonly EquipmentId[]
}

export interface EquipmentState {
  readonly custom: readonly CustomEquipment[]
  readonly gyms: readonly Gym[]
  readonly activeGymId: GymId | null
  /** The user's corrections, by exerciseKey(name). A key present replaces the default, even with []. */
  readonly needs: Readonly<Record<string, readonly EquipmentId[]>>
}

export const freshEquipment = (): EquipmentState => ({ custom: [], gyms: [], activeGymId: null, needs: {} })

const BUILT_IN = new Map<string, string>(EQUIPMENT.map((e) => [e.id, e.label]))
const DEFAULTS: Readonly<Record<string, readonly EquipmentId[]>> = DEFAULT_NEEDS

export const isBuiltIn = (id: string): id is BuiltInEquipmentId => BUILT_IN.has(id)

/** Every material the user can mark: the built-in list, then their own. */
export const allEquipment = (state: EquipmentState): readonly { id: EquipmentId; label: string }[] => [
  ...EQUIPMENT,
  ...state.custom.map((c) => ({ id: c.id, label: c.name })),
]

export const equipmentLabel = (state: EquipmentState, id: EquipmentId): string =>
  BUILT_IN.get(id) ?? state.custom.find((c) => c.id === id)?.name ?? 'Material desconhecido'

const defaultNeeds = (name: string): readonly EquipmentId[] => {
  const entry = catalogEntry(name)
  return (entry && DEFAULTS[entry.id]) ?? []
}

/** What the Exercise needs: the user's correction, else the catalog's guess, else nothing. */
export const needsOf = (state: EquipmentState, name: string): readonly EquipmentId[] => state.needs[exerciseKey(name)] ?? defaultNeeds(name)

export const isChanged = (state: EquipmentState, name: string): boolean => exerciseKey(name) in state.needs

export const activeGym = (state: EquipmentState): Gym | undefined => state.gyms.find((g) => g.id === state.activeGymId)

/** The material the Exercise needs that the active Gym lacks; null with no active Gym, when nothing is judged. */
export function missingAt(state: EquipmentState, name: string): readonly EquipmentId[] | null {
  const gym = activeGym(state)
  if (!gym) return null
  return needsOf(state, name).filter((id) => !gym.has.includes(id))
}

/** The items whose Exercise the active Gym has everything for first, each group in its own order. */
export function readyFirst<T>(state: EquipmentState, items: readonly T[], nameOf: (item: T) => string): readonly T[] {
  if (!activeGym(state)) return items
  const ready = items.filter((item) => missingAt(state, nameOf(item))!.length === 0)
  return [...ready, ...items.filter((item) => !ready.includes(item))]
}

export type EquipmentAction =
  | { type: 'addGym'; gymId: GymId; name: string }
  | { type: 'renameGym'; gymId: GymId; name: string }
  | { type: 'removeGym'; gymId: GymId }
  | { type: 'setActiveGym'; gymId: GymId }
  | { type: 'toggleHas'; gymId: GymId; equipmentId: EquipmentId }
  | { type: 'setAllHas'; gymId: GymId }
  | { type: 'clearHas'; gymId: GymId }
  | { type: 'addCustom'; id: CustomEquipmentId; name: string }
  | { type: 'renameCustom'; id: CustomEquipmentId; name: string }
  | { type: 'removeCustom'; id: CustomEquipmentId }
  | { type: 'setNeeds'; name: string; needs: readonly EquipmentId[] }
  | { type: 'resetNeeds'; name: string }

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

const withoutKey = <V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))

/** A blank name changes nothing; so does a name another material already has, ignoring case. */
export function equipmentReducer(state: EquipmentState, action: EquipmentAction): EquipmentState {
  const editGym = (gymId: GymId, edit: (gym: Gym) => Gym) => ({ ...state, gyms: state.gyms.map((g) => (g.id === gymId ? edit(g) : g)) })
  const name = 'name' in action ? action.name.trim() : ''
  switch (action.type) {
    case 'addGym':
      if (!name) return state
      return { ...state, gyms: [...state.gyms, { id: action.gymId, name, has: [] }], activeGymId: action.gymId }
    case 'renameGym':
      return name ? editGym(action.gymId, (g) => ({ ...g, name })) : state
    case 'removeGym': {
      const gyms = state.gyms.filter((g) => g.id !== action.gymId)
      return { ...state, gyms, activeGymId: state.activeGymId === action.gymId ? (gyms[0]?.id ?? null) : state.activeGymId }
    }
    case 'setActiveGym':
      return state.gyms.some((g) => g.id === action.gymId) ? { ...state, activeGymId: action.gymId } : state
    case 'toggleHas':
      return editGym(action.gymId, (g) => ({ ...g, has: g.has.includes(action.equipmentId) ? g.has.filter((id) => id !== action.equipmentId) : [...g.has, action.equipmentId] }))
    case 'setAllHas':
      return editGym(action.gymId, (g) => ({ ...g, has: allEquipment(state).map((e) => e.id) }))
    case 'clearHas':
      return editGym(action.gymId, (g) => ({ ...g, has: [] }))
    case 'addCustom': {
      const taken = allEquipment(state).some((e) => exerciseKey(e.label) === exerciseKey(name))
      return !name || taken ? state : { ...state, custom: [...state.custom, { id: action.id, name }] }
    }
    case 'renameCustom': {
      const taken = allEquipment(state).some((e) => e.id !== action.id && exerciseKey(e.label) === exerciseKey(name))
      return !name || taken ? state : { ...state, custom: state.custom.map((c) => (c.id === action.id ? { ...c, name } : c)) }
    }
    case 'removeCustom': {
      const drop = (ids: readonly EquipmentId[]) => ids.filter((id) => id !== action.id)
      return {
        ...state,
        custom: state.custom.filter((c) => c.id !== action.id),
        gyms: state.gyms.map((g) => ({ ...g, has: drop(g.has) })),
        needs: Object.fromEntries(Object.entries(state.needs).map(([key, ids]) => [key, drop(ids)])),
      }
    }
    case 'setNeeds': {
      const key = exerciseKey(action.name)
      const needs = [...new Set(action.needs)]
      // Back to the default is no correction, so "Alterado" only marks a real difference.
      if (sameSet(needs, defaultNeeds(action.name))) return key in state.needs ? { ...state, needs: withoutKey(state.needs, key) } : state
      return { ...state, needs: { ...state.needs, [key]: needs } }
    }
    case 'resetNeeds':
      return { ...state, needs: withoutKey(state.needs, exerciseKey(action.name)) }
  }
}

/** A Backup's material joins the user's: Gyms and own material by id, corrections for Exercises the user has not corrected. What is already there wins. */
export function mergeEquipment(current: EquipmentState, incoming: EquipmentState): EquipmentState {
  const customIds = new Set(current.custom.map((c) => c.id))
  const gymIds = new Set(current.gyms.map((g) => g.id))
  return {
    custom: [...current.custom, ...incoming.custom.filter((c) => !customIds.has(c.id))],
    gyms: [...current.gyms, ...incoming.gyms.filter((g) => !gymIds.has(g.id))],
    activeGymId: current.activeGymId ?? incoming.activeGymId,
    needs: { ...incoming.needs, ...current.needs },
  }
}
