// The one way scripts start a test server, Vite or server/serve.ts on the build: a free port, a temp database and WORKOUT_TEST=1.
// scripts/e2e.mjs and scripts/perf.mjs use it, so nothing it starts can reach the user's database or port.
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
 * Starts `vite` in `cwd` on a free port (or `port`) with its own empty database. `mode: 'serve'` runs `server/serve.ts` on the built app instead.
 * Resolves once it listens, or rejects after `timeoutMs`. `env` is what scripts running against it inherit; `stop` is idempotent.
 */
export async function startTestServer({ cwd = process.cwd(), port, mode = 'vite', timeoutMs = 30_000 } = {}) {
  const chosen = String(port ?? (await freePort()))
  if (chosen === USER_DEV_PORT) throw new Error(`refusing port ${USER_DEV_PORT}: it is the user's own dev server`)
  const dbDir = mkdtempSync(join(tmpdir(), 'workout-test-'))
  const env = { ...process.env, WORKOUT_TEST: '1', WORKOUT_DB: join(dbDir, 'workout.sqlite') }
  const serve = mode === 'serve'
  const [command, args, ready, url] = serve
    ? ['node', ['server/serve.ts'], 'Treino on', `http://127.0.0.1:${chosen}/`]
    : ['npx', ['vite', '--port', chosen, '--strictPort'], 'Local:', `http://localhost:${chosen}/`]
  const server = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], detached: true, env: serve ? { ...env, PORT: chosen, HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' } : env })
  const stop = () => {
    try { process.kill(-server.pid) } catch { /* already gone */ }
    rmSync(dbDir, { recursive: true, force: true })
  }
  let timer
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${args[0]} in ${cwd} did not listen on port ${chosen} within ${timeoutMs} ms`)), timeoutMs)
      server.stdout.on('data', (d) => d.toString().includes(ready) && resolve())
      server.on('exit', (code) => reject(new Error(`${args[0]} exited with ${code}; is port ${chosen} taken? set E2E_PORT to another`)))
    })
  } catch (e) {
    stop()
    throw e
  } finally {
    clearTimeout(timer)
  }
  return { url, env, stop }
}
