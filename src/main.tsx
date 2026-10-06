import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { defaultStorage, installStorage } from './domain/persistence.ts'
import { startSync } from './sync.ts'

// The app reads every store synchronously as it first renders, so the server's copies must be in localStorage before.
const storage = defaultStorage()
const sync = storage && (await startSync({ storage }))
if (sync) {
  installStorage(sync.storage)
  window.addEventListener('online', () => void sync.flush())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sync={sync} />
  </StrictMode>,
)
