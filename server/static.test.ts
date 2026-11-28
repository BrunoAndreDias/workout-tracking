import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { staticHandler } from './static.ts'

let close = () => {}
afterEach(() => {
  close()
  close = () => {}
})

async function serve() {
  const root = mkdtempSync(join(tmpdir(), 'workout-static-'))
  const dist = join(root, 'dist/')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"secret":true}')
  writeFileSync(join(dist, 'index.html'), '<p>Treino</p>')
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'export {}')
  const server = createServer(staticHandler(dist, (_req, res) => void res.writeHead(204).end()))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  close = () => server.close()
  const { port } = server.address() as AddressInfo
  return (path: string) =>
    new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
      request({ host: '127.0.0.1', port, path }, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
      })
        .on('error', reject)
        .end()
    })
}

describe('static files', () => {
  it('serves index.html at the root and passes /api/ to the store API', async () => {
    const get = await serve()
    expect(await get('/')).toMatchObject({ status: 200, body: '<p>Treino</p>', headers: { 'content-type': 'text/html; charset=utf-8' } })
    expect((await get('/api/stores')).status).toBe(204)
  })

  it('refuses a path that climbs out of dist', async () => {
    const get = await serve()
    expect(await get('/../package.json')).toMatchObject({ status: 404, body: '' })
    expect(await get('/..%2Fpackage.json')).toMatchObject({ status: 404, body: '' })
  })

  it('answers 400 to a path that cannot be decoded', async () => {
    const get = await serve()
    expect((await get('/%E0')).status).toBe(400)
  })

  it('answers 404 for a missing file', async () => {
    const get = await serve()
    expect((await get('/nope.js')).status).toBe(404)
  })

  it('caches files under /assets/ for good, since each build names them by content hash', async () => {
    const get = await serve()
    expect((await get('/assets/index-abc123.js')).headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect((await get('/')).headers['cache-control']).toBeUndefined()
  })
})
