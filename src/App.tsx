import { useEffect, useMemo, useReducer, useState } from 'react'
import { foods as catalogFoods, foodsById as catalogById, searchIndex as catalogIndex, table as catalogTable } from './data/catalog.ts'
import { customFoodsReducer, withCustomEquivalents } from './domain/customFoods.ts'
import { loadCustomFoods, saveCustomFoods } from './domain/customFoodsStorage.ts'
import { planTotals } from './domain/nutrition.ts'
import { loadState, saveState } from './domain/persistence.ts'
import { countEntries, newId, planReducer } from './domain/plans.ts'
import { buildSearchIndex } from './domain/search.ts'
import type { EntryId, Food, FoodId, MealId, MealPlan, PlanId } from './domain/types.ts'
import { CustomFoodsSection } from './ui/CustomFoodsSection.tsx'
import { DaySummary } from './ui/DaySummary.tsx'
import { FoodPanel } from './ui/FoodPanel.tsx'
import type { Swap } from './ui/FoodPanel.tsx'
import { Footer } from './ui/Footer.tsx'
import { GoalsPanel } from './ui/GoalsPanel.tsx'
import { MealSection } from './ui/MealSection.tsx'
import { NutrientDetail } from './ui/NutrientDetail.tsx'
import { PlanSwitcher } from './ui/PlanSwitcher.tsx'

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

export default function App() {
  const [state, dispatch] = useReducer(planReducer, undefined, () => loadState())
  const [customFoods, dispatchFoods] = useReducer(customFoodsReducer, undefined, () => loadCustomFoods())
  const [panel, setPanel] = useState<PanelTarget | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])
  useEffect(() => {
    saveCustomFoods(customFoods)
  }, [customFoods])

  const { foodsById, allFoods, searchIndex, table } = useMemo(() => {
    const allFoods = [...customFoods, ...catalogFoods]
    return {
      foodsById: new Map<FoodId, Food>([...catalogById, ...customFoods.map((f) => [f.id, f] as const)]),
      allFoods,
      searchIndex: buildSearchIndex(allFoods),
      table: withCustomEquivalents(catalogTable, customFoods, catalogById),
    }
  }, [customFoods])

  const plan = state.plans.find((p) => p.id === state.selectedId)!
  const totals = planTotals(plan, foodsById)
  const foodTarget = panel && resolveFoodTarget(panel, plan, foodsById)
  const close = () => setPanel(null)

  return (
    <div className="app">
      <div className="page">
        <header className="top">
          <div className="eyebrow">Plano alimentar</div>
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
                planId={plan.id}
                meal={meal}
                index={i}
                count={plan.meals.length}
                dayKcal={totals.amounts.energyKcal}
                foods={foodsById}
                table={table}
                onAdd={() => setPanel({ mode: 'add', planId: plan.id, mealId: meal.id })}
                onSwap={(entryId) => setPanel({ mode: 'swap', planId: plan.id, mealId: meal.id, entryId })}
                dispatch={dispatch}
              />
            ))}
            <button
              type="button"
              className="add-meal"
              onClick={() => dispatch({ type: 'addMeal', planId: plan.id, mealId: newId<MealId>(), name: `Refeição ${plan.meals.length + 1}` })}
            >
              + Adicionar refeição
            </button>
          </div>

          <NutrientDetail totals={totals} />
          <CustomFoodsSection
            customFoods={customFoods}
            catalogIndex={catalogIndex}
            baseName={(id) => catalogById.get(id)?.name}
            usage={(id) => countEntries(state.plans, id)}
            dispatchFoods={dispatchFoods}
          />
        </main>
        <Footer />
      </div>

      {panel?.mode === 'goals' && panel.planId === plan.id && <GoalsPanel key={plan.id} plan={plan} dispatch={dispatch} onClose={close} />}
      {foodTarget && (
        <FoodPanel
          key={panel?.mode === 'swap' ? panel.entryId : foodTarget.meal.id}
          plan={plan}
          meal={foodTarget.meal}
          swap={foodTarget.swap}
          plans={state.plans}
          foods={foodsById}
          allFoods={allFoods}
          searchIndex={searchIndex}
          catalogIndex={catalogIndex}
          table={table}
          dispatch={dispatch}
          dispatchFoods={dispatchFoods}
          onClose={close}
        />
      )}
    </div>
  )
}
