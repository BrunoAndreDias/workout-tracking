import { GOALS, isValidGoals } from './goals.ts'
import { DEFAULT_GOALS, initialState } from './plans.ts'
import type { PlanState } from './plans.ts'
import type { EntryId, FoodId, Goals, Meal, MealId, MealPlan, PlanId } from './types.ts'

export const STORAGE_KEY = 'nutrition-tracking:plans'
export const SCHEMA_VERSION = 2

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function parseMeal(raw: unknown): Meal | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || !Array.isArray(raw.entries)) return null
  const entries = []
  for (const e of raw.entries) {
    if (!isRecord(e) || !isId(e.id) || !isId(e.foodId)) return null
    if (typeof e.grams !== 'number' || !Number.isFinite(e.grams) || e.grams < 0) return null
    entries.push({ id: e.id as EntryId, foodId: e.foodId as FoodId, grams: e.grams })
  }
  return { id: raw.id as MealId, name: raw.name, entries }
}

// Version 1 had no goals; a bad goals object costs only the goals, never the plan's meals.
function parseGoals(raw: unknown): Goals {
  if (!isRecord(raw)) return DEFAULT_GOALS
  const goals: Record<keyof Goals, number> = { ...DEFAULT_GOALS }
  for (const { key } of GOALS) {
    const v = raw[key]
    if (typeof v !== 'number') return DEFAULT_GOALS
    goals[key] = v
  }
  return isValidGoals(goals) ? goals : DEFAULT_GOALS
}

function parsePlan(raw: unknown): MealPlan | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || !Array.isArray(raw.meals)) return null
  const meals = []
  for (const m of raw.meals) {
    const meal = parseMeal(m)
    if (!meal) return null
    meals.push(meal)
  }
  return { id: raw.id as PlanId, name: raw.name, goals: parseGoals(raw.goals), meals }
}

/** Reads version 1 (no goals) and the current version; null for anything else. */
export function parseState(raw: unknown): PlanState | null {
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== SCHEMA_VERSION) || !isRecord(raw.state)) return null
  const { plans: rawPlans, selectedId } = raw.state
  if (!Array.isArray(rawPlans) || rawPlans.length === 0) return null
  const plans = []
  for (const p of rawPlans) {
    const plan = parsePlan(p)
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
