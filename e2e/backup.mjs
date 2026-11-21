import { chromium } from 'playwright'
import { openFresh, readStored, rendered } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const FIXTURE = 'src/domain/fixtures/meal-app-backup.json'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL)

const data = page.getByRole('region', { name: 'Dados' })
await data.getByLabel('Ficheiro de dados').setInputFiles(FIXTURE)
const panel = page.getByRole('dialog')
await panel.locator('.backup-summary').waitFor()
const summary = await panel.locator('.backup-summary').textContent()
assert(summary === '1 plano de treino, 1 treino, 1 local de treino', `a Backup from the meal app reads as its workout stores (got ${summary})`)
await page.screenshot({ path: `${S}/backup-meal-app-preview.png` })
await panel.getByRole('button', { name: 'Juntar aos meus dados' }).click()
await page.waitForEvent('load')
await rendered(page)

const stored = await readStored(page)
assert(stored['workout-plans'].plans.map((p) => p.name).join() === 'Força', 'the workout plan came in')
assert(stored['workout-sessions'].sessions[0].note.text === 'Bom treino', 'the session came in with its note')
assert(stored.equipment.gyms.map((g) => g.name).join() === 'Casa', 'the material came in')
const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.endsWith(':sync') && !k.endsWith(':theme')).sort())
assert(keys.every((k) => k.startsWith('workout-tracking:')) && !keys.some((k) => /plans$|foods|units|days|sleep|feel|pains|health|watch/.test(k.replace('workout-plans', ''))), `no food or watch store was written (${keys.join(', ')})`)

await page.goto(`${URL}#treino/2026-05-01`)
await page.getByRole('heading', { name: 'Push' }).first().waitFor()
await page.screenshot({ path: `${S}/backup-meal-app-session.png`, fullPage: true })

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
