'use client';

// src/components/ui/Toast.tsx — Phase 1b
// Per docs/CMS V2.md §三十二 (统一 Toast)
// Provider + useToast() hook + auto-dismiss (3s)

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: 'var(--space-lg)',
  right: 'var(--space-lg)',
  zIndex: 2000,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  pointerEvents: 'none',
};

const toastStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-elevated)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--font-size-sm)',
  minWidth: '200px',
  maxWidth: '400px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  pointerEvents: 'auto',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={containerStyle} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              ...toastStyle,
              borderLeftWidth: '3px',
              borderLeftStyle: 'solid',
              borderLeftColor:
                t.type === 'success'
                  ? 'var(--color-success)'
                  : t.type === 'error'
                  ? 'var(--color-danger)'
                  : 'var(--color-primary)',
            }}
          >
            {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : ''}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
