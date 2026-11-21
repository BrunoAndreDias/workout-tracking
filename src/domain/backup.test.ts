import { describe, expect, it } from 'vitest'
import { describeBackup, exportBackup, mergeBackup, parseBackup, writeAll } from './backup.ts'
import { equipmentReducer, freshEquipment, needsOf } from './equipment.ts'
import type { EquipmentAction } from './equipment.ts'
import type { TimedNote } from './notes.ts'
import type { AppData } from './stores.ts'
import type { CustomEquipmentId, ExerciseId, GymId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import type { WorkoutPlan, WorkoutSession } from './workouts.ts'
import { loadAll, saveStore, STORES } from './stores.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] }
}

/** Fails like a full localStorage: the nth write throws. */
function quotaStorage(initial: Record<string, string>, failOn: number) {
  const storage = memoryStorage(initial)
  let writes = 0
  return {
    ...storage,
    setItem: (k: string, v: string) => {
      if (++writes === failOn) throw new Error('QuotaExceededError')
      storage.setItem(k, v)
    },
  }
}

const SUPINO = { id: 'ex-supino' as ExerciseId, name: 'Supino' }
const PEITO_DAY = { id: 'wd-1' as WorkoutDayId, name: 'Peito', exercises: [{ exerciseId: SUPINO.id, role: 'main' as const, sets: 3, reps: { min: 8, max: 12 }, weeks: null, since: null }] }
const restDay = (id: string) => ({ id: id as WorkoutDayId, name: id, exercises: [] })
const PEITO: WorkoutPlan = {
  id: 'wp-1' as WorkoutPlanId,
  name: 'Força',
  split: 'ppf',
  blocks: [{ id: 'wb-1' as WorkoutBlockId, name: 'Bloco A', weeks: 1, rir: [{ min: 5, max: 6 }], days: [PEITO_DAY, restDay('wd-1b'), restDay('wd-1c')] }],
  start: { blockId: 'wb-1' as WorkoutBlockId, since: '2026-05-04' as IsoDate },
}
const workout = (id: string, exerciseId: ExerciseId): WorkoutSession => ({
  id: id as WorkoutSessionId,
  date: '2026-05-01' as IsoDate,
  workoutDayId: null,
  exercises: [{ exerciseId, sets: [{ done: true, reps: 8, kg: 60, rir: null }] }],
})
const note = (text: string, at = '2026-05-01T21:00:00'): TimedNote => ({ text, createdAt: at as LocalDateTime, updatedAt: at as LocalDateTime })
const CASA = 'gym-casa' as GymId
const ELASTICOS = 'mat:elasticos' as CustomEquipmentId
const material = (...actions: EquipmentAction[]) => actions.reduce(equipmentReducer, freshEquipment())
const casaWith = (...actions: EquipmentAction[]) => material({ type: 'addGym', gymId: CASA, name: 'Casa' }, { type: 'addCustom', id: ELASTICOS, name: 'Elásticos' }, ...actions)
const EMPTY: AppData = { exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [], equipment: freshEquipment() }

function filled() {
  const storage = memoryStorage()
  saveStore(STORES.exercises, [SUPINO], storage)
  saveStore(STORES.workoutPlans, { plans: [PEITO], activePlanId: PEITO.id }, storage)
  saveStore(STORES.workoutSessions, [workout('ws-1', SUPINO.id)], storage)
  saveStore(STORES.equipment, casaWith({ type: 'toggleHas', gymId: CASA, equipmentId: ELASTICOS }), storage)
  return storage
}

