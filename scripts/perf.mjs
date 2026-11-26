// Measures Treino's performance on the production build with a year of history, under a phone-like CPU, and records it.
// Usage: node scripts/perf.mjs [--runs 7] [--weeks 52] [--against <worktree dir>] [--no-write] [--no-build] [--label <text>] [--profile]
//   --profile prints the top self-time functions of one reopen and of 20 kg keystrokes, then exits; it never writes.
//   Writes perf/latest.json, appends perf/history.jsonl and regenerates perf/STATUS.md, unless --no-write.
//   --against alternates runs between this tree and another built worktree, and prints both sides; it never writes.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createWorkoutPlan, daysAgo, putStore, readStored, synced, todayIso, toIsoDate } from '../e2e/_driver.mjs'
import { freePort } from './testServer.mjs'
import { METRICS, writeStatus } from './perfStatus.mjs'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1] }
const flag = (name) => process.argv.includes(`--${name}`)
const RUNS = Number(arg('runs', 7))
const CPU_SLOWDOWN = 4
const HISTORY_WEEKS = Number(arg('weeks', 52))
const here = process.cwd()
const against = arg('against') && resolve(arg('against'))

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }

async function startServer(dir) {
  if (!flag('no-build')) execFileSync('npx', ['vite', 'build', '--logLevel', 'error', ...(flag('profile') ? ['--minify', 'false'] : [])], { cwd: dir, stdio: 'inherit' })
  const port = await freePort()
  const dbDir = mkdtempSync(join(tmpdir(), 'workout-perf-'))
  const env = { ...process.env, PORT: port, HOST: '127.0.0.1', WORKOUT_TEST: '1', WORKOUT_DB: join(dbDir, 'workout.sqlite'), NODE_NO_WARNINGS: '1' }
  const server = spawn('node', ['server/serve.ts'], { cwd: dir, stdio: 'ignore', detached: true, env })
  const url = `http://127.0.0.1:${port}/`
  const stop = () => { try { process.kill(-server.pid) } catch { /* gone */ } rmSync(dbDir, { recursive: true, force: true }) }
  for (let i = 0; ; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* not yet */ }
    if (i > 100) { stop(); throw new Error(`${dir}: server/serve.ts did not answer on ${url}`) }
    await new Promise((r) => setTimeout(r, 100))
  }
  return { dir, url, stop }
}

/** A year of a 4-day Upper/Lower plan, four sessions a week, built on the server. */
async function seed(browser, url) {
  const page = await browser.newPage()
  await page.goto(url + '#treino')
  await page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Plano de treino' }).click()
  await createWorkoutPlan(page, { name: 'Upper/Lower', days: 4 })
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '+ Novo bloco' }).click()
  await page.locator('.block-card').first().click()
  await page.getByRole('button', { name: 'Começar aqui' }).click()
  await synced(page)
  const stored = await readStored(page)
  const plans = structuredClone(stored.workoutPlans)
  const plan = plans.plans[0]
  const start = daysAgo(HISTORY_WEEKS * 7 + ((daysAgo(0).getDay() + 6) % 7))
  plan.start = { ...plan.start, since: toIsoDate(start) }
  const sessions = []
  let n = 0
  for (let week = 0; week < HISTORY_WEEKS; week++) {
    const block = plan.blocks[Math.floor(week / plan.blocks[0].weeks) % plan.blocks.length]
    for (const [k, offset] of [0, 1, 3, 4].entries()) {
      const d = new Date(start); d.setDate(d.getDate() + week * 7 + offset)
      if (toIsoDate(d) >= todayIso()) continue
      const day = block.days[k]
      const date = toIsoDate(d)
      const id = `perf-${n++}`
      sessions.push({
        id, date, workoutDayId: day.id,
        exercises: day.exercises.map((p, j) => ({
          exerciseId: p.exerciseId,
          sets: Array.from({ length: p.sets }, (_, s) => ({ done: true, kg: 20 + j * 5 + Math.floor(week / 3) * 2.5, reps: p.reps.min + ((week + s) % 3), rir: 2 })),
          target: { kg: 20 + j * 5 + Math.floor(week / 3) * 2.5, reps: p.reps.min, rir: 2 },
        })),
        feel: 1 + (n % 5),
        ...(n % 3 === 0 && { note: { text: `Treino ${n}: correu bem, um pouco cansado no fim.`, createdAt: `${date}T19:00:00`, updatedAt: `${date}T19:05:00` } }),
      })
    }
  }
  await putStore(page, url, 'workoutPlans', plans)
  await putStore(page, url, 'workoutSessions', { version: 4, sessions })
  await page.close()
  return { sessions: sessions.length, sets: sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0), 0) }
}

