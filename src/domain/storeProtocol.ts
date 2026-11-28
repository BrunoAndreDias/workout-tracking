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

export type StoreRevs = Partial<Record<StoreKey, number>>

export const isRev = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1

export function formatHave(revs: StoreRevs): string {
  return Object.entries(revs)
    .map(([key, rev]) => `${key}:${rev}`)
    .join(',')
}

export function parseHave(text: string | null): StoreRevs {
  const revs: StoreRevs = {}
  for (const pair of (text ?? '').split(',')) {
    const at = pair.lastIndexOf(':')
    const key = pair.slice(0, at)
    const rev = Number(pair.slice(at + 1))
    if (isStoreKey(key) && isRev(rev)) revs[key] = rev
  }
  return revs
}

export function parsePut(text: string): PutBody | null {
  try {
    const body: unknown = JSON.parse(text)
    if (!isRecord(body)) return null
    const { doc, baseRev } = body
    if (typeof doc !== 'string' || (baseRev !== null && !isRev(baseRev))) return null
    JSON.parse(doc)
    return { doc, baseRev }
  } catch {
    return null
  }
}

export function parsePutReply(body: unknown): PutReply | null {
  const rev = isRecord(body) ? body.rev : undefined
  return isRev(rev) ? { rev } : null
}

export function parseStoreList(raw: unknown, unchanged: (key: StoreKey, rev: number) => string | null): StoreList | null {
  if (!isRecord(raw)) return null
  const list: StoreList = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isStoreKey(key) || !isRecord(value)) continue
    const { doc, rev } = value
    if (!isRev(rev)) continue
    const known = typeof doc === 'string' ? doc : doc === undefined ? unchanged(key, rev) : null
    if (known !== null) list[key] = { doc: known, rev }
  }
  return list
}
