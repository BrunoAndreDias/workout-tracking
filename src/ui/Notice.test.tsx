import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Notice } from './Notice.tsx'

describe('Notice', () => {
  it('is an alert only for an error', () => {
    expect(renderToStaticMarkup(<Notice tone="error">x</Notice>)).toBe('<p class="notice notice-error" role="alert">x</p>')
    expect(renderToStaticMarkup(<Notice tone="warning">x</Notice>)).toBe('<p class="notice notice-warning" role="status">x</p>')
    expect(renderToStaticMarkup(<Notice tone="info" className="dictate-status" />)).toBe('<p class="notice notice-info dictate-status" role="status"></p>')
  })
})
