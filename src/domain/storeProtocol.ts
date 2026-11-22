import { isRecord } from './records.ts'
import { isStoreKey } from './storeKeys.ts'
import type { StoreKey } from './storeKeys.ts'

export interface Stored {
  readonly doc: string
  readonly rev: number
}

export interface PutBody {
  readonly doc: string
  readonly baseRev: number | null
}

export interface PutReply {
  readonly rev: number
}

export interface CurrentReply {
  readonly doc: string | null
  readonly rev: number
}

export type StoreList = Partial<Record<StoreKey, Stored>>

export type StoreListReply = Partial<Record<StoreKey, Stored | PutReply>>

export function parsePut(text: string): PutBody | null {
  try {
    const body: unknown = JSON.parse(text)
    if (!isRecord(body)) return null
    const { doc, baseRev } = body
    if (typeof doc !== 'string' || (baseRev !== null && !(typeof baseRev === 'number' && Number.isInteger(baseRev) && baseRev > 0))) return null
    JSON.parse(doc)
    return { doc, baseRev }
  } catch {
    return null
  }
}

export function parsePutReply(body: unknown): PutReply | null {
  const rev = isRecord(body) ? body.rev : undefined
  return typeof rev === 'number' && Number.isInteger(rev) && rev >= 0 ? { rev } : null
}

export function parseStoreList(raw: unknown, unchanged: (key: StoreKey, rev: number) => string | null): StoreList | null {
  if (!isRecord(raw)) return null
  const list: StoreList = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isStoreKey(key) || !isRecord(value)) continue
    const { doc, rev } = value
    if (typeof rev !== 'number' || !Number.isInteger(rev)) continue
    const known = typeof doc === 'string' ? doc : doc === undefined ? unchanged(key, rev) : null
    if (known !== null) list[key] = { doc: known, rev }
  }
  return list
}
