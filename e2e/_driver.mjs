// The one way scripts drive shared flows. e2e/*.mjs and the verify-plano session import it,
// so a UI change is fixed here once instead of in every script's copy.
// Every quantity field opens in grams (2fc4aaf), so typing grams needs no unit switch.

/** Adds a catalog food through the real panel; grams omitted keeps the default (the APN portion, else the first unit's grams, else 100 g). */
export async function addFood(page, mealName, query, pick, grams) {
  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: `Adicionar alimento ao ${mealName}`, exact: true }).click()
  await dialog.getByRole('searchbox', { name: 'Pesquisar alimento' }).fill(query)
  await dialog.locator('.result', { hasText: pick }).first().click()
  if (grams !== undefined) await dialog.getByLabel(`Gramas de ${pick}`).fill(String(grams))
  await dialog.getByRole('button', { name: `Adicionar ao ${mealName}` }).click()
  await dialog.waitFor({ state: 'detached' })
}
