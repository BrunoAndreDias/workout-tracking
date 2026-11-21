import { useEffect, useReducer, useState } from 'react'
import { parseIsoDate, toIsoDate } from './domain/dates.ts'
import { equipmentReducer } from './domain/equipment.ts'
import { loadAll, saveStore, STORES } from './domain/stores.ts'
import type { IsoDate } from './domain/types.ts'
import { workoutReducer } from './domain/workoutReducer.ts'
import { BackupSection } from './ui/BackupSection.tsx'
import { SyncLine } from './ui/SyncLine.tsx'
import { WorkoutView } from './ui/WorkoutView.tsx'
import type { Sync } from './sync.ts'

/**
 * `#treino/2026-10-06` opens Treino on that date; any other hash opens on today and follows it past midnight. A
 * malformed date reads as none.
 */
function dateFromHash(): IsoDate | null {
  const [id, arg] = window.location.hash.slice(1).split('/')
  return id === 'treino' && arg ? parseIsoDate(arg) : null
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

/** `sync` is null only when the browser blocks localStorage. */
export default function App({ sync }: { sync: Sync | null }) {
  const [stored] = useState(() => loadAll())
  const [workouts, dispatchWorkouts] = useReducer(workoutReducer, { exercises: stored.exercises, ...stored.workoutPlans, sessions: stored.workoutSessions })
  const [equipment, dispatchEquipment] = useReducer(equipmentReducer, stored.equipment)
  const [routeDate, setRouteDate] = useState(dateFromHash)
  const today = useToday()
  const date = routeDate ?? today
  const onDate = (next: IsoDate) => (window.location.hash = `treino/${next}`)

  useEffect(() => void saveStore(STORES.exercises, workouts.exercises), [workouts.exercises])
  const { plans: workoutPlans, activePlanId } = workouts
  useEffect(() => void saveStore(STORES.workoutPlans, { plans: workoutPlans, activePlanId }), [workoutPlans, activePlanId])
  useEffect(() => void saveStore(STORES.workoutSessions, workouts.sessions), [workouts.sessions])
  useEffect(() => void saveStore(STORES.equipment, equipment), [equipment])
  useEffect(() => {
    // popstate fires with the navigation itself and hashchange only after the next frame, so whichever comes first routes.
    const onNavigate = () => setRouteDate(dateFromHash())
    window.addEventListener('popstate', onNavigate)
    window.addEventListener('hashchange', onNavigate)
    return () => {
      window.removeEventListener('popstate', onNavigate)
      window.removeEventListener('hashchange', onNavigate)
    }
  }, [])

  return (
    <div className="app">
      <div className="page">
        {sync && <SyncLine sync={sync} />}

        <main className="main">
          <WorkoutView state={workouts} dispatch={dispatchWorkouts} date={date} today={today} onDate={onDate} equipment={equipment} dispatchEquipment={dispatchEquipment} />
        </main>
        <BackupSection />
      </div>
    </div>
  )
}
