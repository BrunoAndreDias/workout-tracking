import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RootErrorBoundary } from './CrashPage.tsx'

const render = (crashed: boolean) => {
  const boundary = new RootErrorBoundary({ children: <p>app</p> })
  boundary.state = crashed ? RootErrorBoundary.getDerivedStateFromError() : { crashed: false }
  return renderToStaticMarkup(<>{boundary.render()}</>)
}

describe('RootErrorBoundary', () => {
  it('renders the app until something throws, then the crash page', () => {
    expect(render(false)).toBe('<p>app</p>')
    const crash = render(true)
    expect(crash).toContain('Algo correu mal no Treino.')
    expect(crash).toContain('Os teus dados continuam neste navegador.')
    expect(crash).toContain('>Exportar dados</button>')
    expect(crash).toContain('>Recarregar</button>')
  })
})
