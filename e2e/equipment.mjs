import { chromium } from 'playwright'
import { addGym, createWorkoutPlan, openFresh, openWorkoutTab, readStored, reloadApp, synced, workoutDay } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('dialog', (d) => d.accept())
await openFresh(page, URL + '#treino')

const DB_CURLS = 'Standing Dumbbell Curls'
const BB_CURLS = 'Standing Barbell Curls'
const dialog = page.getByRole('dialog')
const result = (name) => dialog.locator('.result', { has: page.locator('.result-name', { hasText: new RegExp(`^${name}$`) }) })
const flagged = (name) => result(name).evaluate((el) => el.classList.contains('is-missing'))
const pickerNames = () => dialog.locator('.result-name').allTextContents()
const openPicker = async (day, query) => {
  await day.getByRole('button', { name: 'Exercício', exact: true }).click()
  await dialog.getByLabel('Pesquisar exercício').fill(query)
}
const closePicker = async () => {
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
}
const exerciseRow = (name) => page.locator('.equipment-exercise', { has: page.locator('.result-name', { hasText: new RegExp(`^${name}$`) }) })
const findExercise = (name) => page.getByRole('region', { name: 'Exercícios' }).getByLabel('Pesquisar exercício').fill(name)

await openWorkoutTab(page, 'Plano de treino')
await createWorkoutPlan(page, { name: 'Força', days: 3 })
let push = await workoutDay(page, 'Push')
assert(await push.locator('.missing-line').count() === 0, 'with no Gym, no planned Exercise is flagged')
await openPicker(push, 'curl')
assert(await dialog.getByText('Marca o material que tens em Treino → Material').count() === 1, 'with no Gym, the picker points to Treino → Material')
assert(await dialog.locator('.result.is-missing').count() === 0, 'and flags nothing')
assert((await result(DB_CURLS).locator('.result-sub').textContent()) === 'Bíceps · Halteres', 'each row shows its muscle group and its material')
await page.screenshot({ path: `${S}/equipment-picker-no-gym.png` })
await closePicker()

await openWorkoutTab(page, 'Material')
await addGym(page, 'Casa', ['Halteres', 'Banco plano'])
assert(await page.getByRole('group', { name: 'Local ativo' }).getByRole('button', { name: 'Casa', pressed: true }).count() === 1, 'the new Gym Casa is the active one')
assert(await page.locator('.equipment-exercise').count() === 16, 'Exercícios opens on Peito’s 16, not the whole catalog')
await page.screenshot({ path: `${S}/equipment-material-tab.png`, fullPage: true })

await openWorkoutTab(page, 'Plano de treino')
push = await workoutDay(page, 'Push')
const bench = push.locator('.planned', { hasText: 'Flat Barbell Bench Press' })
assert((await bench.locator('.missing-line').textContent()) === 'Falta: Barra, Suporte de barra (rack)', 'a planned barbell bench press says what Casa lacks')
await openPicker(push, 'curl')
let names = await pickerNames()
assert(names.indexOf(DB_CURLS) < names.indexOf(BB_CURLS), 'the dumbbell curl Casa can do lists before the barbell one')
assert(!(await flagged(DB_CURLS)) && (await flagged(BB_CURLS)), 'only the barbell curl is flagged')
assert((await result(BB_CURLS).locator('.missing-line').textContent()) === 'Falta: Barra', 'and it says it lacks a Barra')
assert(await result(BB_CURLS).isEnabled(), 'a flagged Exercise can still be picked')
await page.screenshot({ path: `${S}/equipment-picker-casa.png` })
await closePicker()

await openWorkoutTab(page, 'Material')
await findExercise(BB_CURLS)
await page.getByRole('button', { name: `Tirar Barra de ${BB_CURLS}` }).click()
await page.getByRole('combobox', { name: `Juntar material a ${BB_CURLS}` }).selectOption({ label: 'Halteres' })
assert((await exerciseRow(BB_CURLS).locator('.need-chip').allTextContents()).join('|') === 'Halteres×', 'the corrected barbell curl needs only Halteres')
assert(await exerciseRow(BB_CURLS).getByText('Alterado').count() === 1, 'and is marked Alterado')
await page.getByRole('group', { name: 'Mostrar' }).getByRole('button', { name: 'Alterados' }).click()
assert((await page.locator('.equipment-exercise .result-name').allTextContents()).join('|') === BB_CURLS, 'Alterados lists only the corrected Exercise')
await findExercise(BB_CURLS)
await exerciseRow(BB_CURLS).screenshot({ path: `${S}/equipment-exercise-changed.png` })

await synced(page)
await reloadApp(page)
await openWorkoutTab(page, 'Material')
assert(await page.getByRole('list', { name: 'Material em Casa' }).getByRole('checkbox', { checked: true }).count() === 2, 'after a reload Casa still has its 2 materials')
const stored = (await readStored(page)).equipment
assert(JSON.stringify(stored.needs) === JSON.stringify({ 'standing barbell curls': ['dumbbells'] }), 'the correction is stored by the Exercise’s key')

await openWorkoutTab(page, 'Plano de treino')
push = await workoutDay(page, 'Push')
await openPicker(push, 'curl')
assert(!(await flagged(BB_CURLS)), 'after the correction the barbell curl is not flagged')
assert((await result(BB_CURLS).locator('.result-sub').textContent()) === 'Bíceps · Halteres', 'and shows its corrected material')
await closePicker()

await openWorkoutTab(page, 'Material')
await findExercise(BB_CURLS)
await page.getByRole('button', { name: `Repor o material de ${BB_CURLS}` }).click()
assert(await exerciseRow(BB_CURLS).getByText('Alterado').count() === 0, 'Repor drops the correction')
await addGym(page, 'Ginásio')
await page.getByRole('button', { name: 'Marcar tudo' }).click()

await openWorkoutTab(page, 'Plano de treino')
push = await workoutDay(page, 'Push')
assert(await push.locator('.missing-line').count() === 0, 'at a Ginásio with everything nothing is flagged')
await openPicker(push, 'curl')
assert(!(await flagged(BB_CURLS)), 'not even the barbell curl')
const local = dialog.getByRole('group', { name: 'Local' })
await local.getByRole('button', { name: 'Casa' }).click()
assert(await flagged(BB_CURLS), 'switching the picker to Casa flags the restored barbell curl again')
names = await pickerNames()
assert(names.indexOf(DB_CURLS) < names.indexOf(BB_CURLS), 'and lists it after the dumbbell curl')
await closePicker()

await openWorkoutTab(page, 'Material')
await page.setViewportSize({ width: 375, height: 812 })
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Material has no horizontal scroll at 375 px')
await page.screenshot({ path: `${S}/equipment-material-mobile.png`, fullPage: true })

assert(errors.length === 0, `no console errors (${errors.join(' | ')})`)
await browser.close()
