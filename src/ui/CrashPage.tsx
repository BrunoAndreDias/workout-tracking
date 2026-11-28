import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import { defaultStorage } from '../domain/persistence.ts'
import { downloadBackup, exportProblem } from './exportFile.ts'
import { Notice } from './Notice.tsx'

export function CrashPage() {
  const [problem, setProblem] = useState<string | null>(null)

  const exportData = () => {
    const storage = defaultStorage()
    if (!storage) return setProblem('O armazenamento do navegador não está disponível.')
    setProblem(exportProblem(downloadBackup(storage)))
  }

  return (
    <main className="crash" aria-labelledby="crash-title">
      <h1 id="crash-title" className="crash-title">
        Algo correu mal no Treino.
      </h1>
      <p>Os teus dados continuam neste navegador.</p>
      <div className="crash-actions">
        <button type="button" className="secondary" onClick={exportData}>
          Exportar dados
        </button>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
      {problem && <Notice tone="error">{problem}</Notice>}
    </main>
  )
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  render() {
    return this.state.crashed ? <CrashPage /> : this.props.children
  }
}
