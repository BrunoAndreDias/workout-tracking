import { isBuiltIn } from './equipment.ts'
import type { CustomEquipment, EquipmentId, EquipmentState, Gym } from './equipment.ts'
import { isId, isRecord } from './persistence.ts'
import type { CustomEquipmentId, GymId } from './types.ts'

export const EQUIPMENT_SCHEMA_VERSION = 1

const isCustomId = (v: unknown): v is CustomEquipmentId => typeof v === 'string' && v.startsWith('mat:') && v.length > 4
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** The current version only; null for one bad row, an id twice, or material no list holds. */
export function parseEquipment(raw: unknown): EquipmentState | null {
  if (!isRecord(raw) || raw.version !== EQUIPMENT_SCHEMA_VERSION) return null
  const { custom: rawCustom, gyms: rawGyms, activeGymId, needs: rawNeeds } = raw
  if (!Array.isArray(rawCustom) || !Array.isArray(rawGyms) || !isRecord(rawNeeds)) return null

  const custom: CustomEquipment[] = []
  for (const c of rawCustom) {
    if (!isRecord(c) || !isCustomId(c.id) || !isName(c.name) || custom.some((x) => x.id === c.id)) return null
    custom.push({ id: c.id, name: c.name })
  }
  const isKnown = (id: unknown): id is EquipmentId => typeof id === 'string' && (isBuiltIn(id) || custom.some((c) => c.id === id))
  const idList = (v: unknown): EquipmentId[] | null => (Array.isArray(v) && v.every(isKnown) && new Set(v).size === v.length ? v : null)

  const gyms: Gym[] = []
  for (const g of rawGyms) {
    const has = isRecord(g) ? idList(g.has) : null
    if (!isRecord(g) || !isId(g.id) || !isName(g.name) || !has || gyms.some((x) => x.id === g.id)) return null
    gyms.push({ id: g.id as GymId, name: g.name, has })
  }
  if (activeGymId !== null && !gyms.some((g) => g.id === activeGymId)) return null

  const needs: Record<string, readonly EquipmentId[]> = {}
  for (const [key, ids] of Object.entries(rawNeeds)) {
    const list = idList(ids)
    if (!list) return null
    needs[key] = list
  }
  return { custom, gyms, activeGymId: activeGymId as GymId | null, needs }
}
