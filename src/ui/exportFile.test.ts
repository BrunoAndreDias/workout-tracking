import { describe, expect, it } from 'vitest'
import { exportProblem } from './exportFile.ts'

describe('export result', () => {
  it('says nothing when every store went into the file', () => {
    expect(exportProblem({ ok: true, skipped: [] })).toBeNull()
  })

  it('names each store left out of the file', () => {
    expect(exportProblem({ ok: true, skipped: ['workoutPlans', 'equipment'] })).toBe(
      'Não foi possível exportar: planos de treino, material. Os dados guardados no navegador não são válidos e ficaram de fora do ficheiro.',
    )
  })

  it('shows the failure of an export that threw', () => {
    expect(exportProblem({ ok: false, error: 'Não foi possível exportar os dados.' })).toBe('Não foi possível exportar os dados.')
  })
})
