import { useEffect, useReducer, useState } from 'react'
import { parseIsoDate, toIsoDate } from './domain/dates.ts'
import { equipmentReducer } from './domain/equipment.ts'
import { upsertSamples } from './domain/health.ts'
import { upsertWatchWorkouts } from './domain/watchWorkouts.ts'
import { loadAll, loadStore, saveStore, STORES } from './domain/stores.ts'
import type { IsoDate } from './domain/types.ts'
import { workoutReducer } from './domain/workoutReducer.ts'
import { BackupSection } from './ui/BackupSection.tsx'
import { ThemeToggle } from './ui/ThemeToggle.tsx'
import { SyncLine } from './ui/SyncLine.tsx'
import { WatchView } from './ui/WatchView.tsx'
import { WorkoutView } from './ui/WorkoutView.tsx'
import type { Sync } from './sync.ts'

const VIEWS = [
  { id: 'treino', label: 'Treino' },
  { id: 'relogio', label: 'Relógio' },
] as const

type View = (typeof VIEWS)[number]['id']

/**
 * `#treino/2026-10-06` and `#relogio/2026-10-06` open that view on that date; a bare `#treino` or `#relogio` opens on
 * today and follows it past midnight. Any other hash opens Treino. A malformed date reads as none.
 */
function routeFromHash(): { view: View; date: IsoDate | null } {
  const [id, arg] = window.location.hash.slice(1).split('/')
  const view = VIEWS.find((v) => v.id === id)?.id ?? 'treino'
  return { view, date: view === id && arg ? parseIsoDate(arg) : null }
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
  const [health, setHealth] = useState(stored.health)
  const [watchWorkouts, setWatchWorkouts] = useState(stored.watchWorkouts)
  const [equipment, dispatchEquipment] = useReducer(equipmentReducer, stored.equipment)
  const [{ view, date: routeDate }, setRoute] = useState(routeFromHash)
  const today = useToday()
  const date = routeDate ?? today
  const onDate = (next: IsoDate) => (window.location.hash = `${view}/${next}`)

  useEffect(() => void saveStore(STORES.exercises, workouts.exercises), [workouts.exercises])
  const { plans: workoutPlans, activePlanId } = workouts
  useEffect(() => void saveStore(STORES.workoutPlans, { plans: workoutPlans, activePlanId }), [workoutPlans, activePlanId])
  useEffect(() => void saveStore(STORES.workoutSessions, workouts.sessions), [workouts.sessions])
  useEffect(() => void saveStore(STORES.health, health), [health])
  useEffect(() => void saveStore(STORES.watchWorkouts, watchWorkouts), [watchWorkouts])
  useEffect(() => void saveStore(STORES.equipment, equipment), [equipment])
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
    // popstate fires with the navigation itself and hashchange only after the next frame, so whichever comes first routes.
    const onNavigate = () => {
      const next = routeFromHash()
      setRoute((route) => (route.view === next.view && route.date === next.date ? route : next))
    }
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
        </header>

        <main className="main">
          {view === 'treino' && (
            <WorkoutView state={workouts} dispatch={dispatchWorkouts} date={date} today={today} onDate={onDate} watch={watchWorkouts} equipment={equipment} dispatchEquipment={dispatchEquipment} />
          )}
          {view === 'relogio' && (
            <WatchView
              date={date}
              today={today}
              onDate={onDate}
              health={health}
              onImport={(samples) => setHealth((log) => upsertSamples(log, samples))}
              watchWorkouts={watchWorkouts}
              onImportWorkouts={(workouts) => setWatchWorkouts((log) => upsertWatchWorkouts(log, workouts))}
            />
          )}
        </main>
        <BackupSection />
      </div>
    </div>
  )
}
