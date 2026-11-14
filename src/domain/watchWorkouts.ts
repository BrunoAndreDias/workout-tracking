import { parseIsoDate } from './dates.ts'
import type { IsoDate, WatchWorkoutId } from './types.ts'

/** One workout the Watch, or any other Health source, recorded, as read from the Health export. */
export interface WatchWorkout {
  readonly id: WatchWorkoutId
  readonly date: IsoDate
  /** 'HH:MM', as the export wrote the start. */
  readonly start: string
  /** The HKWorkoutActivityType name without its prefix, such as `TraditionalStrengthTraining`. */
  readonly activity: string
  readonly minutes: number
  readonly kcal?: number
  readonly km?: number
}

export type WatchWorkoutLog = Readonly<Record<WatchWorkoutId, WatchWorkout>>

/** The pt-PT name of each common activity; any other reads as its own name split into words. */
const ACTIVITY_LABELS: Readonly<Record<string, string>> = {
  TraditionalStrengthTraining: 'Força tradicional',
  FunctionalStrengthTraining: 'Força funcional',
  HighIntensityIntervalTraining: 'HIIT',
  Running: 'Corrida',
  Walking: 'Caminhada',
  Hiking: 'Caminhada na natureza',
  Cycling: 'Ciclismo',
  Swimming: 'Natação',
  WaterFitness: 'Hidroginástica',
  Yoga: 'Ioga',
  Pilates: 'Pilates',
  Barre: 'Barra',
  MindAndBody: 'Mente e corpo',
  Elliptical: 'Elíptica',
  Rowing: 'Remo',
  CoreTraining: 'Treino de core',
  CrossTraining: 'Treino cruzado',
  MixedCardio: 'Cardio misto',
  StairClimbing: 'Escadas',
  Stairs: 'Escadas',
  StepTraining: 'Step',
  JumpRope: 'Saltar à corda',
  Dance: 'Dança',
  CardioDance: 'Dança cardio',
  SocialDance: 'Dança social',
  Flexibility: 'Flexibilidade',
  Cooldown: 'Arrefecimento',
  Boxing: 'Boxe',
  Kickboxing: 'Kickboxing',
  MartialArts: 'Artes marciais',
  Climbing: 'Escalada',
  Tennis: 'Ténis',
  TableTennis: 'Ténis de mesa',
  Badminton: 'Badminton',
  Squash: 'Squash',
  Soccer: 'Futebol',
  Basketball: 'Basquetebol',
  Volleyball: 'Voleibol',
  Golf: 'Golfe',
  SurfingSports: 'Surf',
  DownhillSkiing: 'Esqui',
  Snowboarding: 'Snowboard',
  Other: 'Outro',
}

/** "Força tradicional"; an activity the table lacks, such as `PaddleSports`, reads "Paddle sports". */
export function activityLabel(activity: string): string {
  const label = ACTIVITY_LABELS[activity]
  if (label) return label
  const words = activity.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The log with each workout written over the one with its id: importing the same export again changes nothing. */
export function upsertWatchWorkouts(log: WatchWorkoutLog, workouts: readonly WatchWorkout[]): WatchWorkoutLog {
  const next: Record<WatchWorkoutId, WatchWorkout> = { ...log }
  for (const w of workouts) next[w.id] = w
  return next
}

export const byStart = (a: WatchWorkout, b: WatchWorkout) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id)

export const watchWorkoutsOn = (log: WatchWorkoutLog, date: IsoDate): WatchWorkout[] =>
  Object.values(log)
    .filter((w) => w.date === date)
    .sort(byStart)

export const latestWatchWorkoutDate = (log: WatchWorkoutLog): IsoDate | null =>
  Object.values(log)
    .map((w) => w.date)
    .sort()
    .at(-1) ?? null

/** What one read of an export found: each workout once, by start, and how many Workout elements could not be read. */
export interface ExportRead {
  readonly workouts: readonly WatchWorkout[]
  readonly skipped: number
}

const MINUTES: Readonly<Record<string, number>> = { min: 1, s: 1 / 60, hr: 60, h: 60 }
const KCAL: Readonly<Record<string, number>> = { kcal: 1, Cal: 1, cal: 1 / 1000, kJ: 1 / 4.184, J: 1 / 4184 }
const KM: Readonly<Record<string, number>> = { km: 1, m: 1 / 1000, cm: 1 / 100_000, mi: 1.609344, yd: 0.0009144, ft: 0.0003048 }

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits

