import { chromium } from 'playwright'
import { buildZip } from '../src/zipFixture.ts'
import { openFresh, readStored, synced } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL + '#relogio')

const pad = (n) => String(n).padStart(2, '0')
const daysAgo = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return d }
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const short = (d) => `${d.getDate()}/${d.getMonth() + 1}`
const lifted = daysAgo(1)
const ran = daysAgo(3)

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="pt_PT">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Relógio" unit="count" startDate="${iso(lifted)} 08:00:00 +0100" value="120"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="52.3" durationUnit="min" startDate="${iso(lifted)} 18:02:11 +0100" endDate="${iso(lifted)} 18:54:29 +0100">
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="310.5" unit="kcal"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="1800" durationUnit="s" startDate="${iso(ran)} 07:30:00 +0100" endDate="${iso(ran)} 08:00:00 +0100">
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5.2" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="1300" unit="kJ"/>
 </Workout>
 <Workout workoutActivityType="HKWorkoutActivityTypeYoga" durationUnit="min" startDate="${iso(ran)} 21:00:00 +0100"/>
</HealthData>
`
const zip = Buffer.from(await buildZip([
  { name: 'apple_health_export/export_cda.xml', data: '<ClinicalDocument/>' },
  { name: 'apple_health_export/export.xml', data: xml },
  { name: 'apple_health_export/workout-routes/route.gpx', data: '<gpx/>', method: 0 },
]).arrayBuffer())

const dialog = page.getByRole('dialog')
const section = dialog.getByRole('region', { name: 'Treinos do relógio' })
const pick = async (name, buffer) => {
  await page.getByRole('button', { name: 'Ligar Apple Watch' }).click()
  await section.getByLabel('Exportação do Saúde').setInputFiles({ name, mimeType: name.endsWith('.zip') ? 'application/zip' : 'text/xml', buffer })
}
const serverDoc = async () => (await (await page.request.get(new globalThis.URL('/api/stores', URL).href)).json())['workout-tracking:watch-workouts']
const span = `2 treinos do relógio, de ${short(ran)} a ${short(lifted)}`
const liftLine = 'RelógioForça tradicional18:02 · 52 min · 311 kcal'
const runLine = 'RelógioCorrida07:30 · 30 min · 311 kcal · 5,2 km'

await pick('notas.txt', Buffer.from('olá'))
await section.locator('.backup-summary').waitFor()
assert(await section.locator('.backup-summary').textContent() === 'O ficheiro não tem treinos.', 'a file with no workouts says so')
assert(await section.getByRole('button', { name: 'Importar treinos' }).isDisabled(), 'and cannot be imported')
await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()

await pick('export.zip', zip)
await section.locator('.backup-summary').filter({ hasText: 'treinos do relógio' }).waitFor()
assert(await section.locator('.backup-summary').textContent() === span, `the preview counts the export's workouts and their dates (got ${await section.locator('.backup-summary').textContent()})`)
assert(await section.locator('.hint-text').last().textContent() === '1 treino não se leu e fica de fora.', 'and says how many it could not read')
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the panel has no horizontal scroll at 390 px')
await section.screenshot({ path: `${S}/watch-workouts-preview.png` })
await section.getByRole('button', { name: 'Importar treinos' }).click()
await dialog.waitFor({ state: 'detached' })
assert(await page.locator('.backup-done').textContent() === `Importados ${span}.`, 'importing closes the panel and says what came in')

await synced(page)
const stored = (await readStored(page))['watch-workouts']
assert(JSON.stringify(stored.workouts.map((w) => [w.date, w.start, w.activity, w.minutes, w.kcal, w.km])) === JSON.stringify([[iso(ran), '07:30', 'Running', 30, 310.7, 5.2], [iso(lifted), '18:02', 'TraditionalStrengthTraining', 52.3, 310.5, null]]), `the store holds both workouts (got ${JSON.stringify(stored)})`)
const first = await serverDoc()
assert(first.doc === JSON.stringify(stored), 'and the server has the same copy')

await page.goto(`${URL}#treino/${iso(lifted)}`)
const treino = page.getByRole('list', { name: 'Treinos do relógio' })
await treino.waitFor()
assert(await treino.locator('li').allTextContents().then((t) => JSON.stringify(t)) === JSON.stringify([liftLine]), 'Treino lists the watch workout beside the sessions')
assert(await page.locator('#comecar-treino').textContent() === 'Registar as séries', 'and invites logging its sets instead of saying no workout was done')
await page.screenshot({ path: `${S}/watch-workouts-treino.png`, fullPage: true })
await page.goto(`${URL}#treino/${iso(ran)}`)
assert(await treino.locator('li').allTextContents().then((t) => JSON.stringify(t)) === JSON.stringify([runLine]), `the run shows its distance (got ${await treino.locator('li').allTextContents()})`)

await page.goto(`${URL}#relogio`)
await pick('export.zip', zip)
await section.locator('.backup-summary').filter({ hasText: 'treinos do relógio' }).waitFor()
assert(await section.getByText('Já estão todos na app.').count() === 1, 'a second pick of the same export says every workout is there')
await section.getByRole('button', { name: 'Importar treinos' }).click()
await dialog.waitFor({ state: 'detached' })
await synced(page)
const second = await serverDoc()
assert(second.rev === first.rev && second.doc === first.doc, 'importing the same export twice changes nothing')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
