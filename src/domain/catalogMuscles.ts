import type { Activation, Region } from './anatomy.ts'
import type { CatalogId } from './catalogEntries.ts'

const a = (target: readonly Region[], assist: readonly Region[] = []): Activation => ({ target, assist })

const flatPress = a(['chest'], ['delt-front', 'triceps'])
const inclinePress = a(['chest-upper'], ['chest', 'delt-front', 'triceps'])
const pushUp = a(['chest'], ['delt-front', 'triceps', 'abs'])
const verticalPull = a(['lats'], ['upper-back', 'delt-rear', 'biceps', 'forearms'])
const underhandPull = a(['lats', 'biceps'], ['upper-back', 'forearms'])
const freeRow = a(['lats', 'upper-back'], ['delt-rear', 'biceps', 'lower-back', 'forearms'])
const supportedRow = a(['upper-back', 'lats'], ['delt-rear', 'biceps', 'forearms'])
const shrug = a(['traps'], ['forearms'])
const seatedPress = a(['delt-front'], ['delt-side', 'triceps', 'chest-upper'])
const standingPress = a(['delt-front'], ['delt-side', 'triceps', 'chest-upper', 'abs'])
const uprightRow = a(['delt-side', 'traps'], ['delt-front', 'biceps'])
const lateralRaise = a(['delt-side'], ['traps'])
const frontRaise = a(['delt-front'], ['chest-upper', 'delt-side'])
const rearDeltRow = a(['delt-rear'], ['upper-back', 'biceps'])
const rearDeltRaise = a(['delt-rear'], ['upper-back'])
const backSquat = a(['quads', 'glutes'], ['adductors', 'lower-back'])
const frontSquat = a(['quads'], ['glutes', 'abs', 'upper-back'])
const singleLeg = a(['quads', 'glutes'], ['adductors', 'hamstrings'])
const legPress = a(['quads'], ['glutes', 'adductors'])
const hinge = a(['hamstrings', 'glutes'], ['lower-back', 'adductors', 'forearms'])
const sumo = a(['glutes', 'hamstrings', 'adductors'], ['quads', 'lower-back', 'traps', 'forearms'])
const curl = a(['biceps'], ['forearms'])
const closePress = a(['triceps'], ['chest', 'delt-front'])
const extension = a(['triceps'])
const crunch = a(['abs'], ['obliques'])

