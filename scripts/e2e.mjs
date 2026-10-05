// Runs every e2e/*.mjs script against its own Vite server, so `npm run check` proves the browser flows too.
// Usage: node scripts/e2e.mjs [name ...]   (names without .mjs; none runs them all)
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'

const PORT = process.env.E2E_PORT ?? '5199'
const APP_URL = `http://localhost:${PORT}/`
const names = process.argv.slice(2)
const scripts = readdirSync('e2e')
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
  .filter((f) => names.length === 0 || names.includes(f.replace(/\.mjs$/, '')))
if (scripts.length === 0) throw new Error(`no e2e script matches ${names.join(', ')}`)

mkdirSync('e2e/shots', { recursive: true })
const server = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
const stop = () => { try { process.kill(-server.pid) } catch { /* already gone */ } }
process.on('exit', stop)

await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('Local:') && resolve())
  server.on('exit', (code) => reject(new Error(`vite exited with ${code}; is port ${PORT} taken? set E2E_PORT`)))
})

const failed = []
for (const script of scripts) {
  console.log(`\n== e2e/${script}`)
  const run = spawnSync('node', [`e2e/${script}`], { stdio: 'inherit', env: { ...process.env, APP_URL } })
  if (run.status !== 0) failed.push(script)
}
stop()
if (failed.length) {
  console.error(`\ne2e failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`\ne2e passed: ${scripts.length} scripts`)
