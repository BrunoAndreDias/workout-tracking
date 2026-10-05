import { useEffect, useMemo, useReducer, useState } from 'react'
import { foods as catalogFoods, foodsById as catalogById, searchIndex as catalogIndex, table as catalogTable } from './data/catalog.ts'
import { SEED_UNITS } from './data/units.ts'
import { customFoodsReducer, resolveCustomFoods, withCustomEquivalents } from './domain/customFoods.ts'
import type { CustomFoodsAction } from './domain/customFoods.ts'
import { loadCustomFoods, saveCustomFoods } from './domain/customFoodsStorage.ts'
import { dayReducer, toIsoDate } from './domain/days.ts'
import { loadDays, saveDays } from './domain/daysStorage.ts'
import { countEntries, foodsByUse } from './domain/meals.ts'
import { loadState, saveState } from './domain/persistence.ts'
import { planReducer } from './domain/plans.ts'
import { buildSearchIndex } from './domain/search.ts'
import type { Food, FoodId, IsoDate } from './domain/types.ts'
import { unitsReducer } from './domain/units.ts'
import type { FoodUnit, UnitsAction } from './domain/units.ts'
import { loadUnits, saveUnits } from './domain/unitsStorage.ts'
import { CustomFoodsSection } from './ui/CustomFoodsSection.tsx'
import { DayEditor } from './ui/DayEditor.tsx'
import { DayLogView } from './ui/DayLogView.tsx'
import type { FoodKit } from './ui/DayEditor.tsx'
import { Footer } from './ui/Footer.tsx'
import { HistoryView } from './ui/HistoryView.tsx'
import { InlineName } from './ui/InlineName.tsx'
import { ThemeToggle } from './ui/ThemeToggle.tsx'
import { PlanSwitcher } from './ui/PlanSwitcher.tsx'
import { UnitsContext } from './ui/unitsContext.ts'

const VIEWS = [
  { id: 'planos', label: 'Planos' },
  { id: 'diario', label: 'Diário' },
  { id: 'historico', label: 'Histórico' },
] as const

type View = (typeof VIEWS)[number]['id']

const viewFromHash = (): View => VIEWS.find((v) => `#${v.id}` === window.location.hash)?.id ?? 'planos'

/** The local date, kept current past midnight and when the tab comes back after sleeping. */
function useToday(): IsoDate {
  const [today, setToday] = useState(() => toIsoDate(new Date()))
  useEffect(() => {
    let timer = 0
    const refresh = () => {
      const now = new Date()
      setToday(toIsoDate(now))
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime())
    }
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    timer = window.setTimeout(refresh, 0)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return today
}

const userUnitsReducer = (state: readonly FoodUnit[], action: UnitsAction) => unitsReducer(state, action, SEED_UNITS)

export default function App() {
  const [state, dispatch] = useReducer(planReducer, undefined, () => loadState())
  const [dayState, dispatchDays] = useReducer(dayReducer, undefined, () => loadDays())
  const [customDefs, dispatchCustomFoods] = useReducer(customFoodsReducer, undefined, () => loadCustomFoods())
  const [userUnits, dispatchUnits] = useReducer(userUnitsReducer, undefined, () => loadUnits())
  const [view, setView] = useState(viewFromHash)
  const today = useToday()

  useEffect(() => {
    saveState(state)
  }, [state])
  useEffect(() => {
    saveDays(dayState)
  }, [dayState])
  useEffect(() => {
    saveCustomFoods(customDefs)
  }, [customDefs])
  useEffect(() => {
    saveUnits(userUnits)
  }, [userUnits])
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
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

  const allMeals = useMemo(
    () => [...state.plans.flatMap((p) => p.meals), ...Object.values(dayState.days).flatMap((d) => d.meals)],
    [state.plans, dayState.days],
  )
  const kit: FoodKit = {
    foods: foodsById,
    allFoods,
    searchIndex,
    catalogIndex,
    ingredientIndex,
    table,
    usedFoods: foodsByUse(allMeals),
    dispatchFoods,
  }
  const plan = state.plans.find((p) => p.id === state.selectedId)!

  return (
    <UnitsContext value={units}>
      <div className="app">
        <div className="page">
          <header className="top">
            <div className="top-row">
              <div className="eyebrow">Plano alimentar</div>
              <nav className="views" aria-label="Secções">
                {VIEWS.map((v) => (
                  <a key={v.id} href={`#${v.id}`} className="view-link" aria-current={v.id === view ? 'page' : undefined}>
                    {v.label}
                  </a>
                ))}
              </nav>
              <ThemeToggle />
            </div>
            {view === 'planos' && <PlanSwitcher state={state} dispatch={dispatch} />}
          </header>

          <main className="main">
            {view === 'planos' && (
              <>
                <DayEditor
                  key={plan.id}
                  title={<InlineName name={plan.name} label="Nome do plano" onRename={(name) => dispatch({ type: 'renamePlan', planId: plan.id, name })} />}
                  eyebrow={plan.name}
                  meals={plan.meals}
                  goals={plan.goals}
                  notes={{ value: plan.notes, onChange: (notes) => dispatch({ type: 'setPlanNotes', planId: plan.id, notes }) }}
                  kit={kit}
                  editMeals={(edit) => dispatch({ type: 'editMeals', planId: plan.id, edit })}
                  onSaveGoals={(goals) => dispatch({ type: 'setGoals', planId: plan.id, goals })}
                />
                <CustomFoodsSection
                  customFoods={customFoods}
                  catalogIndex={catalogIndex}
                  ingredientIndex={ingredientIndex}
                  foods={foodsById}
                  baseName={(id) => catalogById.get(id)?.name}
                  usage={(id) => countEntries(allMeals, id)}
                  dispatchFoods={dispatchFoods}
                />
              </>
            )}
            {view === 'diario' && <DayLogView state={dayState} dispatch={dispatchDays} plans={state.plans} kit={kit} today={today} />}
            {view === 'historico' && <HistoryView days={dayState.days} foods={foodsById} today={today} />}
          </main>
          <Footer />
        </div>
      </div>
    </UnitsContext>
  )
}
