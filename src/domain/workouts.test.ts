import { describe, expect, it } from 'vitest'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { emptyWorkouts, loggedCounts, parseRepRange, prefillSets, startSession, workoutReducer } from './workouts.ts'
import type { WorkoutAction, WorkoutDay, WorkoutSession, WorkoutState } from './workouts.ts'

const SUPINO = 'ex-supino' as ExerciseId
const REMO = 'ex-remo' as ExerciseId
const date = (s: string) => s as IsoDate

const session = (id: string, on: string, exercises: WorkoutSession['exercises']): WorkoutSession => ({
  id: id as WorkoutSessionId,
  date: date(on),
  workoutDayId: null,
  exercises,
})

const PEITO: WorkoutDay = {
  id: 'd-peito' as WorkoutDayId,
  name: 'Peito',
  exercises: [
    { exerciseId: SUPINO, sets: 4, reps: { min: 6, max: 8 } },
    { exerciseId: REMO, sets: 2, reps: { min: 10, max: 10 } },
  ],
}

const HISTORY = [
  session('s1', '2026-10-01', [{ exerciseId: SUPINO, sets: [{ reps: 8, kg: 60 }, { reps: 7, kg: 60 }] }]),
  session('s2', '2026-10-03', [{ exerciseId: SUPINO, sets: [{ reps: 8, kg: 62.5 }, { reps: 6, kg: 62.5 }, { reps: null, kg: null }] }]),
  session('s3', '2026-10-05', [{ exerciseId: SUPINO, sets: [{ reps: null, kg: 65 }] }]),
  session('s4', '2026-10-09', [{ exerciseId: SUPINO, sets: [{ reps: 10, kg: 70 }] }]),
]

const run = (actions: WorkoutAction[], from: WorkoutState = emptyWorkouts()) => actions.reduce(workoutReducer, from)

describe('pre-fill', () => {
  it('copies the latest earlier session that logged the exercise, repeating its last set for extra planned sets', () => {
    expect(prefillSets(HISTORY, SUPINO, date('2026-10-06'), 4)).toEqual([
      { reps: 8, kg: 62.5 },
      { reps: 6, kg: 62.5 },
      { reps: 6, kg: 62.5 },
      { reps: 6, kg: 62.5 },
    ])
  })

  it('takes only as many sets as planned', () => {
    expect(prefillSets(HISTORY, SUPINO, date('2026-10-02'), 1)).toEqual([{ reps: 8, kg: 60 }])
  })

  it('leaves the sets empty when the exercise was never logged before that date', () => {
    expect(prefillSets(HISTORY, SUPINO, date('2026-09-30'), 2)).toEqual([
      { reps: null, kg: null },
      { reps: null, kg: null },
    ])
  })

  it('on the same date, the session logged last wins', () => {
    const sameDay = [...HISTORY, session('s5', '2026-10-03', [{ exerciseId: SUPINO, sets: [{ reps: 12, kg: null }] }])]
    expect(prefillSets(sameDay, SUPINO, date('2026-10-04'), 1)).toEqual([{ reps: 12, kg: null }])
  })

  it('starting from a Workout Day gives one row per planned exercise with its planned set count', () => {
    expect(startSession('new' as WorkoutSessionId, date('2026-10-06'), PEITO, HISTORY)).toEqual({
      id: 'new',
      date: '2026-10-06',
      workoutDayId: 'd-peito',
      exercises: [
        {
          exerciseId: 'ex-supino',
          sets: [
            { reps: 8, kg: 62.5 },
            { reps: 6, kg: 62.5 },
            { reps: 6, kg: 62.5 },
            { reps: 6, kg: 62.5 },
          ],
        },
        {
          exerciseId: 'ex-remo',
          sets: [
            { reps: null, kg: null },
            { reps: null, kg: null },
          ],
        },
      ],
    })
  })

  it('a blank session starts with no exercises', () => {
    expect(startSession('b' as WorkoutSessionId, date('2026-10-06'), null, HISTORY)).toEqual({ id: 'b', date: '2026-10-06', workoutDayId: null, exercises: [] })
  })
})

