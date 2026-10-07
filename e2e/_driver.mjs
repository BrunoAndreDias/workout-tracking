// The one way scripts drive shared flows. e2e/*.mjs, the verify-plano session and scripts/plano.mjs import it,
// so a UI change is fixed here once instead of in every script's copy.
// Every quantity field opens in grams (2fc4aaf), so typing grams needs no unit switch.

const STORAGE_KEYS = ['plans', 'foods', 'units', 'days', 'exercises', 'workout-plans', 'workout-sessions', 'sleep', 'pains', 'health']

/** A flow failed for a reason the caller can act on; `fix` says how. Playwright's own timeouts say neither. */
export class FlowError extends Error {
  constructor(message, fix) {
    super(message)
    this.fix = fix
  }
}

/** The localStorage documents, parsed (null when absent): the shape of a plano state file. */
export const readStored = (page) =>
  page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, JSON.parse(localStorage.getItem(`nutrition-tracking:${k}`) ?? 'null')])), STORAGE_KEYS)

const storesUrl = (url, key) => new URL(key ? `api/stores/${encodeURIComponent(`nutrition-tracking:${key}`)}` : 'api/stores', url).href

/** Empties the server's database. Only a test server (PLANO_TEST=1: scripts/e2e.mjs, verify-plano launch.sh) allows it. */
export async function resetServer(page, url) {
  const res = await page.request.delete(storesUrl(url))
  if (!res.ok()) throw new FlowError(`${url} refused to reset its stores (${res.status()})`, 'drive a test server: npm run e2e, or verify-plano launch.sh, both set PLANO_TEST=1 and a temp PLANO_DB')
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
  page.waitForFunction(() => (JSON.parse(localStorage.getItem('nutrition-tracking:sync') ?? 'null')?.pending ?? []).length === 0)

/** Writes one store on the server as another device would; the page sees it on its next load. */
export async function putStore(page, url, key, doc) {
  await synced(page)
  const current = (await (await page.request.get(storesUrl(url))).json())[`nutrition-tracking:${key}`]
  const res = await page.request.put(storesUrl(url, key), { data: { doc: JSON.stringify(doc), baseRev: current?.rev ?? null } })
  if (!res.ok()) throw new FlowError(`the server refused ${key} (${res.status()})`, 'check the server log')
}

/** Puts `state` (the readStored shape) on an emptied server, so the next page load boots from it. Call before page.goto. */
export async function seedStored(page, url, state) {
  await resetServer(page, url)
  for (const key of STORAGE_KEYS) {
    if (state[key] == null) continue
    const res = await page.request.put(storesUrl(url, key), { data: { doc: JSON.stringify(state[key]), baseRev: null } })
    if (!res.ok()) throw new FlowError(`the server refused ${key} (${res.status()})`, 'check the server log')
  }
}

/** Plan goal fields, keyed by the name scripts use, with the label the goals panel shows. */
export const GOAL_FIELDS = {
  energy: 'Energia (kcal)',
  protein: 'Proteínas (g)',
  carbs: 'Hidratos (g)',
  fat: 'Lípidos (g)',
  fiber: 'Fibra (g)',
  salt: 'Sal (g)',
}

async function requireMeal(page, name) {
  const meal = page.getByRole('region', { name, exact: true })
  try {
    await meal.waitFor()
  } catch {
    const names = await page.locator('section.meal h2').allTextContents()
    throw new FlowError(`no meal named "${name}"`, `meals on the page: ${names.join(', ')}`)
  }
  return meal
}

async function pickResult(dialog, name, query) {
  const row = dialog.locator('.result', { hasText: name }).first()
  try {
    await row.waitFor()
  } catch {
    const names = await dialog.locator('.result .result-name').allTextContents()
    throw new FlowError(`no result "${name}"${query ? ` for "${query}"` : ''}`, `first results: ${names.slice(0, 5).join(' | ') || '(none)'}`)
  }
  await row.click()
}

/** Adds a catalog food through the real panel; grams omitted keeps the default (the APN portion, else the first unit's grams, else 100 g). Returns the grams added. */
export async function addFood(page, mealName, query, pick, grams) {
  const dialog = page.getByRole('dialog')
  const meal = await requireMeal(page, mealName)
  await meal.getByRole('button', { name: `Adicionar alimento ao ${mealName}`, exact: true }).click()
  await dialog.getByRole('searchbox', { name: 'Pesquisar alimento' }).fill(query)
  await pickResult(dialog, pick, query)
  const field = dialog.getByLabel(`Gramas de ${pick}`)
  if (grams !== undefined) await field.fill(grams.toString().replace('.', ','))
  const added = Number((await field.inputValue()).replace(',', '.'))
  await dialog.getByRole('button', { name: `Adicionar ao ${mealName}` }).click()
  await dialog.waitFor({ state: 'detached' })
  return added
}

/**
 * Replaces `from` with `to` in one meal through the swap panel. Grams: typed, the entry's own (`sameGrams`), or the panel's suggestion.
 * `query` searches inside the panel for a target that is not a suggestion. Returns the grams confirmed.
 */
export async function swapFood(page, mealName, from, to, { query, grams, sameGrams } = {}) {
  if (grams !== undefined && sameGrams) throw new FlowError('grams and sameGrams are exclusive', 'pass one of them')
  const dialog = page.getByRole('dialog')
  const meal = await requireMeal(page, mealName)
  const swap = meal.getByRole('button', { name: `Trocar ${from}`, exact: true })
  try {
    await swap.waitFor()
  } catch {
    const names = await meal.locator('.entry-name').allTextContents()
    throw new FlowError(`no entry "${from}" in ${mealName}`, `entries in ${mealName}: ${names.join(', ') || '(none)'}`)
  }
  await swap.click()
  if (query) await dialog.getByRole('searchbox', { name: 'Pesquisar alimento' }).fill(query)
  await pickResult(dialog, to, query)
  const field = dialog.getByLabel(`Gramas de ${to}`)
  if (grams !== undefined) await field.fill(grams.toString().replace('.', ','))
  if (sameGrams) await dialog.getByRole('button', { name: /^Mesmas gramas/ }).click()
  const swapped = Number((await field.inputValue()).replace(',', '.'))
  await dialog.getByRole('button', { name: 'Confirmar troca' }).click()
  await dialog.waitFor({ state: 'detached' })
  return swapped
}

/** Sets the plan's goals through `Editar metas`. `goals` maps GOAL_FIELDS keys to numbers. */
export async function setGoals(page, goals) {
  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: 'Editar metas' }).click()
  for (const [key, value] of Object.entries(goals)) {
    await dialog.getByLabel(GOAL_FIELDS[key], { exact: true }).fill(value.toString().replace('.', ','))
  }
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await dialog.waitFor({ state: 'detached' })
}

