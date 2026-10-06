import type { PainEntry } from './body.ts'
import { loadPains, loadSleep, PAINS_STORAGE_KEY, parsePains, parseSleep, savePains, saveSleep, SLEEP_STORAGE_KEY } from './bodyStorage.ts'
import type { SleepLog } from './bodyStorage.ts'
import { loadCustomFoods, parseCustomFoods, FOODS_STORAGE_KEY, saveCustomFoods } from './customFoodsStorage.ts'
import type { DayState } from './days.ts'
import { DAYS_STORAGE_KEY, loadDays, parseDays, saveDays } from './daysStorage.ts'
import { countSamples, fillMissing } from './health.ts'
import type { HealthLog } from './health.ts'
import { HEALTH_STORAGE_KEY, loadHealth, parseHealth, saveHealth } from './healthStorage.ts'
import { copyMeals } from './meals.ts'
import { isRecord, loadState, parseState, saveState, STORAGE_KEY } from './persistence.ts'
import type { RemovableStorage, StorageLike } from './persistence.ts'
import { initialState, newId } from './plans.ts'
import type { PlanState } from './plans.ts'
import type { CustomFoodDef, DayLog, ExerciseId, IsoDate, MealPlan, PlanId } from './types.ts'
import { loadUnits, parseUnits, saveUnits, UNITS_STORAGE_KEY } from './unitsStorage.ts'
import type { FoodUnit } from './units.ts'
import {
  EXERCISES_STORAGE_KEY,
  loadExercises,
  loadWorkoutPlans,
  loadWorkoutSessions,
  parseExercises,
  parseWorkoutPlans,
  parseWorkoutSessions,
  saveExercises,
  saveWorkoutPlans,
  saveWorkoutSessions,
  WORKOUT_PLANS_STORAGE_KEY,
  WORKOUT_SESSIONS_STORAGE_KEY,
} from './workoutStorage.ts'
import { findExercise } from './workouts.ts'
import type { Exercise, WorkoutPlanState, WorkoutSession } from './workouts.ts'

export const BACKUP_APP = 'plano-alimentar'
export const BACKUP_VERSION = 1

/** What the stores hold once parsed. `plans` is null only for a backup that had no plans store. */
export interface BackupData {
  readonly plans: PlanState | null
  readonly foods: readonly CustomFoodDef[]
  readonly units: readonly FoodUnit[]
  readonly days: DayState
  readonly exercises: readonly Exercise[]
  readonly workoutPlans: WorkoutPlanState
  readonly workoutSessions: readonly WorkoutSession[]
  readonly sleep: SleepLog
  readonly pains: readonly PainEntry[]
  readonly health: HealthLog
}

/** The app's own data: it always has a plan. */
export type AppData = BackupData & { readonly plans: PlanState }

export type ParsedBackup = { ok: true; data: BackupData } | { ok: false; error: string }

const STORES = [
  { name: 'plans', key: STORAGE_KEY, label: 'planos', parse: parseState },
  { name: 'foods', key: FOODS_STORAGE_KEY, label: 'alimentos', parse: parseCustomFoods },
  { name: 'units', key: UNITS_STORAGE_KEY, label: 'unidades', parse: parseUnits },
  { name: 'days', key: DAYS_STORAGE_KEY, label: 'dias', parse: parseDays },
  { name: 'exercises', key: EXERCISES_STORAGE_KEY, label: 'exercícios', parse: parseExercises },
  { name: 'workoutPlans', key: WORKOUT_PLANS_STORAGE_KEY, label: 'planos de treino', parse: parseWorkoutPlans },
  { name: 'workoutSessions', key: WORKOUT_SESSIONS_STORAGE_KEY, label: 'treinos', parse: parseWorkoutSessions },
  { name: 'sleep', key: SLEEP_STORAGE_KEY, label: 'sono', parse: parseSleep },
  { name: 'pains', key: PAINS_STORAGE_KEY, label: 'dores', parse: parsePains },
  { name: 'health', key: HEALTH_STORAGE_KEY, label: 'valores do relógio', parse: parseHealth },
] as const

export type StoreName = (typeof STORES)[number]['name']

/** Each store is the document the app saves under its own key, so it keeps its own schema version. */
export interface BackupFile {
  readonly app: typeof BACKUP_APP
  readonly version: typeof BACKUP_VERSION
  readonly exportedAt: string
  readonly stores: Readonly<Partial<Record<StoreName, unknown>>>
}

export const storeLabel = (name: StoreName): string => STORES.find((s) => s.name === name)!.label

/** `skipped` names the stores that hold a document the app can no longer read: they are not in the file. A store never saved is not skipped. */
export interface Exported {
  readonly file: BackupFile
  readonly skipped: readonly StoreName[]
}

