import { useEffect, useMemo, useReducer, useState } from 'react'
import { foods as catalogFoods, foodsById as catalogById, searchIndex as catalogIndex, table as catalogTable } from './data/catalog.ts'
import { SEED_UNITS } from './data/units.ts'
import { bodyReducer } from './domain/body.ts'
import { customFoodsReducer, resolveCustomFoods, withCustomEquivalents } from './domain/customFoods.ts'
import type { CustomFoodsAction } from './domain/customFoods.ts'
import { dayReducer, parseIsoDate, toIsoDate } from './domain/days.ts'
import { upsertSamples } from './domain/health.ts'
import { countEntries, foodsByUse } from './domain/meals.ts'
import { planReducer } from './domain/plans.ts'
import { buildSearchIndex } from './domain/search.ts'
import { loadAll, loadStore, saveStore, STORES } from './domain/stores.ts'
import type { Food, FoodId, IsoDate } from './domain/types.ts'
import { unitsReducer } from './domain/units.ts'
import type { FoodUnit, UnitsAction } from './domain/units.ts'
import { workoutReducer } from './domain/workouts.ts'
import { BackupSection } from './ui/BackupSection.tsx'
import { CustomFoodsSection } from './ui/CustomFoodsSection.tsx'
import { DayEditor } from './ui/DayEditor.tsx'
import { DayLog } from './ui/DayLog.tsx'
import { DayLogView } from './ui/DayLogView.tsx'
import type { FoodKit } from './ui/DayEditor.tsx'
import { Footer } from './ui/Footer.tsx'
import { HealthImport } from './ui/HealthImport.tsx'
import { HistoryView } from './ui/HistoryView.tsx'
import { InlineName } from './ui/InlineName.tsx'
import { ThemeToggle } from './ui/ThemeToggle.tsx'
import { PlanSwitcher } from './ui/PlanSwitcher.tsx'
import { SyncLine } from './ui/SyncLine.tsx'
import { WorkoutView } from './ui/WorkoutView.tsx'
import { UnitsContext } from './ui/unitsContext.ts'
import type { Sync } from './sync.ts'

const VIEWS = [
  { id: 'diario', label: 'Diário' },
  { id: 'historico', label: 'Histórico' },
  { id: 'treino', label: 'Treino' },
  { id: 'alimentacao', label: 'Alimentação' },
] as const

type View = (typeof VIEWS)[number]['id']

const FOOD_TABS = [
  { id: 'planos', label: 'Planos', hash: 'alimentacao' },
  { id: 'hoje', label: 'Hoje', hash: 'alimentacao/hoje' },
] as const

type FoodTab = (typeof FOOD_TABS)[number]['id']

/**
 * `#treino/2026-10-06` opens the Treino view on that date; a bare `#treino` opens it on today.
 * `#alimentacao/hoje` opens Alimentação on today's intake; `#alimentacao` and any other argument open the plans.
 */
function routeFromHash(): { view: View; date: IsoDate | null; foodTab: FoodTab } {
  const [id, arg] = window.location.hash.slice(1).split('/')
  const view = VIEWS.find((v) => v.id === id)?.id ?? 'diario'
  return { view, date: view === 'treino' && arg ? parseIsoDate(arg) : null, foodTab: view === 'alimentacao' && arg === 'hoje' ? 'hoje' : 'planos' }
}

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

