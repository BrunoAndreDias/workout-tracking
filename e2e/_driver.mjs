// The one way scripts drive shared flows. e2e/*.mjs, the verify-plano session and scripts/plano.mjs import it,
// so a UI change is fixed here once instead of in every script's copy.
// Every quantity field opens in grams (2fc4aaf), so typing grams needs no unit switch.

const STORAGE_KEYS = ['plans', 'foods', 'units', 'days', 'exercises', 'workout-plans', 'workout-sessions']

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

/** Makes every load of this page boot from `state` (the readStored shape), reloads included. Call before page.goto. */
export const seedStored = (page, state) =>
  page.addInitScript((entries) => {
    for (const [key, value] of entries) localStorage.setItem(`nutrition-tracking:${key}`, JSON.stringify(value))
  }, STORAGE_KEYS.filter((k) => state[k] != null).map((k) => [k, state[k]]))

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
