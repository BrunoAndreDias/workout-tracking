import { describe, expect, it } from 'vitest'
import { nameKey, nameMatcher } from './names.ts'

describe('names', () => {
  it('keys a name ignoring case and outer spaces', () => {
    expect(nameKey('  Supino INCLINADO ')).toBe('supino inclinado')
  })

  it('matches a name holding every word of the query, in any order and case', () => {
    const matches = nameMatcher(' GRIP  wide ')
    expect(matches('Wide-Grip Lat Pulldown')).toBe(true)
    expect(matches('Close-Grip Lat Pulldown')).toBe(false)
  })

  it('matches every name for a blank query', () => {
    expect(nameMatcher('   ')('Supino')).toBe(true)
  })
})
