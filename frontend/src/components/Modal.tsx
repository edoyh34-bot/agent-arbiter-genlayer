import type { ReactNode } from 'react'

export default function Modal({
  title,
  hint,
  children,
  onClose,
}: {
  title: string
  hint?: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {hint && <p className="hint">{hint}</p>}
        {children}
      </div>
    </div>
  )
}
