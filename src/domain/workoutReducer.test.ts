import { describe, expect, it } from 'vitest'
import type { ExerciseId, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from './types.ts'
import { findDay } from './blocks.ts'
import { emptyWorkouts } from './workouts.ts'
import { recentSessions } from './sessions.ts'
import type { WorkoutState } from './workouts.ts'
import type { WorkoutAction } from './workoutReducer.ts'
import { SUPINO, REMO, date, done, pending, session, HISTORY, run, P, B, S1, TODAY, created, PUSH, BENCH, day } from './workoutFixtures.ts'

describe('Workout Plans', () => {
  it('a new plan is its split’s template in one Bloco A, and becomes the active plan', () => {
    const plan = created.plans[0]
    expect(plan).toMatchObject({ id: 'p1', name: 'Força', split: 'ppf', start: null })
    expect(plan.blocks.map((b) => [b.id, b.name, b.weeks])).toEqual([['b1', 'Bloco A', 6]])
    expect(plan.blocks[0].days.map((d) => [d.id, d.name])).toEqual([
      ['b1-d1', 'Push'],
      ['b1-d2', 'Pull'],
      ['b1-d3', 'Full body'],
    ])
    expect(created.exercises.find((e) => e.id === BENCH)?.name).toBe('Flat Barbell Bench Press')
    expect(created.activePlanId).toBe('p1')
  })

  it('a second plan reuses the Exercises the first one created', () => {
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, blockId: 'b2' as WorkoutBlockId, name: 'Outro', split: 'ul', today: TODAY }], created)
    expect(two.plans[1].blocks[0].days.map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(two.plans[1].blocks[0].days[0].exercises[0].exerciseId).toBe(BENCH)
    expect(new Set(two.exercises.map((e) => e.name)).size).toBe(two.exercises.length)
  })

  it('adds an Exercise with a role, its rep range and its run of weeks from today, reusing one named the same ignoring case', () => {
    const s = run(
      [
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: ' Supino ', role: 'secondary', newExerciseId: 'e1' as ExerciseId, today: TODAY },
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: 'supino', role: 'isolation', newExerciseId: 'e2' as ExerciseId, today: TODAY },
        { type: 'addPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, name: '  ', role: 'isolation', newExerciseId: 'e3' as ExerciseId, today: TODAY },
      ],
      created,
    )
    expect(day(s).exercises.slice(PUSH.exercises.length)).toEqual([{ exerciseId: 'e1', role: 'secondary', sets: 3, reps: { min: 8, max: 10 }, weeks: 8, since: TODAY }])
    expect(s.exercises.at(-1)).toEqual({ id: 'e1', name: 'Supino' })
  })

  it('swapping keeps the role, sets, reps, weeks and place, starts the run today, and does nothing when the new Exercise is already in the day', () => {
    const edited = run([{ type: 'setPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, planned: { ...PUSH.exercises[0], sets: 5, weeks: 12 } }], created)
    const swapped = run([{ type: 'swapPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, exerciseId: BENCH, name: 'Flat Dumbbell Bench Press', newExerciseId: 'db' as ExerciseId, today: TODAY }], edited)
    expect(day(swapped).exercises[0]).toEqual({ exerciseId: 'db', role: 'main', sets: 5, reps: { min: 6, max: 8 }, weeks: 12, since: TODAY })
    expect(day(swapped).exercises.slice(1)).toEqual(PUSH.exercises.slice(1))
    const into = PUSH.exercises[1].exerciseId
    const same = run([{ type: 'swapPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, exerciseId: BENCH, name: created.exercises.find((e) => e.id === into)!.name, newExerciseId: 'x' as ExerciseId, today: TODAY }], created)
    expect(day(same)).toEqual(PUSH)
  })

  it('an Exercise Run lasts 1 to 52 weeks or has no limit', () => {
    const weeks = (n: number | null) => day(run([{ type: 'setPlannedExercise', planId: P, blockId: B, dayId: PUSH.id, planned: { ...PUSH.exercises[1], weeks: n } }], created)).exercises[1].weeks
    expect([weeks(1), weeks(52), weeks(null), weeks(0), weeks(53), weeks(2.5)]).toEqual([1, 52, null, 8, 8, 8])
  })

  it('deleting the active plan activates the next one, and the last leaves none', () => {
    const two = run([{ type: 'createPlan', planId: 'p2' as WorkoutPlanId, blockId: 'b2' as WorkoutBlockId, name: 'Outro', split: 'ul', today: TODAY }], created)
    expect(two.activePlanId).toBe('p2')
    const one = run([{ type: 'deletePlan', planId: 'p2' as WorkoutPlanId }], two)
    expect(one.activePlanId).toBe('p1')
    expect(run([{ type: 'deletePlan', planId: P }], one).activePlanId).toBe(null)
  })

  it('a new block copies the selected one, its days under new ids, and takes the next free letter', () => {
    const s = run(
      [
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockLight', planId: P, blockId: B, light: true },
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B },
        { type: 'renameBlock', planId: P, blockId: 'b2' as WorkoutBlockId, name: 'Bloco C' },
        { type: 'addBlock', planId: P, blockId: 'b3' as WorkoutBlockId, copyOf: 'gone' as WorkoutBlockId },
      ],
      created,
    )
    const [a, c] = s.plans[0].blocks
    expect(s.plans[0].blocks.map((b) => [b.id, b.name, b.weeks])).toEqual([
      ['b1', 'Bloco A', 3],
      ['b2', 'Bloco C', 3],
    ])
    expect(c.light).toBe(true)
    expect(c.days.map((d) => d.id)).toEqual(['b2-d1', 'b2-d2', 'b2-d3'])
    expect(c.days.map((d) => d.exercises)).toEqual(a.days.map((d) => d.exercises))
    expect(findDay(s.plans, 'b2-d1' as WorkoutDayId)?.name).toBe('Push')
  })

  it('a new plan’s block is not light; Semana leve turns it light and back, and its weeks change nothing else', () => {
    expect(created.plans[0].blocks[0].light).toBe(false)
    const light = run([{ type: 'setBlockLight', planId: P, blockId: B, light: true }], created)
    expect(light.plans[0].blocks[0].light).toBe(true)
    expect(run([{ type: 'setBlockLight', planId: P, blockId: B, light: false }], light).plans[0].blocks[0].light).toBe(false)
    const resized = run(
      [
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 3 },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 0 },
        { type: 'setBlockWeeks', planId: P, blockId: B, weeks: 53 },
      ],
      light,
    )
    expect(resized.plans[0].blocks[0]).toEqual({ ...light.plans[0].blocks[0], weeks: 3 })
  })

  it('removing the block the cycle started on moves the start to the first block left, keeping its date, and the last block stays', () => {
    const since = date('2026-10-05')
    const two = run(
      [
        { type: 'addBlock', planId: P, blockId: 'b2' as WorkoutBlockId, copyOf: B },
        { type: 'setCycleStart', planId: P, blockId: B, since },
        { type: 'removeBlock', planId: P, blockId: B },
      ],
      created,
    )
    expect(two.plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
    expect(two.plans[0].start).toEqual({ blockId: 'b2', since })
    expect(run([{ type: 'removeBlock', planId: P, blockId: 'b2' as WorkoutBlockId }], two).plans[0].blocks.map((b) => b.id)).toEqual(['b2'])
  })
})

describe('logging sets', () => {
  const start: WorkoutState = { ...emptyWorkouts(), sessions: [session('s1', '2026-10-06', [{ exerciseId: SUPINO, sets: [pending(8, 60), pending(8, 60), pending(8, 60)] }])] }
  const sets = (s: WorkoutState) => s.sessions[0].exercises[0].sets
  const tick = (index: number, isDone = true): WorkoutAction => ({ type: 'setSetDone', sessionId: S1, exerciseId: SUPINO, index, done: isDone })
  const type = (index: number, set: { kg: number | null; reps: number | null; rir: number | null }): WorkoutAction => ({ type: 'setSet', sessionId: S1, exerciseId: SUPINO, index, set })

  it('one tap marks a set done as shown, again is the same, and un-marking keeps its values', () => {
    expect(sets(run([tick(0), tick(0)], start))).toEqual([done(8, 60), pending(8, 60), pending(8, 60)])
    expect(sets(run([tick(0), tick(0, false)], start))).toEqual(sets(start))
  })

  it('a set with no reps cannot be done', () => {
    const empty = run([type(1, { kg: 60, reps: null, rir: null }), tick(1)], start)
    expect(sets(empty)[1]).toEqual(pending(null, 60))
  })

  it('editing kg or reps never marks a set done, and keeps a done one done while it has reps', () => {
    const s = run([type(0, { kg: 62.5, reps: 7, rir: null }), tick(1), type(1, { kg: 60, reps: 9, rir: null })], start)
    expect(sets(s).slice(0, 2)).toEqual([pending(7, 62.5), done(9, 60)])
    expect(sets(run([type(1, { kg: 60, reps: null, rir: null })], s))[1]).toEqual(pending(null, 60))
  })

  it('a new RIR fills the next pending set that has none', () => {
    const s = run([tick(0), type(0, { kg: 60, reps: 8, rir: 2 }), type(1, { kg: 60, reps: 8, rir: 1 })], start)
    expect(sets(s)).toEqual([done(8, 60, 2), pending(8, 60, 1), pending(8, 60, 1)])
  })

  it('a new set copies the last one, pending', () => {
    expect(sets(run([tick(2), { type: 'addSet', sessionId: S1, exerciseId: SUPINO }], start)).at(-1)).toEqual(pending(8, 60))
  })

  it('an Exercise added to a session copies its last done sets, pending', () => {
    const s = run([{ type: 'addSessionExercise', sessionId: S1, name: 'Remo', newExerciseId: REMO }], {
      ...start,
      exercises: [{ id: REMO, name: 'Remo' }],
      sessions: [session('s0', '2026-10-01', [{ exerciseId: REMO, sets: [done(10, 40, 1), pending(10, 40)] }]), ...start.sessions],
    })
    expect(s.sessions[1].exercises[1]).toEqual({ exerciseId: REMO, sets: [pending(10, 40)] })
  })

  it('starting a session suggests from the history in the state, each Exercise aiming at its Role’s RIR Target', () => {
    const [bench, press, raise, , crunch] = PUSH.exercises.map((p) => p.exerciseId)
    const last = [
      { exerciseId: bench, sets: [done(7, 60, 2)] },
      { exerciseId: press, sets: [done(8, 40, 2)] },
      { exerciseId: raise, sets: [done(12, 10, 1)] },
      { exerciseId: crunch, sets: [done(12, 20)] },
    ]
    const s = run([{ type: 'startSession', sessionId: S1, date: date('2026-10-06'), day: PUSH, light: false }], { ...created, sessions: [session('s0', '2026-10-01', last)] })
    expect(s.sessions[1].exercises.map((e) => e.target)).toEqual([
      { kg: 60, reps: 8, rir: 2 },
      { kg: 40, reps: 9, rir: 2 },
      { kg: 10, reps: 13, rir: 1, rirMax: 3 },
      undefined,
      { kg: 20, reps: 13, rir: 1, rirMax: 3 },
    ])
    expect(s.sessions[1].exercises[0].sets).toEqual(Array(3).fill(pending(8, 60)))
  })

  it('in a light block every Exercise aims 2 RIR further from failure, and back in a normal block the reps rise by at most 2', () => {
    const benchAt = (reps: number, rir: number) => session('s0', '2026-10-01', [{ exerciseId: BENCH, sets: [done(reps, 60, rir)], target: { kg: 60, reps, rir: 2 } }])
    const start = (light: boolean, history: WorkoutState['sessions']) =>
      run([{ type: 'startSession', sessionId: S1, date: date('2026-10-06'), day: PUSH, light }], { ...created, sessions: history }).sessions.at(-1)!.exercises[0]
    const light = start(true, [benchAt(7, 2)])
    expect(light).toEqual({ exerciseId: BENCH, sets: Array(3).fill(pending(6, 60)), target: { kg: 60, reps: 6, rir: 4 } })
    const deload = session('s0', '2026-10-01', [{ ...light, sets: [done(6, 60, 4)] }])
    expect(start(false, [deload])).toEqual({ exerciseId: BENCH, sets: Array(3).fill(pending(8, 60)), target: { kg: 60, reps: 8, rir: 2 } })
  })

  it('in a light block, a session that kept no target is read as aiming at the Role’s normal RIR Target', () => {
    const unaimed = session('s0', '2026-10-01', [{ exerciseId: BENCH, sets: [done(7, 60, 2)] }])
    const s = run([{ type: 'startSession', sessionId: S1, date: date('2026-10-06'), day: PUSH, light: true }], { ...created, sessions: [unaimed] })
    expect(s.sessions[1].exercises[0].sets[0]).toEqual(pending(6, 60))
  })
})

describe('exercise notes', () => {
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

