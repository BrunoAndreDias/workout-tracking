import { DatabaseSync } from 'node:sqlite'
import { chromium } from 'playwright'
import { STORE_KEY } from '../src/domain/storeKeys.ts'
import { addGym, createWorkoutPlan, openFresh, openWorkoutTab, rendered, resetServer, synced } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const DB = process.env.WORKOUT_DB
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
if (!DB) throw new Error('set WORKOUT_DB to the test server database (npm run e2e does)')

const OFFLINE = 'Sem ligação ao servidor. As alterações ficam neste navegador até voltar.'
const row = (name) => new DatabaseSync(DB, { readOnly: true }).prepare('SELECT doc, rev FROM stores WHERE key = ?').get(STORE_KEY[name])
const gyms = () => JSON.parse(row('equipment').doc).gyms.map((g) => g.name).join('|')

const browser = await chromium.launch()
const errors = []
/** A new browser profile: its own localStorage, the same server. The browser itself logs each refused request (409, offline). */
async function device(width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())
  return { context, page, open: async () => { await page.goto(URL + '#treino'); await rendered(page) } }
}
const planTabs = (page) => page.getByRole('navigation', { name: 'Planos de treino' }).getByRole('button').allTextContents()

const a = await device()
await openFresh(a.page, URL + '#treino')
await openWorkoutTab(a.page, 'Plano de treino')
await createWorkoutPlan(a.page, { name: 'Força' })
await synced(a.page)
assert(JSON.parse(row('workoutPlans').doc).plans[0].name === 'Força', `device A's workout plan is on disk (rev ${row('workoutPlans').rev})`)

const b = await device(390)
await b.open()
await openWorkoutTab(b.page, 'Plano de treino')
assert((await planTabs(b.page)).includes('Força'), 'a fresh browser on the same server shows the plan')

await openWorkoutTab(b.page, 'Material')
await addGym(b.page, 'Casa')
await synced(b.page)
await openWorkoutTab(a.page, 'Material')
await addGym(a.page, 'Ginásio')
const conflict = a.page.getByRole('alert').filter({ hasText: 'Os dados mudaram noutro dispositivo.' })
await conflict.waitFor()
assert(gyms() === 'Casa', 'the stale device does not overwrite the other device’s Local')
await a.page.screenshot({ path: `${S}/disk-store-conflict.png` })
await conflict.getByRole('button', { name: 'Recarregar' }).click()
await a.page.waitForLoadState('load')
await rendered(a.page)
await openWorkoutTab(a.page, 'Material')
assert(await a.page.getByRole('list', { name: 'Material em Casa' }).count() === 1, 'Recarregar takes the server’s Local')
assert(await a.page.getByRole('alert').count() === 0, 'the conflict line is gone after Recarregar')

await b.context.setOffline(true)
await addGym(b.page, 'Rua')
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor()
await b.page.screenshot({ path: `${S}/disk-store-offline-390.png` })
assert(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the offline line fits a 390 px phone')
assert(gyms() === 'Casa', 'offline, the server still holds one Local')
await b.context.setOffline(false)
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor({ state: 'detached' })
assert(gyms() === 'Casa|Rua', 'back online, the offline change reaches the server')

await b.page.route('**/api/stores**', (route) => route.abort())
await addGym(b.page, 'Parque')
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor()
await b.page.unroute('**/api/stores**')
await b.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await b.page.getByRole('status').filter({ hasText: OFFLINE }).waitFor({ state: 'detached', timeout: 3000 })
assert(gyms() === 'Casa|Rua|Parque', 'coming back into view sends a change the server missed, before the retry timer')

await resetServer(a.page, URL)
const empty = await device()
await empty.open()
await synced(empty.page)
await empty.page.waitForTimeout(1000)
assert(row('workoutPlans') === undefined, 'an empty browser on an empty server does not upload its empty stores')
const old = await device()
const v1Plans = { version: 1, plans: [{ id: 'wp1', name: 'Plano antigo', days: ['wd1', 'wd2', 'wd3'].map((id) => ({ id, name: id, exercises: [{ exerciseId: 'x1', sets: 3, reps: { min: 8, max: 12 } }] })) }], activePlanId: 'wp1' }
await old.page.addInitScript(([key, doc]) => localStorage.getItem(key) ?? localStorage.setItem(key, doc), [STORE_KEY.workoutPlans, JSON.stringify(v1Plans)])
await old.open()
await openWorkoutTab(old.page, 'Plano de treino')
assert((await planTabs(old.page)).includes('Plano antigo'), 'a browser holding a version 1 workout plans doc opens it')
await synced(old.page)
const uploaded = JSON.parse(row('workoutPlans').doc)
assert(uploaded.version === 4 && uploaded.plans[0].name === 'Plano antigo', 'the browser’s plans reach an empty server, saved as version 4')

const [download] = await Promise.all([old.page.waitForEvent('download'), old.page.getByRole('button', { name: 'Exportar dados' }).click()])
const file = `${S}/disk-store-backup.json`
await download.saveAs(file)
const restorer = await device()
await openFresh(restorer.page, URL + '#treino')
await restorer.page.getByLabel('Ficheiro de dados').setInputFiles(file)
await restorer.page.getByRole('button', { name: 'Substituir tudo' }).click()
await restorer.page.waitForLoadState('load')
await rendered(restorer.page)
await synced(restorer.page)
const afterImport = await device()
await afterImport.open()
await openWorkoutTab(afterImport.page, 'Plano de treino')
assert((await planTabs(afterImport.page)).includes('Plano antigo'), 'a backup replaced in one browser reaches the server: a fresh browser opens on Plano antigo')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
