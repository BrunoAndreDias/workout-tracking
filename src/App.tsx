import { useEffect, useMemo, useReducer, useState } from 'react'
import { foods as catalogFoods, foodsById as catalogById, searchIndex as catalogIndex, table as catalogTable } from './data/catalog.ts'
import { SEED_UNITS } from './data/units.ts'
import { customFoodsReducer, resolveCustomFoods, withCustomEquivalents } from './domain/customFoods.ts'
import type { CustomFoodsAction } from './domain/customFoods.ts'
import { loadCustomFoods, saveCustomFoods } from './domain/customFoodsStorage.ts'
import { countEntries, foodsByUse } from './domain/meals.ts'
import type { MealsAction } from './domain/meals.ts'
import { dayTotals } from './domain/nutrition.ts'
import { loadState, saveState } from './domain/persistence.ts'
import { newId, planReducer } from './domain/plans.ts'
import { buildSearchIndex } from './domain/search.ts'
import type { EntryId, Food, FoodId, MealId, MealPlan, PlanId } from './domain/types.ts'
import { unitsReducer } from './domain/units.ts'
import type { FoodUnit, UnitsAction } from './domain/units.ts'
import { loadUnits, saveUnits } from './domain/unitsStorage.ts'
import { CustomFoodsSection } from './ui/CustomFoodsSection.tsx'
import { DaySummary } from './ui/DaySummary.tsx'
import { FoodPanel } from './ui/FoodPanel.tsx'
import type { Swap } from './ui/FoodPanel.tsx'
import { Footer } from './ui/Footer.tsx'
import { GoalsPanel } from './ui/GoalsPanel.tsx'
import { MealSection } from './ui/MealSection.tsx'
import { NutrientDetail } from './ui/NutrientDetail.tsx'
import { PlanSwitcher } from './ui/PlanSwitcher.tsx'
import { ThemeToggle } from './ui/ThemeToggle.tsx'
import { UnitsContext } from './ui/unitsContext.ts'

type PanelTarget =
  | { mode: 'add'; planId: PlanId; mealId: MealId }
  | { mode: 'swap'; planId: PlanId; mealId: MealId; entryId: EntryId }
  | { mode: 'goals'; planId: PlanId }

/** Resolves a food panel target against the current plan; null once its meal or entry is gone. */
function resolveFoodTarget(target: PanelTarget, plan: MealPlan, foods: ReadonlyMap<FoodId, Food>) {
  if (target.mode === 'goals' || target.planId !== plan.id) return null
  const meal = plan.meals.find((m) => m.id === target.mealId)
  if (!meal) return null
  if (target.mode === 'add') return { meal, swap: null }
  const entry = meal.entries.find((e) => e.id === target.entryId)
  const food = entry && foods.get(entry.foodId)
  return entry && food ? { meal, swap: { entry, food } satisfies Swap } : null
}

const userUnitsReducer = (state: readonly FoodUnit[], action: UnitsAction) => unitsReducer(state, action, SEED_UNITS)

