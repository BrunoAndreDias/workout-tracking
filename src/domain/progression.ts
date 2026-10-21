import type { DoneSet, RepRange } from './workouts.ts'

/**
 * The suggested target for an Exercise's next session, by double progression, ported from just-workout.
 *
 * A set's rep capacity is its reps plus its reps in reserve (the RIR aimed at when none was logged). The next reps are
 * that capacity minus the next RIR, so a set harder than planned lowers them and one with reps to spare raises them.
 * Past the top of the rep range the load goes up one increment, below the bottom it goes down, and the reps at the new
 * load are re-estimated with the Epley formula. Bodyweight sets (no kg) move the reps only.
 */
export interface Suggestion {
  readonly kg: number | null
  readonly reps: number
  readonly change: 'up' | 'keep' | 'down'
  readonly note: string
}

export interface ProgressionInput {
  /** The done sets of the last session that had any. */
  readonly sets: readonly DoneSet[]
  /** The RIR those sets aimed at. */
  readonly previousRir: number
  readonly nextRir: number
  readonly range: RepRange
  readonly increment: number
}

const MAX_LOAD_STEPS = 4

const clamp = (n: number, range: RepRange) => Math.min(Math.max(n, range.min), range.max)
const round = (kg: number, increment: number) => Math.round(kg / increment) * increment
const kgText = (kg: number) => `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`
const loadText = (kg: number | null) => (kg === null ? 'peso corporal' : kgText(kg))
const rangeText = (r: RepRange) => `${r.min}–${r.max}`

function stepLoad(load: number, direction: 1 | -1, capacity: number, input: ProgressionInput): { kg: number; reps: number } | null {
  const oneRepMax = load * (1 + capacity / 30)
  const repsAt = (kg: number) => Math.floor(30 * (oneRepMax / kg - 1) - input.nextRir + 1e-6)
  let kg = load
  for (let step = 0; step < MAX_LOAD_STEPS; step++) {
    const next = round(kg + direction * input.increment, input.increment)
    if (next <= 0) break
    const reps = repsAt(next)
    if (direction > 0 && reps < input.range.min) break
    kg = next
    if (direction > 0 ? reps <= input.range.max : reps >= input.range.min) break
  }
  return kg === load ? null : { kg, reps: clamp(repsAt(kg), input.range) }
}

function effortChange(previous: number, next: number): string {
  if (next > previous) return ` Semana mais leve: RIR ${next} (era ${previous}).`
  if (next < previous) return ` Mais esforço: RIR ${next} (era ${previous}).`
  return ''
}

export function suggestTarget(input: ProgressionInput): Suggestion | null {
  const last = input.sets.at(-1)
  if (!last) return null
  const { previousRir, nextRir, range } = input
  const load = last.kg
  const atLoad = input.sets.filter((s) => s.kg === load)
  const capacity = Math.min(...atLoad.map((s) => s.reps + (s.rir ?? previousRir)))
  const harder = atLoad.some((s) => s.rir !== null && s.rir < previousRir)
  const nudge = !harder && nextRir === previousRir ? 1 : 0
  const reps = capacity - nextRir + nudge
  const rirs = atLoad.flatMap((s) => (s.rir === null ? [] : [s.rir]))
  const summary = `Última: ${loadText(load)} × ${atLoad.map((s) => s.reps).join('/')}${rirs.length > 0 ? ` · RIR ${Math.min(...rirs)}` : ''}.${effortChange(previousRir, nextRir)}`

  if (reps >= range.min && reps <= range.max) {
    const why = harder ? ` Foi mais duro do que o RIR ${previousRir} pedido.` : ''
    return { kg: load, reps, change: 'keep', note: `${summary}${why} Faz ${reps} com ${loadText(load)}.` }
  }
  const direction = reps > range.max ? 1 : -1
  const stepped = load === null ? null : stepLoad(load, direction, capacity, input)
  if (!stepped) {
    const kept = clamp(reps, range)
    return { kg: load, reps: kept, change: 'keep', note: `${summary} Faz ${kept} com ${loadText(load)}.` }
  }
  const why = direction > 0 ? `Sobram repetições acima de ${rangeText(range)}, por isso sobe para` : `Com este esforço ficarias abaixo de ${rangeText(range)}, por isso desce para`
  return { kg: stepped.kg, reps: stepped.reps, change: direction > 0 ? 'up' : 'down', note: `${summary} ${why} ${kgText(stepped.kg)} e faz ${stepped.reps}.` }
}
