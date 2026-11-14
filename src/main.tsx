import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { defaultStorage, installStorage } from './domain/persistence.ts'
import { startSync } from './sync.ts'

// The app reads every store synchronously as it first renders, so the server's copies must be in localStorage before.
// The app's code loads while the stores are on their way.
const storage = defaultStorage()
const [sync, { default: App }] = await Promise.all([storage && startSync({ storage }), import('./App.tsx')])
if (sync) {
  installStorage(sync.storage)
  window.addEventListener('online', () => void sync.flush())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sync={sync} />
  </StrictMode>,
)
