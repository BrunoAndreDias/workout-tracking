import { loadCustomFoods, parseCustomFoods, FOODS_STORAGE_KEY, saveCustomFoods } from './customFoodsStorage.ts'
import type { DayState } from './days.ts'
import { DAYS_STORAGE_KEY, loadDays, parseDays, saveDays } from './daysStorage.ts'
import { copyMeals } from './meals.ts'
import { isRecord, loadState, parseState, saveState, STORAGE_KEY } from './persistence.ts'
import type { StorageLike } from './persistence.ts'
import { initialState, newId } from './plans.ts'
import type { PlanState } from './plans.ts'
import type { CustomFoodDef, DayLog, IsoDate, MealPlan, PlanId } from './types.ts'
import { loadUnits, parseUnits, saveUnits, UNITS_STORAGE_KEY } from './unitsStorage.ts'
import type { FoodUnit } from './units.ts'

export const BACKUP_APP = 'plano-alimentar'
export const BACKUP_VERSION = 1

/** Each store is the document the app saves under its own key, so it keeps its own schema version. */
export interface BackupFile {
  readonly app: typeof BACKUP_APP
  readonly version: typeof BACKUP_VERSION
  readonly exportedAt: string
  readonly stores: Readonly<Partial<Record<'plans' | 'foods' | 'units' | 'days', unknown>>>
}

/** What the four stores hold once parsed. `plans` is null only for a backup that had no plans store. */
export interface BackupData {
  readonly plans: PlanState | null
  readonly foods: readonly CustomFoodDef[]
  readonly units: readonly FoodUnit[]
  readonly days: DayState
}

/** The app's own data: it always has a plan. */
export type AppData = BackupData & { readonly plans: PlanState }

export type ParsedBackup = { ok: true; data: BackupData } | { ok: false; error: string }

const STORES = [
  { name: 'plans', key: STORAGE_KEY, label: 'planos', parse: parseState },
  { name: 'foods', key: FOODS_STORAGE_KEY, label: 'alimentos', parse: parseCustomFoods },
  { name: 'units', key: UNITS_STORAGE_KEY, label: 'unidades', parse: parseUnits },
  { name: 'days', key: DAYS_STORAGE_KEY, label: 'dias', parse: parseDays },
] as const

function readDocument(storage: StorageLike, key: string): unknown {
  try {
    const text = storage.getItem(key)
    return text ? JSON.parse(text) : undefined
  } catch {
    return undefined
  }
}

/** A store that is missing or no longer readable is left out, as the app would start it empty. */
export function exportBackup(storage: StorageLike, now: Date = new Date()): BackupFile {
  const stores: Record<string, unknown> = {}
  for (const { name, key, parse } of STORES) {
    const doc = readDocument(storage, key)
    if (doc !== undefined && parse(doc) !== null) stores[name] = doc
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), stores }
}

/** Rejects the whole file when any store present fails its own parser. */
export function parseBackup(raw: unknown): ParsedBackup {
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'Este ficheiro não é uma cópia de segurança do Plano alimentar.' }
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: 'Esta cópia de segurança é de uma versão que a app não conhece.' }
  if (!isRecord(raw.stores)) return { ok: false, error: 'A cópia de segurança está danificada: faltam os dados.' }
  const data = { plans: null, foods: [], units: [], days: { days: {} } } as { -readonly [K in keyof BackupData]: unknown }
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
  return { plans: loadState(storage), foods: loadCustomFoods(storage), units: loadUnits(storage), days: loadDays(storage) }
}

export interface MergeResult {
  readonly data: AppData
  readonly skippedFoods: number
  readonly skippedUnits: number
  readonly skippedDays: number
}

/**
 * Plans are appended; one whose id is taken gets a fresh id (and its days follow it), and the suffix " (importado)" only when its name is taken too.
 * Foods and units are added by id and days by date; what is already there wins.
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

  const days: Record<IsoDate, DayLog> = { ...current.days.days }
  let skippedDays = 0
  for (const day of Object.values(incoming.days.days)) {
    if (days[day.date]) skippedDays++
    else days[day.date] = day.planId && renamed.has(day.planId) ? { ...day, planId: renamed.get(day.planId)! } : day
  }
  return {
    data: { plans: { ...current.plans, plans: [...current.plans.plans, ...added] }, foods, units, days: { days } },
    skippedFoods: incoming.foods.length - (foods.length - current.foods.length),
    skippedUnits: incoming.units.length - (units.length - current.units.length),
    skippedDays,
  }
}

/** Replacing is writing the incoming stores. A backup without plans leaves the app its fresh starting plan. */
export function replaceWithBackup(incoming: BackupData, storage: StorageLike): boolean {
  return writeAll({ ...incoming, plans: incoming.plans ?? initialState() }, storage)
}

export function writeAll(data: AppData, storage: StorageLike): boolean {
  return [saveState(data.plans, storage), saveCustomFoods(data.foods, storage), saveUnits(data.units, storage), saveDays(data.days, storage)].every(Boolean)
}

/** "2 planos, 1 alimento meu, 4 unidades, 0 dias" */
export function describeBackup({ plans, foods, units, days }: BackupData): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return [
    count(plans?.plans.length ?? 0, 'plano', 'planos'),
    count(foods.length, 'alimento meu', 'alimentos meus'),
    count(units.length, 'unidade', 'unidades'),
    count(Object.keys(days.days).length, 'dia', 'dias'),
  ].join(', ')
}
