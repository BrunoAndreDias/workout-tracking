import { GOALS, isValidGoals } from './goals.ts'
import { newMeal, parseTime } from './meals.ts'
import { DEFAULT_GOALS, initialState } from './plans.ts'
import type { PlanState } from './plans.ts'
import type { EntryId, FoodEntry, FoodId, Goals, Meal, MealId, MealOption, MealPlan, OptionId, PlanId } from './types.ts'

export const STORAGE_KEY = 'nutrition-tracking:plans'
/** 1 had no goals; 2 had one list of entries per meal and no notes; 3 has meal options, time, notes and optional meals. */
export const SCHEMA_VERSION = 3

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function parseEntries(raw: unknown): FoodEntry[] | null {
  if (!Array.isArray(raw)) return null
  const entries = []
  for (const e of raw) {
    if (!isRecord(e) || !isId(e.id) || !isId(e.foodId)) return null
    if (typeof e.grams !== 'number' || !Number.isFinite(e.grams) || e.grams < 0) return null
    entries.push({ id: e.id as EntryId, foodId: e.foodId as FoodId, grams: e.grams })
  }
  return entries
}

function parseOption(raw: unknown): MealOption | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const entries = parseEntries(raw.entries)
  return entries && { id: raw.id as OptionId, name: raw.name, entries }
}

/** A meal as stored since version 3. */
export function parseMeal(raw: unknown): Meal | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || typeof raw.notes !== 'string' || typeof raw.optional !== 'boolean') return null
  if (!Array.isArray(raw.options) || !isId(raw.activeOptionId)) return null
  const options = []
  for (const o of raw.options) {
    const option = parseOption(o)
    if (!option) return null
    options.push(option)
  }
  const [first, ...rest] = options
  if (!first || new Set(options.map((o) => o.id)).size !== options.length || !options.some((o) => o.id === raw.activeOptionId)) return null
  // A time this build cannot read costs only the time, as bad goals cost only the goals.
  const time = typeof raw.time === 'string' ? parseTime(raw.time) : null
  return { id: raw.id as MealId, name: raw.name, time, notes: raw.notes, optional: raw.optional, options: [first, ...rest], activeOptionId: raw.activeOptionId as OptionId }
}

/** A version 1 or 2 meal, `{ id, name, entries }`, becomes a single-option meal. */
export function parseLegacyMeal(raw: unknown): Meal | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const entries = parseEntries(raw.entries)
  return entries && newMeal(raw.id as MealId, raw.name, entries)
}

export function parseMeals(raw: unknown, parse: (raw: unknown) => Meal | null): Meal[] | null {
  if (!Array.isArray(raw)) return null
  const meals = []
  for (const m of raw) {
    const meal = parse(m)
    if (!meal) return null
    meals.push(meal)
  }
  return meals
}

// Version 1 had no goals; a bad goals object costs only the goals, never the plan's meals.
export function parseGoals(raw: unknown): Goals {
  if (!isRecord(raw)) return DEFAULT_GOALS
  const goals: Record<keyof Goals, number> = { ...DEFAULT_GOALS }
  for (const { key } of GOALS) {
    const v = raw[key]
    if (typeof v !== 'number') return DEFAULT_GOALS
    goals[key] = v
  }
  return isValidGoals(goals) ? goals : DEFAULT_GOALS
}

function parsePlan(raw: unknown, legacy: boolean): MealPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string') return null
  const meals = parseMeals(raw.meals, legacy ? parseLegacyMeal : parseMeal)
  const notes = legacy ? '' : raw.notes
  if (!meals || typeof notes !== 'string') return null
  return { id: raw.id as PlanId, name: raw.name, goals: parseGoals(raw.goals), meals, notes }
}

/** Reads every version up to the current one; null for anything else. */
export function parseState(raw: unknown): PlanState | null {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2 && raw.version !== SCHEMA_VERSION) || !isRecord(raw.state)) return null
  const legacy = raw.version !== SCHEMA_VERSION
  const { plans: rawPlans, selectedId } = raw.state
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) return null
  const plans = []
  for (const p of rawPlans) {
    const plan = parsePlan(p, legacy)
    if (!plan) return null
    plans.push(plan)
  }
  if (new Set(plans.map((p) => p.id)).size !== plans.length) return null
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0]
  return { plans, selectedId: selected.id }
}

export function loadState(storage: StorageLike | null = defaultStorage()): PlanState {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    if (text) return parseState(JSON.parse(text)) ?? initialState()
  } catch {
    // corrupt JSON or blocked storage: fall through to a fresh state
  }
  return initialState()
}

export function saveState(state: PlanState, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, state }))
    return storage !== null
  } catch {
    return false
  }
}