describe('workoutReducer', () => {
  const P = 'p1' as WorkoutPlanId
  const D = 'd1' as WorkoutDayId
  const planned = run([
    { type: 'createPlan', planId: P, name: 'Força' },
    { type: 'addDay', planId: P, dayId: D, name: 'Pernas' },
    { type: 'addPlannedExercise', planId: P, dayId: D, name: ' Agachamento ', newExerciseId: 'e1' as ExerciseId },
    { type: 'addPlannedExercise', planId: P, dayId: D, name: 'agachamento', newExerciseId: 'e2' as ExerciseId },
    { type: 'addPlannedExercise', planId: P, dayId: D, name: '   ', newExerciseId: 'e3' as ExerciseId },
  ])

  it('creates an exercise from a typed name and reuses it when the name matches ignoring case', () => {
    expect(planned.exercises).toEqual([{ id: 'e1', name: 'Agachamento' }])
    expect(planned.plans).toEqual([{ id: 'p1', name: 'Força', days: [{ id: 'd1', name: 'Pernas', exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 8, max: 12 } }] }] }])
    expect(planned.activePlanId).toBe('p1')
  })

  it('a session exercise typed by name reuses the plan exercise and copies its last logged sets', () => {
    const s = run(
      [
        { type: 'startSession', sessionId: 's1' as WorkoutSessionId, date: date('2026-10-01'), day: planned.plans[0].days[0] },
        { type: 'setSet', sessionId: 's1' as WorkoutSessionId, exerciseId: 'e1' as ExerciseId, index: 0, set: { reps: 5, kg: 100 } },
        { type: 'removeSet', sessionId: 's1' as WorkoutSessionId, exerciseId: 'e1' as ExerciseId, index: 2 },
        { type: 'addSet', sessionId: 's1' as WorkoutSessionId, exerciseId: 'e1' as ExerciseId },
        { type: 'startSession', sessionId: 's2' as WorkoutSessionId, date: date('2026-10-02'), day: null },
        { type: 'addSessionExercise', sessionId: 's2' as WorkoutSessionId, name: 'AGACHAMENTO', newExerciseId: 'e9' as ExerciseId },
        { type: 'addSessionExercise', sessionId: 's2' as WorkoutSessionId, name: 'Prancha', newExerciseId: 'e10' as ExerciseId },
        { type: 'setSessionNote', sessionId: 's2' as WorkoutSessionId, text: 'Joelho bem', now: '2026-10-02T19:30:00' as LocalDateTime },
      ],
      planned,
    )
    expect(s.sessions[0].exercises[0].sets).toEqual([
      { reps: 5, kg: 100 },
      { reps: null, kg: null },
      { reps: null, kg: null },
    ])
    expect(s.exercises.map((e) => e.name)).toEqual(['Agachamento', 'Prancha'])
    expect(s.sessions[1]).toEqual({
      id: 's2',
      date: '2026-10-02',
      workoutDayId: null,
      note: { text: 'Joelho bem', createdAt: '2026-10-02T19:30:00', updatedAt: '2026-10-02T19:30:00' },
      exercises: [
        { exerciseId: 'e1', sets: [{ reps: 5, kg: 100 }] },
        { exerciseId: 'e10', sets: [{ reps: null, kg: null }] },
      ],
    })
    expect(loggedCounts(s.sessions[0])).toEqual({ exercises: 1, sets: 1 })
  })

  it('deleting the active plan activates the next one, and the last leaves none', () => {
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, name: 'Outro' }], planned)
    expect(two.activePlanId).toBe('p2')
    const one = run([{ type: 'deletePlan', planId: 'p2' as WorkoutPlanId }], two)
    expect(one.activePlanId).toBe('p1')
    expect(run([{ type: 'deletePlan', planId: P }], one).activePlanId).toBe(null)
  })
})

describe('parseRepRange', () => {
  it.each([
    ['8-12', { min: 8, max: 12 }],
    [' 8 – 12 ', { min: 8, max: 12 }],
    ['6 a 8', { min: 6, max: 8 }],
    ['10', { min: 10, max: 10 }],
    ['12-8', null],
    ['8-', null],
    ['0', null],
    ['', null],
  ])('reads "%s"', (text, expected) => {
    expect(parseRepRange(text)).toEqual(expected)
  })
})

describe('exercise notes', () => {
  const S1 = 's1' as WorkoutSessionId
  const at = (s: string) => s as LocalDateTime
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [] }, { exerciseId: REMO, sets: [] }])] }

  it('gives one exercise its own note with when it was written and last edited, leaving the others alone', () => {
    const s = run(
      [
        { type: 'setExerciseNote', sessionId: S1, exerciseId: SUPINO, text: 'Ombro esq. a picar', now: at('2026-10-06T18:40:00') },
        { type: 'setExerciseNote', sessionId: S1, exerciseId: SUPINO, text: 'Ombro esq. a picar na 3.ª série', now: at('2026-10-06T18:47:30') },
      ],
      start,
    )
    expect(s.sessions[0].exercises).toEqual([
      { exerciseId: SUPINO, sets: [], note: { text: 'Ombro esq. a picar na 3.ª série', createdAt: '2026-10-06T18:40:00', updatedAt: '2026-10-06T18:47:30' } },
      { exerciseId: REMO, sets: [] },
    ])
  })

  it('removes the note, key and all, when cleared to blank', () => {
    const s = run(
      [
        { type: 'setExerciseNote', sessionId: S1, exerciseId: REMO, text: 'Bem', now: at('2026-10-06T18:40:00') },
        { type: 'setExerciseNote', sessionId: S1, exerciseId: REMO, text: '', now: at('2026-10-06T18:41:00') },
      ],
      start,
    )
    expect(Object.keys(s.sessions[0].exercises[1])).toEqual(['exerciseId', 'sets'])
  })
})
