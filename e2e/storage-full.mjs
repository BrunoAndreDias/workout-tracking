import { chromium } from 'playwright'
import { STORE_KEY } from '../src/domain/storeKeys.ts'
import { addGym, appUrl, assert, noHorizontalScroll, openFresh, openPage, openWorkoutTab, readStored, SHOTS, synced } from './_driver.mjs'
const URL = appUrl()
const FULL = 'Não foi possível guardar neste navegador: o armazenamento está cheio. Exporta os dados.'

const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser, { mobile: true })
await openFresh(page, URL + '#treino')
await openWorkoutTab(page, 'Material')

await page.evaluate((fullKey) => {
  const setItem = Storage.prototype.setItem
  window.restoreSetItem = () => (Storage.prototype.setItem = setItem)
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith(fullKey)) throw new DOMException('full', 'QuotaExceededError')
    return setItem.call(this, key, value)
  }
}, STORE_KEY.equipment)
await addGym(page, 'Casa')
const full = page.getByRole('alert').filter({ hasText: FULL })
await full.waitFor()
assert(((await readStored(page)).equipment?.gyms ?? []).length === 0, 'the Local could not be saved')
await page.screenshot({ path: `${SHOTS}/storage-full-390.png` })
assert(await noHorizontalScroll(page), 'the line fits a 390 px phone')

await page.evaluate(() => window.restoreSetItem())
await addGym(page, 'Ginásio')
await full.waitFor({ state: 'detached' })
await synced(page)
assert((await readStored(page)).equipment.gyms.map((g) => g.name).join() === 'Casa,Ginásio', 'the next save that succeeds keeps both Locais and clears the line')

noErrors()
await browser.close()
