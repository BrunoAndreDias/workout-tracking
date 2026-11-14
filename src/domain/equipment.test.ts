import { describe, expect, it } from 'vitest'
import { equipmentLabel, equipmentReducer, freshEquipment, isChanged, missingAt, needsOf, readyFirst } from './equipment.ts'
import type { EquipmentAction } from './equipment.ts'
import { CATALOG } from './exerciseCatalog.ts'
import { loadStore, saveStore, STORES } from './stores.ts'
import type { CustomEquipmentId, GymId } from './types.ts'

const CASA = 'gym-casa' as GymId
const GINASIO = 'gym-ginasio' as GymId
const ELASTICOS = 'mat:elasticos' as CustomEquipmentId
const material = (...actions: EquipmentAction[]) => actions.reduce(equipmentReducer, freshEquipment())
const casa = (...actions: EquipmentAction[]) =>
  material(
    { type: 'addGym', gymId: CASA, name: 'Casa' },
    { type: 'toggleHas', gymId: CASA, equipmentId: 'dumbbells' },
    { type: 'toggleHas', gymId: CASA, equipmentId: 'bench' },
    ...actions,
  )

describe('material an Exercise needs', () => {
  it('starts from the catalog’s guess, ignoring case, and is nothing for a name of the user’s own', () => {
    const state = freshEquipment()
    expect(needsOf(state, 'flat barbell bench press')).toEqual(['barbell', 'bench', 'rack'])
    expect(needsOf(state, 'Planks')).toEqual([])
    expect(needsOf(state, 'Supino')).toEqual([])
    expect(CATALOG.every((e) => needsOf(state, e.name).every((id) => equipmentLabel(state, id) !== 'Material desconhecido'))).toBe(true)
  })

  it('takes the user’s correction, even to nothing, and Repor goes back to the guess', () => {
    const corrected = material({ type: 'setNeeds', name: 'Hanging Leg Raises', needs: [] })
    expect(needsOf(corrected, 'Hanging Leg Raises')).toEqual([])
    expect(isChanged(corrected, 'hanging leg raises')).toBe(true)
    const reset = equipmentReducer(corrected, { type: 'resetNeeds', name: 'Hanging Leg Raises' })
    expect(needsOf(reset, 'Hanging Leg Raises')).toEqual(['pull-up-bar'])
    expect(isChanged(reset, 'Hanging Leg Raises')).toBe(false)
  })

  it('is no correction once edited back to the guess, in any order', () => {
    const state = material({ type: 'setNeeds', name: 'Flat Barbell Bench Press', needs: ['barbell', 'bench'] }, { type: 'setNeeds', name: 'Flat Barbell Bench Press', needs: ['rack', 'barbell', 'bench'] })
    expect(isChanged(state, 'Flat Barbell Bench Press')).toBe(false)
  })
})

describe('what the active Gym lacks', () => {
  it('judges nothing with no Gym', () => {
    expect(missingAt(freshEquipment(), 'Flat Barbell Bench Press')).toBeNull()
  })

  it('lists the needed material the active Gym does not have', () => {
    const state = casa()
    expect(missingAt(state, 'Flat Dumbbell Bench Press')).toEqual([])
    expect(missingAt(state, 'Flat Barbell Bench Press')).toEqual(['barbell', 'rack'])
    expect(missingAt(state, 'Push-Ups')).toEqual([])
  })

  it('follows the Gym the user switches to', () => {
    const state = casa({ type: 'addGym', gymId: GINASIO, name: 'Ginásio' }, { type: 'setAllHas', gymId: GINASIO })
    expect(state.activeGymId).toBe(GINASIO)
    expect(missingAt(state, 'Flat Barbell Bench Press')).toEqual([])
    expect(missingAt(equipmentReducer(state, { type: 'setActiveGym', gymId: CASA }), 'Flat Barbell Bench Press')).toEqual(['barbell', 'rack'])
  })

  it('puts what the Gym can do first and keeps each group’s order', () => {
    const names = ['Flat Barbell Bench Press', 'Flat Dumbbell Bench Press', 'Barbell Squats', 'Push-Ups']
    expect(readyFirst(casa(), names, (n) => n)).toEqual(['Flat Dumbbell Bench Press', 'Push-Ups', 'Flat Barbell Bench Press', 'Barbell Squats'])
    expect(readyFirst(freshEquipment(), names, (n) => n)).toEqual(names)
  })
})