export function exportBackup(storage: StorageLike, now: Date = new Date()): Exported {
  const stores: Record<string, unknown> = {}
  const skipped: StoreName[] = []
  for (const { name, key, parse } of STORES) {
    let text: string | null = null
    try {
      text = storage.getItem(key)
    } catch {
      // blocked storage reads as empty
    }
    if (!text) continue
    try {
      const doc: unknown = JSON.parse(text)
      if (parse(doc) !== null) {
        stores[name] = doc
        continue
      }
    } catch {
      // corrupt JSON is skipped like any other unreadable document
    }
    skipped.push(name)
  }
  return { file: { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), stores }, skipped }
}

/** Rejects the whole file when any store present fails its own parser. */
export function parseBackup(raw: unknown): ParsedBackup {
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'Este ficheiro não é uma cópia de segurança do Plano alimentar.' }
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: 'Esta cópia de segurança é de uma versão que a app não conhece.' }
  if (!isRecord(raw.stores)) return { ok: false, error: 'A cópia de segurança está danificada: faltam os dados.' }
  const data = { plans: null, foods: [], units: [], days: { days: {} }, exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [], sleep: {}, pains: [], health: {} } as { -readonly [K in keyof BackupData]: unknown }
  for (const { name, label, parse } of STORES) {
    const doc = raw.stores[name]
    if (doc === undefined) continue
    const value = parse(doc)
    if (value === null) return { ok: false, error: `A cópia de segurança está danificada: os dados de ${label} não são válidos. Não foi alterado nada.` }
    data[name] = value
  }
  return { ok: true, data: data as BackupData }
}

export function loadAll(storage: StorageLike): AppData {
  return {
    plans: loadState(storage),
    foods: loadCustomFoods(storage),
    units: loadUnits(storage),
    days: loadDays(storage),
    exercises: loadExercises(storage),
    workoutPlans: loadWorkoutPlans(storage),
    workoutSessions: loadWorkoutSessions(storage),
    sleep: loadSleep(storage),
    pains: loadPains(storage),
    health: loadHealth(storage),
  }
}

export interface MergeResult {
  readonly data: AppData
  readonly skippedFoods: number
  readonly skippedUnits: number
  readonly skippedDays: number
}

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => items.filter((item, i) => items.findIndex((other) => key(other) === key(item)) === i)

/**
 * Workout stores are added by id; what is already there wins. An incoming Exercise named like one the user has becomes
 * that one, so its sets keep one history; a day or session that then lists it twice keeps the first.
 */
function mergeWorkouts(current: AppData, incoming: BackupData): Pick<AppData, 'exercises' | 'workoutPlans' | 'workoutSessions'> {
  const exercises = [...current.exercises]
  const same = new Map<ExerciseId, ExerciseId>()
  for (const e of incoming.exercises) {
    const existing = exercises.find((x) => x.id === e.id) ?? findExercise(exercises, e.name)
    if (existing) same.set(e.id, existing.id)
    else exercises.push(e)
  }
  const map = <T extends { exerciseId: ExerciseId }>(rows: readonly T[]): T[] =>
    uniqueBy(
      rows.map((r) => ({ ...r, exerciseId: same.get(r.exerciseId) ?? r.exerciseId })),
      (r) => r.exerciseId,
    )

  const planIds = new Set(current.workoutPlans.plans.map((p) => p.id))
  const addedPlans = incoming.workoutPlans.plans.filter((p) => !planIds.has(p.id)).map((p) => ({ ...p, days: p.days.map((d) => ({ ...d, exercises: map(d.exercises) })) }))
  const plans = [...current.workoutPlans.plans, ...addedPlans]
  const sessionIds = new Set(current.workoutSessions.map((s) => s.id))
  const addedSessions = incoming.workoutSessions.filter((s) => !sessionIds.has(s.id)).map((s) => ({ ...s, exercises: map(s.exercises) }))
  return {
    exercises,
    workoutPlans: { plans, activePlanId: current.workoutPlans.activePlanId ?? plans[0]?.id ?? null },
    workoutSessions: [...current.workoutSessions, ...addedSessions],
  }
}

/**
 * Plans are appended; one whose id is taken gets a fresh id (and its days follow it), and the suffix " (importado)" only when its name is taken too.
 * Foods, units and Pain Entries are added by id, days and Sleep Entries by date, and Health Samples by date and metric; what is already there wins.
 */
