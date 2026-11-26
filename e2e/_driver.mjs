// The one way scripts drive shared flows. e2e/*.mjs and the verify-treino session import it,
// so a UI change is fixed here once instead of in every script's copy.

import { addDays, mondayOf, toIsoDate } from '../src/domain/dates.ts'
import { DEVICE_KEY, STORE_KEY } from '../src/domain/storeKeys.ts'

export { toIsoDate }

const STORE_NAMES = Object.keys(STORE_KEY)

export function appUrl() {
  const url = process.env.APP_URL
  if (!url) throw new Error('set APP_URL to a test server: run the script with npm run e2e -- <name>')
  return url
}

/** A flow failed for a reason the caller can act on; `fix` says how. Playwright's own timeouts say neither. */
export class FlowError extends Error {
  constructor(message, fix) {
    super(message)
    this.fix = fix
  }
}

/** The localStorage documents, parsed (null when absent), by STORE_KEY name: `workoutPlans`, `workoutSessions`, `exercises`, `equipment`. */
export const readStored = (page) =>
  page.evaluate((keys) => Object.fromEntries(keys.map(([name, key]) => [name, JSON.parse(localStorage.getItem(key) ?? 'null')])), Object.entries(STORE_KEY))

const storesUrl = (url, name) => new URL(name ? `api/stores/${encodeURIComponent(STORE_KEY[name])}` : 'api/stores', url).href

/** Empties the server's database. Only a test server (WORKOUT_TEST=1: scripts/e2e.mjs, verify-treino launch.sh) allows it. */
export async function resetServer(page, url) {
  const res = await page.request.delete(storesUrl(url))
  if (!res.ok()) throw new FlowError(`${url} refused to reset its stores (${res.status()})`, 'drive a test server: npm run e2e, or verify-treino launch.sh, both set WORKOUT_TEST=1 and a temp WORKOUT_DB')
}

/** The app renders only after it has fetched the server's stores, which is after the page's `load` event. */
export const rendered = (page) => page.locator('#root > *').first().waitFor()

/** Opens the app on an empty server, as a first visit: the page's context must be new, so its localStorage is empty. */
export async function openFresh(page, url) {
  await resetServer(page, url)
  await page.goto(url)
  await rendered(page)
}

/** page.reload(), then waits until the app has rendered again. */
export async function reloadApp(page) {
  await page.reload()
  await rendered(page)
}

/** Resolves once every change this page made has reached the server. */
export const synced = (page) =>
  page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? 'null')?.pending ?? []).length === 0, DEVICE_KEY.sync)

/** Writes one store on the server as another device would; the page sees it on its next load. */
export async function putStore(page, url, name, doc) {
  await synced(page)
  const current = (await (await page.request.get(storesUrl(url))).json())[STORE_KEY[name]]
  const res = await page.request.put(storesUrl(url, name), { data: { doc: JSON.stringify(doc), baseRev: current?.rev ?? null } })
  if (!res.ok()) throw new FlowError(`the server refused ${name} (${res.status()})`, 'check the server log')
}

/** Puts `state` (the readStored shape) on an emptied server, so the next page load boots from it. Call before page.goto. */
export async function seedStored(page, url, state) {
  await resetServer(page, url)
  for (const name of STORE_NAMES) {
    if (state[name] == null) continue
    const res = await page.request.put(storesUrl(url, name), { data: { doc: JSON.stringify(state[name]), baseRev: null } })
    if (!res.ok()) throw new FlowError(`the server refused ${name} (${res.status()})`, 'check the server log')
  }
}

/** The local calendar date as YYYY-MM-DD, which is the date the app calls today. */
export const todayIso = () => toIsoDate(new Date())

export const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d }

export const mondayWeeksAgo = (n) => addDays(mondayOf(todayIso()), -7 * n)

