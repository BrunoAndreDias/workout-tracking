import { isLightTarget } from './splits.ts'
import { LOAD_INCREMENT, SMALL_LOAD_BELOW, SMALL_LOAD_INCREMENT } from './workouts.ts'
import type { DoneSet, RepRange, RirTarget } from './workouts.ts'

/**
 * The suggested target for an Exercise's next session, by double progression read against the RIR Target the sets
 * aimed at (docs/research/rir-and-volume.md, docs/research/progression-rate.md).
 *
 * Each done set at the last load gives its next reps by its RIR: inside the target one more, above it (easy) two more,
 * below it but short of failure the same, and at failure (RIR 0) one fewer. A set with no RIR logged counts as on
 * target. The hardest set decides, so every set gets the same kg and reps. When the next target differs from the last,
 * the reps move by the difference between their lower ends, never up by more than two in all. Past the top of the rep
 * range the load goes up one step, below the bottom it goes down one, and the reps at the new load are re-estimated
 * with the Epley formula. Bodyweight sets (no kg) move the reps only, within the range.
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
  /** The RIR Target those sets aimed at. */
  readonly previous: RirTarget
  /** The RIR Target the next session aims at. */
  readonly next: RirTarget
  readonly range: RepRange
}

type Effort = 'failure' | 'harder' | 'on' | 'easy'

/** How a set's logged RIR compares with the target it aimed at; none logged counts as on target. */
function effort(rir: number | null, aimed: RirTarget): Effort {
  if (rir === null || (rir >= aimed.min && rir <= aimed.max)) return 'on'
  if (rir > aimed.max) return 'easy'
  return rir === 0 ? 'failure' : 'harder'
}

/** The cause the reason line names when the hardest set's effort decided. */
const WHY: Record<Effort, string> = { failure: 'Chegou à falha: ', harder: 'Mais duro do que o alvo: ', on: '', easy: 'Sobraram repetições: ' }

/** The reps each effort adds to the set's reps next time. */
const MAX_REPS_UP = 2
const STEP: Record<Effort, number> = { failure: -1, harder: 0, on: 1, easy: MAX_REPS_UP }

const clamp = (n: number, range: RepRange) => Math.min(Math.max(n, range.min), range.max)
const kgText = (kg: number) => `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`
const loadText = (kg: number | null) => (kg === null ? 'peso corporal' : kgText(kg))
const rangeText = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)
const sentence = (why: string, text: string) => (why ? why + text : text[0].toUpperCase() + text.slice(1))

/** One load step from `load`, 1 kg under 25 kg and 2,5 kg from there, so a step stays near 10% or less. Null at 0. */
export function loadStep(load: number, direction: 1 | -1): number | null {
  const step = load < SMALL_LOAD_BELOW ? SMALL_LOAD_INCREMENT : LOAD_INCREMENT
  const next = Math.round((load + direction * step) * 100) / 100
  return next > 0 ? next : null
}

/**
 * Said when the next target differs from the one the sets aimed at: into a light block, back from one, or any other
 * change, such as a new Role or a session from before RIR Targets that aimed at its single old RIR.
 */
function effortChange(previous: RirTarget, next: RirTarget): string {
  if (previous.min === next.min && previous.max === next.max) return ''
  const [wasLight, isLight] = [isLightTarget(previous), isLightTarget(next)]
  if (isLight && !wasLight) return ` Semana leve: alvo RIR ${rangeText(next)}.`
  if (wasLight && !isLight) return ` Volta ao alvo RIR ${rangeText(next)}.`
  return ` Novo alvo: RIR ${rangeText(next)}.`
}

export function suggestTarget(input: ProgressionInput): Suggestion | null {
  const last = input.sets.at(-1)
  if (!last) return null
  const { previous, next, range } = input
  const load = last.kg
  const atLoad = input.sets.filter((s) => s.kg === load)
  const moves = atLoad.map((set) => {
    const e = effort(set.rir, previous)
    return { set, effort: e, reps: set.reps + STEP[e] }
  })
  const hardest = moves.reduce((a, b) => (b.reps < a.reps ? b : a))
  const lowest = Math.min(...atLoad.map((s) => s.reps))
  const reps = Math.min(hardest.reps + previous.min - next.min, lowest + MAX_REPS_UP)
  const logged = hardest.set.rir === null ? '' : `RIR ${hardest.set.rir}, `
  const summary = `Última: ${loadText(load)} × ${atLoad.map((s) => s.reps).join('/')} · ${logged}alvo ${rangeText(previous)}.${effortChange(previous, next)}`

  const direction = reps > range.max ? 1 : reps < range.min ? -1 : 0
  const kg = load === null || direction === 0 ? null : loadStep(load, direction)
  if (kg === null) {
    const kept = clamp(reps, range)
    const same = atLoad.every((s) => s.reps === kept)
    const what = same ? `mantém ${loadText(load)} × ${kept}.` : `faz ${kept} com ${loadText(load)}.`
    return { kg: load, reps: kept, change: 'keep', note: `${summary} ${sentence(WHY[hardest.effort], what)}` }
  }
  const capacity = hardest.set.reps + (hardest.set.rir ?? previous.min)
  const oneRepMax = (load as number) * (1 + capacity / 30)
  const nextReps = clamp(Math.floor(30 * (oneRepMax / kg - 1) - next.min + 1e-6), range)
  const move = direction > 0 ? `Sobram repetições acima de ${rangeText(range)}, por isso sobe para` : `Com este esforço ficarias abaixo de ${rangeText(range)}, por isso desce para`
  return { kg, reps: nextReps, change: direction > 0 ? 'up' : 'down', note: `${summary} ${move} ${kgText(kg)} e faz ${nextReps}.` }
}
