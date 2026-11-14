import { describe, expect, it } from 'vitest'
import { describeBackup, mergeBackup, parseBackup, writeAll } from './backup.ts'
import MEAL_APP_BACKUP from './fixtures/meal-app-backup.json'
import { loadAll, STORES } from './stores.ts'

function memoryStorage() {
  const data: Record<string, string> = {}
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] }
}

/** The fixture is a full Backup the meal app exported with its own code, before this app was split from it. */
describe('a Backup from the meal app', () => {
  it('brings in the workout, material and watch stores and ignores its food, day, sleep and mood stores', () => {
    const r = parseBackup(MEAL_APP_BACKUP)
    if (!r.ok) throw new Error(r.error)
    expect(describeBackup(r.data)).toBe('1 plano de treino, 1 treino, 3 valores do relógio, 1 treino do relógio, 1 local de treino')
    expect(r.data.exercises).toEqual([{ id: 'ex-supino', name: 'Supino' }])
    const [session] = r.data.workoutSessions
    expect([session.feel, session.note?.text, session.after?.map((a) => a.note.text)]).toEqual([4, 'Bom treino', ['Peito dorido']])
    expect(Object.keys(r.data)).toEqual(Object.keys(STORES))
  })

  it('merged into an empty app, writes only this app’s stores under its own keys', () => {
    const storage = memoryStorage()
    const r = parseBackup(MEAL_APP_BACKUP)
    if (!r.ok) throw new Error(r.error)
    expect(writeAll(mergeBackup(loadAll(storage), r.data), storage)).toEqual({ ok: true })
    expect(Object.keys(storage.data).sort()).toEqual(Object.values(STORES).map((s) => s.key).sort())
    expect(Object.keys(storage.data).every((k) => k.startsWith('workout-tracking:'))).toBe(true)
    expect(loadAll(storage)).toEqual(r.data)
  })

  it('still rejects the file when a workout store in it is damaged', () => {
    const damaged = { ...MEAL_APP_BACKUP, stores: { ...MEAL_APP_BACKUP.stores, workoutSessions: { version: 3, sessions: 'x' } } }
    expect(parseBackup(damaged)).toEqual({ ok: false, error: 'A cópia de segurança está danificada: os dados de treinos não são válidos. Não foi alterado nada.' })
  })
})
