import { chromium } from 'playwright'
import { appUrl, assert, createWorkoutPlan, mondayWeeksAgo, openFresh, putStore, readStored, reloadApp, swapExercise, todayIso, workoutDay } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL + '#treino')

const tab = (name) => page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name })
const notice = page.getByRole('region', { name: 'Exercícios a rever' })
const noticeRows = () => notice.locator('.run-row > span:first-child').allTextContents()
const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const row = (day, name) => day.locator('.planned', { has: page.locator('.planned-name', { hasText: new RegExp(`^${name}`) }) })
const plannedEverywhere = (stored, id) => stored.workoutPlans.plans[0].blocks[0].days.flatMap((d) => d.exercises.filter((p) => p.exerciseId === id).map((p) => ({ day: d.name, weeks: p.weeks, since: p.since })))

await tab('Plano de treino').click()
await createWorkoutPlan(page, { days: 3 })
const created = await readStored(page)
const idOf = (name) => created.exercises.exercises.find((e) => e.name === name).id
const [bench, raises, curls] = ['Flat Barbell Bench Press', 'Dumbbell Lateral Raises', 'Standing Barbell Curls'].map(idOf)
const done = (exerciseId) => ({ exerciseId, sets: [{ done: true, kg: 20, reps: 10, rir: 2 }] })
const sessions = [8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ id: `w${n}`, date: mondayWeeksAgo(n), workoutDayId: null, exercises: [done(bench), done(raises), done(curls)] }))
const backdated = structuredClone(created.workoutPlans)
for (const day of backdated.plans[0].blocks[0].days) for (const p of day.exercises) if ([bench, raises, curls].includes(p.exerciseId)) p.since = mondayWeeksAgo(9)
await putStore(page, URL, 'workoutPlans', backdated)
await putStore(page, URL, 'workoutSessions', { version: 4, sessions })
await reloadApp(page)

await tab('Registo').click()
assert((await noticeRows()).join('|') === 'Dumbbell Lateral Raises · 8 semanas feitas|Standing Barbell Curls · 8 semanas feitas', 'after 8 training weeks the accessories are up for review, the main lift is not')
await page.screenshot({ path: `${S}/runs-registo-desktop.png`, fullPage: true })
await page.setViewportSize({ width: 390, height: 844 })
assert(await noScroll(), 'Registo with Exercícios a rever has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/runs-registo-mobile.png`, fullPage: true })

await tab('Plano de treino').click()
const push = await workoutDay(page, 'Push')
assert(await row(push, 'Dumbbell Lateral Raises').locator('.missing-line').textContent() === 'Rever: 8 semanas feitas', 'the plan flags the due exercise in its row')
assert(await row(push, 'Flat Barbell Bench Press').locator('.run-line').textContent() === 'semana 9 · sem limite', 'and counts the main lift’s weeks with no limit')
assert(await push.getByLabel('Semanas de Flat Barbell Bench Press').inputValue() === '', 'a main lift’s weeks field is empty for no limit')
assert(await push.getByLabel('Semanas de Cable Press-Downs').inputValue() === '8', 'an accessory runs 8 weeks')
assert(await row(push, 'Cable Press-Downs').locator('.run-line').textContent() === 'semana 1 de 8', 'and one never done is in its first week')
assert(await noScroll(), 'Plano de treino with weeks fields has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/runs-plan-mobile.png`, fullPage: true })
await page.setViewportSize({ width: 1280, height: 900 })

await tab('Registo').click()
await notice.getByRole('button', { name: 'Mais 4 semanas de Dumbbell Lateral Raises' }).click()
assert((await noticeRows()).join('|') === 'Standing Barbell Curls · 8 semanas feitas', 'Mais 4 semanas takes the exercise off the list')
assert(JSON.stringify(plannedEverywhere(await readStored(page), raises)) === JSON.stringify([{ day: 'Push', weeks: 12, since: mondayWeeksAgo(9) }]), 'and runs it 12 weeks')

await swapExercise(notice, 'Standing Barbell Curls', 'Standing Dumbbell Curls')
assert(await notice.count() === 0, 'Trocar swaps the last due exercise and the notice goes')
const swapped = await readStored(page)
const dumbbell = swapped.exercises.exercises.find((e) => e.name === 'Standing Dumbbell Curls').id
assert(JSON.stringify(plannedEverywhere(swapped, dumbbell)) === JSON.stringify(['Pull', 'Full body'].map((day) => ({ day, weeks: 8, since: todayIso() }))), 'on every day it was planned, starting its run today')
assert(plannedEverywhere(swapped, curls).length === 0, 'and the barbell curls leave the plan')

await tab('Plano de treino').click()
const pull = await workoutDay(page, 'Pull')
assert(await row(pull, 'Standing Dumbbell Curls').locator('.run-line').textContent() === 'semana 1 de 8', 'the plan shows the new exercise in its first week')
await pull.getByLabel('Semanas de Standing Dumbbell Curls').fill('')
assert(await row(pull, 'Standing Dumbbell Curls').locator('.run-line').textContent() === 'semana 1 · sem limite', 'emptying its weeks runs it with no limit')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
