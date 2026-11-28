import { isRecord } from './records.ts'
import type { RemovableStorage, StorageLike } from './persistence.ts'
import { saveStore, STORE_NAMES, STORES } from './stores.ts'
import type { AppData, StoreName } from './stores.ts'
import type { ExerciseId } from './types.ts'
import { mergeEquipment } from './equipment.ts'
import { findExercise } from './names.ts'
import { mapPlanDays } from './workoutReducer.ts'
import { afterEffectKey } from './workouts.ts'

const BACKUP_APP = 'workout-tracking'
const BACKUP_VERSION = 1

export type ParsedBackup = { ok: true; data: AppData } | { ok: false; error: string }

export interface BackupFile {
  readonly app: typeof BACKUP_APP
  readonly version: typeof BACKUP_VERSION
  readonly exportedAt: string
  readonly stores: Readonly<Partial<Record<StoreName, unknown>>>
}

export interface Exported {
  readonly file: BackupFile
  readonly skipped: readonly StoreName[]
}

function readKey(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function readDocument(text: string, parse: (doc: unknown) => unknown): { doc: unknown } | null {
  try {
    const doc: unknown = JSON.parse(text)
    return parse(doc) === null ? null : { doc }
  } catch {
    return null
  }
}

export function exportBackup(storage: StorageLike, now: Date = new Date()): Exported {
  const stores: Record<string, unknown> = {}
  const skipped: StoreName[] = []
  for (const name of STORE_NAMES) {
    const { key, parse } = STORES[name]
    const text = readKey(storage, key)
    if (!text) continue
    const read = readDocument(text, parse)
    if (read) stores[name] = read.doc
    else skipped.push(name)
  }
  return { file: { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), stores }, skipped }
}

export function parseBackup(raw: unknown): ParsedBackup {
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'Este ficheiro não é uma cópia de segurança do Treino.' }
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
        afterEffectKey,
      )
      return { ...session, after }
    })
  return {
    exercises,
    workoutPlans: { plans, activePlanId: current.workoutPlans.activePlanId ?? plans[0]?.id ?? null },
    workoutSessions: [...current.workoutSessions, ...addedSessions],
  }
}

export function mergeBackup(current: AppData, incoming: AppData): AppData {
  return {
    ...mergeWorkouts(current, incoming),
    equipment: mergeEquipment(current.equipment, incoming.equipment),
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string }

const APPLY_FAILED = 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.'
const RESTORE_FAILED = 'Não foi possível guardar os dados e também não foi possível repor os anteriores. Exporte uma cópia antes de recarregar.'

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