/** `sync` is null only when the browser blocks localStorage. */
export default function App({ sync }: { sync: Sync | null }) {
  const [stored] = useState(() => loadAll())
  const [state, dispatch] = useReducer(planReducer, stored.plans)
  const [dayState, dispatchDays] = useReducer(dayReducer, stored.days)
  const [customDefs, dispatchCustomFoods] = useReducer(customFoodsReducer, stored.foods)
  const [userUnits, dispatchUnits] = useReducer(userUnitsReducer, stored.units)
  const [workouts, dispatchWorkouts] = useReducer(workoutReducer, { exercises: stored.exercises, ...stored.workoutPlans, sessions: stored.workoutSessions })
  const [body, dispatchBody] = useReducer(bodyReducer, { sleep: stored.sleep, moods: stored.moods })
  const [health, setHealth] = useState(stored.health)
  const [{ view, date: routeDate, foodTab }, setRoute] = useState(routeFromHash)
  const today = useToday()

  useEffect(() => void saveStore(STORES.plans, state), [state])
  useEffect(() => void saveStore(STORES.days, dayState), [dayState])
  useEffect(() => void saveStore(STORES.foods, customDefs), [customDefs])
  useEffect(() => void saveStore(STORES.units, userUnits), [userUnits])
  useEffect(() => void saveStore(STORES.exercises, workouts.exercises), [workouts.exercises])
  const { plans: workoutPlans, activePlanId } = workouts
  useEffect(() => void saveStore(STORES.workoutPlans, { plans: workoutPlans, activePlanId }), [workoutPlans, activePlanId])
  useEffect(() => void saveStore(STORES.workoutSessions, workouts.sessions), [workouts.sessions])
  useEffect(() => void saveStore(STORES.sleep, body.sleep), [body.sleep])
  useEffect(() => void saveStore(STORES.moods, body.moods), [body.moods])
  useEffect(() => void saveStore(STORES.health, health), [health])
  // The iPhone posts watch values straight to the server, so an open tab looks for them each time it comes back.
  useEffect(() => {
    if (!sync) return
    const pull = () => void sync.refresh([STORES.health.key]).then((changed) => changed.length > 0 && setHealth(loadStore(STORES.health)))
    const onVisible = () => document.visibilityState === 'visible' && pull()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', pull)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', pull)
    }
  }, [sync])
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
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
    usedFoods: () => foodsByUse(allMeals),
    dispatchFoods,
  }
  const plan = state.plans.find((p) => p.id === state.selectedId)!

  return (
    <UnitsContext value={units}>
      <div className="app">
        <div className="page">
          <header className="top">
            <div className="top-row">
              <nav className="views" aria-label="Secções">
                {VIEWS.map((v) => (
                  <a key={v.id} href={`#${v.id}`} className="view-link" aria-current={v.id === view ? 'page' : undefined}>
                    {v.label}
                  </a>
                ))}
              </nav>
              <ThemeToggle />
            </div>
            {sync && <SyncLine sync={sync} />}
            {view === 'alimentacao' && (
              <nav className="tabs" aria-label="Alimentação">
                {FOOD_TABS.map((t) => (
                  <a key={t.id} href={`#${t.hash}`} className="tab" aria-current={t.id === foodTab ? 'page' : undefined}>
                    {t.label}
                  </a>
                ))}
              </nav>
            )}
            {view === 'alimentacao' && foodTab === 'planos' && <PlanSwitcher state={state} dispatch={dispatch} />}
          </header>

          <main className="main">
            {view === 'alimentacao' && foodTab === 'hoje' && <DayLog date={today} today={today} state={dayState} dispatch={dispatchDays} plans={state.plans} kit={kit} workouts={workouts} />}
            {view === 'alimentacao' && foodTab === 'planos' && (
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
            {view === 'diario' && <DayLogView state={dayState} dispatch={dispatchDays} plans={state.plans} kit={kit} today={today} workouts={workouts} body={body} dispatchBody={dispatchBody} health={health} />}
            {view === 'historico' && <HistoryView days={dayState.days} foods={foodsById} today={today} />}
            {view === 'treino' && (
              <WorkoutView state={workouts} dispatch={dispatchWorkouts} date={routeDate ?? today} today={today} onDate={(date) => (window.location.hash = `treino/${date}`)} />
            )}
          </main>
          <BackupSection>
            <HealthImport log={health} onImport={(samples) => setHealth((log) => upsertSamples(log, samples))} />
          </BackupSection>
          <Footer />
        </div>
      </div>
    </UnitsContext>
  )
}
