import { describe, expect, it } from 'vitest'
import type { TimedNote } from './notes.ts'
import { DEFAULT_GOALS } from './plans.ts'
import { NUTRIENTS } from './types.ts'
import type { CustomFoodDef, DayLog, EntryId, ExerciseId, FoodId, IsoDate, LocalDateTime, Meal, MealId, NutrientValues, OptionId, PlanId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { loadStore, saveStore, STORES } from './stores.ts'

function written(save: (storage: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }) => boolean): Record<string, string> {
  const data: Record<string, string> = {}
  expect(save({ getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) })).toBe(true)
  return data
}

const at = (s: string) => s as LocalDateTime
const note = (text: string, time: string): TimedNote => ({ text, createdAt: at(time), updatedAt: at(time) })
const meal: Meal = {
  id: 'm1' as MealId,
  name: 'Almoço',
  time: '13:00',
  notes: 'Sem pressa',
  optional: false,
  options: [{ id: 'o1' as OptionId, name: 'Opção 1', entries: [{ id: 'e1' as EntryId, foodId: '430' as FoodId, grams: 60 }] }],
  activeOptionId: 'o1' as OptionId,
}
const day = (date: string): DayLog => ({ date: date as IsoDate, planId: 'p1' as PlanId, goals: DEFAULT_GOALS, meals: [meal], baseline: [], eaten: [] })
const label: CustomFoodDef = {
  id: 'custom:bolo' as FoodId,
  name: 'Bolo',
  basedOn: null,
  kind: 'label',
  per100: Object.fromEntries(NUTRIENTS.map(({ key }) => [key, key === 'energyKcal' ? 350 : null])) as NutrientValues,
}
const recipe: CustomFoodDef = { id: 'custom:sopa' as FoodId, name: 'Sopa', basedOn: '430' as FoodId, kind: 'recipe', recipe: { ingredients: [{ foodId: '430' as FoodId, grams: 200 }], yieldGrams: null } }

