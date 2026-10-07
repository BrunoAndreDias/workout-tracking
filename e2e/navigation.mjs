import { chromium } from 'playwright'
import { longDate, openFresh } from './_driver.mjs'
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
assert((await views.getByRole('link').allTextContents()).join(' | ') === 'Diário | Treino | Alimentação | Corpo', 'the tabs run Diário, Treino, Alimentação, Corpo')

await page.goto(URL + '#planos')
assert(await current() === 'Diário', 'the old #planos hash falls back to the Diário')

const foodTabs = page.getByRole('navigation', { name: 'Alimentação' })
await page.goto(URL + '#historico')
await page.locator('.tiles').waitFor()
assert(await current() === 'Alimentação' && await foodTabs.locator('[aria-current="page"]').textContent() === 'Histórico', 'the old #historico hash opens Alimentação → Histórico')
await foodTabs.getByRole('link', { name: 'Histórico', exact: true }).click()
assert(page.url().endsWith('#alimentacao/historico'), 'Histórico is #alimentacao/historico in the URL')

const isoDaysFromToday = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return { iso: d.toLocaleDateString('sv-SE'), title: longDate.format(d) }
}
const [today, yesterday, twoAgo, tomorrow] = [0, -1, -2, 1].map(isoDaysFromToday)
const corpoDate = () => page.locator('.date-stepper h2').textContent()
await views.getByRole('link', { name: 'Corpo', exact: true }).click()
await page.getByRole('region', { name: 'Corpo', exact: true }).waitFor()
assert(page.url().endsWith('#corpo') && await current() === 'Corpo' && await corpoDate() === today.title, 'Corpo is #corpo and opens on today')
const headings = await page.locator('main').getByRole('heading').evaluateAll((hs) => hs.map((h) => `${h.tagName} ${h.textContent}`))
assert(JSON.stringify(headings) === JSON.stringify(['H1 Corpo', `H2 ${today.title}`, 'H2 Últimos 14 dias']), `Corpo has one h1 and no second Corpo heading (got ${headings})`)
await page.goto(URL + `#corpo/${yesterday.iso}`)
await page.locator('.date-stepper h2', { hasText: yesterday.title }).waitFor()
await page.getByRole('button', { name: 'Dia anterior' }).click()
await page.locator('.date-stepper h2', { hasText: twoAgo.title }).waitFor()
assert(page.url().endsWith(`#corpo/${twoAgo.iso}`), 'the Corpo stepper writes its date to the URL')
await page.goto(URL + `#corpo/${tomorrow.iso}`)
await page.locator('.date-stepper h2', { hasText: today.title }).waitFor()
assert(await page.getByRole('button', { name: 'Dia seguinte' }).isDisabled(), 'a future #corpo date opens on today')
await page.goto(URL + '#corpo/xx')
await page.locator('.date-stepper h2', { hasText: today.title }).waitFor()
assert(await current() === 'Corpo', 'a malformed #corpo date falls back to today')

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
