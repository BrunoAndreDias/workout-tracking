import { DatabaseSync } from 'node:sqlite'
import { chromium } from 'playwright'
import { addFood, openFresh, rendered, resetServer, synced } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const DB = process.env.PLANO_DB
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
if (!DB) throw new Error('set PLANO_DB to the test server database (npm run e2e does)')

const PAO = 'Pão de mistura de trigo e centeio'
const OFFLINE = 'Sem ligação ao servidor. As alterações ficam neste navegador até voltar.'
const row = (key) => new DatabaseSync(DB, { readOnly: true }).prepare('SELECT doc, rev FROM stores WHERE key = ?').get(`nutrition-tracking:${key}`)

const browser = await chromium.launch()
const errors = []
/** A new browser profile: its own localStorage, the same server. The browser itself logs each refused request (409, offline). */
async function device(hash = '#alimentacao', width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())
  return { context, page, open: async () => { await page.goto(URL + hash); await rendered(page) } }
}
const kcal = async (page) => (await page.locator('.donut-figure').textContent()).replace(/\s/g, '')
const sleepButton = (page, label) => page.getByRole('region', { name: 'Corpo' }).getByRole('group', { name: 'Sono' }).getByRole('button', { name: label })
const pressed = async (page, label) => (await sleepButton(page, label).getAttribute('aria-pressed')) === 'true'

const a = await device('#diario')
await openFresh(a.page, URL + '#diario')
await sleepButton(a.page, 'Sono: Bem').click()
await a.page.getByRole('button', { name: 'Começar em branco' }).click()
await addFood(a.page, 'Pequeno-almoço', 'pao de mistura', PAO, 120)
assert(await kcal(a.page) === '326', 'device A logs 120 g pão, 326 kcal, and sleep 4')
await synced(a.page)
assert(JSON.parse(row('sleep').doc).entries[0].quality === 4, `the sleep row on disk holds quality 4 (rev ${row('sleep').rev})`)

const b = await device('#diario', 390)
await b.open()
assert(await pressed(b.page, 'Sono: Bem'), 'a fresh browser on the same server shows sleep 4')
assert(await kcal(b.page) === '326', 'a fresh browser on the same server shows the 326 kcal day')

await sleepButton(b.page, 'Sono: Mal').click()
await synced(b.page)
await sleepButton(a.page, 'Sono: Muito bem').click()
const conflict = a.page.getByRole('alert').filter({ hasText: 'Os dados mudaram noutro dispositivo.' })
await conflict.waitFor()
assert(JSON.parse(row('sleep').doc).entries[0].quality === 2, 'the stale device does not overwrite the other device’s sleep 2')
await a.page.screenshot({ path: `${S}/disk-store-conflict.png` })
await conflict.getByRole('button', { name: 'Recarregar' }).click()
await a.page.waitForLoadState('load')
await rendered(a.page)
assert(await pressed(a.page, 'Sono: Mal'), 'Recarregar takes the server’s sleep 2')
assert(await a.page.getByRole('alert').count() === 0, 'the conflict line is gone after Recarregar')

await b.context.setOffline(true)
await sleepButton(b.page, 'Sono: Normal').click()
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor()
await b.page.screenshot({ path: `${S}/disk-store-offline-390.png` })
assert(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the offline line fits a 390 px phone')
assert(JSON.parse(row('sleep').doc).entries[0].quality === 2, 'offline, the server still holds sleep 2')
await b.context.setOffline(false)
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor({ state: 'detached' })
assert(JSON.parse(row('sleep').doc).entries[0].quality === 3, 'back online, the offline change reaches the server: sleep 3')

await resetServer(a.page, URL)
const old = await device()
const v1Plans = { version: 1, state: { plans: [{ id: 'old', name: 'Plano antigo', meals: [{ id: 'm0', name: 'Pequeno-almoço', entries: [{ id: 'e0', foodId: '430', grams: 120 }] }] }], selectedId: 'old' } }
await old.page.addInitScript((doc) => localStorage.getItem('nutrition-tracking:plans') ?? localStorage.setItem('nutrition-tracking:plans', doc), JSON.stringify(v1Plans))
await old.open()
assert(await kcal(old.page) === '326', 'a browser holding a version 1 plans doc opens it at 326 kcal')
await synced(old.page)
const uploaded = JSON.parse(row('plans').doc)
assert(uploaded.version === 3 && uploaded.state.plans[0].name === 'Plano antigo', 'the browser’s plans reach an empty server, saved as version 3')
const later = await device()
await later.open()
assert(await later.page.getByRole('navigation', { name: 'Planos' }).getByText('Plano antigo').count() === 1, 'another fresh browser opens on Plano antigo')

const [download] = await Promise.all([later.page.waitForEvent('download'), later.page.getByRole('button', { name: 'Exportar dados' }).click()])
const file = `${S}/disk-store-backup.json`
await download.saveAs(file)
const restorer = await device()
await openFresh(restorer.page, URL + '#alimentacao')
assert(await restorer.page.getByRole('navigation', { name: 'Planos' }).getByText('Plano antigo').count() === 0, 'the emptied server starts on the default plan')
await restorer.page.getByLabel('Ficheiro de dados').setInputFiles(file)
await restorer.page.getByRole('button', { name: 'Substituir tudo' }).click()
await restorer.page.waitForLoadState('load')
await restorer.page.getByRole('navigation', { name: 'Planos' }).getByText('Plano antigo').waitFor()
await synced(restorer.page)
const afterImport = await device()
await afterImport.open()
assert(await afterImport.page.getByRole('navigation', { name: 'Planos' }).getByText('Plano antigo').count() === 1, 'a backup replaced in one browser reaches the server: a fresh browser opens on Plano antigo')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