describe('the text each store writes', () => {
  it('plans', () => {
    const state = { plans: [{ id: 'p1' as PlanId, name: 'Plano 1', goals: DEFAULT_GOALS, meals: [meal], notes: 'Água 3L' }], selectedId: 'p1' as PlanId }
    expect(written((s) => saveStore(STORES.plans, state, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:plans": "{"version":3,"state":{"plans":[{"id":"p1","name":"Plano 1","goals":{"energyKcal":2000,"protein":130,"carbohydrate":220,"fat":65,"fiber":30,"salt":5},"meals":[{"id":"m1","name":"Almoço","time":"13:00","notes":"Sem pressa","optional":false,"options":[{"id":"o1","name":"Opção 1","entries":[{"id":"e1","foodId":"430","grams":60}]}],"activeOptionId":"o1"}],"notes":"Água 3L"}],"selectedId":"p1"}}",
      }
    `)
  })

  it('custom foods', () => {
    expect(written((s) => saveStore(STORES.foods, [label, recipe], s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:foods": "{"version":2,"foods":[{"id":"custom:bolo","name":"Bolo","basedOn":null,"kind":"label","per100":{"energyKcal":350,"energyKj":null,"fat":null,"saturatedFat":null,"monounsaturatedFat":null,"polyunsaturatedFat":null,"linoleicAcid":null,"transFat":null,"carbohydrate":null,"sugars":null,"oligosaccharides":null,"starch":null,"salt":null,"fiber":null,"protein":null,"alcohol":null,"water":null,"organicAcids":null,"cholesterol":null,"vitaminA":null,"betaCaroteneEq":null,"alphaCarotene":null,"betaCarotene":null,"betaCryptoxanthin":null,"lycopene":null,"lutein":null,"zeaxanthin":null,"vitaminD":null,"alphaTocopherol":null,"thiamin":null,"riboflavin":null,"niacin":null,"niacinEq":null,"tryptophan60":null,"vitaminB6":null,"vitaminB12":null,"vitaminC":null,"folate":null,"ash":null,"sodium":null,"potassium":null,"calcium":null,"phosphorus":null,"magnesium":null,"iron":null,"zinc":null,"selenium":null,"iodine":null}},{"id":"custom:sopa","name":"Sopa","basedOn":"430","kind":"recipe","recipe":{"ingredients":[{"foodId":"430","grams":200}],"yieldGrams":null}}]}",
      }
    `)
  })

  it('units', () => {
    expect(written((s) => saveStore(STORES.units, [{ id: 'unit:fatia', foodId: '430' as FoodId, name: 'fatia', grams: 30 }], s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:units": "{"version":1,"units":[{"id":"unit:fatia","foodId":"430","name":"fatia","grams":30}]}",
      }
    `)
  })

  it('days, sorted by date', () => {
    expect(written((s) => saveStore(STORES.days, { days: { ['2026-10-05' as IsoDate]: day('2026-10-05'), ['2026-10-04' as IsoDate]: day('2026-10-04') } }, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:days": "{"version":3,"days":[{"date":"2026-10-04","planId":"p1","goals":{"energyKcal":2000,"protein":130,"carbohydrate":220,"fat":65,"fiber":30,"salt":5},"meals":[{"id":"m1","name":"Almoço","time":"13:00","notes":"Sem pressa","optional":false,"options":[{"id":"o1","name":"Opção 1","entries":[{"id":"e1","foodId":"430","grams":60}]}],"activeOptionId":"o1"}],"baseline":[],"eaten":[]},{"date":"2026-10-05","planId":"p1","goals":{"energyKcal":2000,"protein":130,"carbohydrate":220,"fat":65,"fiber":30,"salt":5},"meals":[{"id":"m1","name":"Almoço","time":"13:00","notes":"Sem pressa","optional":false,"options":[{"id":"o1","name":"Opção 1","entries":[{"id":"e1","foodId":"430","grams":60}]}],"activeOptionId":"o1"}],"baseline":[],"eaten":[]}]}",
      }
    `)
  })

  it('exercises', () => {
    expect(written((s) => saveStore(STORES.exercises, [{ id: 'x1' as ExerciseId, name: 'Supino' }], s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:exercises": "{"version":1,"exercises":[{"id":"x1","name":"Supino"}]}",
      }
    `)
  })

  it('workout plans', () => {
    const plans = [{ id: 'wp1' as WorkoutPlanId, name: 'Força', days: [{ id: 'wd1' as WorkoutDayId, name: 'Peito', exercises: [{ exerciseId: 'x1' as ExerciseId, sets: 3, reps: { min: 8, max: 12 } }] }] }]
    expect(written((s) => saveStore(STORES.workoutPlans, { plans, activePlanId: 'wp1' as WorkoutPlanId }, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:workout-plans": "{"version":1,"plans":[{"id":"wp1","name":"Força","days":[{"id":"wd1","name":"Peito","exercises":[{"exerciseId":"x1","sets":3,"reps":{"min":8,"max":12}}]}]}],"activePlanId":"wp1"}",
      }
    `)
  })

  it('workout sessions', () => {
    const sessions = [
      {
        id: 's1' as WorkoutSessionId,
        date: '2026-10-05' as IsoDate,
        workoutDayId: 'wd1' as WorkoutDayId,
        exercises: [{ exerciseId: 'x1' as ExerciseId, sets: [{ reps: 10, kg: 42.5 }, { reps: null, kg: null }], note: note('Ombro bem', '2026-10-05T18:00:00') }],
        note: note('Bom treino', '2026-10-05T18:30:00'),
      },
    ]
    expect(written((s) => saveStore(STORES.workoutSessions, sessions, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:workout-sessions": "{"version":2,"sessions":[{"id":"s1","date":"2026-10-05","workoutDayId":"wd1","exercises":[{"exerciseId":"x1","sets":[{"reps":10,"kg":42.5},{"reps":null,"kg":null}],"note":{"text":"Ombro bem","createdAt":"2026-10-05T18:00:00","updatedAt":"2026-10-05T18:00:00"}}],"note":{"text":"Bom treino","createdAt":"2026-10-05T18:30:00","updatedAt":"2026-10-05T18:30:00"}}]}",
      }
    `)
  })

  it('sleep, sorted by date', () => {
    const sleep = { ['2026-10-05' as IsoDate]: { date: '2026-10-05' as IsoDate, quality: 4 as const }, ['2026-10-04' as IsoDate]: { date: '2026-10-04' as IsoDate, quality: 2 as const } }
    expect(written((s) => saveStore(STORES.sleep, sleep, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:sleep": "{"version":1,"entries":[{"date":"2026-10-04","quality":2},{"date":"2026-10-05","quality":4}]}",
      }
    `)
  })

  it('moods, sorted by date', () => {
    const moods = { ['2026-10-05' as IsoDate]: note('Calmo', '2026-10-05T09:00:00'), ['2026-10-04' as IsoDate]: note('Cansado', '2026-10-04T22:00:00') }
    expect(written((s) => saveStore(STORES.moods, moods, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:pains": "{"version":2,"moods":[{"date":"2026-10-04","text":"Cansado","createdAt":"2026-10-04T22:00:00","updatedAt":"2026-10-04T22:00:00"},{"date":"2026-10-05","text":"Calmo","createdAt":"2026-10-05T09:00:00","updatedAt":"2026-10-05T09:00:00"}]}",
      }
    `)
  })

  it('health, sorted by date then metric', () => {
    const health = { ['2026-10-05' as IsoDate]: { steps: 8000, standHours: 10 }, ['2026-10-04' as IsoDate]: { restingHeartRate: 58 } }
    expect(written((s) => saveStore(STORES.health, health, s))).toMatchInlineSnapshot(`
      {
        "nutrition-tracking:health": "{"version":1,"samples":[{"date":"2026-10-04","metric":"restingHeartRate","value":58},{"date":"2026-10-05","metric":"standHours","value":10},{"date":"2026-10-05","metric":"steps","value":8000}]}",
      }
    `)
  })
})

describe('saving a store as the app starts', () => {
  const storageWith = (data: Record<string, string>) => {
    const writes: string[] = []
    return { writes, data, storage: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (writes.push(k), (data[k] = v)), removeItem: (k: string) => void delete data[k] } }
  }
  const SLEEP_TEXT = '{"version":1,"entries":[{"date":"2026-10-05","quality":4,"hours":7}]}'

  it('leaves a store read at the current version as it was read, until it changes', () => {
    const { writes, data, storage } = storageWith({ [STORES.sleep.key]: SLEEP_TEXT })
    const sleep = loadStore(STORES.sleep, storage)
    expect(saveStore(STORES.sleep, sleep, storage)).toBe(true)
    expect(writes).toEqual([])
    expect(data[STORES.sleep.key]).toBe(SLEEP_TEXT)
    saveStore(STORES.sleep, { ...sleep, ['2026-10-06' as IsoDate]: { date: '2026-10-06' as IsoDate, quality: 2 } }, storage)
    expect(data[STORES.sleep.key]).toBe('{"version":1,"entries":[{"date":"2026-10-05","quality":4},{"date":"2026-10-06","quality":2}]}')
  })

  it('writes the read value again once the stored text is another', () => {
    const { data, storage } = storageWith({ [STORES.sleep.key]: SLEEP_TEXT })
    const sleep = loadStore(STORES.sleep, storage)
    data[STORES.sleep.key] = '{"version":1,"entries":[]}'
    saveStore(STORES.sleep, sleep, storage)
    expect(data[STORES.sleep.key]).toBe('{"version":1,"entries":[{"date":"2026-10-05","quality":4}]}')
  })

  it('writes a store read at an older version in the current one', () => {
    const { data, storage } = storageWith({ [STORES.moods.key]: JSON.stringify({ version: 1, pains: [{ id: 'p1', date: '2026-10-06', region: 'lowerBack', intensity: 6, time: '07:30', note: '' }] }) })
    saveStore(STORES.moods, loadStore(STORES.moods, storage), storage)
    expect(JSON.parse(data[STORES.moods.key]).version).toBe(2)
  })
})
