'use client';

import { useState, useCallback, useEffect } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let _addToast: ((t: Omit<ToastItem, 'id'>) => string) | null = null;

export function toast(t: Omit<ToastItem, 'id'>): string {
  if (!_addToast) {
    console.warn('[toast] ToastProvider not mounted');
    return '';
  }
  return _addToast(t);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((t: Omit<ToastItem, 'id'>): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, duration: 5000, ...t }]);
    return id;
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map(t =>
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration ?? 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const dismiss = (id: string) => setToasts(prev => prev.filter(x => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            t.type === 'error' ? 'bg-red-600' :
            t.type === 'success' ? 'bg-green-600' :
            'bg-gray-800'
          }`}
        >
          <span>{t.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className="font-semibold underline hover:no-underline"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