/** The app's long date, "quarta-feira, 7 de outubro": `longDate.format(date)`. */
export const longDate = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** The ARIA snapshot of the named region (a Workout Day card, a session card, …), or of `main`. */
export async function regionAria(page, region) {
  if (region === undefined) return page.locator('main').ariaSnapshot()
  const target = page.getByRole('region', { name: region, exact: true })
  try {
    await target.waitFor()
  } catch {
    const names = await page.locator('section[aria-label], section[aria-labelledby]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? document.getElementById(e.getAttribute('aria-labelledby'))?.textContent))
    throw new FlowError(`no region named "${region}"`, `regions on the page: ${names.filter(Boolean).join(', ')}`)
  }
  return target.ariaSnapshot()
}

const exactly = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')

/** In the open exercise picker, picks `name`: a catalog Exercise or one of the user's own by name, else a new one. */
export async function pickExercise(page, name) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Pesquisar exercício').fill(name)
  const found = dialog.locator('.result:not([disabled])').filter({ has: page.locator('.result-name', { hasText: exactly(name) }) })
  if ((await found.count()) > 0) await found.first().click()
  else {
    const create = dialog.getByRole('button', { name: `+ Criar “${name}”` })
    if ((await create.count()) === 0) {
      const names = await dialog.locator('.result:not([disabled]) .result-name').allTextContents()
      throw new FlowError(`cannot pick "${name}": it is already in the day or session`, `pickable: ${names.slice(0, 10).join(', ')}`)
    }
    await create.click()
  }
  await dialog.waitFor({ state: 'detached' })
}

/** Adds an Exercise to a Workout Day's card or a session's card through its "+ Exercício" picker. */
export async function addExercise(scope, name) {
  await scope.getByRole('button', { name: 'Exercício', exact: true }).click()
  await pickExercise(scope.page(), name)
}

/** Swaps a Planned Exercise for another through its ⇄ picker, keeping its role, sets and reps. */
export async function swapExercise(scope, from, to) {
  await scope.getByRole('button', { name: `Trocar ${from}`, exact: true }).click()
  await pickExercise(scope.page(), to)
}

/** On Treino → Plano de treino, creates a Workout Plan of 3 (Push · Pull · Full body) or 4 (Upper and Lower twice) days. */
export async function createWorkoutPlan(page, { name, days = 3 } = {}) {
  if ((await page.getByRole('heading', { name: 'Novo plano de treino' }).count()) === 0) await page.getByRole('button', { name: '+ Novo plano' }).click()
  if (name) await page.getByRole('textbox', { name: 'Nome', exact: true }).fill(name)
  await page.getByRole('button', { name: new RegExp(`^${days} dias`) }).click()
  await page.getByRole('button', { name: 'Criar plano' }).click()
  await page.getByRole('region', { name: 'Blocos' }).waitFor()
}

/** Opens a Treino tab ('Registo', 'Plano de treino', 'Material') through the tab bar. */
export async function openWorkoutTab(page, name) {
  const tab = page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name, exact: true })
  await tab.click()
  await tab.and(page.locator('[aria-current="page"]')).waitFor()
}

/** On Treino → Material, adds a Gym (it becomes the active one) and ticks each material label in `has`. */
export async function addGym(page, name, has = []) {
  await page.getByRole('textbox', { name: 'Nome do novo local' }).fill(name)
  await page.getByRole('button', { name: 'Adicionar local' }).click()
  const checks = page.getByRole('list', { name: `Material em ${name}` })
  await checks.waitFor()
  for (const label of has) {
    const box = checks.getByRole('checkbox', { name: label, exact: true })
    if ((await box.count()) === 0) throw new FlowError(`no material "${label}"`, `material: ${(await checks.locator('label').allTextContents()).join(', ')}`)
    await box.check()
  }
}

/** Shows one day of the selected Training Block in Plano de treino and returns its card. */
export async function workoutDay(page, name) {
  await page.getByRole('navigation', { name: /^Dias de / }).getByRole('button', { name, exact: true }).click()
  return page.getByRole('region', { name, exact: true })
}

/** A stand-in for the Whisper worker, so a script dictates a known text without the 250 MB model. */
const FAKE_WHISPER = `self.onmessage = async ({ data }) => {
  if (data.type === 'warmUp') self.postMessage({ type: 'ready' })
  if (data.type === 'transcribe') self.postMessage({ type: 'result', id: data.id, text: await (await fetch('/__fake-whisper')).text() })
}`

/**
 * Replaces the Whisper worker in `context` with one that transcribes any recording as the text last passed to `say`.
 * The browser needs a fake microphone: launch it with --use-fake-ui-for-media-stream and --use-fake-device-for-media-stream.
 */
export async function fakeWhisper(context) {
  let text = ''
  await context.route('**/whisper.worker.ts*', (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_WHISPER }))
  await context.route('**/__fake-whisper', (route) => route.fulfill({ contentType: 'text/plain; charset=utf-8', body: text }))
  return { say: (said) => { text = said } }
}
