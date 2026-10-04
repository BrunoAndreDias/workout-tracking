import { useEffect, useReducer, useState } from 'react'
import { foodsById, searchIndex, table } from './data/catalog.ts'
import { planTotals } from './domain/nutrition.ts'
import { loadState, saveState } from './domain/persistence.ts'
import { newId, planReducer } from './domain/plans.ts'
import type { EntryId, MealId } from './domain/types.ts'
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
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

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
              table={table}
              selectedEntryId={selectedMeal?.id === meal.id ? (selectedEntry?.id ?? null) : null}
              onSelectEntry={(entryId) => setSelection({ planId: plan.id, mealId: meal.id, entryId })}
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
          <NutrientDetail totals={totals} />
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
