import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  // Agent worktrees hold whole copies of the repo.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
