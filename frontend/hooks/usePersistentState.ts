import { useEffect, useState } from 'react';

/**
 * useState that survives a refresh, kept in this browser under `key`.
 * Falls back to in-memory state if the browser refuses to store more (storage full).
 */
export const usePersistentState = <T,>(key: string, initial: () => T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? (JSON.parse(saved) as T) : initial();
    } catch {
      return initial();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn(`Couldn't save ${key}: browser storage is full.`);
    }
  }, [key, value]);

  return [value, setValue] as const;
};
