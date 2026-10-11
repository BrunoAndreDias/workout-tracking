import { describe, expect, it } from 'vitest'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { blockChanges, blockPosition, emptyWorkouts, findDay, loggedCounts, parseRepRange, parseRir, prefillSets, recentSessions, startSession, workoutReducer } from './workouts.ts'
import type { WorkoutAction, WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from './workouts.ts'

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
  const B = 'b1' as WorkoutBlockId
  const planned = run([
    { type: 'createPlan', planId: P, blockId: B, name: 'Força' },
    { type: 'addDay', planId: P, blockId: B, dayId: D, name: 'Pernas' },
    { type: 'addPlannedExercise', planId: P, blockId: B, dayId: D, name: ' Agachamento ', newExerciseId: 'e1' as ExerciseId },
    { type: 'addPlannedExercise', planId: P, blockId: B, dayId: D, name: 'agachamento', newExerciseId: 'e2' as ExerciseId },
    { type: 'addPlannedExercise', planId: P, blockId: B, dayId: D, name: '   ', newExerciseId: 'e3' as ExerciseId },
  ])
  const NO_RIR = [null, null, null, null, null, null]

  it('creates an exercise from a typed name and reuses it when the name matches ignoring case', () => {
    expect(planned.exercises).toEqual([{ id: 'e1', name: 'Agachamento' }])
    expect(planned.plans).toEqual([
      {
        id: 'p1',
        name: 'Força',
        blocks: [{ id: 'b1', name: 'Bloco A', weeks: 6, rir: NO_RIR, days: [{ id: 'd1', name: 'Pernas', exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 8, max: 12 } }] }] }],
        start: null,
      },
    ])
    expect(planned.activePlanId).toBe('p1')
  })

  it('a session exercise typed by name reuses the plan exercise and copies its last logged sets', () => {
    const s = run(
      [
        { type: 'startSession', sessionId: 's1' as WorkoutSessionId, date: date('2026-10-01'), day: planned.plans[0].blocks[0].days[0] },
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
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, blockId: 'b2' as WorkoutBlockId, name: 'Outro' }], planned)
    expect(two.activePlanId).toBe('p2')
    const one = run([{ type: 'deletePlan', planId: 'p2' as WorkoutPlanId }], two)
    expect(one.activePlanId).toBe('p1')
    expect(run([{ type: 'deletePlan', planId: P }], one).activePlanId).toBe(null)
  })

  it('a new block copies the selected one, its days under new ids, and takes the next free letter', () => {
    const s = run(
      [
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockRir', planId: P, blockId: B, week: 1, rir: { min: 5, max: 6 } },
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B },
        { type: 'renameBlock', planId: P, blockId: 'b2' as WorkoutBlockId, name: 'Bloco C' },
        { type: 'addBlock', planId: P, blockId: 'b3' as WorkoutBlockId, copyOf: null },
      ],
      planned,
    )
    expect(s.plans[0].blocks).toEqual([
      { id: 'b1', name: 'Bloco A', weeks: 3, rir: [{ min: 5, max: 6 }, null, null], days: [{ id: 'd1', name: 'Pernas', exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 8, max: 12 } }] }] },
      { id: 'b2', name: 'Bloco C', weeks: 3, rir: [{ min: 5, max: 6 }, null, null], days: [{ id: 'b2-d1', name: 'Pernas', exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 8, max: 12 } }] }] },
      { id: 'b3', name: 'Bloco D', weeks: 6, rir: NO_RIR, days: [] },
    ])
    expect(findDay(s.plans, 'b2-d1' as WorkoutDayId)?.name).toBe('Pernas')
  })

  it('more weeks pad the RIR targets with none, fewer drop the last ones, and a week out of range is not set', () => {
    const s = run(
      [
        { type: 'setBlockRir', planId: P, blockId: B, week: 6, rir: { min: 0, max: 1 } },
        { type: 'setBlockRir', planId: P, blockId: B, week: 2, rir: { min: 4, max: 4 } },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 4 },
        { type: 'setBlockRir', planId: P, blockId: B, week: 5, rir: { min: 1, max: 1 } },
        { type: 'setBlockRir', planId: P, blockId: B, week: 1, rir: { min: 3, max: 11 } },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 0 },
      ],
      planned,
    )
    expect(s.plans[0].blocks[0].rir).toEqual([null, { min: 4, max: 4 }, null, null])
  })

  it('removing the block the cycle started on moves the start to the first block left, keeping its date, and the last block stays', () => {
    const since = date('2026-10-05')
    const two = run(
      [
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: null },
        { type: 'setCycleStart', planId: P, blockId: B, since },
        { type: 'removeBlock', planId: P, blockId: B },
      ],
      planned,
    )
    expect(two.plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
    expect(two.plans[0].start).toEqual({ blockId: 'b2', since })
    expect(run([{ type: 'removeBlock', planId: P, blockId: 'b2' as WorkoutBlockId }], two).plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
  })
})