/** The local calendar date as YYYY-MM-DD, which is the date the app calls today. */
export const todayIso = () => new Date().toLocaleDateString('sv-SE')

const longDate = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
const monthYear = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
const localDate = (iso) => new Date(...iso.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))

/** Opens `date`'s (YYYY-MM-DD) Day Log on Alimentação → Hoje, where its meals are edited, through `#alimentacao/hoje/<date>`. */
export async function openDay(page, date) {
  await page.evaluate((hash) => { location.hash = hash }, `alimentacao/hoje/${date}`)
  await page.getByRole('navigation', { name: 'Alimentação' }).waitFor()
  await page.locator('main h2').filter({ hasText: longDate.format(localDate(date)) }).first().waitFor()
}

/** Selects `date` (YYYY-MM-DD) in the Diário calendar, paging months as a user would, so the Overview shows it. The Diário must already be open. */
export async function selectDay(page, date) {
  const target = localDate(date)
  const shown = await page.locator('#calendario-titulo').textContent()
  const monthsAhead = Array.from({ length: 241 }, (_, i) => i - 120).find((k) => monthYear.format(new Date(target.getFullYear(), target.getMonth() + k, 1)) === shown)
  if (monthsAhead === undefined) throw new FlowError(`the calendar shows "${shown}", too far from ${date}`, 'pick a date within ten years of the month shown')
  const step = page.getByRole('button', { name: monthsAhead > 0 ? 'Mês anterior' : 'Mês seguinte', exact: true })
  for (let i = 0; i < Math.abs(monthsAhead); i++) await step.click()
  const label = longDate.format(target)
  const day = page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,|$)`) })
  try {
    await day.click()
  } catch {
    throw new FlowError(`no day button for ${date} in ${monthYear.format(target)}`, 'dates are YYYY-MM-DD and must exist in that month')
  }
  await page.locator('.home-date', { hasText: label }).waitFor()
}

/** Starts the selected empty day from a plan (`plan`: its name), blank (`blank`) or by repeating the last logged day (`repeat`). */
export async function startDay(page, { plan, blank }) {
  const name = plan !== undefined ? `Começar com ${plan}` : blank ? 'Começar em branco' : null
  const button = name ? page.getByRole('button', { name, exact: true }) : page.getByRole('button', { name: /^Repetir / })
  try {
    await button.waitFor()
  } catch {
    const starts = await page.locator('.day-start button').allTextContents()
    if (starts.length === 0) throw new FlowError('this day cannot be started: it is already started, or in the future', 'pick another --date')
    throw new FlowError(`no start button "${name ?? 'Repetir …'}"`, `start buttons on this day: ${starts.join(' | ')}`)
  }
  await button.click()
  await page.getByRole('combobox', { name: 'Plano do dia' }).waitFor()
}

/** Moves planned food from a meal's "Do plano" tray to eaten: one food (`Usar <food>`), or the whole tray. */
export async function eatFromPlan(page, mealName, food) {
  const meal = await requireMeal(page, mealName)
  const button = meal.getByRole('button', { name: food === undefined ? `Usar o plano em ${mealName}` : `Usar ${food}`, exact: true })
  try {
    await button.waitFor()
  } catch {
    const chips = await meal.locator('.plan-chip').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/^Usar /, '')))
    throw new FlowError(food === undefined ? `nothing left to use in ${mealName}` : `no planned food "${food}" in ${mealName}`, `food in the ${mealName} tray: ${chips.join(', ') || '(none: the meal has no plan food, or all of it is used)'}`)
  }
  await button.click()
  await button.waitFor({ state: 'detached' })
}

/** Checks or unchecks an eaten row (`Comi <food>`). Food still in the tray has no row: use eatFromPlan. */
export async function setEaten(page, mealName, food, eaten) {
  const meal = await requireMeal(page, mealName)
  const box = meal.getByRole('checkbox', { name: `Comi ${food}`, exact: true })
  try {
    await box.waitFor()
  } catch {
    const rows = await meal.locator('input[aria-label^="Comi "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').slice(5)))
    throw new FlowError(`no eaten row "${food}" in ${mealName}`, `rows in ${mealName}: ${rows.join(', ') || '(none)'}; food still in the tray needs use-plan`)
  }
  if ((await box.isChecked()) === eaten) return
  const row = await box.elementHandle()
  await box.click()
  await page.waitForFunction(([node, want]) => !node.isConnected || node.checked === want, [row, eaten])
}

/** Imports a plan meal's food into a Diário meal, checked as eaten. `label` is the option text (`<meal>` or `<meal> · <option>`), default the meal's own name. */
export async function importPlan(page, mealName, label = mealName) {
  const meal = await requireMeal(page, mealName)
  const select = meal.getByRole('combobox', { name: `Importar do plano em ${mealName}` })
  const before = await meal.locator('.entries li').count()
  try {
    await select.selectOption({ label }, { timeout: 1000 })
  } catch {
    const labels = (await select.locator('option').allTextContents()).filter((o) => !o.endsWith('…'))
    throw new FlowError(`nothing to import as "${label}" into ${mealName}`, `plan meals with food: ${labels.join(' | ') || '(none: add food to the plan first, or this is not a started day)'}`)
  }
  await page.waitForFunction(([node, n]) => node.querySelectorAll('.entries li').length > n, [await meal.elementHandle(), before])
}

/** The ARIA snapshot of the named region (a meal card, `Corpo`, …), or of `main`. */
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
