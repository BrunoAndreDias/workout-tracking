import { chromium } from 'playwright'
import { addGym, appUrl, assert, clickAndReload, openFresh, openWorkoutTab, synced } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const REFUSED = 'O servidor recusou uma alteração. Fica guardada neste navegador. Exporta os dados e recarrega.'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()))
await openFresh(page, URL + '#treino')
await openWorkoutTab(page, 'Material')
const gyms = async () => JSON.parse((await (await page.request.get(new globalThis.URL('api/stores', URL).href)).json())['workout-tracking:equipment']?.doc ?? '{"gyms":[]}').gyms.map((g) => g.name).join('|')

let puts = 0
await page.route('**/api/stores/**', (route) => {
  if (route.request().method() !== 'PUT') return route.continue()
  puts++
  return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"refused"}' })
})
await addGym(page, 'Casa')
const refused = page.getByRole('alert').filter({ hasText: REFUSED })
await refused.waitFor()
await page.screenshot({ path: `${S}/sync-refused-390.png` })
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the refused line fits a 390 px phone')

await addGym(page, 'Ginásio')
await page.evaluate(() => {
  window.dispatchEvent(new Event('online'))
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(1000)
assert(puts === 1, `a refused store is not sent again: not after a later change, online or visibilitychange (got ${puts} PUTs)`)
assert(await gyms() === '', 'the server does not hold the refused change')

await page.unroute('**/api/stores/**')
await clickAndReload(page, refused.getByRole('button', { name: 'Recarregar' }))
await synced(page)
assert(await gyms() === 'Casa|Ginásio', 'after Recarregar the change kept in the browser is sent again')
assert(await refused.count() === 0, 'the refused line is gone')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
