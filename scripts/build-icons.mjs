// Renders public/favicon.svg onto an opaque square at each home screen icon size (iOS fills transparency with black).
// Usage: node scripts/build-icons.mjs
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BG = '#f7f5ef' // --bg in src/design-system/plano/tokens.css, light theme
const svg = readFileSync('public/favicon.svg').toString('base64')
// `fill` is the share of the square the logo takes. The maskable icon keeps it inside the 80 % safe circle.
const icons = [
  { file: 'apple-touch-icon.png', size: 180, fill: 0.62 },
  { file: 'icon-192.png', size: 192, fill: 0.62 },
  { file: 'icon-512.png', size: 512, fill: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, fill: 0.5 },
]

const browser = await chromium.launch()
for (const { file, size, fill } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<body style="margin:0;background:${BG};display:grid;place-items:center;width:${size}px;height:${size}px"><img width="${Math.round(size * fill)}" src="data:image/svg+xml;base64,${svg}"></body>`,
  )
  await page.locator('img').evaluate((img) => img.decode())
  await page.screenshot({ path: `public/${file}` })
  await page.close()
  console.log(`public/${file} ${size}x${size}`)
}
await browser.close()
