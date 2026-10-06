import react from '@vitejs/plugin-react'
import type { Connect, Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import { dbPath, openStores, storeHandler } from './server/storeApi.ts'
import type { Stores } from './server/storeApi.ts'

/** Mounts the store API in `vite` and `vite preview`. The database opens on the first request, so vitest never opens it. */
function storeApi(): Plugin {
  let stores: Stores | undefined
  const handle = storeHandler(() => (stores ??= openStores(dbPath())), { allowReset: process.env.PLANO_TEST === '1' })
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.startsWith('/api/')) void handle(req, res).catch(next)
    else next()
  }
  return {
    name: 'plano-store-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), storeApi()],
  server: { port: 5180, strictPort: true },
  // Dictation imports transformers lazily; found only then, Vite re-bundles it and reloads the page mid-recording.
  optimizeDeps: { include: ['@huggingface/transformers'] },
  // Agent worktrees hold whole copies of the repo.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