const parsed = (raw: unknown): AppData => {
  const r = parseBackup(raw)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

describe('backup', () => {
  it('round-trips every store through export and parse', () => {
    const storage = filled()
    const { file, skipped } = exportBackup(storage, new Date('2026-06-01T10:00:00Z'))
    expect(skipped).toEqual([])
    expect([file.app, file.version, file.exportedAt]).toEqual(['workout-tracking', 1, '2026-06-01T10:00:00.000Z'])
    expect(file.stores.workoutSessions).toEqual(JSON.parse(storage.data[STORES.workoutSessions.key]))
    const data = parsed(JSON.parse(JSON.stringify(file)))
    expect(data).toEqual(loadAll(storage))
    expect(describeBackup(data)).toBe('1 plano de treino, 1 treino, 1 local de treino')
  })

  it('leaves out stores that are missing and accepts them missing', () => {
    const { file } = exportBackup(memoryStorage())
    expect(file.stores).toEqual({})
    expect(describeBackup(parsed(file))).toBe('0 planos de treino, 0 treinos, 0 locais de treino')
  })

  it('imports a Backup from before the Apple Watch was removed, ignoring its watch stores', () => {
    const { file } = exportBackup(filled())
    const old = { ...file, stores: { ...file.stores, health: { version: 1, samples: [{ date: '2026-05-01', metric: 'steps', value: 8123 }] }, watchWorkouts: { version: 1, workouts: [] } } }
    const data = parsed(old)
    expect(Object.keys(data)).toEqual(['exercises', 'workoutPlans', 'workoutSessions', 'equipment'])
    expect(data).toEqual(loadAll(filled()))
  })

  it.each([
    ['not a backup', { foo: 1 }, 'Este ficheiro não é uma cópia de segurança do Treino.'],
    ['an unknown version', { app: 'workout-tracking', version: 2, stores: {} }, 'Esta cópia de segurança é de uma versão que a app não conhece.'],
    ['no stores', { app: 'workout-tracking', version: 1 }, 'A cópia de segurança está danificada: faltam os dados.'],
    [
      'a set with fractional reps',
      { app: 'workout-tracking', version: 1, stores: { workoutSessions: { version: 1, sessions: [{ ...workout('s', SUPINO.id), exercises: [{ exerciseId: 'x', sets: [{ reps: 2.5, kg: null }] }] }] } } },
      'A cópia de segurança está danificada: os dados de treinos não são válidos. Não foi alterado nada.',
    ],
    [
      'two exercises with the same name',
      { app: 'workout-tracking', version: 1, stores: { exercises: { version: 1, exercises: [SUPINO, { id: 'other', name: 'supino ' }] } } },
      'A cópia de segurança está danificada: os dados de exercícios não são válidos. Não foi alterado nada.',
    ],
    [
      'an active plan that is not there',
      { app: 'workout-tracking', version: 1, stores: { workoutPlans: { version: 3, plans: [PEITO], activePlanId: 'gone' } } },
      'A cópia de segurança está danificada: os dados de planos de treino não são válidos. Não foi alterado nada.',
    ],
  ])('rejects %s', (_, raw, error) => {
    expect(parseBackup(raw)).toEqual({ ok: false, error })
  })

  it('imports workout plans saved before Training Splits as their split, and drops a plan that fits none instead of rejecting the file', () => {
    const v2Day = (id: string) => ({ id, name: id, exercises: [{ exerciseId: SUPINO.id, sets: 3, reps: { min: 8, max: 12 } }] })
    const v2Plan = (id: string, n: number) => ({ id, name: id, blocks: [{ id: `${id}-b`, name: 'Bloco A', weeks: 1, rir: [null], days: Array.from({ length: n }, (_, i) => v2Day(`${id}-${i}`)) }], start: null })
    const v2 = { version: 2, plans: [v2Plan('cinco', 5), v2Plan('quatro', 4)], activePlanId: 'cinco' }
    const data = parsed({ app: 'workout-tracking', version: 1, stores: { workoutPlans: v2 } })
    expect(data.workoutPlans.plans.map((p) => [p.id, p.split, p.blocks[0].days[0].exercises[0].role])).toEqual([['quatro', 'ul', 'main']])
    expect(data.workoutPlans.activePlanId).toBe('quatro')
  })

  it('a session brings its end feel and After-effects, which follow an Exercise merged by name', () => {
    const theirSupino = { id: 'ex-their-supino' as ExerciseId, name: 'supino' }
    const at = '2026-05-02T08:00:00'
    const theirs: WorkoutSession = {
      ...workout('ws-2', theirSupino.id),
      feel: 2,
      after: [{ date: '2026-05-02' as IsoDate, exerciseId: theirSupino.id, note: note('Ombro dói', at) }, { date: '2026-05-02' as IsoDate, exerciseId: null, note: note('Cansado', at) }],
    }
    const data = mergeBackup(loadAll(filled()), { ...EMPTY, exercises: [theirSupino], workoutSessions: [{ ...workout('ws-1', SUPINO.id), feel: 5 }, theirs] })
    expect(data.exercises).toEqual([SUPINO])
    expect(data.workoutSessions.map((s) => [s.id, s.feel, s.after?.map((a) => [a.exerciseId, a.note.text])])).toEqual([
      ['ws-1', undefined, undefined],
      ['ws-2', 2, [['ex-supino', 'Ombro dói'], [null, 'Cansado']]],
    ])
  })

  it('merges material: new Gyms and own material by id, corrections only for Exercises the user has not corrected, and keeps the active Gym', () => {
    const GINASIO = 'gym-ginasio' as GymId
    const current = { ...loadAll(filled()), equipment: casaWith({ type: 'setNeeds', name: 'Planks', needs: [ELASTICOS] }) }
    const incoming: AppData = {
      ...EMPTY,
      equipment: material(
        { type: 'addGym', gymId: GINASIO, name: 'Ginásio' },
        { type: 'toggleHas', gymId: GINASIO, equipmentId: 'barbell' },
        { type: 'setNeeds', name: 'Planks', needs: ['bench'] },
        { type: 'setNeeds', name: 'Push-Ups', needs: ['bench'] },
      ),
    }
    const once = mergeBackup(current, incoming).equipment
    expect(once.gyms.map((g) => [g.name, g.has])).toEqual([
      ['Casa', []],
      ['Ginásio', ['barbell']],
    ])
    expect(once.activeGymId).toBe(CASA)
    expect([needsOf(once, 'Planks'), needsOf(once, 'Push-Ups')]).toEqual([[ELASTICOS], ['bench']])
    expect(mergeBackup({ ...current, equipment: once }, incoming).equipment).toEqual(once)
    expect(mergeBackup({ ...current, equipment: freshEquipment() }, incoming).equipment.activeGymId).toBe(GINASIO)
  })

  describe('applying is all or nothing', () => {
    const FAILED = { ok: false, error: 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.' }
    // Exercises are absent, so the failed import must also remove the key it had already created.
    const before = () => {
      const storage = filled()
      delete storage.data[STORES.exercises.key]
      return { ...storage.data }
    }
    const incoming = (): AppData => ({ ...EMPTY, exercises: [SUPINO] })

    it('replace restores every key when a write throws', () => {
      const initial = before()
      const storage = quotaStorage(initial, 3)
      expect(writeAll(incoming(), storage)).toEqual(FAILED)
      expect(storage.data).toEqual(initial)
    })

    it('merge restores every key when the last write throws', () => {
      const initial = before()
      const storage = quotaStorage(initial, 4)
      expect(writeAll(mergeBackup(loadAll(storage), incoming()), storage)).toEqual(FAILED)
      expect(storage.data).toEqual(initial)
      expect(storage.data[STORES.exercises.key]).toBeUndefined()
    })

    it('reports success and writes every store when nothing throws', () => {
      const storage = quotaStorage(before(), 99)
      expect(writeAll(incoming(), storage)).toEqual({ ok: true })
      expect(JSON.parse(storage.data[STORES.workoutSessions.key])).toEqual({ version: 3, sessions: [] })
      expect(STORES.exercises.key in storage.data).toBe(true)
    })
  })

  describe('export reports what it left out', () => {
    it('lists a store whose document does not parse, and keeps the others', () => {
      const storage = filled()
      storage.data[STORES.workoutPlans.key] = JSON.stringify({ version: 99, plans: [] })
      const { file, skipped } = exportBackup(storage)
      expect(skipped).toEqual(['workoutPlans'])
      expect(Object.keys(file.stores)).toEqual(['exercises', 'workoutSessions', 'equipment'])
    })

    it('lists corrupt JSON too, but not a store that was never saved', () => {
      expect(exportBackup(memoryStorage({ [STORES.exercises.key]: '{nope' })).skipped).toEqual(['exercises'])
      expect(exportBackup(memoryStorage()).skipped).toEqual([])
    })
  })
})
