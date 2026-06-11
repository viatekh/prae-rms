import { useState, createContext, useContext, useCallback } from 'react'
import type { ReactNode } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

type ToastType = 'success' | 'error'
interface Toast { id: number; message: string; type: ToastType }

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-in slide-in-from-right
              ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
            {toast.type === 'error'
              ? <AlertCircle size={16} className="shrink-0 mt-0.5" />
              : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}
              className="opacity-70 hover:opacity-100 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
