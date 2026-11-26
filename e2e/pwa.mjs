import { chromium } from 'playwright'
import { appUrl, openFresh } from './_driver.mjs'
const URL = appUrl()
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
await openFresh(page, URL)

const head = await page.evaluate(() => {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content
  return {
    manifest: document.querySelector('link[rel="manifest"]')?.href,
    touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href,
    capable: meta('apple-mobile-web-app-capable'),
    webCapable: meta('mobile-web-app-capable'),
    title: meta('apple-mobile-web-app-title'),
    themes: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.media} ${m.content}`),
  }
})
assert(head.manifest, 'index.html links a manifest')
assert(head.capable === 'yes' && head.webCapable === 'yes', 'both web-app-capable metas are yes')
assert(head.title === 'Treino', 'home screen title is Treino')
assert(head.themes.length === 2, 'a theme-color per colour scheme: ' + head.themes.join(' | '))

const res = await page.request.get(head.manifest)
assert(res.status() === 200, 'manifest answers 200')
const manifest = await res.json()
assert(manifest.name === 'Treino' && manifest.short_name === 'Treino', 'manifest names')
assert(manifest.display === 'standalone', 'manifest display is standalone')
assert(manifest.start_url === '/' && manifest.scope === '/', 'manifest start_url and scope are /')
assert(manifest.lang === 'pt-PT', 'manifest lang is pt-PT')

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) })
const icons = [
  ...manifest.icons.map((i) => ({ url: new globalThis.URL(i.src, head.manifest).href, size: Number(i.sizes.split('x')[0]) })),
  { url: head.touchIcon, size: 180 },
]
assert(icons.length === 4, 'three manifest icons plus the apple-touch-icon')
for (const { url, size } of icons) {
  const r = await page.request.get(url)
  assert(r.status() === 200 && r.headers()['content-type'] === 'image/png', `${url} answers 200 image/png`)
  const { w, h } = pngSize(await r.body())
  assert(w === size && h === size, `${url} is ${size}x${size} (got ${w}x${h})`)
}
await browser.close()
