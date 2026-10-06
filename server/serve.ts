// Serves the built app (dist/) and the store API from one Node process: `npm run serve`.
// PORT (default 4173) and HOST (default 127.0.0.1, this machine only) choose where it listens; PLANO_DB the database.
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
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
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
})

const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
server.listen(port, host, () => console.log(`Plano alimentar on http://${host}:${port}/ (database ${file})`))
