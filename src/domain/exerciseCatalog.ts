import { CATALOG } from './catalogEntries.ts'
import type { CatalogEntry, CatalogId, Muscle } from './catalogEntries.ts'
import { nameKey, nameMatcher } from './names.ts'

export const MUSCLE_LABEL: Readonly<Record<Muscle, string>> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdominais',
  glutes: 'Glúteos',
  calves: 'Gémeos',
}

type CatalogItem = (typeof CATALOG)[number]

const byKey = new Map<string, CatalogItem>(CATALOG.map((e) => [nameKey(e.name), e]))
const byId = new Map<CatalogId, CatalogItem>(CATALOG.map((e) => [e.id, e]))

export const catalogEntry = (name: string): CatalogItem | undefined => byKey.get(nameKey(name))

export const catalogById = (id: CatalogId): CatalogItem => byId.get(id)!

export function pickerList(query: string, muscle: Muscle | null, current: string | null): { same: CatalogEntry[]; others: CatalogEntry[] } {
  const matches = nameMatcher(query)
  const swapped = current === null ? undefined : catalogEntry(current)
  const found = CATALOG.filter((e: CatalogEntry) => e !== swapped && matches(e.name) && (muscle === null || e.muscle === muscle || e.primary.includes(muscle)))
  const same = swapped ? found.filter((e) => e.pattern === swapped.pattern) : []
  return { same, others: found.filter((e) => !same.includes(e)) }
}
