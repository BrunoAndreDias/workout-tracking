import { describe, expect, it } from 'vitest'
import { describeBackup, exportBackup, mergeBackup, parseBackup, replaceWithBackup, writeAll } from './backup.ts'
import type { BackupData } from './backup.ts'
import type { Rating, SleepEntry } from './body.ts'
import type { TimedNote } from './notes.ts'
import { initialState, planReducer } from './plans.ts'
import type { PlanAction } from './plans.ts'
import { NUTRIENTS } from './types.ts'
import type { CustomFoodDef, DayLog, EntryId, ExerciseId, FoodId, IsoDate, LocalDateTime, MealId, NutrientValues, PlanId, WatchWorkoutId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import type { WatchWorkout } from './watchWorkouts.ts'
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

const per100 = Object.fromEntries(NUTRIENTS.map(({ key }) => [key, key === 'energyKcal' ? 250 : null])) as NutrientValues
const SKYR = { id: 'custom:skyr' as FoodId, name: 'Skyr', basedOn: null, kind: 'label', per100 } satisfies CustomFoodDef
const COPO = { id: 'unit:copo', foodId: SKYR.id, name: 'copo', grams: 150 }
const A = 'a' as PlanId

const withEntry = (planId: PlanId, name: string) =>
  (
    [
      { type: 'renamePlan', planId, name },
      { type: 'editMeals', planId, edit: { type: 'addEntry', mealId: `${planId}-m0` as MealId, entryId: 'e1' as EntryId, foodId: SKYR.id, grams: 200 } },
    ] satisfies PlanAction[]
  ).reduce(planReducer, initialState(planId))

const day = (date: string, planId: PlanId | null): DayLog => {
  const plan = withEntry(A, 'x').plans[0]
  return { date: date as IsoDate, planId, goals: plan.goals, meals: plan.meals, baseline: plan.meals, eaten: [] }
}

const SUPINO = { id: 'ex-supino' as ExerciseId, name: 'Supino' }
const PEITO: WorkoutPlan = {
  id: 'wp-1' as WorkoutPlanId,
  name: 'Força',
  days: [{ id: 'wd-1' as WorkoutDayId, name: 'Peito', exercises: [{ exerciseId: SUPINO.id, sets: 3, reps: { min: 8, max: 12 } }] }],
}
const workout = (id: string, exerciseId: ExerciseId): WorkoutSession => ({
  id: id as WorkoutSessionId,
  date: '2026-05-01' as IsoDate,
  workoutDayId: null,
  exercises: [{ exerciseId, sets: [{ reps: 8, kg: 60 }] }],
})
const NO_WORKOUTS = { exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [] }
const NO_BODY = { sleep: {}, feel: {}, moods: {}, health: {}, watchWorkouts: {} }
const sleepOn = (date: string, quality: Rating): SleepEntry => ({ date: date as IsoDate, quality })
const mood = (text: string, at = '2026-05-01T21:00:00'): TimedNote => ({ text, createdAt: at as LocalDateTime, updatedAt: at as LocalDateTime })
const watchWorkout = (id: string, date: string, minutes: number): WatchWorkout => ({ id: id as WatchWorkoutId, date: date as IsoDate, start: '07:30', activity: 'Running', minutes })
const RUN = watchWorkout('2026-05-01T06:30:00Z Running', '2026-05-01', 31.5)
const OLD_PAIN = { id: 'pain-1', date: '2026-05-01', region: 'kneeLeft', intensity: 4, time: '08:30', note: 'escadas' }

function filled() {
  const storage = memoryStorage()
  saveStore(STORES.plans, withEntry(A, 'Treino'), storage)
  saveStore(STORES.foods, [SKYR], storage)
  saveStore(STORES.units, [COPO], storage)
  saveStore(STORES.days, { days: { '2026-05-01': day('2026-05-01', A) } as Record<IsoDate, DayLog> }, storage)
  saveStore(STORES.exercises, [SUPINO], storage)
  saveStore(STORES.workoutPlans, { plans: [PEITO], activePlanId: PEITO.id }, storage)
  saveStore(STORES.workoutSessions, [workout('ws-1', SUPINO.id)], storage)
  saveStore(STORES.sleep, { ['2026-05-01' as IsoDate]: sleepOn('2026-05-01', 4) }, storage)
  saveStore(STORES.feel, { ['2026-05-01' as IsoDate]: 3 }, storage)
  saveStore(STORES.moods, { ['2026-05-01' as IsoDate]: mood('Bem disposto') }, storage)
  saveStore(STORES.health, { ['2026-05-01' as IsoDate]: { steps: 8123, standHours: 9 } }, storage)
  saveStore(STORES.watchWorkouts, { [RUN.id]: RUN }, storage)
  return storage
}

const parsed = (raw: unknown): BackupData => {
  const r = parseBackup(raw)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

const NO_PLANS = { plans: null, foods: [], units: [], days: { days: {} }, ...NO_WORKOUTS, ...NO_BODY } satisfies BackupData

describe('backup', () => {
  it('round-trips every store through export and parse', () => {
    const storage = filled()
    const { file, skipped } = exportBackup(storage, new Date('2026-06-01T10:00:00Z'))
    expect(skipped).toEqual([])
    expect(file.app).toBe('plano-alimentar')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toBe('2026-06-01T10:00:00.000Z')
    expect(file.stores.plans).toEqual(JSON.parse(storage.data[STORES.plans.key]))
    const data = parsed(JSON.parse(JSON.stringify(file)))
    expect(data).toEqual(loadAll(storage))
    expect(describeBackup(data)).toBe('1 plano, 1 alimento meu, 1 unidade, 1 dia, 1 plano de treino, 1 treino, 1 noite de sono, 1 dia com humor, 1 nota de humor, 2 valores do relógio, 1 treino do relógio')
  })

  it('leaves out stores that are missing and accepts them missing', () => {
    const { file } = exportBackup(memoryStorage())
    expect(file.stores).toEqual({})
    expect(describeBackup(parsed(file))).toBe('0 planos, 0 alimentos meus, 0 unidades, 0 dias, 0 planos de treino, 0 treinos, 0 noites de sono, 0 dias com humor, 0 notas de humor, 0 valores do relógio, 0 treinos do relógio')
  })

  it('reads a backup whose sleep entries still carry manual hours and drops them', () => {
    const old = { version: 1, entries: [{ date: '2026-05-01', quality: 4, hours: 7.5 }, { date: '2026-05-02', quality: 2, hours: null }] }
    const data = parsed({ app: 'plano-alimentar', version: 1, exportedAt: 'x', stores: { sleep: old } })
    expect(data.sleep).toEqual({ '2026-05-01': { date: '2026-05-01', quality: 4 }, '2026-05-02': { date: '2026-05-02', quality: 2 } })
  })

  it('migrates an old-version plans document inside a backup', () => {
    const v2 = { version: 2, state: { plans: [{ id: 'old', name: 'Antigo', meals: [{ id: 'm', name: 'Almoço', entries: [{ id: 'e', foodId: 'f', grams: 90 }] }] }], selectedId: 'old' } }
    const data = parsed({ app: 'plano-alimentar', version: 1, exportedAt: 'x', stores: { plans: v2 } })
    const meal = data.plans!.plans[0].meals[0]
    expect(data.plans!.plans[0].name).toBe('Antigo')
    expect(meal.options).toHaveLength(1)
    expect(meal.options[0].entries).toEqual([{ id: 'e', foodId: 'f', grams: 90 }])
  })

  it.each([
    ['not a backup', { foo: 1 }, 'Este ficheiro não é uma cópia de segurança do Plano alimentar.'],
    ['an unknown version', { app: 'plano-alimentar', version: 2, stores: {} }, 'Esta cópia de segurança é de uma versão que a app não conhece.'],
    ['no stores', { app: 'plano-alimentar', version: 1 }, 'A cópia de segurança está danificada: faltam os dados.'],
    [
      'a bad store',
      { app: 'plano-alimentar', version: 1, stores: { plans: { version: 3, state: { plans: [], selectedId: 'x' } } } },
      'A cópia de segurança está danificada: os dados de planos não são válidos. Não foi alterado nada.',
    ],
    [
      'one good store and one bad',
      { app: 'plano-alimentar', version: 1, stores: { foods: { version: 2, foods: [] }, units: { version: 1, units: [{ id: 'x' }] } } },
      'A cópia de segurança está danificada: os dados de unidades não são válidos. Não foi alterado nada.',
    ],
    [
      'a set with fractional reps',
      { app: 'plano-alimentar', version: 1, stores: { workoutSessions: { version: 1, sessions: [{ ...workout('s', SUPINO.id), exercises: [{ exerciseId: 'x', sets: [{ reps: 2.5, kg: null }] }] }] } } },
      'A cópia de segurança está danificada: os dados de treinos não são válidos. Não foi alterado nada.',
    ],
    [
      'two exercises with the same name',
      { app: 'plano-alimentar', version: 1, stores: { exercises: { version: 1, exercises: [SUPINO, { id: 'other', name: 'supino ' }] } } },
      'A cópia de segurança está danificada: os dados de exercícios não são válidos. Não foi alterado nada.',
    ],
    [
      'an active plan that is not there',
      { app: 'plano-alimentar', version: 1, stores: { workoutPlans: { version: 1, plans: [PEITO], activePlanId: 'gone' } } },
      'A cópia de segurança está danificada: os dados de planos de treino não são válidos. Não foi alterado nada.',
    ],
  ])('rejects %s', (_, raw, error) => {
    expect(parseBackup(raw)).toEqual({ ok: false, error })
  })

  it('merges: appends plans, a taken id gets a fresh one, and a taken name also gets the suffix', () => {
    const current = loadAll(filled())
    const incoming = parsed(exportBackup(filled()).file)
    const descanso = withEntry('b' as PlanId, 'Descanso').plans[0]
    const { data } = mergeBackup(current, { ...incoming, plans: { plans: [...incoming.plans!.plans, descanso], selectedId: A } }, () => 'new-id' as PlanId)
    expect(data.plans.plans.map((p) => [p.id, p.name])).toEqual([
      ['a', 'Treino'],
      ['new-id', 'Treino (importado)'],
      ['b', 'Descanso'],
    ])
    expect(data.plans.selectedId).toBe('a')
    expect(data.plans.plans[1].meals[0].id).toBe('new-id-m0')
  })

  it('a colliding plan with a different name keeps its name', () => {
    const { data } = mergeBackup(loadAll(filled()), { ...NO_PLANS, plans: withEntry(A, 'Outro') }, () => 'n2' as PlanId)
    expect(data.plans.plans.map((p) => [p.id, p.name])).toEqual([
      ['a', 'Treino'],
      ['n2', 'Outro'],
    ])
  })

  it('merges foods, units and days by id or date, reports the skipped, and days follow a renamed plan', () => {
    const incoming: BackupData = {
      plans: withEntry(A, 'Treino'),
      foods: [{ ...SKYR, name: 'Skyr diferente' }, { ...SKYR, id: 'custom:novo' as FoodId, name: 'Novo' }],
      units: [COPO, { ...COPO, id: 'unit:b', name: 'colher' }],
      days: { days: { '2026-05-01': day('2026-05-01', A), '2026-05-02': day('2026-05-02', A) } as Record<IsoDate, DayLog> },
      ...NO_WORKOUTS, ...NO_BODY,
    }
    const r = mergeBackup(loadAll(filled()), incoming, () => 'n3' as PlanId)
    expect(r.data.foods.map((f) => [f.id, f.name])).toEqual([
      ['custom:skyr', 'Skyr'],
      ['custom:novo', 'Novo'],
    ])
    expect(r.data.units.map((u) => u.id)).toEqual(['unit:copo', 'unit:b'])
    expect(Object.keys(r.data.days.days)).toEqual(['2026-05-01', '2026-05-02'])
    expect(r.data.days.days['2026-05-01' as IsoDate].planId).toBe('a')
    expect(r.data.days.days['2026-05-02' as IsoDate].planId).toBe('n3')
    expect([r.skippedFoods, r.skippedUnits, r.skippedDays]).toEqual([1, 1, 1])
  })

  it('merges workouts by id, and an incoming exercise named like one the user has becomes that one', () => {
    const remo = { id: 'ex-remo' as ExerciseId, name: 'Remo' }
    const theirSupino = { id: 'ex-their-supino' as ExerciseId, name: 'SUPINO' }
    const theirPlan: WorkoutPlan = { ...PEITO, id: 'wp-2' as WorkoutPlanId, name: 'Deles', days: [{ ...PEITO.days[0], exercises: [{ ...PEITO.days[0].exercises[0], exerciseId: theirSupino.id }] }] }
    const incoming: BackupData = {
      ...NO_PLANS,
      exercises: [{ ...SUPINO, name: 'Supino renomeado' }, theirSupino, remo],
      workoutPlans: { plans: [{ ...PEITO, name: 'Outro nome' }, theirPlan], activePlanId: theirPlan.id },
      workoutSessions: [{ ...workout('ws-1', remo.id), note: mood('perde') }, workout('ws-2', theirSupino.id), workout('ws-3', remo.id)],
    }
    const { data } = mergeBackup(loadAll(filled()), incoming)
    expect(data.exercises).toEqual([SUPINO, remo])
    expect(data.workoutPlans.plans.map((p) => [p.id, p.name, p.days[0].exercises[0].exerciseId])).toEqual([
      ['wp-1', 'Força', 'ex-supino'],
      ['wp-2', 'Deles', 'ex-supino'],
    ])
    expect(data.workoutPlans.activePlanId).toBe('wp-1')
    expect(data.workoutSessions.map((s) => [s.id, s.exercises[0].exerciseId, s.note?.text])).toEqual([
      ['ws-1', 'ex-supino', undefined],
      ['ws-2', 'ex-supino', undefined],
      ['ws-3', 'ex-remo', undefined],
    ])
  })

  it('a session brings its end feel and After-effects, which follow an Exercise merged by name', () => {
    const theirSupino = { id: 'ex-their-supino' as ExerciseId, name: 'supino' }
    const at = '2026-05-02T08:00:00' as LocalDateTime
    const theirs: WorkoutSession = {
      ...workout('ws-2', theirSupino.id),
      feel: 2,
      after: [{ date: '2026-05-02' as IsoDate, exerciseId: theirSupino.id, note: mood('Ombro dói', at) }, { date: '2026-05-02' as IsoDate, exerciseId: null, note: mood('Cansado', at) }],
    }
    const { data } = mergeBackup(loadAll(filled()), { ...NO_PLANS, exercises: [theirSupino], workoutSessions: [{ ...workout('ws-1', SUPINO.id), feel: 5 }, theirs] })
    expect(data.workoutSessions.map((s) => [s.id, s.feel, s.after?.map((a) => [a.exerciseId, a.note.text])])).toEqual([
      ['ws-1', undefined, undefined],
      ['ws-2', 2, [['ex-supino', 'Ombro dói'], [null, 'Cansado']]],
    ])
  })

  it('merges Feelings by date, what the user has winning', () => {
    const { data } = mergeBackup(loadAll(filled()), { ...NO_PLANS, feel: { ['2026-05-01' as IsoDate]: 1, ['2026-05-03' as IsoDate]: 4 } })
    expect(data.feel).toEqual({ '2026-05-01': 3, '2026-05-03': 4 })
  })

  it('rejects a whole file whose Feelings hold a rating of 7', () => {
    expect(parseBackup({ app: 'plano-alimentar', version: 1, stores: { feel: { version: 1, feel: [{ date: '2026-05-01', rating: 7 }] } } })).toEqual({
      ok: false,
      error: 'A cópia de segurança está danificada: os dados de avaliação do humor não são válidos. Não foi alterado nada.',
    })
  })

  it('merges sleep by date, what the user has winning, and adds the lines a Mood Note lacks', () => {
    const incoming: BackupData = {
      ...NO_PLANS,
      sleep: { ['2026-05-01' as IsoDate]: sleepOn('2026-05-01', 1), ['2026-05-02' as IsoDate]: sleepOn('2026-05-02', 5) },
      moods: { ['2026-05-01' as IsoDate]: mood('Bem disposto\nDormi pouco', '2026-05-01T22:00:00'), ['2026-05-02' as IsoDate]: mood('Animado') },
    }
    const { data } = mergeBackup(loadAll(filled()), incoming)
    expect(data.sleep).toEqual({
      '2026-05-01': { date: '2026-05-01', quality: 4 },
      '2026-05-02': { date: '2026-05-02', quality: 5 },
    })
    expect(data.moods).toEqual({
      '2026-05-01': { text: 'Bem disposto\nDormi pouco', createdAt: '2026-05-01T21:00:00', updatedAt: '2026-05-01T22:00:00' },
      '2026-05-02': { text: 'Animado', createdAt: '2026-05-01T21:00:00', updatedAt: '2026-05-01T21:00:00' },
    })
  })

  it('merges an older file’s pains as lines after the mood text, and merging it twice changes nothing', () => {
    const old = parsed({ app: 'plano-alimentar', version: 1, stores: { pains: { version: 1, pains: [OLD_PAIN] } } })
    const once = mergeBackup(loadAll(filled()), old).data
    expect(once.moods).toEqual({ '2026-05-01': { text: 'Bem disposto\nDor: Joelho esq. 4/10 · 08:30 · escadas', createdAt: '2026-05-01T08:30:00', updatedAt: '2026-05-01T21:00:00' } })
    expect(mergeBackup(once, old).data.moods).toEqual(once.moods)
  })

  it('merges health samples so incoming only fills a missing date and metric', () => {
    const incoming: BackupData = { ...NO_PLANS, health: { ['2026-05-01' as IsoDate]: { steps: 1, activeEnergy: 400 }, ['2026-05-02' as IsoDate]: { steps: 5000 } } }
    expect(mergeBackup(loadAll(filled()), incoming).data.health).toEqual({
      '2026-05-01': { steps: 8123, standHours: 9, activeEnergy: 400 },
      '2026-05-02': { steps: 5000 },
    })
  })

  it('merges watch workouts by id: the user’s copy wins, a new id is added, and merging twice changes nothing', () => {
    const incoming: BackupData = { ...NO_PLANS, watchWorkouts: { [RUN.id]: { ...RUN, minutes: 99 }, ['2026-05-02T17:00:00Z Yoga' as WatchWorkoutId]: watchWorkout('2026-05-02T17:00:00Z Yoga', '2026-05-02', 45) } }
    const once = mergeBackup(loadAll(filled()), incoming).data
    expect(Object.values(once.watchWorkouts).map((w) => [w.id, w.minutes])).toEqual([
      ['2026-05-01T06:30:00Z Running', 31.5],
      ['2026-05-02T17:00:00Z Yoga', 45],
    ])
    expect(mergeBackup(once, incoming).data.watchWorkouts).toEqual(once.watchWorkouts)
  })

  it('rejects a whole file whose older pains store holds an intensity above 10', () => {
    const r = parseBackup({ app: 'plano-alimentar', version: 1, stores: { pains: { version: 1, pains: [{ ...OLD_PAIN, intensity: 11 }] } } })
    expect(r).toEqual({ ok: false, error: 'A cópia de segurança está danificada: os dados de humor não são válidos. Não foi alterado nada.' })
  })

  it('entries of an imported plan still resolve to the imported custom food after merging', () => {
    const { data } = mergeBackup(loadAll(memoryStorage()), parsed(exportBackup(filled()).file))
    const ids = new Set(data.foods.map((f) => f.id))
    const entries = data.plans.plans.flatMap((p) => p.meals.flatMap((m) => m.options.flatMap((o) => o.entries)))
    expect(entries.map((e) => e.foodId)).toEqual(['custom:skyr'])
    expect(entries.every((e) => ids.has(e.foodId))).toBe(true)
  })

  it('replace writes the incoming stores, and a plans-less backup leaves one fresh plan', () => {
    const storage = filled()
    const incoming = parsed({ app: 'plano-alimentar', version: 1, stores: { foods: { version: 2, foods: [] } } })
    expect(replaceWithBackup(incoming, storage)).toEqual({ ok: true })
    const after = loadAll(storage)
    expect(after.plans.plans.map((p) => p.name)).toEqual(['Plano 1'])
    expect([after.foods, after.units, after.days]).toEqual([[], [], { days: {} }])
  })

  it('writes nothing when the file is rejected', () => {
    const storage = filled()
    const before = { ...storage.data }
    expect(parseBackup({ app: 'plano-alimentar', version: 1, stores: { plans: { version: 3 } } }).ok).toBe(false)
    expect(storage.data).toEqual(before)
  })

  describe('applying is all or nothing', () => {
    const FAILED = { ok: false, error: 'Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.' }
    // Foods are absent, so the failed import must also remove the key it had already created.
    const before = () => {
      const storage = filled()
      delete storage.data[STORES.foods.key]
      return { ...storage.data }
    }
    const incoming = (): BackupData => ({ plans: withEntry('z' as PlanId, 'Novo'), foods: [SKYR], units: [], days: { days: {} }, ...NO_WORKOUTS, ...NO_BODY })

    it('replace restores every key when the third write throws', () => {
      const initial = before()
      const storage = quotaStorage(initial, 3)
      expect(replaceWithBackup(incoming(), storage)).toEqual(FAILED)
      expect(storage.data).toEqual(initial)
      expect(storage.data[STORES.foods.key]).toBeUndefined()
    })

    it('merge restores every key when the third write throws', () => {
      const initial = before()
      const storage = quotaStorage(initial, 3)
      const merged = mergeBackup(loadAll(storage), incoming()).data
      expect(writeAll(merged, storage)).toEqual(FAILED)
      expect(storage.data).toEqual(initial)
    })

    it('reports success and writes every store when nothing throws', () => {
      const storage = quotaStorage(before(), 99)
      expect(replaceWithBackup(incoming(), storage)).toEqual({ ok: true })
      expect([STORES.units.key, STORES.days.key, STORES.foods.key].map((k) => k in storage.data)).toEqual([true, true, true])
      expect(JSON.parse(storage.data[STORES.workoutSessions.key])).toEqual({ version: 2, sessions: [] })
    })

    it('a failed last write puts back the workout sessions too', () => {
      const initial = before()
      const storage = quotaStorage(initial, 7)
      expect(replaceWithBackup(incoming(), storage)).toEqual(FAILED)
      expect(storage.data).toEqual(initial)
    })
  })

  describe('export reports what it left out', () => {
    it('lists a store whose document does not parse, and keeps the others', () => {
      const storage = filled()
      storage.data[STORES.units.key] = JSON.stringify({ version: 99, units: [] })
      const { file, skipped } = exportBackup(storage)
      expect(skipped).toEqual(['units'])
      expect(Object.keys(file.stores)).toEqual(['plans', 'foods', 'days', 'exercises', 'workoutPlans', 'workoutSessions', 'sleep', 'feel', 'moods', 'health', 'watchWorkouts'])
    })

    it('lists corrupt JSON too, but not a store that was never saved', () => {
      const storage = memoryStorage({ [STORES.days.key]: '{nope' })
      expect(exportBackup(storage).skipped).toEqual(['days'])
      expect(exportBackup(memoryStorage()).skipped).toEqual([])
    })
  })
})
