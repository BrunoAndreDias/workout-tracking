import type { CatalogId } from './catalogEntries.ts'
import { CATALOG_MUSCLES } from './catalogMuscles.ts'
import { catalogEntry } from './exerciseCatalog.ts'
import type { Muscle } from './exerciseCatalog.ts'

/** A part of the body map, finer than a muscle group, so a lateral raise and a rear delt fly light different parts. */
export type Region =
  | 'chest-upper'
  | 'chest'
  | 'delt-front'
  | 'delt-side'
  | 'delt-rear'
  | 'traps'
  | 'upper-back'
  | 'lats'
  | 'lower-back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'calves'

export type Side = 'front' | 'back'

export interface RegionInfo {
  readonly label: string
  /** The muscle group it counts for; adductors have none. */
  readonly group: Muscle | null
  /** The figure it is drawn on; the side delt shows on both. */
  readonly sides: readonly Side[]
}

/** Every region, in the order the muscle list reads: top to bottom, front before back. */
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

export const REGION_ORDER = Object.keys(REGIONS) as Region[]

/**
 * What an Exercise works: `target`, the regions the user should feel it in most, and `assist`, the ones that help.
 * A region is in at most one of the two.
 */
export interface Activation {
  readonly target: readonly Region[]
  readonly assist: readonly Region[]
}

export type Involvement = 'target' | 'assist'

export const activationOf = (id: CatalogId): Activation => CATALOG_MUSCLES[id]

/** The Activation of a catalog Exercise by its name, ignoring case; undefined for the user's own names. */
export function activationByName(name: string): Activation | undefined {
  const entry = catalogEntry(name)
  return entry && CATALOG_MUSCLES[entry.id as CatalogId]
}

export function involvement(activation: Activation, region: Region): Involvement | null {
  if (activation.target.includes(region)) return 'target'
  return activation.assist.includes(region) ? 'assist' : null
}

/** The side whose figure shows more of the target, front on a tie. */
export function mainSide(activation: Activation): Side {
  const on = (side: Side) => activation.target.filter((r) => REGIONS[r].sides.includes(side)).length
  return on('back') > on('front') ? 'back' : 'front'
}

/** The regions it works, targets first, each list in the muscle list's order. */
export const workedRegions = (activation: Activation): { region: Region; involvement: Involvement }[] =>
  (['target', 'assist'] as const).flatMap((inv) => REGION_ORDER.filter((r) => activation[inv].includes(r)).map((region) => ({ region, involvement: inv })))
