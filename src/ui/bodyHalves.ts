import type { Side } from '../domain/anatomy.ts'
import type { Region } from '../domain/catalogMuscles.ts'
import { BACK } from './bodyBack.ts'
import { FRONT } from './bodyFront.ts'

export const HALVES = { front: FRONT, back: BACK } as const

export const regionsOf = (side: Side) => Object.entries(HALVES[side].regions) as [Region, string][]
