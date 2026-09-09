import { useEffect, useReducer, type ReactNode } from 'react'

export interface Toast {
  id: number
  kind: 'ok' | 'err'
  message: string
}

type Action =
  | { type: 'add'; toast: Toast }
  | { type: 'remove'; id: number }

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast]
    case 'remove':
      return state.filter((t) => t.id !== action.id)
  }
}

interface ToastCtx {
  push: (kind: Toast['kind'], message: string) => void
}

let pushFn: ToastCtx['push'] | null = null
let nextId = 1

export function toast(kind: Toast['kind'], message: string) {
  pushFn?.(kind, message)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  useEffect(() => {
    pushFn = (kind, message) => {
      const id = nextId++
      dispatch({ type: 'add', toast: { id, kind, message } })
      setTimeout(() => dispatch({ type: 'remove', id }), 5200)
    }
    return () => {
      pushFn = null
    }
  }, [])

  return (
    <>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}
