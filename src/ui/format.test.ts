import { describe, expect, it } from 'vitest'
import { freshEquipment } from '../domain/equipment.ts'
import type { AppData } from '../domain/stores.ts'
import type { IsoDate, LocalDateTime } from '../domain/types.ts'
import { CASA, created, material, P, trained } from '../domain/workoutFixtures.ts'
import { describeBackup, formatAfterDay, formatDaysAgo, formatNoteTimes, formatPlanned } from './format.ts'

describe('pt-PT formatting', () => {
  it('writes a planned exercise', () => {
    expect(formatPlanned({ sets: 3, reps: { min: 8, max: 12 } })).toBe('3 × 8–12')
    expect(formatPlanned({ sets: 4, reps: { min: 6, max: 6 } })).toBe('4 × 6')
  })
})

describe('note times', () => {
  const note = (createdAt: string, updatedAt: string) => ({ text: 'x', createdAt: createdAt as LocalDateTime, updatedAt: updatedAt as LocalDateTime })

  it('shows only when it was written while the edit falls in the same minute', () => {
    expect(formatNoteTimes(note('2026-10-06T18:50:05', '2026-10-06T18:50:59'))).toBe('Escrito a 6 out, 18:50')
  })

  it('adds the edit time on the same day', () => {
    expect(formatNoteTimes(note('2026-10-06T18:50:05', '2026-10-06T19:02:00'))).toBe('Escrito a 6 out, 18:50 · editado 19:02')
  })

  it('repeats the date when edited on another day', () => {
    expect(formatNoteTimes(note('2026-01-31T23:59:00', '2026-02-01T00:10:00'))).toBe('Escrito a 31 jan, 23:59 · editado 1 fev, 00:10')
  })
})

describe('After-effect days', () => {
  const d = (s: string) => s as IsoDate
  it('names the day after a session, then counts days, then gives the date', () => {
    expect(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13'].map((on) => formatAfterDay(d('2026-10-06'), d(on)))).toEqual(['Dia seguinte', '2 dias depois', '3 dias depois', '13 out'])
  })

  it('says how long before a date a session was, across a month', () => {
    expect([d('2026-09-30'), d('2026-09-29')].map((on) => formatDaysAgo(on, d('2026-10-01')))).toEqual(['ontem', 'há 2 dias'])
  })
})

describe('Backup summary', () => {
  const empty: AppData = { exercises: [], workoutPlans: { plans: [], activePlanId: null }, workoutSessions: [], equipment: freshEquipment() }

  it('counts one of each in the singular', () => {
    const data: AppData = { ...empty, workoutPlans: { plans: created.plans, activePlanId: P }, workoutSessions: [trained('2026-05-01')], equipment: material({ type: 'addGym', gymId: CASA, name: 'Casa' }) }
    expect(describeBackup(data)).toBe('1 plano de treino, 1 treino, 1 local de treino')
  })

  it('counts none in the plural', () => {
    expect(describeBackup(empty)).toBe('0 planos de treino, 0 treinos, 0 locais de treino')
  })
})
