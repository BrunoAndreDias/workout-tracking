import { chromium } from 'playwright'
import { appUrl, assert, closePicker, createWorkoutPlan, openFresh, openPage, openPicker, openWorkoutTab, SHOTS, workoutDay } from './_driver.mjs'
const URL = appUrl()
const W = 390
const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser, { mobile: true })
await openFresh(page, URL + '#treino')
const dialog = page.getByRole('dialog')
const fits = async (where) => assert(await page.evaluate((w) => document.documentElement.scrollWidth <= w, W), `no horizontal scroll at ${W} px (${where})`)

await openWorkoutTab(page, 'Plano de treino')
await createWorkoutPlan(page)
const push = await workoutDay(page, 'Push')
await page.screenshot({ path: `${SHOTS}/mobile-390-plan.png`, fullPage: true })
await fits('plan')

await openPicker(push)
const box = await dialog.boundingBox()
assert(box.width === W && box.x === 0, 'the exercise picker is full width')
await page.screenshot({ path: `${SHOTS}/mobile-390-picker.png` })
await fits('exercise picker')
await closePicker(page)

await openWorkoutTab(page, 'Registo')
await page.getByRole('button', { name: 'Começar Push' }).click()
await page.screenshot({ path: `${SHOTS}/mobile-390-session.png`, fullPage: true })
await fits('session')

noErrors()
await browser.close()
