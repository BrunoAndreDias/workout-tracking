import { describe, expect, it } from 'vitest'
import { parseRepRange } from './workouts.ts'

describe('parseRepRange', () => {
  it.each([
    ['8-12', { min: 8, max: 12 }],
    [' 8 – 12 ', { min: 8, max: 12 }],
    ['6 a 8', { min: 6, max: 8 }],
    ['10', { min: 10, max: 10 }],
    ['12-8', null],
    ['8-', null],
    ['0', null],
    ['', null],
  ])('reads "%s"', (text, expected) => {
    expect(parseRepRange(text)).toEqual(expected)
  })
})
