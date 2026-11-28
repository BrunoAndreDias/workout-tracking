import { describe, expect, it } from 'vitest'
import type { ExerciseId } from './types.ts'
import { parseWorkoutPlans, parseWorkoutSessions } from './workoutStorage.ts'
import { loadAll, loadStore, saveStore, STORES } from './stores.ts'
import { memoryStorage } from './memoryStorage.ts'

const SET = { done: true, kg: 62.5, reps: 8, rir: 2 }
const SESSION = {
  id: 's1',
  date: '2026-10-06',
  workoutDayId: 'd1',
  exercises: [
    {
      exerciseId: 'e1',
      sets: [SET, { done: true, kg: null, reps: 10, rir: null }, { done: false, kg: 60, reps: 8, rir: null }],
      target: { kg: 62.5, reps: 8, rir: 2 },
      note: { text: 'Pulso dir. a doer na última', createdAt: '2026-10-06T19:12:00', updatedAt: '2026-10-06T19:12:00' },
    },
  ],
  note: { text: 'Ombro ok', createdAt: '2026-10-06T19:30:00', updatedAt: '2026-10-06T19:41:00' },
}
const sessions = (...list: unknown[]) => ({ version: 4, sessions: list })
const withSets = (sets: unknown[]) => sessions({ ...SESSION, exercises: [{ exerciseId: 'e1', sets }] })

const ROW = { exerciseId: 'e1', role: 'main', sets: 4, reps: { min: 6, max: 6 }, weeks: 10, since: '2026-09-28' }
const day = (id: string, exercises: object[] = []) => ({ id, name: id, exercises })
const DAYS = [day('d1', [ROW]), day('d2'), day('d3')]
const BLOCK = { id: 'b1', name: 'Bloco A', weeks: 2, light: true, days: DAYS }
const PLAN = { id: 'p1', name: 'Força', split: 'ppf', blocks: [BLOCK], start: { blockId: 'b1', since: '2026-10-05' } }
const plans = (...list: unknown[]) => ({ version: 4, plans: list, activePlanId: 'p1' })
const withBlock = (block: object) => plans({ ...PLAN, blocks: [{ ...BLOCK, ...block }] })

const AFTER = [
  { date: '2026-10-07', exerciseId: null, note: { text: 'Pernas pesadas', createdAt: '2026-10-07T08:10:00', updatedAt: '2026-10-07T08:10:00' } },
  { date: '2026-10-08', exerciseId: 'e1', note: { text: 'Pulso ainda dói', createdAt: '2026-10-08T09:00:00', updatedAt: '2026-10-08T09:20:00' } },
]

