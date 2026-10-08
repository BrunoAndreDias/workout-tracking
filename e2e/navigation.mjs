import { chromium } from 'playwright'
import { openFresh } from './_driver.mjs'
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
assert(await page.title() === 'Diário', 'the page title is Diário')
assert(await current() === 'Diário', 'a bare URL opens on the Diário')
await page.locator('.cal-grid').waitFor()
assert(await page.getByText('Plano alimentar', { exact: true }).count() === 0, 'the header has no Plano alimentar eyebrow')
assert((await views.getByRole('link').allTextContents()).join(' | ') === 'Diário | Treino | Alimentação', 'the tabs run Diário, Treino, Alimentação')

await page.goto(URL + '#planos')
assert(await current() === 'Diário', 'the old #planos hash falls back to the Diário')

const foodTabs = page.getByRole('navigation', { name: 'Alimentação' })
await page.goto(URL + '#historico')
await page.locator('.tiles').waitFor()
assert(await current() === 'Alimentação' && await foodTabs.locator('[aria-current="page"]').textContent() === 'Histórico', 'the old #historico hash opens Alimentação → Histórico')
await foodTabs.getByRole('link', { name: 'Histórico', exact: true }).click()
assert(page.url().endsWith('#alimentacao/historico'), 'Histórico is #alimentacao/historico in the URL')

await page.goto(URL + '#corpo')
await page.locator('.cal-grid').waitFor()
assert(await current() === 'Diário', 'the removed #corpo hash falls back to the Diário')

await views.getByRole('link', { name: 'Alimentação', exact: true }).click()
assert(page.url().endsWith('#alimentacao'), 'Alimentação is #alimentacao in the URL')
await page.getByRole('navigation', { name: 'Planos' }).waitFor()
await page.getByRole('region', { name: 'Almoço', exact: true }).waitFor()
assert(await current() === 'Alimentação', 'the Alimentação tab is current and shows the plan editor')

await page.setViewportSize({ width: 375, height: 812 })
const navBox = await views.boundingBox()
const toggleBox = await page.locator('.theme-toggle').boundingBox()
assert(toggleBox.y < navBox.y + navBox.height, 'at 375 px the theme toggle shares the tab row')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
