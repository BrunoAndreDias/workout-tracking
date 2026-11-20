import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CloseIcon } from './icons.tsx'

interface Props {
  eyebrow: string
  title: string
  onClose: () => void
  /** Fixed content under the title, above the scrolling body. */
  head?: ReactNode
  /** What Escape does, when it is not closing the panel. */
  onEscape?: () => void
  children: ReactNode
}

/** A modal side sheet: full height on the right, full screen on phones. */
export function Panel({ eyebrow, title, onClose, head, onEscape = onClose, children }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  // Read during the first render, before an autofocused field inside the panel takes focus.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => {
    const panel = ref.current!
    if (!panel.contains(document.activeElement)) panel.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  return (
    <div className="panel-layer">
      <button type="button" className="scrim" aria-label="Fechar painel" tabIndex={-1} onClick={onClose} />
      <div
        ref={ref}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onEscape()
        }}
      >
        <div className="panel-top">
          <div className="panel-title-row">
            <div>
              <div className="panel-eyebrow">{eyebrow}</div>
              <h2 id={titleId} className="panel-title">{title}</h2>
            </div>
            <button type="button" className="icon-btn panel-close" aria-label="Fechar" onClick={onClose}>
              <CloseIcon size={18} />
            </button>
          </div>
          {head}
        </div>
        {children}
      </div>
    </div>
  )
}
