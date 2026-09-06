import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext({ triggerToast: () => {} });

/**
 * App-wide toast provider. Lane A owns the canonical version of this file;
 * this implementation exists so Lane B's components resolve and the build
 * stays green before integration. `useToast()` returns `{ triggerToast }`.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const triggerToast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ triggerToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export default ToastContext;