describe('Gyms', () => {
  it('a removed active Gym hands over to another, and to none after the last', () => {
    const two = casa({ type: 'addGym', gymId: GINASIO, name: 'Ginásio' })
    const one = equipmentReducer(two, { type: 'removeGym', gymId: GINASIO })
    expect(one.activeGymId).toBe(CASA)
    expect(equipmentReducer(one, { type: 'removeGym', gymId: CASA }).activeGymId).toBeNull()
  })

  it('marks every material, the user’s own too, and clears it', () => {
    const all = casa({ type: 'addCustom', id: ELASTICOS, name: 'Elásticos' }, { type: 'setAllHas', gymId: CASA })
    expect(all.gyms[0].has).toContain(ELASTICOS)
    expect(all.gyms[0].has).toContain('leg-press')
    expect(equipmentReducer(all, { type: 'clearHas', gymId: CASA }).gyms[0].has).toEqual([])
  })

  it('ignores a blank name', () => {
    expect(material({ type: 'addGym', gymId: CASA, name: '  ' }).gyms).toEqual([])
    expect(casa({ type: 'renameGym', gymId: CASA, name: '' }).gyms[0].name).toBe('Casa')
  })
})

describe('the user’s own material', () => {
  it('is named like no other material, ignoring case', () => {
    expect(material({ type: 'addCustom', id: ELASTICOS, name: 'halteres' }).custom).toEqual([])
    const added = material({ type: 'addCustom', id: ELASTICOS, name: ' Elásticos ' })
    expect(equipmentLabel(added, ELASTICOS)).toBe('Elásticos')
    expect(equipmentLabel(equipmentReducer(added, { type: 'renameCustom', id: ELASTICOS, name: 'Bandas' }), ELASTICOS)).toBe('Bandas')
  })

  it('removed, leaves every Gym and every Exercise', () => {
    const state = casa(
      { type: 'addCustom', id: ELASTICOS, name: 'Elásticos' },
      { type: 'toggleHas', gymId: CASA, equipmentId: ELASTICOS },
      { type: 'setNeeds', name: 'Face Pulls', needs: [ELASTICOS] },
      { type: 'removeCustom', id: ELASTICOS },
    )
    expect(state.custom).toEqual([])
    expect(state.gyms[0].has).toEqual(['dumbbells', 'bench'])
    expect(needsOf(state, 'Face Pulls')).toEqual([])
  })
})

function memoryStorage() {
  const data: Record<string, string> = {}
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
}

describe('material store', () => {
  it('saves and reads back Gyms, own material and corrections', () => {
    const storage = memoryStorage()
    const state = casa({ type: 'addCustom', id: ELASTICOS, name: 'Elásticos' }, { type: 'setNeeds', name: 'Planks', needs: [ELASTICOS] })
    saveStore(STORES.equipment, state, storage)
    expect(JSON.parse(storage.data['workout-tracking:equipment'])).toEqual({
      version: 1,
      custom: [{ id: ELASTICOS, name: 'Elásticos' }],
      gyms: [{ id: CASA, name: 'Casa', has: ['dumbbells', 'bench'] }],
      activeGymId: CASA,
      needs: { planks: [ELASTICOS] },
    })
    expect(loadStore(STORES.equipment, storage)).toEqual(state)
  })

  it.each([
    ['material no list holds', { gyms: [{ id: CASA, name: 'Casa', has: ['trampoline'] }] }],
    ['an active Gym that is not there', { activeGymId: GINASIO }],
    ['own material without the mat: prefix', { custom: [{ id: 'elasticos', name: 'Elásticos' }] }],
    ['a correction naming unknown material', { needs: { planks: ['mat:gone'] } }],
  ])('rejects a document with %s', (_, change) => {
    const doc = { version: 1, custom: [], gyms: [{ id: CASA, name: 'Casa', has: [] }], activeGymId: CASA, needs: {} }
    expect(STORES.equipment.parse(doc)).not.toBeNull()
    expect(STORES.equipment.parse({ ...doc, ...change })).toBeNull()
  })
})