const SQUAT = 'ex-agachamento' as ExerciseId
const day = (id: string, exercises: ExerciseId[]): WorkoutDay => ({
  id: id as WorkoutDayId,
  name: id,
  exercises: exercises.map((exerciseId) => ({ exerciseId, sets: 3, reps: { min: 8, max: 12 } })),
})
const block = (id: string, weeks: number, days: WorkoutDay[]): WorkoutBlock => ({
  id: id as WorkoutBlockId,
  name: `Bloco ${id}`,
  weeks,
  rir: Array.from({ length: weeks }, (_, i) => ({ min: weeks - 1 - i, max: weeks - i })),
  days,
})
const BLOCK_A = block('A', 2, [day('a1', [SQUAT, SUPINO])])
const BLOCK_B = block('B', 1, [day('b1', [SQUAT, REMO])])
const cycle = (startOn: string | null, blocks = [BLOCK_A, BLOCK_B], blockId = 'A'): WorkoutPlan => ({
  id: 'p' as WorkoutPlanId,
  name: 'Força',
  blocks,
  start: startOn === null ? null : { blockId: blockId as WorkoutBlockId, since: date(startOn) },
})
const trained = (on: string) => session(`s-${on}`, on, [{ exerciseId: SQUAT, sets: [{ reps: 5, kg: 100 }] }])
const where = (plan: WorkoutPlan, sessions: WorkoutSession[], on: string) => {
  const p = blockPosition(plan, sessions, date(on))
  return p && { block: p.block.name, week: p.week, rir: p.rir, movedFrom: p.movedFrom?.name ?? null }
}

const MONDAY = '2026-10-05'

describe('blockPosition', () => {
  it('is nowhere before the cycle starts or before the week it started', () => {
    expect(where(cycle(null), [], '2026-10-07')).toBe(null)
    expect(where(cycle('2026-10-07'), [], '2026-10-04')).toBe(null)
  })

  it('counts the week the cycle started from its Monday, with that week’s RIR and nothing before it', () => {
    expect(where(cycle('2026-10-07'), [], MONDAY)).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: null })
  })

  it('a week without a filled set pauses the block, and two sessions in one week count once', () => {
    const sessions = [trained('2026-10-06'), trained('2026-10-08'), session('empty', '2026-10-13', [{ exerciseId: SQUAT, sets: [{ reps: null, kg: 80 }] }])]
    expect(where(cycle(MONDAY), sessions, '2026-10-21')).toEqual({ block: 'Bloco A', week: 2, rir: { min: 0, max: 1 }, movedFrom: null })
  })

  it('ignores sessions before the start and the sessions of the week asked about', () => {
    const sessions = [trained('2026-09-29'), trained('2026-10-12')]
    expect(where(cycle(MONDAY), sessions, '2026-10-12')?.week).toBe(1)
  })

  it('moves into the next block after the block’s training weeks, naming the one before on its week 1', () => {
    const sessions = [trained(MONDAY), trained('2026-10-12')]
    expect(where(cycle(MONDAY), sessions, '2026-10-19')).toEqual({ block: 'Bloco B', week: 1, rir: { min: 0, max: 1 }, movedFrom: 'Bloco A' })
  })

  it('wraps to the first block after the last', () => {
    const sessions = [MONDAY, '2026-10-12', '2026-10-19', '2026-10-26'].map(trained)
    expect(where(cycle(MONDAY), sessions, '2026-11-02')).toEqual({ block: 'Bloco A', week: 2, rir: { min: 0, max: 1 }, movedFrom: null })
    expect(where(cycle(MONDAY), sessions.slice(0, 3), '2026-10-26')).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: 'Bloco B' })
  })

  it('starts from the block named in the start, and from the first when that block is gone', () => {
    expect(where(cycle(MONDAY, [BLOCK_A, BLOCK_B], 'B'), [trained(MONDAY)], '2026-10-12')?.block).toBe('Bloco A')
    expect(where(cycle(MONDAY, [BLOCK_A, BLOCK_B], 'gone'), [], '2026-10-12')?.block).toBe('Bloco A')
  })

  it('a plan with one block has no block before it', () => {
    expect(where(cycle(MONDAY, [BLOCK_A]), [MONDAY, '2026-10-12'].map(trained), '2026-10-19')).toEqual({ block: 'Bloco A', week: 1, rir: { min: 1, max: 2 }, movedFrom: null })
  })
})

