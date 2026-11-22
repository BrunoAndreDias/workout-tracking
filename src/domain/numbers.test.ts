import { describe, expect, it } from 'vitest'
import { decimalText, kgText, parseTyped, rangeText, ratioText } from './numbers.ts'

describe('kg text', () => {
  it('shows up to two decimals, trimmed, with a comma', () => {
    expect(decimalText(60)).toBe('60')
    expect(decimalText(62.5)).toBe('62,5')
    expect(decimalText(61.25)).toBe('61,25')
    expect(decimalText(1250)).toBe('1250')
    expect(kgText(63.75)).toBe('63,75 kg')
  })

  it('shows a stored value with more decimals at two', () => {
    expect(decimalText(61.257)).toBe('61,26')
  })
})

describe('typed numbers', () => {
  it('reads a comma or a point and rounds to two decimals', () => {
    expect(parseTyped('61,25', true)).toBe(61.25)
    expect(parseTyped('61.25', true)).toBe(61.25)
    expect(parseTyped('61,257', true)).toBe(61.26)
    expect(parseTyped(' 60 ', true)).toBe(60)
    expect(parseTyped('62,', true)).toBe(62)
    expect(parseTyped(',5', true)).toBe(0.5)
    expect(parseTyped('9999', true)).toBe(9999)
  })

  it('gives null for an empty box', () => {
    expect(parseTyped('', true)).toBeNull()
    expect(parseTyped('  ', false)).toBeNull()
  })

  it.each(['abc', '-5', '10000', '1,2,3', '1e3', '0x10', 'Infinity', ','])('refuses %s', (raw) => {
    expect(parseTyped(raw, true)).toBeUndefined()
  })

  it('keeps whole-number fields whole', () => {
    expect(parseTyped('8', false)).toBe(8)
    expect(parseTyped('8,5', false)).toBeUndefined()
    expect(parseTyped('8.0', false)).toBeUndefined()
  })
})

describe('ranges and ratios', () => {
  it('writes a range, or one number when it is a single target', () => {
    expect(rangeText({ min: 8, max: 12 })).toBe('8–12')
    expect(rangeText({ min: 2, max: 2 })).toBe('2')
  })

  it('writes a ratio with one decimal', () => {
    expect(ratioText(2)).toBe('2,0')
    expect(ratioText(1.46)).toBe('1,5')
  })
})
