import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface ToastContextValue {
  toast: (text: string) => void;
  toastError: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((text: string, kind: 'info' | 'error') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const toast = useCallback((text: string) => push(text, 'info'), [push]);
  const toastError = useCallback((text: string) => push(text, 'error'), [push]);

  return (
    <ToastContext.Provider value={{ toast, toastError }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-wrap" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.kind === 'error' ? ' error' : ''}`}>{t.text}</div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
