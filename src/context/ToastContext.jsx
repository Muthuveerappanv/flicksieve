import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

/**
 * Provides the app-wide toast queue plus a stable `triggerToast(message, type)`
 * callback. Renders its children followed by the toast container, so any
 * component under the provider can raise a toast via `useToast()`.
 *
 * `useToast()` returns `{ triggerToast }`.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const triggerToast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ triggerToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            <span>{t.type === 'error' ? '⚠️' : '✨'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns `{ triggerToast }`. Must be called under a <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used within a <ToastProvider>');
  }
  return ctx;
}

export default ToastContext;
