import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { appUrl, assert, clickAndReload, openFresh, openPage, readStored, SHOTS } from './_driver.mjs'
const URL = appUrl()
const FIXTURE = 'e2e/fixtures/treino-backup.json'
const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser, { mobile: true })
await openFresh(page, URL)

const data = page.getByRole('region', { name: 'Dados' })
const mealApp = `${SHOTS}/backup-meal-app.json`
writeFileSync(mealApp, JSON.stringify({ app: 'plano-alimentar', version: 1, stores: { exercises: { version: 1, exercises: [{ id: 'ex-supino', name: 'Supino' }] } } }))
await data.getByLabel('Ficheiro de dados').setInputFiles(mealApp)
const rejected = data.getByRole('alert')
await rejected.waitFor()
assert(await rejected.textContent() === 'Este ficheiro não é uma cópia de segurança do Treino.', 'a Backup from the meal app is rejected like any other foreign file')

await data.getByLabel('Ficheiro de dados').setInputFiles(FIXTURE)
const panel = page.getByRole('dialog')
await panel.locator('.backup-summary').waitFor()
const summary = await panel.locator('.backup-summary').textContent()
assert(summary === '1 plano de treino, 1 treino, 1 local de treino', `a Treino Backup reads as its stores (got ${summary})`)
await page.screenshot({ path: `${SHOTS}/backup-import-preview.png` })
await clickAndReload(page, panel.getByRole('button', { name: 'Juntar aos meus dados' }))

const stored = await readStored(page)
assert(stored.workoutPlans.plans.map((p) => p.name).join() === 'Força', 'the workout plan came in')
assert(stored.workoutSessions.sessions[0].note.text === 'Bom treino', 'the session came in with its note')
assert(stored.equipment.gyms.map((g) => g.name).join() === 'Casa', 'the material came in')

await page.goto(`${URL}#treino/2026-05-01`)
await page.getByRole('heading', { name: 'Push' }).first().waitFor()
await page.screenshot({ path: `${SHOTS}/backup-import-session.png`, fullPage: true })

noErrors()
await browser.close()
