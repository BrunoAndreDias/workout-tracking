import { describe, expect, it } from 'vitest'
import type { ExerciseId } from './types.ts'
import { parseWorkoutPlans, parseWorkoutSessions } from './workoutStorage.ts'
import { loadAll, loadStore, saveStore, STORES } from './stores.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    get length() {
      return Object.keys(data).length
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
  }
}

const SESSION = {
  id: 's1',
  date: '2026-10-06',
  workoutDayId: 'd1',
  exercises: [
    {
      exerciseId: 'e1',
      sets: [{ reps: 8, kg: 62.5 }, { reps: 10, kg: null }, { reps: null, kg: null }],
      note: { text: 'Pulso dir. a doer na última', createdAt: '2026-10-06T19:12:00', updatedAt: '2026-10-06T19:12:00' },
    },
  ],
  note: { text: 'Ombro ok', createdAt: '2026-10-06T19:30:00', updatedAt: '2026-10-06T19:41:00' },
}
const DAY = { id: 'd1', name: 'Peito', exercises: [{ exerciseId: 'e1', sets: 4, reps: { min: 6, max: 6 } }] }
const BLOCK = { id: 'b1', name: 'Bloco A', weeks: 2, rir: [{ min: 5, max: 6 }, null], days: [DAY] }
const PLAN = { id: 'p1', name: 'Força', blocks: [BLOCK], start: { blockId: 'b1', since: '2026-10-05' } }
const LEGACY_PLAN = { id: 'p1', name: 'Força', days: [DAY] }
const plans = (...list: unknown[]) => ({ version: 2, plans: list, activePlanId: 'p1' })
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
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 2, sessions: [SESSION] })!, storage)
    const { exercises, workoutPlans, workoutSessions } = loadAll(storage)
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [{ id: 'e1', name: 'Supino' }], workoutPlans: { plans: [PLAN], activePlanId: 'p1' }, workoutSessions: [SESSION] })
  })

  it('reads back a session’s end feel and After-effects', () => {
    const storage = memoryStorage()
    saveStore(STORES.workoutSessions, parseWorkoutSessions({ version: 2, sessions: [{ ...SESSION, feel: 4, after: AFTER }] })!, storage)
    expect(loadStore(STORES.workoutSessions, storage)).toEqual([{ ...SESSION, feel: 4, after: AFTER }])
  })

  it('reads a session stored before end feel and After-effects with neither key', () => {
    const [session] = parseWorkoutSessions({ version: 2, sessions: [SESSION] })!
    expect(['feel' in session, 'after' in session]).toEqual([false, false])
  })

  it('reads an empty After-effects list as none', () => {
    const [session] = parseWorkoutSessions({ version: 2, sessions: [{ ...SESSION, after: [] }] })!
    expect(session).toEqual(SESSION)
  })

  it('starts empty when nothing was saved', () => {
    const { exercises, workoutPlans, workoutSessions } = loadAll(memoryStorage())
    expect({ exercises, workoutPlans, workoutSessions }).toEqual({ exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [] })
  })

  it('reads a version 1 plain-text note as written at midday of the session, and an empty one as no note', () => {
    const { note: _, ...bare } = SESSION
    expect(parseWorkoutSessions({ version: 1, sessions: [{ ...bare, notes: 'Ombro ok' }, { ...bare, id: 's2', notes: '' }] })).toEqual([
      { ...bare, note: { text: 'Ombro ok', createdAt: '2026-10-06T12:00:00', updatedAt: '2026-10-06T12:00:00' } },
      { ...bare, id: 's2' },
    ])
  })

  it.each([
    ['an unknown version', { version: 3, sessions: [] }],
    ['a bad date', { version: 2, sessions: [{ ...SESSION, date: '2026-02-30' }] }],
    ['negative kg', { version: 2, sessions: [{ ...SESSION, exercises: [{ exerciseId: 'e1', sets: [{ reps: 5, kg: -1 }] }] }] }],
    ['an exercise twice', { version: 2, sessions: [{ ...SESSION, exercises: [SESSION.exercises[0], SESSION.exercises[0]] }] }],
    ['a repeated session id', { version: 2, sessions: [SESSION, SESSION] }],
    ['a blank note', { version: 2, sessions: [{ ...SESSION, note: { ...SESSION.note, text: '' } }] }],
    ['an exercise note with no times', { version: 2, sessions: [{ ...SESSION, exercises: [{ ...SESSION.exercises[0], note: { text: 'x' } }] }] }],
    ['a version 1 session without notes', { version: 1, sessions: [{ ...SESSION, note: undefined }] }],
    ['an end feel of 0', { version: 2, sessions: [{ ...SESSION, feel: 0 }] }],
    ['an end feel of null', { version: 2, sessions: [{ ...SESSION, feel: null }] }],
    ['After-effects that are not a list', { version: 2, sessions: [{ ...SESSION, after: {} }] }],
    ['an After-effect on the session’s own date', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], date: '2026-10-06' }] }] }],
    ['an After-effect on an Exercise not in the session', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], exerciseId: 'e9' }] }] }],
    ['an After-effect with no exerciseId key', { version: 2, sessions: [{ ...SESSION, after: [{ date: '2026-10-07', note: AFTER[0].note }] }] }],
    ['an After-effect with a blank note', { version: 2, sessions: [{ ...SESSION, after: [{ ...AFTER[0], note: { ...AFTER[0].note, text: ' ' } }] }] }],
    ['two After-effects on one date and Exercise', { version: 2, sessions: [{ ...SESSION, after: [AFTER[1], { ...AFTER[1], note: AFTER[0].note }] }] }],
  ])('rejects sessions with %s', (_, raw) => {
    expect(parseWorkoutSessions(raw)).toBe(null)
  })

  it('reads one day id in two plans, as version 1 did', () => {
    expect(parseWorkoutPlans(plans(PLAN, { ...PLAN, id: 'p2', blocks: [{ ...BLOCK, id: 'b2' }], start: null }))?.plans.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('reads a version 1 plan’s days as its one Bloco A of 6 weeks, not started', () => {
    expect(parseWorkoutPlans({ version: 1, plans: [LEGACY_PLAN], activePlanId: 'p1' })).toEqual({
      plans: [{ id: 'p1', name: 'Força', blocks: [{ id: 'p1-b1', name: 'Bloco A', weeks: 6, rir: [null, null, null, null, null, null], days: [DAY] }], start: null }],
      activePlanId: 'p1',
    })
  })

  it.each([
    ['a rep range upside down', withBlock({ days: [{ ...DAY, exercises: [{ exerciseId: 'e1', sets: 3, reps: { min: 12, max: 8 } }] }] })],
    ['zero sets', withBlock({ days: [{ ...DAY, exercises: [{ exerciseId: 'e1', sets: 0, reps: { min: 8, max: 8 } }] }] })],
    ['no active plan while there are plans', { ...plans(PLAN), activePlanId: null }],
    ['an active plan while there are none', plans()],
    ['no blocks', plans({ ...PLAN, blocks: [], start: null })],
    ['two blocks with one id', plans({ ...PLAN, blocks: [BLOCK, { ...BLOCK, days: [] }] })],
    ['one day id in two blocks', plans({ ...PLAN, blocks: [BLOCK, { ...BLOCK, id: 'b2' }] })],
    ['0 weeks', withBlock({ weeks: 0, rir: [] })],
    ['53 weeks', withBlock({ weeks: 53, rir: Array(53).fill(null) })],
    ['fewer RIR targets than weeks', withBlock({ rir: [null] })],
    ['a RIR above 10', withBlock({ rir: [{ min: 5, max: 11 }, null] })],
    ['a RIR upside down', withBlock({ rir: [{ min: 6, max: 5 }, null] })],
    ['a start on a block not in the plan', plans({ ...PLAN, start: { blockId: 'b9', since: '2026-10-05' } })],
    ['a start on a bad date', plans({ ...PLAN, start: { blockId: 'b1', since: '2026-02-30' } })],
    ['no start key', plans({ id: 'p1', name: 'Força', blocks: [BLOCK] })],
    ['a version 1 plan in a version 2 document', plans(LEGACY_PLAN)],
    ['a version 1 plan with a bad day', { version: 1, plans: [{ ...LEGACY_PLAN, days: [{ ...DAY, exercises: 'x' }] }], activePlanId: 'p1' }],
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
