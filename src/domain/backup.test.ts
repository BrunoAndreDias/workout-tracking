import { describe, expect, it } from 'vitest'
import { describeBackup, exportBackup, loadAll, mergeBackup, parseBackup, replaceWithBackup } from './backup.ts'
import type { BackupData } from './backup.ts'
import { saveCustomFoods } from './customFoodsStorage.ts'
import { DAYS_STORAGE_KEY, saveDays } from './daysStorage.ts'
import { saveState, STORAGE_KEY } from './persistence.ts'
import { initialState, planReducer } from './plans.ts'
import type { PlanAction } from './plans.ts'
import { NUTRIENTS } from './types.ts'
import type { CustomFoodDef, DayLog, EntryId, FoodId, IsoDate, MealId, NutrientValues, PlanId } from './types.ts'
import { saveUnits, UNITS_STORAGE_KEY } from './unitsStorage.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] }
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
  return { date: date as IsoDate, planId, goals: plan.goals, meals: plan.meals, baseline: plan.meals }
}

function filled() {
  const storage = memoryStorage()
  saveState(withEntry(A, 'Treino'), storage)
  saveCustomFoods([SKYR], storage)
  saveUnits([COPO], storage)
  saveDays({ days: { '2026-05-01': day('2026-05-01', A) } as Record<IsoDate, DayLog> }, storage)
  return storage
}

const parsed = (raw: unknown): BackupData => {
  const r = parseBackup(raw)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

const NO_PLANS = { plans: null, foods: [], units: [], days: { days: {} } } satisfies BackupData

describe('backup', () => {
  it('round-trips every store through export and parse', () => {
    const storage = filled()
    const { file, skipped } = exportBackup(storage, new Date('2026-06-01T10:00:00Z'))
    expect(skipped).toEqual([])
    expect(file.app).toBe('plano-alimentar')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toBe('2026-06-01T10:00:00.000Z')
    expect(file.stores.plans).toEqual(JSON.parse(storage.data[STORAGE_KEY]))
    const data = parsed(JSON.parse(JSON.stringify(file)))
    expect(data).toEqual(loadAll(storage))
    expect(describeBackup(data)).toBe('1 plano, 1 alimento meu, 1 unidade, 1 dia')
  })

  it('leaves out stores that are missing and accepts them missing', () => {
    const { file } = exportBackup(memoryStorage())
    expect(file.stores).toEqual({})
    expect(describeBackup(parsed(file))).toBe('0 planos, 0 alimentos meus, 0 unidades, 0 dias')
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
    expect(replaceWithBackup(incoming, storage)).toBe(true)
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

  describe('export reports what it left out', () => {
    it('lists a store whose document does not parse, and keeps the others', () => {
      const storage = filled()
      storage.data[UNITS_STORAGE_KEY] = JSON.stringify({ version: 99, units: [] })
      const { file, skipped } = exportBackup(storage)
      expect(skipped).toEqual(['units'])
      expect(Object.keys(file.stores)).toEqual(['plans', 'foods', 'days'])
    })

    it('lists corrupt JSON too, but not a store that was never saved', () => {
      const storage = memoryStorage({ [DAYS_STORAGE_KEY]: '{nope' })
      expect(exportBackup(storage).skipped).toEqual(['days'])
      expect(exportBackup(memoryStorage()).skipped).toEqual([])
    })
  })
})