describe('blockChanges', () => {
  it('lists the Exercises that come in and those that go', () => {
    expect(blockChanges(BLOCK_A, BLOCK_B)).toEqual({ entering: [REMO], leaving: [SUPINO] })
  })
})

describe('parseRir', () => {
  it.each([
    ['3', { min: 3, max: 3 }],
    ['5-6', { min: 5, max: 6 }],
    ['5–6', { min: 5, max: 6 }],
    ['5 a 6', { min: 5, max: 6 }],
    ['0', { min: 0, max: 0 }],
    ['6-5', null],
    ['11', null],
    ['', null],
  ])('%s', (text, rir) => {
    expect(parseRir(text)).toEqual(rir)
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

describe('end feel and After-effects', () => {
  const S1 = 's1' as WorkoutSessionId
  const at = (s: string) => s as LocalDateTime
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [] }, { exerciseId: REMO, sets: [] }])] }
  const after = (on: string, exerciseId: ExerciseId | null, text: string, now: string): WorkoutAction => ({ type: 'setAfterEffect', sessionId: S1, date: date(on), exerciseId, text, now: at(now) })

  it('rates how the session felt at its end, and null removes the key', () => {
    const rated = run([{ type: 'setSessionFeel', sessionId: S1, feel: 2 }, { type: 'setSessionFeel', sessionId: S1, feel: 4 }], start)
    expect(rated.sessions[0].feel).toBe(4)
    expect(Object.keys(run([{ type: 'setSessionFeel', sessionId: S1, feel: null }], rated).sessions[0])).toEqual(['id', 'date', 'workoutDayId', 'exercises'])
  })

  it('keeps one After-effect per later date and Exercise, with when it was written and last edited', () => {
    const s = run(
      [
        after('2026-10-07', null, 'Pernas pesadas', '2026-10-07T08:00:00'),
        after('2026-10-07', SUPINO, 'Ombro dói', '2026-10-07T08:05:00'),
        after('2026-10-08', SUPINO, 'Ombro melhor', '2026-10-08T09:00:00'),
        after('2026-10-07', SUPINO, 'Ombro dói ao levantar o braço', '2026-10-07T21:30:00'),
      ],
      start,
    )
    expect(s.sessions[0].after).toEqual([
      { date: '2026-10-07', exerciseId: null, note: { text: 'Pernas pesadas', createdAt: '2026-10-07T08:00:00', updatedAt: '2026-10-07T08:00:00' } },
      { date: '2026-10-07', exerciseId: SUPINO, note: { text: 'Ombro dói ao levantar o braço', createdAt: '2026-10-07T08:05:00', updatedAt: '2026-10-07T21:30:00' } },
      { date: '2026-10-08', exerciseId: SUPINO, note: { text: 'Ombro melhor', createdAt: '2026-10-08T09:00:00', updatedAt: '2026-10-08T09:00:00' } },
    ])
  })

  it('removes an After-effect cleared to blank, and the key with the last one', () => {
    const two = run([after('2026-10-07', null, 'Pernas pesadas', '2026-10-07T08:00:00'), after('2026-10-08', REMO, 'Costas ok', '2026-10-08T08:00:00')], start)
    const one = run([after('2026-10-07', null, ' ', '2026-10-07T09:00:00')], two)
    expect(one.sessions[0].after?.map((a) => a.note.text)).toEqual(['Costas ok'])
    expect('after' in run([after('2026-10-08', REMO, '', '2026-10-08T09:00:00')], one).sessions[0]).toBe(false)
  })

  it('ignores an After-effect on the session’s own date or on an Exercise it does not have', () => {
    const s = run([after('2026-10-06', null, 'Hoje', '2026-10-06T20:00:00'), after('2026-10-07', 'ex-outro' as ExerciseId, 'Outro', '2026-10-07T08:00:00')], start)
    expect(s.sessions[0]).toEqual(start.sessions[0])
  })

  it('removing an Exercise from the session removes its After-effects', () => {
    const s = run([after('2026-10-07', SUPINO, 'Ombro dói', '2026-10-07T08:00:00'), after('2026-10-07', REMO, 'Costas ok', '2026-10-07T08:00:00'), { type: 'removeSessionExercise', sessionId: S1, exerciseId: SUPINO }], start)
    expect(s.sessions[0].after?.map((a) => [a.exerciseId, a.note.text])).toEqual([[REMO, 'Costas ok']])
  })

  it('lists the sessions one to three days before a date, newest first', () => {
    expect(recentSessions(HISTORY, date('2026-10-06')).map((s) => s.id)).toEqual(['s3', 's2'])
    expect(recentSessions(HISTORY, date('2026-10-04')).map((s) => s.id)).toEqual(['s2', 's1'])
    expect(recentSessions(HISTORY, date('2026-10-05')).map((s) => s.id)).toEqual(['s2'])
  })
})