describe('workout storage', () => {
  it('reads back what it saved', () => {
    const storage = memoryStorage()
    saveStore(STORES.exercises, [{ id: 'e1' as ExerciseId, name: 'Supino' }], storage)
    saveStore(STORES.workoutPlans, parseWorkoutPlans(plans(PLAN))!, storage)
    saveStore(STORES.workoutSessions, parseWorkoutSessions(sessions(SESSION))!, storage)
    const { exercises, workoutPlans, workoutSessions } = loadAll(storage)
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [{ id: 'e1', name: 'Supino' }], workoutPlans: { plans: [PLAN], activePlanId: 'p1' }, workoutSessions: [SESSION] })
  })

  it('reads a version 3 block as not light, dropping its RIR target per week', () => {
    const { light: _, ...v3Block } = BLOCK
    const v3 = { version: 3, plans: [{ ...PLAN, blocks: [{ ...v3Block, rir: [{ min: 5, max: 6 }, null] }] }], activePlanId: 'p1' }
    expect(parseWorkoutPlans(v3)?.plans[0].blocks).toEqual([{ ...BLOCK, light: false }])
  })

  it('reads back a session’s end feel and After-effects', () => {
    const storage = memoryStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions(sessions({ ...SESSION, feel: 4, after: AFTER }))!, storage)
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([{ ...SESSION, feel: 4, after: AFTER }])
  })

  it('reads a session stored before end feel and After-effects with neither key', () => {
    const [session] = parseWorkoutSessions(sessions(SESSION))!
    expect(['feel' in session, 'after' in session]).toEqual([false, false])
  })

  it('reads back a kept target that aimed at a RIR range, and one without `rirMax` as a single RIR', () => {
    const ranged = { ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 10, reps: 12, rir: 1, rirMax: 3 } }] }
    const storage = memoryStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions(sessions(ranged, { ...SESSION, id: 's2' }))!, storage)
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([ranged, { ...SESSION, id: 's2' }])
    expect(storage.data['workout-tracking:workout-sessions']).toContain('"version":4')
  })

  it('reads back a kept light target', () => {
    const light = { ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 10, reps: 12, rir: 3, rirMax: 5, light: true } }] }
    const storage = memoryStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions(sessions(light))!, storage)
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([light])
    expect(storage.data['workout-tracking:workout-sessions']).toContain('"version":4')
  })

  it('reads an empty After-effects list as none', () => {
    const [session] = parseWorkoutSessions(sessions({ ...SESSION, after: [] }))!
    expect(session).toEqual(SESSION)
  })

  it('starts empty when nothing was saved', () => {
    const { exercises, workoutPlans, workoutSessions } = loadAll(memoryStorage())
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [] })
  })

  it('reads a version 2 set with reps as done and an empty one as pending, with no RIR and no target', () => {
    const v2 = { ...SESSION, exercises: [{ exerciseId: 'e1', sets: [{ reps: 8, kg: 62.5 }, { reps: null, kg: 60 }], target: { kg: 1, reps: 1, rir: 1 } }] }
    expect(parseWorkoutSessions({ version: 2, sessions: [v2] })?.[0].exercises).toEqual([
      {
        exerciseId: 'e1',
        sets: [
          { done: true, kg: 62.5, reps: 8, rir: null },
          { done: false, kg: 60, reps: null, rir: null },
        ],
      },
    ])
  })

  it('reads a version 1 plain-text note as written at midday of the session, and an empty one as no note', () => {
    const { note: _, ...bare } = SESSION
    const v1 = { ...bare, exercises: [{ exerciseId: 'e1', sets: [] }] }
    expect(parseWorkoutSessions({ version: 1, sessions: [{ ...v1, notes: 'Ombro ok' }, { ...v1, id: 's2', notes: '' }] })).toEqual([
      { ...v1, note: { text: 'Ombro ok', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' } },
      { ...v1, id: 's2' },
    ])
  })

  it.each([
    ['an unknown version', { version: 5, sessions: [] }],
    ['a bad date', sessions({ ...SESSION, date: '2026-02-30' })],
    ['negative kg', withSets([{ ...SET, kg: -1 }])],
    ['a done set with no reps', withSets([{ ...SET, reps: null }])],
    ['a set with no done key', withSets([{ kg: 60, reps: 8, rir: null }])],
    ['a RIR of 11', withSets([{ ...SET, rir: 11 }])],
    ['a target with no RIR', sessions({ ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 60, reps: 8 } }] })],
    ['a target whose RIR range is upside down', sessions({ ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 60, reps: 8, rir: 3, rirMax: 1 } }] })],
    ['a target whose `light` is not true', sessions({ ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 60, reps: 8, rir: 2, light: false } }] })],
    ['a target whose RIR range is one RIR', sessions({ ...SESSION, exercises: [{ ...SESSION.exercises[0], target: { kg: 60, reps: 8, rir: 2, rirMax: 2 } }] })],
    ['an exercise twice', sessions({ ...SESSION, exercises: [SESSION.exercises[0], SESSION.exercises[0]] })],
    ['a repeated session id', sessions(SESSION, SESSION)],
    ['a blank note', sessions({ ...SESSION, note: { ...SESSION.note, text: '' } })],
    ['an exercise note with no times', sessions({ ...SESSION, exercises: [{ ...SESSION.exercises[0], note: { text: 'x' } }] })],
    ['a version 1 session without notes', { version: 1, sessions: [{ ...SESSION, note: undefined }] }],
    ['an end feel of 0', sessions({ ...SESSION, feel: 0 })],
    ['an end feel of null', sessions({ ...SESSION, feel: null })],
    ['After-effects that are not a list', sessions({ ...SESSION, after: {} })],
    ['an After-effect on the session’s own date', sessions({ ...SESSION, after: [{ ...AFTER[0], date: '2026-10-06' }] })],
    ['an After-effect on an Exercise not in the session', sessions({ ...SESSION, after: [{ ...AFTER[0], exerciseId: 'e9' }] })],
    ['an After-effect with no exerciseId key', sessions({ ...SESSION, after: [{ date: '2026-10-07', note: AFTER[0].note }] })],
    ['an After-effect with a blank note', sessions({ ...SESSION, after: [{ ...AFTER[0], note: { ...AFTER[0].note, text: ' ' } }] })],
    ['two After-effects on one date and Exercise', sessions({ ...SESSION, after: [AFTER[1], { ...AFTER[1], note: AFTER[0].note }] })],
  ])('rejects sessions with %s', (_, raw) => {
    expect(parseWorkoutSessions(raw)).toBe(null)
  })

  it('reads a Planned Exercise stored before Exercise Runs as running its role’s weeks since it was first done', () => {
    const { weeks: _, since: __, ...old } = ROW
    const rows = [old, { ...old, exerciseId: 'e2', role: 'isolation' }, { ...ROW, exerciseId: 'e3', weeks: null, since: null }]
    const read = parseWorkoutPlans(withBlock({ days: [day('d1', rows), DAYS[1], DAYS[2]] }))!.plans[0].blocks[0].days[0].exercises
    expect(read.map((p) => [p.exerciseId, p.weeks, p.since])).toEqual([
      ['e1', null, null],
      ['e2', 8, null],
      ['e3', null, null],
    ])
  })

  it('reads one day id in two plans, as version 1 did', () => {
    expect(parseWorkoutPlans(plans(PLAN, { ...PLAN, id: 'p2', blocks: [{ ...BLOCK, id: 'b2' }], start: null }))?.plans.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it.each([
    ['a rep range upside down', withBlock({ days: [day('d1', [{ ...ROW, reps: { min: 12, max: 8 } }]), DAYS[1], DAYS[2]] })],
    ['zero sets', withBlock({ days: [day('d1', [{ ...ROW, sets: 0 }]), DAYS[1], DAYS[2]] })],
    ['no role', withBlock({ days: [day('d1', [{ ...ROW, role: undefined }]), DAYS[1], DAYS[2]] })],
    ['an unknown role', withBlock({ days: [day('d1', [{ ...ROW, role: 'warmup' }]), DAYS[1], DAYS[2]] })],
    ['an exercise run of 0 weeks', withBlock({ days: [day('d1', [{ ...ROW, weeks: 0 }]), DAYS[1], DAYS[2]] })],
    ['an exercise run of 53 weeks', withBlock({ days: [day('d1', [{ ...ROW, weeks: 53 }]), DAYS[1], DAYS[2]] })],
    ['an exercise run of 2.5 weeks', withBlock({ days: [day('d1', [{ ...ROW, weeks: 2.5 }]), DAYS[1], DAYS[2]] })],
    ['an exercise run since a bad date', withBlock({ days: [day('d1', [{ ...ROW, since: '2026-02-30' }]), DAYS[1], DAYS[2]] })],
    ['an exercise run since a number', withBlock({ days: [day('d1', [{ ...ROW, since: 20261005 }]), DAYS[1], DAYS[2]] })],
    ['an unknown split', plans({ ...PLAN, split: 'ppl' })],
    ['four days in a 3-day split', withBlock({ days: [...DAYS, day('d4')] })],
    ['no active plan while there are plans', { ...plans(PLAN), activePlanId: null }],
    ['an active plan while there are none', plans()],
    ['no blocks', plans({ ...PLAN, blocks: [], start: null })],
    ['two blocks with one id', plans({ ...PLAN, blocks: [BLOCK, { ...BLOCK, days: [day('x1'), day('x2'), day('x3')] }] })],
    ['one day id in two blocks', plans({ ...PLAN, blocks: [BLOCK, { ...BLOCK, id: 'b2' }] })],
    ['0 weeks', withBlock({ weeks: 0 })],
    ['53 weeks', withBlock({ weeks: 53 })],
    ['a block with no light key', plans({ ...PLAN, blocks: [{ id: 'b1', name: 'Bloco A', weeks: 2, days: DAYS }] })],
    ['a light that is not true or false', withBlock({ light: 'sim' })],
    ['a start on a block not in the plan', plans({ ...PLAN, start: { blockId: 'b9', since: '2026-10-05' } })],
    ['a start on a bad date', plans({ ...PLAN, start: { blockId: 'b1', since: '2026-02-30' } })],
    ['no start key', plans({ id: 'p1', name: 'Força', split: 'ppf', blocks: [BLOCK] })],
    ['a version 1 plan in a version 4 document', plans({ id: 'p1', name: 'Força', days: DAYS })],
    ['a version 1 plan with a bad day', { version: 1, plans: [{ id: 'p1', name: 'Força', days: [{ ...DAYS[0], exercises: 'x' }] }], activePlanId: 'p1' }],
  ])('rejects plans with %s', (_, raw) => {
    expect(parseWorkoutPlans(raw)).toBe(null)
  })

  it('keeps an unreadable sessions document aside before starting empty', () => {
    const text = JSON.stringify({ version: 1, sessions: [{ ...SESSION, notes: 3 }] })
    const storage = memoryStorage({ [STORES.workoutSessions.key]: text })
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([])
    const copies = Object.entries(storage.data).filter(([k]) => k.startsWith(`${STORES.workoutSessions.key}:unreadable:`))
    expect(copies.map(([, v]) => v)).toEqual([text])
  })
})

describe('migrating Workout Plans to Training Splits', () => {
  const v2Row = (exerciseId: string) => ({ exerciseId, sets: 3, reps: { min: 8, max: 12 } })
  const v2Day = (id: string, rows: string[] = []) => ({ id, name: `Dia ${id}`, exercises: rows.map(v2Row) })
  const v2Block = (id: string, n: number) => ({ id, name: `Bloco ${id}`, weeks: 1, rir: [{ min: 2, max: 3 }], days: Array.from({ length: n }, (_, i) => v2Day(`${id}-${i}`, i === 0 ? ['e1', 'e2', 'e3'] : [])) })
  const v2Plan = (id: string, ...counts: number[]) => ({ id, name: `Plano ${id}`, blocks: counts.map((n, i) => v2Block(`${id}b${i}`, n)), start: { blockId: `${id}b0`, since: '2026-10-05' } })
  const v2 = (activePlanId: string, ...list: object[]) => ({ version: 2, plans: list, activePlanId })

  it('keeps a plan of 3-day blocks as Push · Pull · Full body, with its names, ids, sets, reps and start, not light', () => {
    const plan = parseWorkoutPlans(v2('a', v2Plan('a', 3, 3)))!.plans[0]
    expect(plan.split).toBe('ppf')
    expect(plan.start).toEqual({ blockId: 'ab0', since: '2026-10-05' })
    expect(plan.blocks.map((b) => [b.id, b.name, b.weeks, b.light])).toEqual([
      ['ab0', 'Bloco ab0', 1, false],
      ['ab1', 'Bloco ab1', 1, false],
    ])
    expect(plan.blocks[0].days.map((d) => [d.id, d.name])).toEqual([
      ['ab0-0', 'Dia ab0-0'],
      ['ab0-1', 'Dia ab0-1'],
      ['ab0-2', 'Dia ab0-2'],
    ])
  })

  it('guesses each role from its place: the first Exercise of a day is the main lift, the rest isolation', () => {
    const plan = parseWorkoutPlans(v2('a', v2Plan('a', 3)))!.plans[0]
    expect(plan.blocks[0].days[0].exercises).toEqual([
      { exerciseId: 'e1', role: 'main', sets: 3, reps: { min: 8, max: 12 }, weeks: null, since: null },
      { exerciseId: 'e2', role: 'isolation', sets: 3, reps: { min: 8, max: 12 }, weeks: 8, since: null },
      { exerciseId: 'e3', role: 'isolation', sets: 3, reps: { min: 8, max: 12 }, weeks: 8, since: null },
    ])
  })

  it('keeps a plan of 4-day blocks as Upper and Lower', () => {
    expect(parseWorkoutPlans(v2('a', v2Plan('a', 4)))!.plans.map((p) => p.split)).toEqual(['ul'])
  })

  it('drops a plan of 5-day blocks and one mixing 3 and 4 days, and the active plan moves to the first kept', () => {
    expect(parseWorkoutPlans(v2('five', v2Plan('five', 5), v2Plan('mixed', 3, 4), v2Plan('ok', 4)))).toEqual({
      plans: [expect.objectContaining({ id: 'ok', split: 'ul' })],
      activePlanId: 'ok',
    })
    expect(parseWorkoutPlans(v2('five', v2Plan('five', 5)))).toEqual({ plans: [], activePlanId: null })
  })

  it('reads a version 1 plan of 3 days as one Bloco A of 6 weeks, not started, and drops one of 1 day', () => {
    const v1 = { version: 1, plans: [{ id: 'p1', name: 'Força', days: [v2Day('a', ['e1']), v2Day('b'), v2Day('c')] }, { id: 'p2', name: 'Um', days: [v2Day('z')] }], activePlanId: 'p2' }
    expect(parseWorkoutPlans(v1)).toEqual({
      plans: [
        {
          id: 'p1',
          name: 'Força',
          split: 'ppf',
          blocks: [{ id: 'p1-b1', name: 'Bloco A', weeks: 6, light: false, days: [{ ...v2Day('a'), exercises: [{ ...v2Row('e1'), role: 'main', weeks: null, since: null }] }, v2Day('b'), v2Day('c')] }],
          start: null,
        },
      ],
      activePlanId: 'p1',
    })
  })
})
