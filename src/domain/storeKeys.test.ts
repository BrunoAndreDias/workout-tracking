import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { DEVICE_KEY } from './storeKeys.ts'

describe('DEVICE_KEY', () => {
  it('is the theme key index.html reads before the bundle loads', () => {
    expect(indexHtml).toContain(`localStorage.getItem('${DEVICE_KEY.theme}')`)
  })
})
