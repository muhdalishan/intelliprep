import { useEffect, useState } from 'react';

// Dark is the default look; a student can switch to light, and the choice is remembered.
// index.html applies the saved theme before first paint so nothing flashes.

export type Theme = 'dark' | 'light';
const EVENT = 'theme-change';

export const currentTheme = (): Theme => (localStorage.getItem('theme') === 'light' ? 'light' : 'dark');

export const setTheme = (theme: Theme) => {
  localStorage.setItem('theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const useTheme = () => {
  const [theme, set] = useState<Theme>(currentTheme);
  useEffect(() => {
    const sync = () => set(currentTheme());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
};
