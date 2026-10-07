import type { MoodLog } from './body.ts'
import { MOODS_SCHEMA_VERSION, parseMoods, parseSleep, SLEEP_SCHEMA_VERSION } from './bodyStorage.ts'
import type { SleepLog } from './bodyStorage.ts'
import { FOODS_SCHEMA_VERSION, parseCustomFoods } from './customFoodsStorage.ts'
import type { DayState } from './days.ts'
import { DAYS_SCHEMA_VERSION, daysText, parseDays, storedDay } from './daysStorage.ts'
import { logSamples } from './health.ts'
import type { HealthLog } from './health.ts'
import { HEALTH_SCHEMA_VERSION, parseHealth } from './healthStorage.ts'
import type { TimedNote } from './notes.ts'
import { defaultStorage, isRecord, parseState, PLANS_SCHEMA_VERSION, preserveCopy } from './persistence.ts'
import type { StorageLike } from './persistence.ts'
import { initialState } from './plans.ts'
import type { PlanState } from './plans.ts'
import { STORE_KEY } from './storeKeys.ts'
import type { StoreKey } from './storeKeys.ts'
import type { CustomFoodDef, IsoDate } from './types.ts'
import type { FoodUnit } from './units.ts'
import { parseUnits, UNITS_SCHEMA_VERSION } from './unitsStorage.ts'
import { EXERCISES_SCHEMA_VERSION, parseExercises, parseWorkoutPlans, parseWorkoutSessions, WORKOUT_PLANS_SCHEMA_VERSION, WORKOUT_SESSIONS_SCHEMA_VERSION } from './workoutStorage.ts'
import type { Exercise, WorkoutPlanState, WorkoutSession } from './workouts.ts'

/**
 * A Store: one versioned document under its own key. `parse` reads every version this build understands, or returns
 * null; `toDoc` is what is saved beside `version`; `fresh` is the value when there is no readable document; `label`
 * names the store to the user. `text`, when given, writes the same JSON as `toDoc` would, faster.
 */
export interface StoreDef<T> {
  readonly key: StoreKey
  readonly label: string
  readonly version: number
  parse(raw: unknown): T | null
  toDoc(value: T): object
  text?(value: T): string
  fresh(): T
}

const store = <T>(def: StoreDef<T>): StoreDef<T> => def
const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date)

/** Every store the app keeps, in the order a Backup lists them. */
export const STORES = {
  plans: store<PlanState>({ key: STORE_KEY.plans, label: 'planos', version: PLANS_SCHEMA_VERSION, parse: parseState, toDoc: (state) => ({ state }), fresh: () => initialState() }),
  foods: store<readonly CustomFoodDef[]>({ key: STORE_KEY.foods, label: 'alimentos', version: FOODS_SCHEMA_VERSION, parse: parseCustomFoods, toDoc: (foods) => ({ foods }), fresh: () => [] }),
  units: store<readonly FoodUnit[]>({ key: STORE_KEY.units, label: 'unidades', version: UNITS_SCHEMA_VERSION, parse: parseUnits, toDoc: (units) => ({ units }), fresh: () => [] }),
  days: store<DayState>({
    key: STORE_KEY.days,
    label: 'dias',
    version: DAYS_SCHEMA_VERSION,
    parse: parseDays,
    toDoc: (state) => ({ days: Object.values(state.days).sort(byDate).map(storedDay) }),
    text: daysText,
    fresh: () => ({ days: {} }),
  }),
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
  sleep: store<SleepLog>({ key: STORE_KEY.sleep, label: 'sono', version: SLEEP_SCHEMA_VERSION, parse: parseSleep, toDoc: (sleep) => ({ entries: Object.values(sleep).sort(byDate) }), fresh: () => ({}) }),
  moods: store<MoodLog>({
    key: STORE_KEY.moods,
    label: 'humor',
    version: MOODS_SCHEMA_VERSION,
    parse: parseMoods,
    toDoc: (moods) => ({ moods: (Object.entries(moods) as [IsoDate, TimedNote][]).map(([date, note]) => ({ date, ...note })).sort(byDate) }),
    fresh: () => ({}),
  }),
  health: store<HealthLog>({ key: STORE_KEY.health, label: 'valores do relógio', version: HEALTH_SCHEMA_VERSION, parse: parseHealth, toDoc: (log) => ({ samples: logSamples(log) }), fresh: () => ({}) }),
} satisfies Record<keyof typeof STORE_KEY, unknown>

export type StoreName = keyof typeof STORES

export const STORE_NAMES = Object.keys(STORES) as StoreName[]

/** What the stores hold once parsed. */
export type AppData = { readonly [N in StoreName]: (typeof STORES)[N] extends StoreDef<infer T> ? T : never }

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
      return value
    }
  } catch {
    // corrupt JSON
  }
  preserveCopy(storage, def.key, text, 'unreadable')
  return def.fresh()
}

/** The exact text a store is saved as, in the browser and by the server. */
export const serializeStore = <T>(def: StoreDef<T>, value: T): string =>
  def.text ? def.text(value) : JSON.stringify({ version: def.version, ...def.toDoc(value) })

/** False when the write failed or there is no storage. */
export function saveStore<T>(def: StoreDef<T>, value: T, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    storage?.setItem(def.key, serializeStore(def, value))
    return storage !== null
  } catch {
    return false
  }
}

export const loadAll = (storage: StorageLike | null = defaultStorage()): AppData =>
  Object.fromEntries(STORE_NAMES.map((name) => [name, loadStore<unknown>(STORES[name], storage)])) as AppData
