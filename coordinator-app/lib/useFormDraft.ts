import { useEffect, useCallback } from 'react';

/**
 * Persists form state to localStorage keyed by `draftKey`.
 * Hydrates on mount, clears on explicit discard.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  draftKey: string,
  value: T,
  setValue: (v: T) => void
) {
  // Hydrate from storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setValue(JSON.parse(saved) as T);
      }
    } catch {
      // Ignore corrupt storage
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Persist every change
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(value));
    } catch {
      // Ignore storage quota errors
    }
  }, [draftKey, value]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  return { clearDraft };
}