export default function App() {
  const [state, dispatch] = useReducer(planReducer, undefined, () => loadState())
  const [customDefs, dispatchCustomFoods] = useReducer(customFoodsReducer, undefined, () => loadCustomFoods())
  const [userUnits, dispatchUnits] = useReducer(userUnitsReducer, undefined, () => loadUnits())
  const [panel, setPanel] = useState<PanelTarget | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])
  useEffect(() => {
    saveCustomFoods(customDefs)
  }, [customDefs])
  useEffect(() => {
    saveUnits(userUnits)
  }, [userUnits])
  const units = useMemo(() => ({ user: userUnits, dispatch: dispatchUnits }), [userUnits])

  const dispatchFoods = (action: CustomFoodsAction) => {
    dispatchCustomFoods(action)
    if (action.type === 'deleteFood') dispatchUnits({ type: 'deleteFood', foodId: action.id })
  }

  const { customFoods, foodsById, allFoods, searchIndex, ingredientIndex, table } = useMemo(() => {
    const customFoods = resolveCustomFoods(customDefs, catalogById)
    const allFoods = [...customFoods, ...catalogFoods]
    return {
      customFoods,
      foodsById: new Map<FoodId, Food>([...catalogById, ...customFoods.map((f) => [f.id, f] as const)]),
      allFoods,
      searchIndex: buildSearchIndex(allFoods),
      ingredientIndex: buildSearchIndex([...customFoods.filter((f) => !f.recipe), ...catalogFoods]),
      table: withCustomEquivalents(catalogTable, customFoods, catalogById),
    }
  }, [customDefs])

  const allMeals = state.plans.flatMap((p) => p.meals)
  const plan = state.plans.find((p) => p.id === state.selectedId)!
  const totals = dayTotals(plan.meals, foodsById)
  const editMeals = (edit: MealsAction) => dispatch({ type: 'editMeals', planId: plan.id, edit })
  const foodTarget = panel && resolveFoodTarget(panel, plan, foodsById)
  const close = () => setPanel(null)

  return (
    <UnitsContext value={units}>
      <div className="app">
        <div className="page">
          <header className="top">
            <div className="top-row">
              <div className="eyebrow">Plano alimentar</div>
              <ThemeToggle />
            </div>
            <PlanSwitcher state={state} dispatch={dispatch} />
          </header>

          <main className="main">
            <DaySummary
              plan={plan}
              totals={totals}
              foods={foodsById}
              onRename={(name) => dispatch({ type: 'renamePlan', planId: plan.id, name })}
              onEditGoals={() => setPanel({ mode: 'goals', planId: plan.id })}
            />

            <div className="meals">
              {plan.meals.map((meal, i) => (
                <MealSection
                  key={meal.id}
                  meal={meal}
                  index={i}
                  count={plan.meals.length}
                  dayKcal={totals.amounts.energyKcal}
                  foods={foodsById}
                  table={table}
                  onAdd={() => setPanel({ mode: 'add', planId: plan.id, mealId: meal.id })}
                  onSwap={(entryId) => setPanel({ mode: 'swap', planId: plan.id, mealId: meal.id, entryId })}
                  editMeals={editMeals}
                />
              ))}
              <button
                type="button"
                className="add-meal"
                onClick={() => editMeals({ type: 'addMeal', mealId: newId<MealId>(), name: `Refeição ${plan.meals.length + 1}` })}
              >
                + Adicionar refeição
              </button>
            </div>

            <NutrientDetail totals={totals} />
            <CustomFoodsSection
              customFoods={customFoods}
              catalogIndex={catalogIndex}
              ingredientIndex={ingredientIndex}
              foods={foodsById}
              baseName={(id) => catalogById.get(id)?.name}
              usage={(id) => countEntries(allMeals, id)}
              dispatchFoods={dispatchFoods}
            />
          </main>
          <Footer />
        </div>

        {panel?.mode === 'goals' && panel.planId === plan.id && (
          <GoalsPanel
            key={plan.id}
            eyebrow={plan.name}
            goals={plan.goals}
            totals={totals}
            onSave={(goals) => dispatch({ type: 'setGoals', planId: plan.id, goals })}
            onClose={close}
          />
        )}
        {foodTarget && (
          <FoodPanel
            key={panel?.mode === 'swap' ? panel.entryId : foodTarget.meal.id}
            meals={plan.meals}
            goals={plan.goals}
            meal={foodTarget.meal}
            swap={foodTarget.swap}
            usedFoods={foodsByUse(allMeals)}
            foods={foodsById}
            allFoods={allFoods}
            searchIndex={searchIndex}
            catalogIndex={catalogIndex}
            ingredientIndex={ingredientIndex}
            table={table}
            editMeals={editMeals}
            dispatchFoods={dispatchFoods}
            onClose={close}
          />
        )}
      </div>
    </UnitsContext>
  )
}
