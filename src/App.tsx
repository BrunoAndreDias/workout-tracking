import { useEffect, useMemo, useReducer, useState } from 'react'
import { foods as catalogFoods, foodsById as catalogById, searchIndex as catalogIndex, table as catalogTable } from './data/catalog.ts'
import { customFoodsReducer, withCustomEquivalents } from './domain/customFoods.ts'
import { loadCustomFoods, saveCustomFoods } from './domain/customFoodsStorage.ts'
import { planTotals } from './domain/nutrition.ts'
import { loadState, saveState } from './domain/persistence.ts'
import { countEntries, newId, planReducer } from './domain/plans.ts'
import { buildSearchIndex } from './domain/search.ts'
import type { EntryId, Food, FoodId, MealId } from './domain/types.ts'
import { CustomFoodsSection } from './ui/CustomFoodsSection.tsx'
import { DaySummary } from './ui/DaySummary.tsx'
import { Footer } from './ui/Footer.tsx'
import { MealSection } from './ui/MealSection.tsx'
import { NutrientDetail } from './ui/NutrientDetail.tsx'
import { PlanSwitcher } from './ui/PlanSwitcher.tsx'
import { ReplacementPanel } from './ui/ReplacementPanel.tsx'

interface Selection {
  planId: string
  mealId: MealId
  entryId: EntryId
}

export default function App() {
  const [state, dispatch] = useReducer(planReducer, undefined, () => loadState())
  const [customFoods, dispatchFoods] = useReducer(customFoodsReducer, undefined, () => loadCustomFoods())
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])
  useEffect(() => {
    saveCustomFoods(customFoods)
  }, [customFoods])

  const { foodsById, searchIndex, table } = useMemo(
    () => ({
      foodsById: new Map<FoodId, Food>([...catalogById, ...customFoods.map((f) => [f.id, f] as const)]),
      searchIndex: buildSearchIndex([...customFoods, ...catalogFoods]),
      table: withCustomEquivalents(catalogTable, customFoods, catalogById),
    }),
    [customFoods],
  )

  const plan = state.plans.find((p) => p.id === state.selectedId)!
  const totals = planTotals(plan, foodsById)

  const selectedMeal = selection?.planId === plan.id ? plan.meals.find((m) => m.id === selection.mealId) : undefined
  const selectedEntry = selectedMeal?.entries.find((e) => e.id === selection?.entryId)
  const selectedFood = selectedEntry && foodsById.get(selectedEntry.foodId)
  const panelOpen = Boolean(selectedMeal && selectedEntry && selectedFood)

  return (
    <div className={`app ${panelOpen ? 'with-panel' : ''}`}>
      <div className="page">
        <header className="top">
          <h1 className="brand">Plano alimentar</h1>
          <PlanSwitcher state={state} dispatch={dispatch} />
        </header>
        <div className="band">
          <DaySummary totals={totals} planName={plan.name} />
          <div className="cols" aria-hidden="true">
            <span>Alimento</span>
            <span>Porções</span>
            <span>g</span>
            <span>kcal</span>
          </div>
        </div>

        <main className="meals">
          {plan.meals.map((meal, i) => (
            <MealSection
              key={meal.id}
              planId={plan.id}
              meal={meal}
              index={i}
              count={plan.meals.length}
              foods={foodsById}
              searchIndex={searchIndex}
              catalogIndex={catalogIndex}
              table={table}
              selectedEntryId={selectedMeal?.id === meal.id ? (selectedEntry?.id ?? null) : null}
              onSelectEntry={(entryId) => setSelection({ planId: plan.id, mealId: meal.id, entryId })}
              dispatch={dispatch}
              dispatchFoods={dispatchFoods}
            />
          ))}
          <button
            type="button"
            className="add-meal"
            onClick={() => dispatch({ type: 'addMeal', planId: plan.id, mealId: newId<MealId>(), name: `Refeição ${plan.meals.length + 1}` })}
          >
            + Adicionar refeição
          </button>
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

      {panelOpen && selectedMeal && selectedEntry && selectedFood && (
        <>
          <div className="scrim" onClick={() => setSelection(null)} aria-hidden="true" />
          <ReplacementPanel
            key={selectedEntry.id}
            plan={plan}
            mealId={selectedMeal.id}
            entry={selectedEntry}
            food={selectedFood}
            foods={foodsById}
            table={table}
            searchIndex={searchIndex}
            dispatch={dispatch}
            onClose={() => setSelection(null)}
          />
        </>
      )}
    </div>
  )
}
