import { chromium } from 'playwright'
import { appUrl, assert, longDate, openFresh, openPage, todayIso } from './_driver.mjs'
const URL = appUrl()
const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser, { mobile: true })
await openFresh(page, URL)

const tabs = page.getByRole('navigation', { name: 'Treino' })
assert(await page.title() === 'Treino', 'the page title is Treino')
await tabs.waitFor()
assert(await page.getByRole('navigation', { name: 'Secções' }).count() === 0, 'the header has no view switcher: Treino is the only view')

for (const old of ['#relogio', `#relogio/${todayIso()}`, '#nada']) {
  await page.goto(URL + old)
  await tabs.waitFor()
  assert(await page.getByRole('region', { name: 'Relógio', exact: true }).count() === 0, `the old ${old} hash falls back to Treino`)
}

await page.goto(`${URL}#treino/2026-05-01`)
await page.locator('.date-title').first().waitFor()
assert(await page.locator('.date-title').first().textContent() === longDate.format(new Date(2026, 4, 1)), 'a dated #treino hash opens Treino on that date')

noErrors()
await browser.close()
