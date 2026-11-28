import { describe, expect, it } from 'vitest'
import { memoryStorage } from './memoryStorage.ts'
import { preserveCopy } from './persistence.ts'

describe('preserveCopy', () => {
  it('copies the same text again on a storage without key and length, which cannot find the copy it made', () => {
    const full = memoryStorage()
    const { data, getItem, setItem } = memoryStorage()
    for (const storage of [full, { getItem, setItem }]) {
      preserveCopy(storage, 'store', 'text', 'migrated')
      preserveCopy(storage, 'store', 'text', 'migrated')
    }
    expect(Object.keys(full.data)).toHaveLength(1)
    expect(Object.values(data)).toEqual(['text', 'text'])
  })
})
