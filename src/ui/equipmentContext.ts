import { createContext } from 'react'
import type { Dispatch } from 'react'
import { freshEquipment } from '../domain/equipment.ts'
import type { EquipmentAction, EquipmentState } from '../domain/equipment.ts'

interface EquipmentStore {
  readonly state: EquipmentState
  readonly dispatch: Dispatch<EquipmentAction>
}

export const EquipmentContext = createContext<EquipmentStore>({ state: freshEquipment(), dispatch: () => {} })