/** What each catalog Exercise works, by its id. */
export const CATALOG_MUSCLES: Readonly<Record<CatalogId, Activation>> = {
  'flat-barbell-bench-press': flatPress,
  'flat-dumbbell-bench-press': flatPress,
  'incline-barbell-bench-press': inclinePress,
  'incline-dumbbell-bench-press': inclinePress,
  'decline-barbell-bench-press': a(['chest'], ['triceps', 'delt-front']),
  'decline-dumbbell-bench-press': a(['chest'], ['triceps', 'delt-front']),
  'flat-chest-press-machine': flatPress,
  'incline-chest-press-machine': inclinePress,
  'decline-chest-press-machine': a(['chest'], ['triceps', 'delt-front']),
  'dips-parallel-bars-slight-forward-lean': a(['chest'], ['triceps', 'delt-front']),
  'push-ups': pushUp,
  'flat-dumbbell-flyes': a(['chest'], ['delt-front']),
  'incline-dumbbell-flyes': a(['chest-upper'], ['delt-front', 'chest']),
  'decline-dumbbell-flyes': a(['chest'], ['delt-front']),
  'pec-deck-machine': a(['chest'], ['delt-front']),
  'cable-crossovers-cable-flyes': a(['chest'], ['chest-upper', 'delt-front']),
  'pull-ups': verticalPull,
  'chin-ups': underhandPull,
  'lat-pull-downs': verticalPull,
  'neutral-grip-pulldown': a(['lats'], ['biceps', 'upper-back', 'forearms']),
  'assisted-pull-up': verticalPull,
  'wide-grip-lat-pulldown': a(['lats'], ['upper-back', 'delt-rear', 'biceps']),
  'close-grip-lat-pulldown': a(['lats'], ['biceps', 'upper-back', 'forearms']),
  'reverse-grip-lat-pulldown': underhandPull,
  'close-neutral-grip-pulldown': a(['lats'], ['biceps', 'upper-back', 'forearms']),
  'medium-grip-lat-pulldown': verticalPull,
  'bent-over-barbell-rows': freeRow,
  'bent-over-dumbbell-rows': a(['lats', 'upper-back'], ['delt-rear', 'biceps', 'forearms']),
  't-bar-rows': freeRow,
  'seated-cable-rows': supportedRow,
  'chest-supported-barbell-rows': supportedRow,
  'chest-supported-dumbbell-rows': supportedRow,
  'chest-supported-machine-rows': supportedRow,
  'inverted-rows': a(['upper-back', 'lats'], ['delt-rear', 'biceps', 'abs']),
  'barbell-shrugs': shrug,
  'dumbbell-shrugs': shrug,
  'machine-shrugs': shrug,
  'seated-overhead-barbell-press': seatedPress,
  'seated-overhead-dumbbell-press': seatedPress,
  'standing-overhead-barbell-press': standingPress,
  'standing-overhead-dumbbell-press': standingPress,
  'overhead-machine-press': seatedPress,
  'arnold-press': a(['delt-front', 'delt-side'], ['triceps', 'chest-upper']),
  'barbell-upright-rows': uprightRow,
  'dumbbell-upright-rows': uprightRow,
  'machine-upright-rows': uprightRow,
  'dumbbell-lateral-raises': lateralRaise,
  'cable-lateral-raises': lateralRaise,
  'machine-lateral-raises': lateralRaise,
  'dumbbell-front-raises': frontRaise,
  'cable-front-raises': frontRaise,
  'machine-front-raises': frontRaise,
  'barbell-rear-delt-rows': rearDeltRow,
  'dumbbell-rear-delt-rows': rearDeltRow,
  'machine-rear-delt-rows': rearDeltRow,
  'dumbbell-rear-delt-raises': rearDeltRaise,
  'machine-rear-delt-raises': rearDeltRaise,
  'dumbbell-rear-delt-flyes': rearDeltRaise,
  'machine-rear-delt-flyes': rearDeltRaise,
  'barbell-squats': backSquat,
  'dumbbell-squats': a(['quads', 'glutes'], ['adductors', 'forearms']),
  'barbell-front-squats': frontSquat,
  'dumbbell-front-squats': a(['quads'], ['glutes', 'abs', 'adductors']),
  'barbell-split-squats': singleLeg,
  'dumbbell-split-squats': singleLeg,
  'barbell-lunges': singleLeg,
  'dumbbell-lunges': singleLeg,
  'barbell-step-ups': singleLeg,
  'dumbbell-step-ups': singleLeg,
  'leg-press': legPress,
  'single-leg-press': legPress,
  'machine-squat-hack-squat': a(['quads'], ['glutes', 'adductors']),
  'leg-extensions': a(['quads']),
  'barbell-romanian-deadlifts': hinge,
  'dumbbell-romanian-deadlifts': hinge,
  'barbell-straight-leg-deadlifts': hinge,
  'dumbbell-straight-leg-deadlifts': hinge,
  'barbell-sumo-deadlifts': sumo,
  'dumbbell-sumo-deadlifts': sumo,
  'glute-ham-raises': a(['hamstrings'], ['glutes', 'calves']),
  hyperextensions: a(['glutes', 'hamstrings'], ['lower-back']),
  'cable-pull-throughs': a(['glutes', 'hamstrings'], ['lower-back', 'adductors']),
  'good-mornings': a(['hamstrings', 'lower-back'], ['glutes', 'adductors']),
  'leg-curls': a(['hamstrings'], ['calves']),
  'standing-calf-raises': a(['calves']),
  'standing-barbell-curls': curl,
  'standing-dumbbell-curls': curl,
  'barbell-preacher-curls': curl,
  'dumbbell-preacher-curls': curl,
  'seated-dumbbell-curls': curl,
  'incline-dumbbell-curls': curl,
  'hammer-curls': a(['biceps', 'forearms']),
  'concentration-curls': curl,
  'cable-curls': curl,
  'biceps-curl-machine': curl,
  'dips-elbows-close-no-forward-lean': a(['triceps'], ['chest', 'delt-front']),
  'flat-close-grip-bench-press': closePress,
  'decline-close-grip-bench-press': closePress,
  'close-grip-push-ups': a(['triceps'], ['chest', 'delt-front', 'abs']),
  'laying-barbell-triceps-extensions': extension,
  'laying-dumbbell-triceps-extensions': extension,
  'skull-crushers': extension,
  'overhead-barbell-triceps-extensions': extension,
  'overhead-dumbbell-triceps-extensions': extension,
  'cable-press-downs': extension,
  'bench-dips': a(['triceps'], ['delt-front', 'chest']),
  'cable-crunches': crunch,
  'hanging-leg-raises': a(['abs'], ['obliques', 'forearms']),
  planks: a(['abs'], ['obliques', 'delt-front', 'glutes']),
  'ab-wheel-rollouts': a(['abs'], ['obliques', 'lats', 'delt-front']),
  'dead-bugs': crunch,
  'reverse-crunches': crunch,
  'side-planks': a(['obliques'], ['abs', 'glutes', 'delt-side']),
  'hollow-holds': crunch,
}
