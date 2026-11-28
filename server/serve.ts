// Serves the built app (dist/) and the store API from one Node process: `npm run serve`.
// PORT (default 4173) and HOST (default 127.0.0.1, this machine only) choose where it listens; WORKOUT_DB the database.
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { hostname, networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { phoneUrls } from './lanAddresses.ts'
import { staticHandler } from './static.ts'
import { dbPath, openStores, storeHandler } from './storeApi.ts'

const file = dbPath()
const stores = openStores(file)
const server = createServer(staticHandler(fileURLToPath(new URL('../dist/', import.meta.url)), storeHandler(() => stores)))

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