const PAINT_OBSERVER = () => {
  window.__perf = { lcp: 0 }
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
  const seen = () => { if (!window.__perf.ready && document.getElementById('comecar-treino')) { void document.body.offsetHeight; window.__perf.ready = performance.now() } }
  new MutationObserver(seen).observe(document, { childList: true, subtree: true })
}

/** Runs `act` in the page and returns the main-thread ms until `ready` holds and layout is done, polling one task at a time. */
const timed = (page, act, ready) =>
  page.evaluate(async ([act, ready]) => {
    const fn = (src) => new Function(`return (${src})`)()
    const [a, r] = [fn(act), fn(ready)]
    const before = r.length ? r(null) : null
    const channel = new MessageChannel()
    const task = () => new Promise((res) => { channel.port1.onmessage = res; channel.port2.postMessage(0) })
    const t0 = performance.now()
    a()
    for (let i = 0; i < 5000; i++) {
      if (r(before)) { void document.body.offsetHeight; return performance.now() - t0 }
      await task()
    }
    throw new Error(`never ready: ${ready}`)
  }, [act.toString(), ready.toString()])

async function measureOnce(browser, url, expected) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
  await page.addInitScript(PAINT_OBSERVER)
  const load = async () => {
    await page.waitForFunction(() => window.__perf?.ready, null, { timeout: 60000 })
    await page.waitForTimeout(300)
    return page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
      const res = performance.getEntriesByType('resource')
      const bytes = (re) => res.filter((r) => re.test(r.name)).reduce((a, r) => a + r.transferSize, 0) + (re.test('.html') ? nav.transferSize : 0)
      return { ready: window.__perf.ready, fcp, lcp: window.__perf.lcp, js: bytes(/\.js($|\?)/), css: bytes(/\.css($|\?)/), font: bytes(/\.woff2($|\?)/), api: bytes(/\/api\//) }
    })
  }
  await page.goto(url + '#treino')
  const cold = await load()
  await page.reload()
  const warm = await load()
  const stored = (await readStored(page)).workoutSessions.sessions.length
  if (stored !== expected.sessions) errors.push(`expected ${expected.sessions} sessions in the page, got ${stored}`)

  const startSession = await timed(page, () => document.querySelector('#comecar-treino').closest('section').querySelector('button.primary, button').click(), () => document.querySelectorAll('.set-row').length > 0)
  const ticks = []
  for (let i = 0; i < 6; i++) {
    ticks.push(await timed(page,
      () => [...document.querySelectorAll('.set-row button[aria-pressed="false"]')].find((b) => !b.disabled).click(),
      (before) => { const n = document.querySelectorAll('.set-row button[aria-pressed="true"]').length + 1000 * document.querySelectorAll('.lift-summary').length; return before === null ? n : n !== before }))
  }
  const types = []
  for (let i = 0; i < 5; i++) {
    types.push(await timed(page, () => {
      const input = [...document.querySelectorAll('input')].find((el) => el.getAttribute('aria-label')?.startsWith('Kg da série'))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(50 + Math.random()).slice(0, 4).replace('.', ','))
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, () => true))
  }
  const tab = (name) => `() => [...document.querySelectorAll('nav[aria-label="Treino"] button')].find((b) => b.textContent.trim() === '${name}').click()`
  const planTab = await timed(page, new Function(`return ${tab('Plano de treino')}`)(), () => !!document.querySelector('.block-card'))
  const registoTab = await timed(page, new Function(`return ${tab('Registo')}`)(), () => document.querySelectorAll('.set-row, .lift-summary').length > 0)
  const today = todayIso()
  const doneSets = (await readStored(page)).workoutSessions.sessions.filter((s) => s.date === today).flatMap((s) => s.exercises.flatMap((e) => e.sets)).filter((s) => s.done).length
  if (doneSets < 6) errors.push(`expected 6 sets ticked today, the store has ${doneSets}`)
  await context.close()
  return {
    values: {
      coldLoadMs: cold.ready, warmLoadMs: warm.ready, fcpMs: cold.fcp, lcpMs: cold.lcp,
      startSessionMs: startSession, tickMs: median(ticks), typeKgMs: median(types), planTabMs: planTab, registoTabMs: registoTab,
      jsKB: cold.js / 1024, cssKB: cold.css / 1024, fontKB: cold.font / 1024, apiKB: cold.api / 1024,
    },
    errors,
  }
}

