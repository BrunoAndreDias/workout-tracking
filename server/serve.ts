// Serves the built app (dist/) and the store API from one Node process: `npm run serve`.
// PORT (default 4173) and HOST (default 127.0.0.1, this machine only) choose where it listens; WORKOUT_DB the database.
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { hostname, networkInterfaces } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { endCompressed } from './compress.ts'
import { phoneUrls } from './lanAddresses.ts'
import { dbPath, openStores, storeHandler } from './storeApi.ts'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

const file = dbPath()
const stores = openStores(file)
const api = storeHandler(() => stores)

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  if (pathname.startsWith('/api/')) return api(req, res)
  const path = normalize(join(DIST, pathname === '/' ? 'index.html' : pathname))
  if (!path.startsWith(DIST)) {
    res.writeHead(404).end()
    return
  }
  try {
    const body = await readFile(path)
    const headers: Record<string, string> = { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }
    // Vite names each built asset by its content hash, so a new build is a new URL.
    if (pathname.startsWith('/assets/')) headers['cache-control'] = 'public, max-age=31536000, immutable'
    endCompressed(req, res, 200, headers, body)
  } catch {
    res.writeHead(404).end()
  }
})

const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
const localHostName = (): string | undefined => {
  try {
    if (process.platform === 'darwin') return `${execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim()}.local`
    const name = hostname()
    return name.endsWith('.local') ? name : `${name}.local`
  } catch {
    return undefined
  }
}

server.listen(port, host, () => {
  console.log(`Treino on http://${host}:${port}/ (database ${file})`)
  if (host !== '0.0.0.0' && host !== '::') return
  console.log('Open on the iPhone (same Wi-Fi):')
  for (const url of phoneUrls(networkInterfaces(), localHostName(), port)) console.log(`  ${url}`)
  console.log('Prefer the .local address. It survives a new Wi-Fi IP.')
  console.log('Warning: there is no login. Anyone on this Wi-Fi can read and change everything.')
})
