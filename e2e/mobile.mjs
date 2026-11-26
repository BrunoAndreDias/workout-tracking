import { chromium } from 'playwright'
import { appUrl, assert, createWorkoutPlan, openFresh, workoutDay } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const W = 390
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: 844 }, hasTouch: true, isMobile: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL + '#treino')
const dialog = page.getByRole('dialog')
const fits = async (where) => assert(await page.evaluate((w) => document.documentElement.scrollWidth <= w, W), `no horizontal scroll at ${W} px (${where})`)

await page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Plano de treino' }).click()
await createWorkoutPlan(page)
const push = await workoutDay(page, 'Push')
await page.screenshot({ path: `${S}/mobile-390-plan.png`, fullPage: true })
await fits('plan')

await push.getByRole('button', { name: 'Exercício', exact: true }).click()
await dialog.waitFor()
const box = await dialog.boundingBox()
assert(box.width === W && box.x === 0, 'the exercise picker is full width')
await page.screenshot({ path: `${S}/mobile-390-picker.png` })
await fits('exercise picker')
await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()

await page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Registo' }).click()
await page.getByRole('button', { name: 'Começar Push' }).click()
await page.screenshot({ path: `${S}/mobile-390-session.png`, fullPage: true })
await fits('session')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
