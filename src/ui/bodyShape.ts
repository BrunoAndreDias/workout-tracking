import type { Region, Side } from '../domain/anatomy.ts'

/** One half of a figure in a 120 × 256 box, drawn left of the centre line x = 60. */
export interface FigureHalf {
  /** The whole silhouette; its centre edge runs a little past x = 60 so the two halves overlap without a seam. */
  readonly outline: string
  /** The regions shown on this side, in painting order. */
  readonly regions: Partial<Record<Region, string>>
}

export const FIGURE_BOX = '0 0 120 256'
export const MIRROR = 'matrix(-1 0 0 1 120 0)'
export const SIDE_LABEL: Record<Side, string> = { front: 'Frente', back: 'Costas' }
