import type { ReactNode } from 'react'

export type NoticeTone = 'error' | 'warning' | 'info'

export function Notice({ tone, className, children }: { tone: NoticeTone; className?: string; children?: ReactNode }) {
  return (
    <p className={`notice notice-${tone}${className ? ` ${className}` : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
