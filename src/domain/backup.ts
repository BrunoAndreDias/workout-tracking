import { isRecord } from './persistence.ts'
import type { RemovableStorage, StorageLike } from './persistence.ts'
import { saveStore, STORE_NAMES, STORES } from './stores.ts'
import type { AppData, StoreName } from './stores.ts'
import type { ExerciseId } from './types.ts'
import { mergeEquipment } from './equipment.ts'
import { findExercise } from './exerciseCatalog.ts'
import { mapPlanDays } from './workoutReducer.ts'

export const BACKUP_APP = 'workout-tracking'
/**
 * The meal-planning app this one was split from wrote its Backups under this name, with the same file shape and the
 * same names for the stores both kept. Its food, plan, day, sleep, mood and Apple Watch stores are not read.
 */
const MEAL_APP = 'plano-alimentar'
export const BACKUP_VERSION = 1

export type ParsedBackup = { ok: true; data: AppData } | { ok: false; error: string }

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

/** Rejects the whole file when any store this app keeps fails its own parser. Stores it does not keep are ignored. */
export function parseBackup(raw: unknown): ParsedBackup {
  if (!isRecord(raw) || (raw.app !== BACKUP_APP && raw.app !== MEAL_APP)) return { ok: false, error: 'Este ficheiro não é uma cópia de segurança do Treino.' }
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: 'Esta cópia de segurança é de uma versão que a app não conhece.' }
  if (!isRecord(raw.stores)) return { ok: false, error: 'A cópia de segurança está danificada: faltam os dados.' }
  const data = Object.fromEntries(STORE_NAMES.map((name) => [name, STORES[name].fresh()])) as { -readonly [K in StoreName]: unknown }
  for (const name of STORE_NAMES) {
    const { label, parse } = STORES[name]
    const doc = raw.stores[name]
    if (doc === undefined) continue
    const value = parse(doc)
    if (value === null) return { ok: false, error: `A cópia de segurança está danificada: os dados de ${label} não são válidos. Não foi alterado nada.` }
    data[name] = value
  }
  return { ok: true, data: data as AppData }
}

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => items.filter((item, i) => items.findIndex((other) => key(other) === key(item)) === i)

/**
 * Workout stores are added by id; what is already there wins, and a session brings its end feel and After-effects with it.
 * An incoming Exercise named like one the user has becomes that one, so its sets keep one history; a day or session that
 * then lists it twice keeps the first.
 */
function mergeWorkouts(current: AppData, incoming: AppData): Pick<AppData, 'exercises' | 'workoutPlans' | 'workoutSessions'> {
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

/** Material merges as `mergeEquipment` says. */
export function mergeBackup(current: AppData, incoming: AppData): AppData {
  return {
    ...mergeWorkouts(current, incoming),
    equipment: mergeEquipment(current.equipment, incoming.equipment),
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string }

const APPLY_FAILED = 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.'
const RESTORE_FAILED = 'Não foi possível guardar os dados e também não foi possível repor os anteriores. Exporte uma cópia antes de recarregar.'

/**
 * Every store or none: the raw value of every key is kept first, and any failed write puts every key back
 * (removing the ones that did not exist), so a full storage cannot leave plans from one file next to sessions from another.
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

/** "1 plano de treino, 3 treinos, 2 locais de treino" */
export function describeBackup({ workoutPlans, workoutSessions, equipment }: AppData): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return [
    count(workoutPlans.plans.length, 'plano de treino', 'planos de treino'),
    count(workoutSessions.length, 'treino', 'treinos'),
    count(equipment.gyms.length, 'local de treino', 'locais de treino'),
  ].join(', ')
}
