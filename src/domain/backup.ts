import type { MoodLog } from './body.ts'
import { countSamples, fillMissing } from './health.ts'
import { copyMeals } from './meals.ts'
import { appendNote } from './notes.ts'
import type { TimedNote } from './notes.ts'
import { isRecord } from './persistence.ts'
import type { RemovableStorage, StorageLike } from './persistence.ts'
import { newId } from './plans.ts'
import type { PlanState } from './plans.ts'
import { saveStore, STORE_NAMES, STORES } from './stores.ts'
import type { AppData, StoreName } from './stores.ts'
import type { DayLog, ExerciseId, IsoDate, MealPlan, PlanId } from './types.ts'
import { findExercise } from './exerciseCatalog.ts'
import { mapPlanDays } from './workouts.ts'

export const BACKUP_APP = 'plano-alimentar'
export const BACKUP_VERSION = 1

/** What a Backup's stores hold once parsed. `plans` is null only for a backup that had no plans store. */
export type BackupData = Omit<AppData, 'plans'> & { readonly plans: PlanState | null }

export type ParsedBackup = { ok: true; data: BackupData } | { ok: false; error: string }

/** Files written before Mood Notes carry their Pain Entries under this name; `parseMoods` turns them into notes. */
const LEGACY_STORE_NAMES: Partial<Record<StoreName, string>> = { moods: 'pains' }

/** Each store is the document the app saves under its own key, so it keeps its own schema version. */
export interface BackupFile {
  readonly app: typeof BACKUP_APP
  readonly version: typeof BACKUP_VERSION
  readonly exportedAt: string
  readonly stores: Readonly<Partial<Record<StoreName, unknown>>>
}

/** `skipped` names the stores that hold a document the app can no longer read: they are not in the file. A store never saved is not skipped. */
export interface Exported {
  readonly file: BackupFile
  readonly skipped: readonly StoreName[]
}

