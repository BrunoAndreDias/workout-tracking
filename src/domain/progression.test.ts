import { describe, expect, it } from 'vitest'
import { suggestTarget } from './progression.ts'
import type { DoneSet, RepRange, RirTarget } from './workouts.ts'

const MAIN = { min: 6, max: 8 }
const ISOLATION = { min: 10, max: 15 }
const TWO: RirTarget = { min: 2, max: 2, light: false }
const ONE_TO_THREE: RirTarget = { min: 1, max: 3, light: false }
const sets = (kg: number | null, reps: number[], rir: number | null): DoneSet[] => reps.map((r) => ({ done: true, kg, reps: r, rir }))
const note = (done: DoneSet[], previous: RirTarget, range: RepRange, next = previous) => suggestTarget({ sets: done, previous, next, range })?.note

describe('the Suggested Target’s reason line', () => {
  it('names the hardest logged RIR and the target, and the cause when it decided', () => {
    expect(note(sets(60, [8], 1), TWO, MAIN)).toBe('Última: 60 kg × 8 · RIR 1, alvo 2. Mais duro do que o alvo: mantém 60 kg × 8.')
    expect(note(sets(60, [8], 0), TWO, { min: 6, max: 10 })).toBe('Última: 60 kg × 8 · RIR 0, alvo 2. Chegou à falha: faz 7 com 60 kg.')
    expect(note(sets(10, [11], 5), ONE_TO_THREE, ISOLATION)).toBe('Última: 10 kg × 11 · RIR 5, alvo 1–3. Sobraram repetições: faz 13 com 10 kg.')
    expect(note(sets(60, [8, 8], 2), TWO, { min: 8, max: 10 })).toBe('Última: 60 kg × 8/8 · RIR 2, alvo 2. Faz 9 com 60 kg.')
    expect(note(sets(60, [8, 8, 8], 2), TWO, MAIN)).toBe('Última: 60 kg × 8/8/8 · RIR 2, alvo 2. Sobram repetições acima de 6–8, por isso sobe para 62,5 kg e faz 6.')
  })

  it('names the RIR of the set that decided, not the lowest RIR logged', () => {
    const decided: DoneSet[] = [{ done: true, kg: 60, reps: 6, rir: 2 }, { done: true, kg: 60, reps: 8, rir: 1 }]
    expect(note(decided, TWO, MAIN)).toBe('Última: 60 kg × 6/8 · RIR 2, alvo 2. Faz 7 com 60 kg.')
  })

  it('names only the target when the deciding set has no RIR logged, and names a bodyweight load', () => {
    expect(note(sets(62.5, [7], null), TWO, MAIN)).toBe('Última: 62,5 kg × 7 · alvo 2. Faz 8 com 62,5 kg.')
    expect(note(sets(null, [8], 2), TWO, MAIN)).toBe('Última: peso corporal × 8 · RIR 2, alvo 2. Mantém peso corporal × 8.')
  })

  it('says when the load comes down', () => {
    expect(note(sets(80, [6, 5], 0), TWO, MAIN)).toBe('Última: 80 kg × 6/5 · RIR 0, alvo 2. Com este esforço ficarias abaixo de 6–8, por isso desce para 77,5 kg e faz 6.')
  })

  it('names a light week’s target on the way in and the normal target on the way back', () => {
    const LIGHT_MAIN: RirTarget = { min: 4, max: 4, light: true }
    expect(note(sets(60, [7], 2), TWO, MAIN, LIGHT_MAIN)).toBe('Última: 60 kg × 7 · RIR 2, alvo 2. Semana leve: alvo RIR 4. Faz 6 com 60 kg.')
    expect(note(sets(12, [11], 4), { min: 3, max: 5, light: true }, ISOLATION, ONE_TO_THREE)).toBe('Última: 12 kg × 11 · RIR 4, alvo 3–5. Volta ao alvo RIR 1–3. Faz 13 com 12 kg.')
  })

  it('calls any other change of target a new target, such as a session from before RIR Targets that aimed at its single old RIR', () => {
    expect(note(sets(60, [7], 0), { min: 0, max: 0, light: false }, MAIN, TWO)).toBe('Última: 60 kg × 7 · RIR 0, alvo 0. Novo alvo: RIR 2. Faz 6 com 60 kg.')
    expect(note(sets(60, [7], 3), { min: 3, max: 3, light: false }, MAIN, TWO)).toBe('Última: 60 kg × 7 · RIR 3, alvo 3. Novo alvo: RIR 2. Sobram repetições acima de 6–8, por isso sobe para 62,5 kg e faz 6.')
    expect(note(sets(60, [7], 2), ONE_TO_THREE, MAIN, TWO)).toBe('Última: 60 kg × 7 · RIR 2, alvo 1–3. Novo alvo: RIR 2. Mantém 60 kg × 7.')
  })

  it('names kg with up to two decimals, trimmed', () => {
    expect(note(sets(61.25, [7], null), TWO, MAIN)).toBe('Última: 61,25 kg × 7 · alvo 2. Faz 8 com 61,25 kg.')
    expect(note(sets(61.25, [8, 8, 8], 2), TWO, MAIN)).toBe('Última: 61,25 kg × 8/8/8 · RIR 2, alvo 2. Sobram repetições acima de 6–8, por isso sobe para 63,75 kg e faz 6.')
    expect(note(sets(61.257, [7], null), TWO, MAIN)).toBe('Última: 61,26 kg × 7 · alvo 2. Faz 8 com 61,26 kg.')
  })

  it('suggests nothing without done sets', () => {
    expect(suggestTarget({ sets: [], previous: TWO, next: TWO, range: MAIN })).toBe(null)
  })
})
