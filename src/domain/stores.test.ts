import { describe, expect, it } from 'vitest'
import type { TimedNote } from './notes.ts'
import type { ExerciseId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import type { PlannedExercise, WorkoutPlan, WorkoutSession } from './workouts.ts'
import { loadStore, saveStore, STORES } from './stores.ts'

function written(save: (storage: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }) => boolean): Record<string, string> {
  const data: Record<string, string> = {}
  expect(save({ getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) })).toBe(true)
  return data
}

const at = (s: string) => s as LocalDateTime
const note = (text: string, time: string): TimedNote => ({ text, createdAt: at(time), updatedAt: at(time) })
describe('the text each store writes', () => {
  it('exercises', () => {
    expect(written((s) => saveStore(STORES.exercises, [{ id: 'x1' as ExerciseId, name: 'Supino' }], s))).toMatchInlineSnapshot(`
      {
        "workout-tracking:exercises": "{"version":1,"exercises":[{"id":"x1","name":"Supino"}]}",
      }
    `)
  })

  it('workout plans', () => {
    const day = (id: string, exercises: PlannedExercise[] = []) => ({ id: id as WorkoutDayId, name: id, exercises })
    const days = [day('Push', [{ exerciseId: 'x1' as ExerciseId, role: 'main', sets: 3, reps: { min: 6, max: 8 }, weeks: null, since: null }]), day('Pull'), day('Full body')] as const
    const blocks = [{ id: 'wb1' as WorkoutBlockId, name: 'Bloco A', weeks: 2, rir: [{ min: 5, max: 6 }, null], days }] as const
    const plans: WorkoutPlan[] = [{ id: 'wp1' as WorkoutPlanId, name: 'Força', split: 'ppf', blocks, start: { blockId: 'wb1' as WorkoutBlockId, since: '2026-10-05' as IsoDate } }]
    expect(written((s) => saveStore(STORES.workoutPlans, { plans, activePlanId: 'wp1' as WorkoutPlanId }, s))).toMatchInlineSnapshot(`
      {
        "workout-tracking:workout-plans": "{"version":3,"plans":[{"id":"wp1","name":"Força","split":"ppf","blocks":[{"id":"wb1","name":"Bloco A","weeks":2,"rir":[{"min":5,"max":6},null],"days":[{"id":"Push","name":"Push","exercises":[{"exerciseId":"x1","role":"main","sets":3,"reps":{"min":6,"max":8},"weeks":null,"since":null}]},{"id":"Pull","name":"Pull","exercises":[]},{"id":"Full body","name":"Full body","exercises":[]}]}],"start":{"blockId":"wb1","since":"2026-10-05"}}],"activePlanId":"wp1"}",
      }
    `)
  })

  it('workout sessions', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1' as WorkoutSessionId,
        date: '2026-10-05' as IsoDate,
        workoutDayId: 'wd1' as WorkoutDayId,
        exercises: [{ exerciseId: 'x1' as ExerciseId, sets: [{ done: true, reps: 10, kg: 42.5, rir: 2 }, { done: false, reps: null, kg: null, rir: null }], target: { kg: 42.5, reps: 10, rir: 2 }, note: note('Ombro bem', '2026-10-05T18:00:00') }],
        note: note('Bom treino', '2026-10-05T18:30:00'),
      },
    ]
    expect(written((s) => saveStore(STORES.workoutSessions, sessions, s))).toMatchInlineSnapshot(`
      {
        "workout-tracking:workout-sessions": "{"version":3,"sessions":[{"id":"s1","date":"2026-10-05","workoutDayId":"wd1","exercises":[{"exerciseId":"x1","sets":[{"done":true,"reps":10,"kg":42.5,"rir":2},{"done":false,"reps":null,"kg":null,"rir":null}],"target":{"kg":42.5,"reps":10,"rir":2},"note":{"text":"Ombro bem","createdAt":"2026-10-05T18:00:00","updatedAt":"2026-10-05T18:00:00"}}],"note":{"text":"Bom treino","createdAt":"2026-10-05T18:30:00","updatedAt":"2026-10-05T18:30:00"}}]}",
      }
    `)
  })

  it('health, sorted by date then metric', () => {
    const health = { ['2026-10-05' as IsoDate]: { steps: 8000, standHours: 10 }, ['2026-10-04' as IsoDate]: { restingHeartRate: 58 } }
    expect(written((s) => saveStore(STORES.health, health, s))).toMatchInlineSnapshot(`
      {
        "workout-tracking:health": "{"version":1,"samples":[{"date":"2026-10-04","metric":"restingHeartRate","value":58},{"date":"2026-10-05","metric":"standHours","value":10},{"date":"2026-10-05","metric":"steps","value":8000}]}",
      }
    `)
  })
})

describe('saving a store as the app starts', () => {
  const storageWith = (data: Record<string, string>) => {
    const writes: string[] = []
    return { writes, data, storage: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (writes.push(k), (data[k] = v)), removeItem: (k: string) => void delete data[k] } }
  }
  const HEALTH_TEXT = '{"version":1,"samples":[{"date":"2026-10-05","metric":"steps","value":8000}]}'

  it('leaves a store read at the current version as it was read, until it changes', () => {
    const { writes, data, storage } = storageWith({ [STORES.health.key]: HEALTH_TEXT })
    const health = loadStore(STORES.health, storage)
    expect(saveStore(STORES.health, health, storage)).toBe(true)
    expect(writes).toEqual([])
    expect(data[STORES.health.key]).toBe(HEALTH_TEXT)
    saveStore(STORES.health, { ...health, ['2026-10-06' as IsoDate]: { steps: 2 } }, storage)
    expect(data[STORES.health.key]).toBe('{"version":1,"samples":[{"date":"2026-10-05","metric":"steps","value":8000},{"date":"2026-10-06","metric":"steps","value":2}]}')
  })

  it('writes the read value again once the stored text is another', () => {
    const { data, storage } = storageWith({ [STORES.health.key]: HEALTH_TEXT })
    const health = loadStore(STORES.health, storage)
    data[STORES.health.key] = '{"version":1,"samples":[]}'
    saveStore(STORES.health, health, storage)
    expect(data[STORES.health.key]).toBe(HEALTH_TEXT)
  })

  it('writes a store read at an older version in the current one', () => {
    const { data, storage } = storageWith({ [STORES.workoutSessions.key]: JSON.stringify({ version: 1, sessions: [{ id: 's1', date: '2026-10-05', workoutDayId: null, exercises: [], notes: 'Bom treino' }] }) })
    saveStore(STORES.workoutSessions, loadStore(STORES.workoutSessions, storage), storage)
    expect(JSON.parse(data[STORES.workoutSessions.key]).version).toBe(3)
  })
})