export function exportBackup(storage: StorageLike, now: Date = new Date()): Exported {
  const stores: Record<string, unknown> = {}
  const skipped: StoreName[] = []
  for (const name of STORE_NAMES) {
    const { key, parse } = STORES[name]
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
  const data = Object.fromEntries(STORE_NAMES.map((name) => [name, name === 'plans' ? null : STORES[name].fresh()])) as { -readonly [K in StoreName]: unknown }
  for (const name of STORE_NAMES) {
    const { label, parse } = STORES[name]
    const legacy = LEGACY_STORE_NAMES[name]
    const doc = raw.stores[name] ?? (legacy && raw.stores[legacy])
    if (doc === undefined) continue
    const value = parse(doc)
    if (value === null) return { ok: false, error: `A cópia de segurança está danificada: os dados de ${label} não são válidos. Não foi alterado nada.` }
    data[name] = value
  }
  return { ok: true, data: data as BackupData }
}

export interface MergeResult {
  readonly data: AppData
  readonly skippedFoods: number
  readonly skippedUnits: number
  readonly skippedDays: number
}

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => items.filter((item, i) => items.findIndex((other) => key(other) === key(item)) === i)

/**
 * Workout stores are added by id; what is already there wins, and a session brings its end feel and After-effects with it.
 * An incoming Exercise named like one the user has becomes that one, so its sets keep one history; a day or session that
 * then lists it twice keeps the first.
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
  const addedPlans = incoming.workoutPlans.plans
    .filter((p) => !planIds.has(p.id))
    .map((p) => mapPlanDays(p, (d) => ({ ...d, exercises: map(d.exercises) })))
  const plans = [...current.workoutPlans.plans, ...addedPlans]
  const sessionIds = new Set(current.workoutSessions.map((s) => s.id))
  const addedSessions = incoming.workoutSessions
    .filter((s) => !sessionIds.has(s.id))
    .map((s) => {
      const session = { ...s, exercises: map(s.exercises) }
      if (!s.after) return session
      const after = uniqueBy(
        s.after.map((a) => ({ ...a, exerciseId: a.exerciseId && (same.get(a.exerciseId) ?? a.exerciseId) })),
        (a) => `${a.date} ${a.exerciseId}`,
      )
      return { ...session, after }
    })
  return {
    exercises,
    workoutPlans: { plans, activePlanId: current.workoutPlans.activePlanId ?? plans[0]?.id ?? null },
    workoutSessions: [...current.workoutSessions, ...addedSessions],
  }
}

/**
 * Plans are appended; one whose id is taken gets a fresh id (and its days follow it), and the suffix " (importado)" only when its name is taken too.
 * Foods, units and Watch Workouts are added by id, days, Sleep Entries and Feelings by date, and Health Samples by date and metric; what is already there wins.
 * A Mood Note gets the incoming note's lines it lacks, so nothing written on either side is lost and merging twice changes nothing.
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
    data: {
      plans: { ...current.plans, plans: [...current.plans.plans, ...added] },
      foods,
      units,
      days: { days },
      ...mergeWorkouts(current, incoming),
      sleep: { ...incoming.sleep, ...current.sleep },
      feel: { ...incoming.feel, ...current.feel },
      moods: mergeMoods(current.moods, incoming.moods),
      health: fillMissing(current.health, incoming.health),
      watchWorkouts: { ...incoming.watchWorkouts, ...current.watchWorkouts },
    },
    skippedFoods: incoming.foods.length - (foods.length - current.foods.length),
    skippedUnits: incoming.units.length - (units.length - current.units.length),
    skippedDays,
  }
}

function mergeMoods(current: MoodLog, incoming: MoodLog): MoodLog {
  const moods: Record<IsoDate, TimedNote> = { ...current }
  for (const [date, note] of Object.entries(incoming) as [IsoDate, TimedNote][]) moods[date] = appendNote(moods[date], note)
  return moods
}

export type ApplyResult = { ok: true } | { ok: false; error: string }

const APPLY_FAILED = 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.'
const RESTORE_FAILED = 'Não foi possível guardar os dados e também não foi possível repor os anteriores. Exporte uma cópia antes de recarregar.'

/** Replacing is writing the incoming stores. A backup without plans leaves the app its fresh starting plan. */
export function replaceWithBackup(incoming: BackupData, storage: RemovableStorage): ApplyResult {
  return writeAll({ ...incoming, plans: incoming.plans ?? STORES.plans.fresh() }, storage)
}

/**
 * Every store or none: the raw value of every key is kept first, and any failed write puts every key back
 * (removing the ones that did not exist), so a full storage cannot leave plans from one file next to days from another.
 */
export function writeAll(data: AppData, storage: RemovableStorage): ApplyResult {
  const snapshot = STORE_NAMES.map((name) => [STORES[name].key, storage.getItem(STORES[name].key)] as const)
  if (STORE_NAMES.every((name) => saveStore<unknown>(STORES[name], data[name], storage))) return { ok: true }
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

/** "2 planos, 1 alimento meu, 4 unidades, 0 dias, 1 plano de treino, 3 treinos, 5 noites de sono, 4 dias com humor, 2 notas de humor, 14 valores do relógio, 6 treinos do relógio" */
export function describeBackup({ plans, foods, units, days, workoutPlans, workoutSessions, sleep, feel, moods, health, watchWorkouts }: BackupData): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return [
    count(plans?.plans.length ?? 0, 'plano', 'planos'),
    count(foods.length, 'alimento meu', 'alimentos meus'),
    count(units.length, 'unidade', 'unidades'),
    count(Object.keys(days.days).length, 'dia', 'dias'),
    count(workoutPlans.plans.length, 'plano de treino', 'planos de treino'),
    count(workoutSessions.length, 'treino', 'treinos'),
    count(Object.keys(sleep).length, 'noite de sono', 'noites de sono'),
    count(Object.keys(feel).length, 'dia com humor', 'dias com humor'),
    count(Object.keys(moods).length, 'nota de humor', 'notas de humor'),
    count(countSamples(health), 'valor do relógio', 'valores do relógio'),
    count(Object.keys(watchWorkouts).length, 'treino do relógio', 'treinos do relógio'),
  ].join(', ')
}
