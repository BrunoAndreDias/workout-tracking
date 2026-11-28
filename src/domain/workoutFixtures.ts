import type { CustomEquipmentId, ExerciseId, GymId, IsoDate, LocalDateTime, WorkoutBlockId, WorkoutDayId, WorkoutPlanId, WorkoutSessionId } from './types.ts'
import { blockPosition } from './blocks.ts'
import { equipmentReducer, freshEquipment } from './equipment.ts'
import type { EquipmentAction } from './equipment.ts'
import type { TimedNote } from './notes.ts'
import { emptyWorkouts } from './workouts.ts'
import { workoutReducer } from './workoutReducer.ts'
import type { BlockOf, LoggedSet, PlanOf, PlannedExercise, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from './workouts.ts'
import type { WorkoutAction } from './workoutReducer.ts'

export const SUPINO = 'ex-supino' as ExerciseId

export const REMO = 'ex-remo' as ExerciseId

export const SQUAT = 'ex-agachamento' as ExerciseId

export const date = (s: string) => s as IsoDate

export const at = (s: string) => s as LocalDateTime

export const note = (text: string, time = '2026-05-01T21:00:00'): TimedNote => ({ text, createdAt: at(time), updatedAt: at(time) })

export const CASA = 'gym-casa' as GymId

export const ELASTICOS = 'mat:elasticos' as CustomEquipmentId

export const material = (...actions: EquipmentAction[]) => actions.reduce(equipmentReducer, freshEquipment())

export const done = (reps: number, kg: number | null, rir: number | null = null): LoggedSet => ({ done: true, reps, kg, rir })

export const pending = (reps: number | null, kg: number | null, rir: number | null = null): LoggedSet => ({ done: false, reps, kg, rir })

export const session = (id: string, on: string, exercises: WorkoutSession['exercises'], workoutDayId: string | null = null): WorkoutSession => ({
  id: id as WorkoutSessionId,
  date: date(on),
  workoutDayId: workoutDayId as WorkoutDayId | null,
  exercises,
})

export const planned = (exerciseId: ExerciseId, role: PlannedExercise['role'], sets = 3, reps = { min: 6, max: 8 }): PlannedExercise => ({ exerciseId, role, sets, reps, weeks: null, since: null })

export const PEITO: WorkoutDay = { id: 'd-peito' as WorkoutDayId, name: 'Peito', exercises: [planned(SUPINO, 'main', 4), planned(REMO, 'isolation', 2, { min: 10, max: 15 })] }

export const HISTORY = [
  session('s1', '2026-10-01', [{ exerciseId: SUPINO, sets: [done(8, 60), done(7, 60)] }]),
  session('s2', '2026-10-03', [{ exerciseId: SUPINO, sets: [done(7, 62.5, 2), done(7, 62.5, 2), pending(7, 62.5)], target: { kg: 62.5, reps: 7, rir: 2 } }]),
  session('s3', '2026-10-05', [{ exerciseId: SUPINO, sets: [pending(9, 65)] }]),
  session('s4', '2026-10-09', [{ exerciseId: SUPINO, sets: [done(10, 70)] }]),
]

export const run = (actions: WorkoutAction[], from: WorkoutState = emptyWorkouts()) => actions.reduce(workoutReducer, from)

export const P = 'p1' as WorkoutPlanId

export const B = 'b1' as WorkoutBlockId

export const S1 = 's1' as WorkoutSessionId

export const TODAY = date('2026-11-02')

export const created = run([{ type: 'createPlan', planId: P, blockId: B, name: 'Força', split: 'ppf', today: TODAY }])

export const PUSH = created.plans[0].blocks[0].days[0]

export const BENCH = PUSH.exercises[0].exerciseId

export const day = (state: WorkoutState, i = 0) => state.plans[0].blocks[0].days[i]

export const day3 = (prefix: string, exercises: ExerciseId[]): BlockOf<'ppf'>['days'] => [
  { id: `${prefix}1` as WorkoutDayId, name: `${prefix}1`, exercises: exercises.map((e) => planned(e, 'main')) },
  { id: `${prefix}2` as WorkoutDayId, name: `${prefix}2`, exercises: [] },
  { id: `${prefix}3` as WorkoutDayId, name: `${prefix}3`, exercises: [] },
]

export const block = (id: string, weeks: number, days: BlockOf<'ppf'>['days']): BlockOf<'ppf'> => ({
  id: id as WorkoutBlockId,
  name: `Bloco ${id}`,
  weeks,
  light: false,
  days,
})

export const BLOCK_A = block('A', 2, day3('a', [SQUAT, SUPINO]))

export const BLOCK_B = block('B', 1, day3('b', [SQUAT, REMO]))

export const cycle = (startOn: string | null, blocks: PlanOf<'ppf'>['blocks'] = [BLOCK_A, BLOCK_B], blockId = 'A'): WorkoutPlan => ({
  id: 'p' as WorkoutPlanId,
  name: 'Força',
  split: 'ppf',
  blocks,
  start: startOn === null ? null : { blockId: blockId as WorkoutBlockId, since: date(startOn) },
})

export const trained = (on: string, dayId: string | null = null) => session(`s-${on}`, on, [{ exerciseId: SQUAT, sets: [done(5, 100)] }], dayId)

export const where = (plan: WorkoutPlan, sessions: WorkoutSession[], on: string) => {
  const p = blockPosition(plan, sessions, date(on))
  return p && { block: p.block.name, week: p.week, movedFrom: p.movedFrom?.name ?? null }
}

export const MONDAY = '2026-10-05'