export function mergeBackup(current: AppData, incoming: BackupData, makeId: () => PlanId = newId<PlanId>): MergeResult {
  const takenIds = new Set(current.plans.plans.map((p) => p.id))
  const takenNames = new Set(current.plans.plans.map((p) => p.name))
  const renamed = new Map<PlanId, PlanId>()
  const added: MealPlan[] = []
  for (const plan of incoming.plans?.plans ?? []) {
    if (!takenIds.has(plan.id)) {
      added.push(plan)
      takenIds.add(plan.id)
      continue
    }
    const id = makeId()
    renamed.set(plan.id, id)
    takenIds.add(id)
    added.push({ ...plan, id, name: takenNames.has(plan.name) ? `${plan.name} (importado)` : plan.name, meals: copyMeals(plan.meals, id) })
  }

  const foodIds = new Set(current.foods.map((f) => f.id))
  const foods = [...current.foods, ...incoming.foods.filter((f) => !foodIds.has(f.id))]
  const unitIds = new Set(current.units.map((u) => u.id))
  const units = [...current.units, ...incoming.units.filter((u) => !unitIds.has(u.id))]

  const painIds = new Set(current.pains.map((p) => p.id))

  const days: Record<IsoDate, DayLog> = { ...current.days.days }
  let skippedDays = 0
  for (const day of Object.values(incoming.days.days)) {
    if (days[day.date]) skippedDays++
    else days[day.date] = day.planId && renamed.has(day.planId) ? { ...day, planId: renamed.get(day.planId)! } : day
  }
  return {
    data: {
      plans: { ...current.plans, plans: [...current.plans.plans, ...added] },
      foods,
      units,
      days: { days },
      ...mergeWorkouts(current, incoming),
      sleep: { ...incoming.sleep, ...current.sleep },
      pains: [...current.pains, ...incoming.pains.filter((p) => !painIds.has(p.id))],
      health: fillMissing(current.health, incoming.health),
    },
    skippedFoods: incoming.foods.length - (foods.length - current.foods.length),
    skippedUnits: incoming.units.length - (units.length - current.units.length),
    skippedDays,
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string }

const APPLY_FAILED = 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.'
const RESTORE_FAILED = 'Não foi possível guardar os dados e também não foi possível repor os anteriores. Exporte uma cópia antes de recarregar.'

/** Replacing is writing the incoming stores. A backup without plans leaves the app its fresh starting plan. */
export function replaceWithBackup(incoming: BackupData, storage: RemovableStorage): ApplyResult {
  return writeAll({ ...incoming, plans: incoming.plans ?? initialState() }, storage)
}

/**
 * Every store or none: the raw value of every key is kept first, and any failed write puts every key back
 * (removing the ones that did not exist), so a full storage cannot leave plans from one file next to days from another.
 */
export function writeAll(data: AppData, storage: RemovableStorage): ApplyResult {
  const snapshot = STORES.map(({ key }) => [key, storage.getItem(key)] as const)
  const writes = [
    () => saveState(data.plans, storage),
    () => saveCustomFoods(data.foods, storage),
    () => saveUnits(data.units, storage),
    () => saveDays(data.days, storage),
    () => saveExercises(data.exercises, storage),
    () => saveWorkoutPlans(data.workoutPlans, storage),
    () => saveWorkoutSessions(data.workoutSessions, storage),
    () => saveSleep(data.sleep, storage),
    () => savePains(data.pains, storage),
    () => saveHealth(data.health, storage),
  ]
  if (writes.every((write) => write())) return { ok: true }
  let restored = true
  for (const [key, raw] of snapshot) {
    try {
      if (raw === null) storage.removeItem(key)
      else storage.setItem(key, raw)
    } catch {
      restored = false
    }
  }
  return { ok: false, error: restored ? APPLY_FAILED : RESTORE_FAILED }
}

/** "2 planos, 1 alimento meu, 4 unidades, 0 dias, 1 plano de treino, 3 treinos, 5 noites de sono, 2 dores, 14 valores do relógio" */
export function describeBackup({ plans, foods, units, days, workoutPlans, workoutSessions, sleep, pains, health }: BackupData): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return [
    count(plans?.plans.length ?? 0, 'plano', 'planos'),
    count(foods.length, 'alimento meu', 'alimentos meus'),
    count(units.length, 'unidade', 'unidades'),
    count(Object.keys(days.days).length, 'dia', 'dias'),
    count(workoutPlans.plans.length, 'plano de treino', 'planos de treino'),
    count(workoutSessions.length, 'treino', 'treinos'),
    count(Object.keys(sleep).length, 'noite de sono', 'noites de sono'),
    count(pains.length, 'dor', 'dores'),
    count(countSamples(health), 'valor do relógio', 'valores do relógio'),
  ].join(', ')
}
