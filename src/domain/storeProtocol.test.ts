import { describe, expect, it } from 'vitest'
import { parsePut, parsePutReply, parseStoreList } from './storeProtocol.ts'

const PLANS = 'workout-tracking:workout-plans'
const EXERCISES = 'workout-tracking:exercises'

describe('parsePut', () => {
  it('reads a JSON doc with a positive integer baseRev or null', () => {
    expect(parsePut(JSON.stringify({ doc: '{"a":1}', baseRev: 3 }))).toEqual({ doc: '{"a":1}', baseRev: 3 })
    expect(parsePut(JSON.stringify({ doc: '[]', baseRev: null }))).toEqual({ doc: '[]', baseRev: null })
  })

  it('refuses anything else', () => {
    for (const text of ['nope', 'null', '[]', '"x"', JSON.stringify({ doc: 'not json', baseRev: null }), JSON.stringify({ doc: 1, baseRev: null }), JSON.stringify({ doc: '{}' }), JSON.stringify({ doc: '{}', baseRev: 0 }), JSON.stringify({ doc: '{}', baseRev: 1.5 }), JSON.stringify({ doc: '{}', baseRev: '1' })]) {
      expect(parsePut(text)).toBeNull()
    }
  })
})

describe('parsePutReply', () => {
  it('reads a non-negative integer rev', () => {
    expect(parsePutReply({ rev: 0 })).toEqual({ rev: 0 })
    expect(parsePutReply({ rev: 7 })).toEqual({ rev: 7 })
  })

  it('refuses anything else', () => {
    for (const body of [null, 7, [], {}, { rev: -1 }, { rev: 1.5 }, { rev: '2' }]) expect(parsePutReply(body)).toBeNull()
  })
})

describe('parseStoreList', () => {
  const none = () => null

  it('keeps known stores with a doc and an integer rev', () => {
    expect(parseStoreList({ [PLANS]: { doc: '{}', rev: 2 }, 'workout-tracking:theme': { doc: 'dark', rev: 1 } }, none)).toEqual({ [PLANS]: { doc: '{}', rev: 2 } })
  })

  it('fills a store sent without its doc from the unchanged copy, and drops it when there is none', () => {
    const unchanged = (key: string, rev: number) => (key === PLANS && rev === 4 ? '{"held":true}' : null)
    expect(parseStoreList({ [PLANS]: { rev: 4 }, [EXERCISES]: { rev: 2 } }, unchanged)).toEqual({ [PLANS]: { doc: '{"held":true}', rev: 4 } })
  })

  it('skips entries without an integer rev or with a non-string doc', () => {
    expect(parseStoreList({ [PLANS]: { doc: '{}', rev: 1.5 }, [EXERCISES]: { doc: null, rev: 1 } }, none)).toEqual({})
  })

  it('refuses a body that is not an object', () => {
    for (const raw of [null, 'x', 3]) expect(parseStoreList(raw, none)).toBeNull()
  })
})
