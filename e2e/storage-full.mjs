import { chromium } from 'playwright'
import { addGym, appUrl, openFresh, openWorkoutTab, readStored, synced } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const FULL = 'Não foi possível guardar neste navegador: o armazenamento está cheio. Exporta os dados.'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL + '#treino')
await openWorkoutTab(page, 'Material')

await page.evaluate(() => {
  const setItem = Storage.prototype.setItem
  window.restoreSetItem = () => (Storage.prototype.setItem = setItem)
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('workout-tracking:equipment')) throw new DOMException('full', 'QuotaExceededError')
    return setItem.call(this, key, value)
  }
})
await addGym(page, 'Casa')
const full = page.getByRole('alert').filter({ hasText: FULL })
await full.waitFor()
assert(((await readStored(page)).equipment?.gyms ?? []).length === 0, 'the Local could not be saved')
await page.screenshot({ path: `${S}/storage-full-390.png` })
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the line fits a 390 px phone')

await page.evaluate(() => window.restoreSetItem())
await addGym(page, 'Ginásio')
await full.waitFor({ state: 'detached' })
await synced(page)
assert((await readStored(page)).equipment.gyms.map((g) => g.name).join() === 'Casa,Ginásio', 'the next save that succeeds keeps both Locais and clears the line')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