async function profile(page, cdp, label, work) {
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
  await cdp.send('Profiler.start')
  await work()
  const { profile: p } = await cdp.send('Profiler.stop')
  const self = new Map()
  const dt = p.timeDeltas.reduce((a, b) => a + b, 0) / p.samples.length / 1000
  const byId = new Map(p.nodes.map((n) => [n.id, n]))
  for (const id of p.samples) { const { callFrame: f } = byId.get(id); const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`; self.set(k, (self.get(k) ?? 0) + dt) }
  console.log(`\nprofile ${label}: top self time (ms, at ${CPU_SLOWDOWN}× slowdown)`)
  for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${ms.toFixed(1).padStart(7)}  ${k}`)
}

async function profileRun(url) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
  await page.addInitScript(PAINT_OBSERVER)
  await page.goto(url + '#treino')
  await page.waitForFunction(() => window.__perf?.ready)
  await profile(page, cdp, 'reopen', async () => { await page.reload(); await page.waitForFunction(() => window.__perf?.ready); await page.waitForTimeout(300) })
  await page.locator('#comecar-treino').locator('xpath=ancestor::section').getByRole('button').first().click()
  const kg = page.locator('input[aria-label^="Kg da série"]').first()
  await profile(page, cdp, '20 kg keystrokes', async () => { for (let i = 0; i < 20; i++) { await kg.fill(String(40 + i)) } })
  await browser.close()
}

async function measureAll(sides) {
  const browser = await chromium.launch()
  try {
    for (const side of sides) { side.work = await seed(browser, side.url); side.runs = []; side.errors = [] }
    const warmup = await measureOnce(browser, sides[0].url, sides[0].work)
    if (warmup.errors.length) throw new Error(`warm-up run failed: ${warmup.errors.join(' / ')}`)
    for (let i = 0; i < RUNS; i++) for (const side of sides) {
      const { values, errors } = await measureOnce(browser, side.url, side.work)
      side.runs.push(values); side.errors.push(...errors)
      process.stdout.write(`.`)
    }
  } finally { await browser.close() }
  console.log()
  return sides.map((side) => ({
    work: side.work, errors: side.errors, runs: RUNS,
    metrics: Object.fromEntries(METRICS.map(({ key }) => {
      const xs = side.runs.map((r) => r[key])
      return [key, { median: +median(xs).toFixed(1), min: +Math.min(...xs).toFixed(1), max: +Math.max(...xs).toFixed(1) }]
    })),
  }))
}

const print = (label, r) => {
  console.log(`\n${label}: ${r.work.sessions} sessions, ${r.work.sets} sets; ${r.runs} runs; errors ${r.errors.length}`)
  for (const { key, label: name, unit } of METRICS) { const m = r.metrics[key]; console.log(`  ${name.padEnd(30)} ${String(m.median).padStart(8)} ${unit}  (${m.min}–${m.max})`) }
  if (r.errors.length) console.log('  errors:', [...new Set(r.errors)].join(' / '))
}

const sides = [await startServer(here), ...(against ? [await startServer(against)] : [])]
try {
  if (flag('profile')) {
    const browser = await chromium.launch()
    sides[0].work = await seed(browser, sides[0].url)
    await browser.close()
    await profileRun(sides[0].url)
    process.exit(0)
  }
  const results = await measureAll(sides)
  print(here, results[0])
  if (against) {
    print(against, results[1])
    console.log('\nthis tree vs --against (median):')
    for (const { key, label } of METRICS) {
      const [a, b] = [results[0].metrics[key].median, results[1].metrics[key].median]
      console.log(`  ${label.padEnd(30)} ${b} → ${a}  (${b ? (((a - b) / b) * 100).toFixed(1) : '0'}%)`)
    }
  } else if (!flag('no-write')) {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'index.html', 'server', 'vite.config.ts'], { encoding: 'utf8' }).trim() !== ''
    const entry = { at: new Date().toISOString(), commit: dirty ? `${commit}+dirty` : commit, label: arg('label', ''), cpuSlowdown: CPU_SLOWDOWN, ...results[0] }
    if (!existsSync('perf')) mkdirSync('perf')
    writeFileSync('perf/latest.json', JSON.stringify(entry, null, 2) + '\n')
    const history = existsSync('perf/history.jsonl') ? readFileSync('perf/history.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
    history.push(entry)
    const kept = history.length > 20 ? [history[0], ...history.slice(-19)] : history
    writeFileSync('perf/history.jsonl', kept.map((e) => JSON.stringify({ ...e, work: undefined })).join('\n') + '\n')
    writeStatus(kept, entry)
    console.log('\nwrote perf/latest.json, perf/history.jsonl and perf/STATUS.md')
  }
  if (results.some((r) => r.errors.length)) process.exitCode = 1
} finally { for (const s of sides) s.stop() }
