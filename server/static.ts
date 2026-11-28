import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { endCompressed } from './compress.ts'

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

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

const decodePath = (url: string | undefined): string | null => {
  try {
    return decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname)
  } catch {
    return null
  }
}

const isMissing = (e: unknown) => ['ENOENT', 'EISDIR', 'ENOTDIR'].includes((e as NodeJS.ErrnoException | undefined)?.code ?? '')

export function staticHandler(distDir: string, api: Handler) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = decodePath(req.url)
    if (pathname === null) {
      res.writeHead(400).end()
      return
    }
    if (pathname.startsWith('/api/')) return api(req, res)
    const path = normalize(join(distDir, pathname === '/' ? 'index.html' : pathname))
    if (!path.startsWith(distDir)) {
      res.writeHead(404).end()
      return
    }
    try {
      const body = await readFile(path)
      const headers: Record<string, string> = { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }
      if (pathname.startsWith('/assets/')) headers['cache-control'] = 'public, max-age=31536000, immutable'
      endCompressed(req, res, 200, headers, body)
    } catch (e) {
      if (isMissing(e)) {
        res.writeHead(404).end()
        return
      }
      console.error(e)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    }
  }
}
