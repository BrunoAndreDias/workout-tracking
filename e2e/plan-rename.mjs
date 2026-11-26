import { chromium } from 'playwright'
import { appUrl, assert, createWorkoutPlan, openFresh, openWorkoutTab, planTabs } from './_driver.mjs'
const URL = appUrl()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL)

await openWorkoutTab(page, 'Plano de treino')
await createWorkoutPlan(page, { name: 'Força', days: 3 })
const planTitle = () => page.locator('.workout-plan-title').textContent()
const renamePlan = async (name) => {
  await page.getByRole('button', { name: 'Mudar o nome do plano' }).click()
  await page.getByRole('textbox', { name: 'Nome do plano de treino' }).fill(name)
}
await renamePlan('Hipertrofia')
await page.getByRole('button', { name: 'Cancelar' }).click()
assert(await planTitle() === 'Força', 'Cancelar keeps the plan name')
await renamePlan('Hipertrofia')
await page.getByRole('button', { name: 'Guardar' }).click()
assert(await planTitle() === 'Hipertrofia' && (await planTabs(page))[0] === 'Hipertrofia', 'Guardar renames the plan, in its title and its tab')
await renamePlan('Força')
await page.keyboard.press('Enter')
assert(await planTitle() === 'Força', 'Enter saves the new name too')
await renamePlan('   ')
await page.keyboard.press('Enter')
assert(await planTitle() === 'Força', 'an empty name keeps the old one')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
