import { chromium } from 'playwright'
import { STORE_KEY } from '../src/domain/storeKeys.ts'
import { addGym, appUrl, assert, clickAndReload, createWorkoutPlan, noHorizontalScroll, openFresh, openPage, openWorkoutTab, readServerStore, SHOTS, synced } from './_driver.mjs'
const URL = appUrl()
const REFUSED = 'O servidor recusou uma alteração. Fica guardada neste navegador. Exporta os dados e recarrega.'

const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser, { mobile: true, allowFailedLoads: true })
await openFresh(page, URL + '#treino')
await openWorkoutTab(page, 'Material')
const gyms = async () => ((await readServerStore(page, URL, 'equipment'))?.gyms ?? []).map((g) => g.name).join('|')

const isPut = (request, name) => request.method() === 'PUT' && request.url().endsWith(`/api/stores/${encodeURIComponent(STORE_KEY[name])}`)
let puts = 0
await page.route('**/api/stores/**', (route) => {
  if (!isPut(route.request(), 'equipment')) return route.continue()
  puts++
  return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"refused"}' })
})
await addGym(page, 'Casa')
const refused = page.getByRole('alert').filter({ hasText: REFUSED })
await refused.waitFor()
await page.screenshot({ path: `${SHOTS}/sync-refused-390.png` })
assert(await noHorizontalScroll(page), 'the refused line fits a 390 px phone')

await addGym(page, 'Ginásio')
await page.evaluate(() => {
  window.dispatchEvent(new Event('online'))
  document.dispatchEvent(new Event('visibilitychange'))
})
await openWorkoutTab(page, 'Plano de treino')
const nextRoundTrip = page.waitForResponse((res) => isPut(res.request(), 'workoutPlans'))
await createWorkoutPlan(page, { name: 'Força' })
await nextRoundTrip
assert(puts === 1, `a refused store is not sent again: not after a later change, online, visibilitychange or the next sync of another store (got ${puts} PUTs)`)
assert(await gyms() === '', 'the server does not hold the refused change')

await page.unroute('**/api/stores/**')
await clickAndReload(page, refused.getByRole('button', { name: 'Recarregar' }))
await synced(page)
assert(await gyms() === 'Casa|Ginásio', 'after Recarregar the change kept in the browser is sent again')
assert(await refused.count() === 0, 'the refused line is gone')

noErrors()
await browser.close()
