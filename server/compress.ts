import type { IncomingMessage, ServerResponse } from 'node:http'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const MIN_BYTES = 1024
// Images, fonts and wasm are compressed already, or too large to compress on every request.
const TEXT = /^(text\/|application\/(json|manifest\+json)|image\/svg)/

/**
 * Ends `res` with `body`, compressed with brotli or gzip when the request accepts it: a year of stores is about 2.6 MB
 * of JSON, which the phone fetches from the Mac on every open.
 */
export function endCompressed(req: IncomingMessage, res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer): void {
  const raw = typeof body === 'string' ? Buffer.from(body) : body
  const accepted = new Set((req.headers['accept-encoding'] ?? '').split(',').map((e) => e.split(';')[0].trim()))
  const encoding = raw.length < MIN_BYTES || !TEXT.test(headers['content-type'] ?? '') ? null : accepted.has('br') ? 'br' : accepted.has('gzip') ? 'gzip' : null
  if (!encoding) {
    res.writeHead(status, { ...headers, vary: 'accept-encoding' }).end(raw)
    return
  }
  // Brotli's default quality takes seconds on megabytes; 4 compresses about as well as gzip's default, faster.
  const out = encoding === 'br' ? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }) : gzipSync(raw)
  res.writeHead(status, { ...headers, vary: 'accept-encoding', 'content-encoding': encoding }).end(out)
}
