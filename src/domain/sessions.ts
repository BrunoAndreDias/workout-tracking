import { addDays } from './dates.ts'
import { suggestTarget } from './progression.ts'
import type { Suggestion } from './progression.ts'
import type { ExerciseId, IsoDate, WorkoutSessionId } from './types.ts'
import { EMPTY_SET, isDone, LOAD_INCREMENT } from './workouts.ts'
import type { DoneSet, PendingSet, RepRange, RirTarget, Role, SessionExercise, WorkoutDay, WorkoutSession } from './workouts.ts'

/**
 * The done sets of `exerciseId` in the latest session on or before `date` that has any, on the same date the one
 * logged last, with the RIR they aimed at when the session knew it. Null when none.
 */
export function lastDoneSets(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate): { sets: DoneSet[]; targetRir: number | null } | null {
  let found: { sets: DoneSet[]; targetRir: number | null } | null = null
  let foundDate: IsoDate | null = null
  for (const session of sessions) {
    if (session.date > date || (foundDate !== null && session.date < foundDate)) continue
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId)
    const sets = exercise?.sets.filter(isDone) ?? []
    if (sets.length === 0) continue
    found = { sets, targetRir: exercise?.target?.rir ?? null }
    foundDate = session.date
  }
  return found
}

/** The sessions logged before `session`: earlier dates, and on its date the ones logged before it. */
export function sessionsBefore(sessions: readonly WorkoutSession[], session: WorkoutSession): WorkoutSession[] {
  const index = sessions.indexOf(session)
  return sessions.filter((s, i) => s.date < session.date || (s.date === session.date && i < index))
}

/** How close to failure a role goes in a week: the week's lowest RIR, never under 1 for compounds; 2 when the week has none. */
export function targetRir(role: Role, week: RirTarget | null): number {
  if (!week) return 2
  return role === 'main' || role === 'secondary' ? Math.max(1, week.min) : week.min
}

/** The suggested target for `exerciseId` on `date`, from the last time it was done; null when it never was. */
export function suggestion(sessions: readonly WorkoutSession[], exerciseId: ExerciseId, date: IsoDate, nextRir: number, range: RepRange): Suggestion | null {
  const last = lastDoneSets(sessions, exerciseId, date)
  return last && suggestTarget({ sets: last.sets, previousRir: last.targetRir ?? nextRir, nextRir, range, increment: LOAD_INCREMENT })
}

/**
 * A session from a Workout Day has one row per Planned Exercise, each set pending at the suggested target, which is
 * kept; an Exercise never done starts with empty sets. `week` is the RIR target of the week the date falls in.
 */
export function startSession(id: WorkoutSessionId, date: IsoDate, day: WorkoutDay | null, week: RirTarget | null, sessions: readonly WorkoutSession[]): WorkoutSession {
  const exercises = (day?.exercises ?? []).map((p): SessionExercise => {
    const rir = targetRir(p.role, week)
    const s = suggestion(sessions, p.exerciseId, date, rir, p.reps)
    if (!s) return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(EMPTY_SET) }
    const set: PendingSet = { done: false, kg: s.kg, reps: s.reps, rir: null }
    return { exerciseId: p.exerciseId, sets: Array(p.sets).fill(set), target: { kg: s.kg, reps: s.reps, rir } }
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
