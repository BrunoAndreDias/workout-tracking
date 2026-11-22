import { addDays } from './dates.ts'
import { suggestTarget } from './progression.ts'
import type { Suggestion } from './progression.ts'
import type { ExerciseId, IsoDate, WorkoutSessionId } from './types.ts'
import { roleRir, withLight } from './splits.ts'
import { aimedAt, EMPTY_SET, isDone } from './workouts.ts'
import type { DoneSet, PendingSet, RepRange, RirTarget, SessionExercise, WorkoutDay, WorkoutSession } from './workouts.ts'

/**
 * The done sets of `exerciseId` in the latest session on or before `date` that has any, on the same date the one
 * logged last, with the RIR they aimed at when the session knew it. Null when none.
 */
export function lastDoneSets(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate): { sets: DoneSet[]; aimed: RirTarget | null } | null {
  let found: { sets: DoneSet[]; aimed: RirTarget | null } | null = null
  let foundDate: IsoDate | null = null
  for (const session of sessions) {
    if (session.date > date || (foundDate !== null && session.date < foundDate)) continue
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId)
    const sets = exercise?.sets.filter(isDone) ?? []
    if (sets.length === 0) continue
    found = { sets, aimed: exercise?.target ? aimedAt(exercise.target) : null }
    foundDate = session.date
  }
  return found
}

/** The sessions logged before `session`: earlier dates, and on its date the ones logged before it. */
export function sessionsBefore(sessions: readonly WorkoutSession[], session: WorkoutSession): WorkoutSession[] {
  const index = sessions.indexOf(session)
  return sessions.filter((s, i) => s.date < session.date || (s.date === session.date && i < index))
}

export function suggestion(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate, next: RirTarget, range: RepRange): Suggestion | null {
  const last = lastDoneSets(sessions, exerciseId, date)
  return last && suggestTarget({ sets: last.sets, previous: last.aimed ?? withLight(next, false), next, range })
}

export function startSession(id: WorkoutSessionId, date: IsoDate, day: WorkoutDay | null, light: boolean, sessions: readonly WorkoutSession[]): WorkoutSession {
  const exercises = (day?.exercises ?? []).map((p): SessionExercise => {
    const rir = roleRir(p.role, light)
    const s = suggestion(sessions, p.exerciseId, date, rir, p.reps)
    if (!s) return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(EMPTY_SET) }
    const set: PendingSet = { done: false, kg: s.kg, reps: s.reps, rir: null }
    return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(set), target: { kg: s.kg, reps: s.reps, rir: rir.min, ...(rir.max > rir.min && { rirMax: rir.max }), ...(rir.light && { light: true }) } }
  })
  return { id, date, workoutDayId: day?.id ?? null, exercises }
}

export const sessionsOn = (sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] => sessions.filter((s) => s.date === date)

/** An injury can show a day or two late, so a session stays open to After-effects for this many days after it. */
export const AFTER_EFFECT_DAYS = 3

/** The sessions 1 to AFTER_EFFECT_DAYS days before `date`, newest first. */
export function recentSessions(sessions: readonly WorkoutSession[], date: IsoDate): WorkoutSession[] {
  const from = addDays(date, -AFTER_EFFECT_DAYS)
  return sessions.filter((s) => s.date >= from && s.date < date).sort((a, b) => b.date.localeCompare(a.date))
}
