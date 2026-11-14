import { chromium } from 'playwright'
import { openFresh, todayIso } from './_driver.mjs'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL)

const views = page.getByRole('navigation', { name: 'Secções' })
const current = () => views.locator('[aria-current="page"]').textContent()
assert(await page.title() === 'Treino', 'the page title is Treino')
assert(await current() === 'Treino', 'a bare URL opens on Treino')
await page.getByRole('navigation', { name: 'Treino' }).waitFor()
assert((await views.getByRole('link').allTextContents()).join(' | ') === 'Treino | Relógio', 'the tabs run Treino, Relógio')

for (const old of ['#diario', '#alimentacao/hoje', '#historico']) {
  await page.goto(URL + old)
  await page.getByRole('navigation', { name: 'Treino' }).waitFor()
  assert(await current() === 'Treino', `the meal app's ${old} hash falls back to Treino`)
}

await views.getByRole('link', { name: 'Relógio', exact: true }).click()
assert(page.url().endsWith('#relogio'), 'Relógio is #relogio in the URL')
await page.getByRole('region', { name: 'Relógio', exact: true }).waitFor()
assert(await page.getByRole('button', { name: 'Ligar Apple Watch' }).count() === 1, 'the Relógio tab holds the Health import')
const stepper = page.getByRole('region', { name: 'Data do relógio' })
assert(await stepper.getByRole('button', { name: 'Dia seguinte' }).isDisabled(), 'the date stepper stops at today')
await stepper.getByRole('button', { name: 'Dia anterior' }).click()
const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
await page.waitForURL(`**#relogio/${yesterday}`)
assert(await stepper.getByRole('button', { name: 'Voltar a hoje' }).count() === 1, 'a past date offers Voltar a hoje')
await page.goto(`${URL}#relogio/${todayIso()}`)
assert(await current() === 'Relógio', 'a dated #relogio hash opens the Relógio tab')

await page.setViewportSize({ width: 375, height: 812 })
const navBox = await views.boundingBox()
const toggleBox = await page.locator('.theme-toggle').boundingBox()
assert(toggleBox.y < navBox.y + navBox.height, 'at 375 px the theme toggle shares the tab row')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
