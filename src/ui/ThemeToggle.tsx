import { useState } from 'react'
import { DEVICE_KEY } from '../domain/storeKeys.ts'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  function toggle() {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(DEVICE_KEY.theme, next) } catch {}
    setTheme(next)
  }

  return (
    <button type="button" className="icon-btn theme-toggle" onClick={toggle} aria-label={next === 'dark' ? 'Mudar para modo escuro' : 'Mudar para modo claro'} title={next === 'dark' ? 'Modo escuro' : 'Modo claro'}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
