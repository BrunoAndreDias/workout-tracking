// Playwright session for one verification drive. Import it from a scenario script:
//   import { openApp } from './.claude/skills/verify-treino/scripts/session.mjs'
//   const app = await openApp({ feature: 'workouts' })
// Reads APP_URL and RUN_DIR from the environment (printed by launch.sh).
// Every check and artifact path is appended to <RUN_DIR>/<feature>/steps.log.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { openWorkoutTab, readStored, rendered, resetServer } from '../../../../e2e/_driver.mjs'

export async function openApp({ feature, mobile = false, fresh = true, url = process.env.APP_URL, runDir = process.env.RUN_DIR } = {}) {
  if (!url || !runDir) throw new Error('set APP_URL and RUN_DIR from launch.sh output')
  if (!feature) throw new Error('pass the feature id, e.g. { feature: "workouts" }')
  const dir = `${runDir}/${feature}`
  mkdirSync(dir, { recursive: true })
  const log = (line) => {
    console.log(line)
    appendFileSync(`${dir}/steps.log`, line + '\n')
  }

  const browser = await chromium.launch()
  // A new context has empty localStorage and `fresh` empties the server, so a drive starts with no data.
  // `fresh: false` opens a second device on the same server instead.
  const page = await browser.newPage(
    mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 900 } },
  )
  const errors = []
  const confirms = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('dialog', (d) => {
    confirms.push(d.message())
    log(`confirm: ${d.message()} -> accepted`)
    d.accept()
  })
  if (fresh) await resetServer(page, url)
  await page.goto(url + '#treino')
  await rendered(page)
  log(`open ${url} (${mobile ? 'mobile 390' : 'desktop 1280'})`)

  const dialog = page.getByRole('dialog')
  const app = {
    page,
    dialog,
    confirms,
    errors,
    log,
    /** A region by its exact accessible name: a Workout Day card, a session card, … */
    region: (name) => page.getByRole('region', { name, exact: true }),
    /** Opens a Treino tab ('Registo', 'Plano de treino', 'Material') and waits until it is current. */
    async workoutTab(name) {
      await openWorkoutTab(page, name)
      log(`Treino → ${name}`)
    },
    check(ok, msg) {
      if (!ok) {
        log(`FAIL: ${msg}`)
        throw new Error('FAIL: ' + msg)
      }
      log(`ok: ${msg}`)
    },
    /** Every localStorage document, parsed: the read-only second view of what the UI saved. */
    stored: () => readStored(page),
    async shot(name, fullPage = true) {
      const path = `${dir}/${name}.png`
      await page.screenshot({ path, fullPage })
      log(`screenshot ${path}`)
    },
    async aria(name, locator = page.locator('body')) {
      const path = `${dir}/${name}.aria.yml`
      writeFileSync(path, await locator.ariaSnapshot())
      log(`aria ${path}`)
    },
    async saveStored(name = 'storage') {
      const path = `${dir}/${name}.json`
      writeFileSync(path, JSON.stringify(await app.stored(), null, 2))
      log(`storage ${path}`)
    },
    /** Fails the drive on any console error, then closes the browser. */
    async close() {
      try {
        app.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''))
      } finally {
        await browser.close()
      }
    },
  }
  return app
}
