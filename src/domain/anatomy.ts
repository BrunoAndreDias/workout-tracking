import type { Muscle } from './catalogEntries.ts'
import { CATALOG_MUSCLES } from './catalogMuscles.ts'
import type { Activation, Region } from './catalogMuscles.ts'
import { catalogEntry } from './exerciseCatalog.ts'

export type Side = 'front' | 'back'

export interface RegionInfo {
  readonly label: string
  readonly group: Muscle | null
  readonly sides: readonly Side[]
}

export const REGIONS: Readonly<Record<Region, RegionInfo>> = {
  traps: { label: 'Trapézio', group: 'back', sides: ['front', 'back'] },
  'delt-front': { label: 'Ombro (frente)', group: 'shoulders', sides: ['front'] },
  'delt-side': { label: 'Ombro (lado)', group: 'shoulders', sides: ['front', 'back'] },
  'delt-rear': { label: 'Ombro (trás)', group: 'shoulders', sides: ['back'] },
  'chest-upper': { label: 'Peito (parte de cima)', group: 'chest', sides: ['front'] },
  chest: { label: 'Peito', group: 'chest', sides: ['front'] },
  'upper-back': { label: 'Meio das costas', group: 'back', sides: ['back'] },
  lats: { label: 'Dorsais', group: 'back', sides: ['back'] },
  biceps: { label: 'Bíceps', group: 'biceps', sides: ['front'] },
  triceps: { label: 'Tríceps', group: 'triceps', sides: ['back'] },
  forearms: { label: 'Antebraços', group: 'forearms', sides: ['front', 'back'] },
  abs: { label: 'Abdominais', group: 'abs', sides: ['front'] },
  obliques: { label: 'Oblíquos', group: 'abs', sides: ['front'] },
  'lower-back': { label: 'Lombar', group: 'back', sides: ['back'] },
  glutes: { label: 'Glúteos', group: 'glutes', sides: ['back'] },
  quads: { label: 'Quadríceps', group: 'quadriceps', sides: ['front'] },
  adductors: { label: 'Adutores', group: null, sides: ['front'] },
  hamstrings: { label: 'Posteriores da coxa', group: 'hamstrings', sides: ['back'] },
  calves: { label: 'Gémeos', group: 'calves', sides: ['front', 'back'] },
}

const REGION_ORDER = Object.keys(REGIONS) as Region[]

export type Involvement = 'target' | 'assist'

export function activationByName(name: string): Activation | undefined {
  const entry = catalogEntry(name)
  return entry && CATALOG_MUSCLES[entry.id]
}

export function involvement(activation: Activation, region: Region): Involvement | null {
  if (activation.target.includes(region)) return 'target'
  return activation.assist.includes(region) ? 'assist' : null
}

export function mainSide(activation: Activation): Side {
  const on = (side: Side) => activation.target.filter((r) => REGIONS[r].sides.includes(side)).length
  return on('back') > on('front') ? 'back' : 'front'
}

export const workedRegions = (activation: Activation): { region: Region; involvement: Involvement }[] =>
  (['target', 'assist'] as const).flatMap((inv) => REGION_ORDER.filter((r) => activation[inv].includes(r)).map((region) => ({ region, involvement: inv })))

export const workedOn = (activation: Activation, side: Side) => workedRegions(activation).filter(({ region }) => REGIONS[region].sides.includes(side))
