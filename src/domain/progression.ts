import { kgText, rangeText, roundKg } from './numbers.ts'
import { inTarget, LOAD_INCREMENT, SMALL_LOAD_BELOW, SMALL_LOAD_INCREMENT } from './workouts.ts'
import type { DoneSet, RepRange, RirTarget } from './workouts.ts'

export interface Suggestion {
  readonly kg: number | null
  readonly reps: number
  readonly change: 'up' | 'keep' | 'down'
  readonly note: string
}

export interface ProgressionInput {
  /** The done sets of the last session that had any. */
  readonly sets: readonly DoneSet[]
  readonly previous: RirTarget
  readonly next: RirTarget
  readonly range: RepRange
}

type Effort = 'failure' | 'harder' | 'on' | 'easy'

function effort(rir: number | null, aimed: RirTarget): Effort {
  if (rir === null || inTarget(rir, aimed)) return 'on'
  if (rir > aimed.max) return 'easy'
  return rir === 0 ? 'failure' : 'harder'
}

const CAUSE: Record<Effort, string> = { failure: 'Chegou à falha: ', harder: 'Mais duro do que o alvo: ', on: '', easy: 'Sobraram repetições: ' }

const MAX_REPS_UP = 2
const EPLEY_REPS = 30
const STEP: Record<Effort, number> = { failure: -1, harder: 0, on: 1, easy: MAX_REPS_UP }

const clamp = (n: number, range: RepRange) => Math.min(Math.max(n, range.min), range.max)
const loadText = (kg: number | null) => (kg === null ? 'peso corporal' : kgText(kg))
const sentence = (cause: string, text: string) => (cause ? cause + text : text[0].toUpperCase() + text.slice(1))

function loadStep(load: number, direction: 1 | -1): number | null {
  const step = load < SMALL_LOAD_BELOW ? SMALL_LOAD_INCREMENT : LOAD_INCREMENT
  const next = roundKg(load + direction * step)
  return next > 0 ? next : null
}

function effortChange(previous: RirTarget, next: RirTarget): string {
  if (next.light && !previous.light) return ` Semana leve: alvo RIR ${rangeText(next)}.`
  if (previous.light && !next.light) return ` Volta ao alvo RIR ${rangeText(next)}.`
  if (previous.min === next.min && previous.max === next.max) return ''
  return ` Novo alvo: RIR ${rangeText(next)}.`
}

export function suggestTarget(input: ProgressionInput): Suggestion | null {
  const last = input.sets.at(-1)
  if (!last) return null
  const { previous, next, range } = input
  const load = last.kg
  const atLoad = input.sets.filter((s) => s.kg === load)
  const moves = atLoad.map((set) => {
    const setEffort = effort(set.rir, previous)
    return { set, effort: setEffort, reps: set.reps + STEP[setEffort] }
  })
  const hardest = moves.reduce((a, b) => (b.reps < a.reps ? b : a))
  const lowest = Math.min(...atLoad.map((s) => s.reps))
  const reps = Math.min(hardest.reps + previous.min - next.min, lowest + MAX_REPS_UP)
  const logged = hardest.set.rir === null ? '' : `RIR ${hardest.set.rir}, `
  const summary = `Última: ${loadText(load)} × ${atLoad.map((s) => s.reps).join('/')} · ${logged}alvo ${rangeText(previous)}.${effortChange(previous, next)}`

  const direction = reps > range.max ? 1 : reps < range.min ? -1 : 0
  const kg = load === null || direction === 0 ? null : loadStep(load, direction)
  if (load === null || kg === null) {
    const kept = clamp(reps, range)
    const repsUnchanged = atLoad.every((s) => s.reps === kept)
    const advice = repsUnchanged ? `mantém ${loadText(load)} × ${kept}.` : `faz ${kept} com ${loadText(load)}.`
    return { kg: load, reps: kept, change: 'keep', note: `${summary} ${sentence(CAUSE[hardest.effort], advice)}` }
  }
  const capacity = hardest.set.reps + (hardest.set.rir ?? previous.min)
  const oneRepMax = load * (1 + capacity / EPLEY_REPS)
  const nextReps = clamp(Math.floor(EPLEY_REPS * (oneRepMax / kg - 1) - next.min + 1e-6), range)
  const move = direction > 0 ? `Sobram repetições acima de ${rangeText(range)}, por isso sobe para` : `Com este esforço ficarias abaixo de ${rangeText(range)}, por isso desce para`
  return { kg, reps: nextReps, change: direction > 0 ? 'up' : 'down', note: `${summary} ${move} ${kgText(kg)} e faz ${nextReps}.` }
}
