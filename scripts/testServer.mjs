// The one way scripts start a Vite dev server for tests: a free port, a temp database and PLANO_TEST=1.
// scripts/e2e.mjs and scripts/compare.mjs use it, so nothing they start can reach the user's database or port.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const USER_DEV_PORT = '5180'

/** A port the OS says is free right now, so parallel runs and a user's dev server never collide. */
export const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, () => {
      const { port } = probe.address()
      probe.close(() => resolve(String(port)))
    })
  })

/**
 * Starts `vite` in `cwd` on a free port (or `port`) with its own empty database.
 * Resolves once it listens. `env` is what scripts running against it inherit; `stop` is idempotent.
 */
export async function startTestServer({ cwd = process.cwd(), port } = {}) {
  const chosen = String(port ?? (await freePort()))
  if (chosen === USER_DEV_PORT) throw new Error(`refusing port ${USER_DEV_PORT}: it is the user's own dev server`)
  const dbDir = mkdtempSync(join(tmpdir(), 'plano-test-'))
  const env = { ...process.env, PLANO_TEST: '1', PLANO_DB: join(dbDir, 'plano.sqlite') }
  const server = spawn('npx', ['vite', '--port', chosen, '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'inherit'], detached: true, env })
  const stop = () => {
    try { process.kill(-server.pid) } catch { /* already gone */ }
    rmSync(dbDir, { recursive: true, force: true })
  }
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on('data', (d) => d.toString().includes('Local:') && resolve())
      server.on('exit', (code) => reject(new Error(`vite exited with ${code}; is port ${chosen} taken? set E2E_PORT to another`)))
    })
  } catch (e) {
    stop()
    throw e
  }
  return { url: `http://localhost:${chosen}/`, env, stop }
}