function convert(value: string | undefined, unit: string | undefined, factors: Readonly<Record<string, number>>): number | null {
  const factor = unit === undefined ? undefined : factors[unit]
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return factor !== undefined && Number.isFinite(n) && n >= 0 ? n * factor : null
}

const START = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/
const ACTIVITY_PREFIX = 'HKWorkoutActivityType'
const ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned'
const DISTANCE = 'HKQuantityTypeIdentifierDistance'

type Attributes = Readonly<Record<string, string>>

const attributes = (tag: string): Attributes => Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [m[1], m[2] ?? m[3]]))

/** The index just past the `>` that closes the tag opened at `from`, skipping quoted values, or -1 when it is not in `text` yet. */
function tagEnd(text: string, from: number): number {
  let quote = ''
  for (let i = from + 1; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '>') return i + 1
  }
  return -1
}

const CLOSE = '</Workout>'

function elementEnd(text: string, from: number): number {
  const tag = tagEnd(text, from)
  if (tag === -1 || text[tag - 2] === '/') return tag
  const close = text.indexOf(CLOSE, tag)
  return close === -1 ? -1 : close + CLOSE.length
}

/** One `<Workout …>…</Workout>` element, or null when it lacks a readable activity, start or duration. */
function readWorkout(element: string): WatchWorkout | null {
  const open = tagEnd(element, 0)
  const at = attributes(element.slice(0, open))
  const activity = at.workoutActivityType?.startsWith(ACTIVITY_PREFIX) ? at.workoutActivityType.slice(ACTIVITY_PREFIX.length) : ''
  const start = START.exec(at.startDate ?? '')
  const date = start && parseIsoDate(start[1])
  const minutes = convert(at.duration, at.durationUnit, MINUTES)
  if (!activity || !start || !date || minutes === null) return null

  const [, , hh, mm, ss, sign, oh, om] = start
  const offset = (sign === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om))
  const instant = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(hh), Number(mm) - offset, Number(ss))
  const id = `${new Date(instant).toISOString().slice(0, 19)}Z ${activity}` as WatchWorkoutId

  // A multisport workout repeats statistics per leg inside WorkoutActivity; the workout's own totals sit outside them.
  const body = element.slice(open).replace(/<WorkoutActivity\b[\s\S]*?<\/WorkoutActivity>/g, '')
  const stats = [...body.matchAll(/<WorkoutStatistics\b[^>]*>/g)].map((m) => attributes(m[0]))
  const energy = stats.find((s) => s.type === ENERGY)
  const kcal = energy ? convert(energy.sum, energy.unit, KCAL) : convert(at.totalEnergyBurned, at.totalEnergyBurnedUnit, KCAL)
  const distances = stats.filter((s) => s.type?.startsWith(DISTANCE)).map((s) => convert(s.sum, s.unit, KM) ?? 0)
  const km = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) : convert(at.totalDistance, at.totalDistanceUnit, KM)
  return {
    id,
    date,
    start: `${hh}:${mm}`,
    activity,
    minutes: round(minutes, 1),
    ...(kcal ? { kcal: round(kcal, 1) } : {}),
    ...(km ? { km: round(km, 2) } : {}),
  }
}

const OPEN = /<Workout[\s/>]/g
/** A real Workout element is a few kB; one that never closes must not keep the rest of a multi-GB file in memory. */
const MAX_ELEMENT = 4 * 1024 * 1024

/**
 * Reads the Workouts of the Health export's export.xml from its text in chunks of any size, holding only the current
 * partial element, since the file can be gigabytes. A Workout that cannot be read is counted and skipped.
 */
export function exportReader(): { push(chunk: string): void; finish(): ExportRead } {
  let buffer = ''
  let skipped = 0
  const found = new Map<WatchWorkoutId, WatchWorkout>()

  function drain(final: boolean) {
    let at = 0
    for (;;) {
      OPEN.lastIndex = at
      const open = OPEN.exec(buffer)
      if (!open) {
        at = Math.max(at, buffer.length - '<Workout'.length)
        break
      }
      const end = elementEnd(buffer, open.index)
      if (end === -1) {
        if (!final && buffer.length - open.index <= MAX_ELEMENT) {
          at = open.index
          break
        }
        skipped++
        at = open.index + 1
        continue
      }
      const workout = readWorkout(buffer.slice(open.index, end))
      if (workout) found.set(workout.id, workout)
      else skipped++
      at = end
    }
    buffer = final ? '' : buffer.slice(at)
  }

  return {
    push(chunk) {
      buffer += chunk
      drain(false)
    },
    finish() {
      drain(true)
      return { workouts: [...found.values()].sort(byStart), skipped }
    },
  }
}
