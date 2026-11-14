import { freshEquipment } from './equipment.ts'
import type { EquipmentState } from './equipment.ts'
import { EQUIPMENT_SCHEMA_VERSION, parseEquipment } from './equipmentStorage.ts'
import { logSamples } from './health.ts'
import type { HealthLog } from './health.ts'
import { HEALTH_SCHEMA_VERSION, parseHealth } from './healthStorage.ts'
import { defaultStorage, isRecord, preserveCopy } from './persistence.ts'
import type { StorageLike } from './persistence.ts'
import { STORE_KEY } from './storeKeys.ts'
import type { StoreKey } from './storeKeys.ts'
import { byStart } from './watchWorkouts.ts'
import type { WatchWorkoutLog } from './watchWorkouts.ts'
import { parseWatchWorkouts, WATCH_WORKOUTS_SCHEMA_VERSION } from './watchWorkoutsStorage.ts'
import { EXERCISES_SCHEMA_VERSION, parseExercises, parseWorkoutPlans, parseWorkoutSessions, WORKOUT_PLANS_SCHEMA_VERSION, WORKOUT_SESSIONS_SCHEMA_VERSION } from './workoutStorage.ts'
import type { Exercise, WorkoutPlanState, WorkoutSession } from './workouts.ts'

/**
 * A Store: one versioned document under its own key. `parse` reads every version this build understands, or returns
 * null; `toDoc` is what is saved beside `version`; `fresh` is the value when there is no readable document; `label`
 * names the store to the user.
 */
export interface StoreDef<T> {
  readonly key: StoreKey
  readonly label: string
  readonly version: number
  parse(raw: unknown): T | null
  toDoc(value: T): object
  fresh(): T
}

const store = <T>(def: StoreDef<T>): StoreDef<T> => def

/** Every store the app keeps, in the order a Backup lists them. */
export const STORES = {
  exercises: store<readonly Exercise[]>({
    key: STORE_KEY.exercises,
    label: 'exercícios',
    version: EXERCISES_SCHEMA_VERSION,
    parse: parseExercises,
    toDoc: (exercises) => ({ exercises }),
    fresh: () => [],
  }),
  workoutPlans: store<WorkoutPlanState>({
    key: STORE_KEY.workoutPlans,
    label: 'planos de treino',
    version: WORKOUT_PLANS_SCHEMA_VERSION,
    parse: parseWorkoutPlans,
    toDoc: ({ plans, activePlanId }) => ({ plans, activePlanId }),
    fresh: () => ({ plans: [], activePlanId: null }),
  }),
  workoutSessions: store<readonly WorkoutSession[]>({
    key: STORE_KEY.workoutSessions,
    label: 'treinos',
    version: WORKOUT_SESSIONS_SCHEMA_VERSION,
    parse: parseWorkoutSessions,
    toDoc: (sessions) => ({ sessions }),
    fresh: () => [],
  }),
  health: store<HealthLog>({ key: STORE_KEY.health, label: 'valores do relógio', version: HEALTH_SCHEMA_VERSION, parse: parseHealth, toDoc: (log) => ({ samples: logSamples(log) }), fresh: () => ({}) }),
  watchWorkouts: store<WatchWorkoutLog>({
    key: STORE_KEY.watchWorkouts,
    label: 'treinos do relógio',
    version: WATCH_WORKOUTS_SCHEMA_VERSION,
    parse: parseWatchWorkouts,
    toDoc: (log) => ({ workouts: Object.values(log).sort(byStart) }),
    fresh: () => ({}),
  }),
  equipment: store<EquipmentState>({
    key: STORE_KEY.equipment,
    label: 'material',
    version: EQUIPMENT_SCHEMA_VERSION,
    parse: parseEquipment,
    toDoc: ({ custom, gyms, activeGymId, needs }) => ({ custom, gyms, activeGymId, needs }),
    fresh: freshEquipment,
  }),
} satisfies Record<keyof typeof STORE_KEY, unknown>

export type StoreName = keyof typeof STORES

export const STORE_NAMES = Object.keys(STORES) as StoreName[]

/** What the stores hold once parsed. */
export type AppData = { readonly [N in StoreName]: (typeof STORES)[N] extends StoreDef<infer T> ? T : never }

// The text each value was read from, at the current version. The app saves every store as it starts, and writing one
// back over the very text it was read from costs a year of data's serialization for nothing.
const readFrom = new WeakMap<object, string>()

/**
 * The one way a store is read: the parsed document, or `fresh()` when there is none, storage is blocked, or the
 * document does not parse, in which case its raw text is first preserved under `<key>:unreadable:<ISO time>`. A
 * document of an older version that parses is preserved under `<key>:migrated:<ISO time>`.
 */
export function loadStore<T>(def: StoreDef<T>, storage: StorageLike | null = defaultStorage()): T {
  let text: string | null | undefined
  try {
    text = storage?.getItem(def.key)
  } catch {
    return def.fresh()
  }
  if (!storage || !text) return def.fresh()
  try {
    const raw: unknown = JSON.parse(text)
    const value = def.parse(raw)
    if (value !== null) {
      if (isRecord(raw) && raw.version !== def.version) preserveCopy(storage, def.key, text, 'migrated')
      else if (typeof value === 'object') readFrom.set(value, text)
      return value
    }
  } catch {
    // corrupt JSON
  }
  preserveCopy(storage, def.key, text, 'unreadable')
  return def.fresh()
}

/** The exact text a store is saved as, in the browser and by the server. */
export const serializeStore = <T>(def: StoreDef<T>, value: T): string => JSON.stringify({ version: def.version, ...def.toDoc(value) })

/** False when the write failed or there is no storage. A value still stored as the text it was read from is left as it is. */
export function saveStore<T>(def: StoreDef<T>, value: T, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    const text = typeof value === 'object' && value !== null ? readFrom.get(value) : undefined
    if (text !== undefined && storage?.getItem(def.key) === text) return true
    storage?.setItem(def.key, serializeStore(def, value))
    return storage !== null
  } catch {
    return false
  }
}

export const loadAll = (storage: StorageLike | null = defaultStorage()): AppData =>
  Object.fromEntries(STORE_NAMES.map((name) => [name, loadStore<unknown>(STORES[name], storage)])) as AppData
