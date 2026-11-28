import { describe, expect, it } from 'vitest'
import { equipmentReducer, freshEquipment } from './equipment.ts'
import type { EquipmentAction, EquipmentId } from './equipment.ts'
import type { CustomEquipmentId, GymId } from './types.ts'

const CASA = 'gym-casa' as GymId
const ELASTICOS = 'mat:elasticos' as CustomEquipmentId
const UNKNOWN = 'mat:nada' as EquipmentId
const start = [
  { type: 'addGym', gymId: CASA, name: 'Casa' },
  { type: 'addCustom', id: ELASTICOS, name: 'Elásticos' },
] satisfies EquipmentAction[]
const state = start.reduce(equipmentReducer, freshEquipment())
const apply = (action: EquipmentAction) => equipmentReducer(state, action)

describe('the reducer refuses material no list holds', () => {
  it('a Local takes built-in and own material', () => {
    const has = [apply({ type: 'toggleHas', gymId: CASA, equipmentId: 'barbell' }), apply({ type: 'toggleHas', gymId: CASA, equipmentId: ELASTICOS })].map((s) => s.gyms[0].has)
    expect(has).toEqual([['barbell'], [ELASTICOS]])
  })

  it('refuses marking material that is neither built in nor the user’s own', () => {
    expect(apply({ type: 'toggleHas', gymId: CASA, equipmentId: UNKNOWN })).toBe(state)
  })

  it('refuses an Exercise’s correction that names unknown material', () => {
    expect(apply({ type: 'setNeeds', name: 'Supino', needs: ['barbell', UNKNOWN] })).toBe(state)
  })

  it('refuses own material under an id without the mat: prefix or one already taken', () => {
    expect(apply({ type: 'addCustom', id: 'elasticos' as CustomEquipmentId, name: 'Bandas' })).toBe(state)
    expect(apply({ type: 'addCustom', id: ELASTICOS, name: 'Bandas' })).toBe(state)
  })
})
