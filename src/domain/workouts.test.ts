import { describe, expect, it } from 'vitest'
import { parseRepRange, parseRir } from './workouts.ts'

describe('parseRir', () => {
  it.each([
    ['3', { min: 3, max: 3 }],
    ['5-6', { min: 5, max: 6 }],
    ['5–6', { min: 5, max: 6 }],
    ['5 a 6', { min: 5, max: 6 }],
    ['0', { min: 0, max: 0 }],
    ['6-5', null],
    ['11', null],
    ['', null],
  ])('%s', (text, rir) => {
    expect(parseRir(text)).toEqual(rir)
  })
})

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
