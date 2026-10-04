import { describe, expect, it } from 'vitest'
import { formatAmount, formatGrams, formatKcal, formatMacro, formatPercent, formatPortions, formatSigned } from './format.ts'

describe('pt-PT formatting', () => {
  it('uses comma decimals', () => {
    expect(formatGrams(120.5)).toBe('120,5')
    expect(formatGrams(120)).toBe('120')
    expect(formatMacro(5.16)).toBe('5,2')
    expect(formatMacro(5)).toBe('5,0')
  })

  it('rounds kcal to integers', () => {
    expect(formatKcal(326.4)).toBe('326')
    expect(formatKcal(326.5)).toBe('327')
  })

  it('formats portions with singular and plural', () => {
    expect(formatPortions(1)).toBe('1 porção')
    expect(formatPortions(2)).toBe('2 porções')
    expect(formatPortions(1.5)).toBe('1,5 porções')
  })

  it('signs deltas and avoids a signed zero', () => {
    expect(formatSigned(51.4, formatKcal)).toBe('+51')
    expect(formatSigned(-51.4, formatKcal)).toBe('−51')
    expect(formatSigned(-0.2, formatKcal)).toBe('0')
  })

  it('formats amounts by magnitude and percent', () => {
    expect(formatAmount(1234.5, 'mg')).toBe('1235')
    expect(formatAmount(12.34, 'mg')).toBe('12,3')
    expect(formatAmount(0.125, 'g')).toBe('0,13')
    expect(formatPercent(0.254)).toBe('25 %')
  })
})
