import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, FlaskConical } from 'lucide-react';
import { apiFetch, DEV_STUDENT_KEY } from '../services/apiClient';
import { cn } from './UIComponents';

interface DevSession {
  current: { key: string; name: string };
  students: { key: string; name: string }[];
}

/**
 * Local development only: pick which test student this browser acts as, to try study groups
 * with "two people" on one machine. Renders nothing unless the backend is in local mode.
 */
export const DevStudentSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const [session, setSession] = useState<DevSession | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<DevSession>('/auth/dev-session').then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!session) return null;

  const pick = (key: string) => {
    localStorage.setItem(DEV_STUDENT_KEY, key);
    window.location.reload();
  };

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Local test mode: switch student to try groups on one computer"
        className={cn(
          'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-500 transition-colors hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-white/[.04]',
          open && 'bg-gray-200/50 dark:bg-white/[.06]'
        )}
      >
        <FlaskConical className="h-4 w-4 shrink-0 opacity-80" />
        <span className="shrink-0">Testing as</span>
        <span className="min-w-0 flex-1 truncate text-left font-medium text-gray-800 dark:text-gray-200">{session.current.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <ul role="listbox" className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-xl animate-in dark:border-white/[.08] dark:bg-gray-900">
          {session.students.map(student => (
            <li key={student.key}>
              <button
                role="option"
                aria-selected={student.key === session.current.key}
                onClick={() => pick(student.key)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[.06]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600 dark:bg-white/[.08] dark:text-gray-300">{student.name.charAt(0)}</span>
                <span className="flex-1 text-left">{student.name}</span>
                {student.key === session.current.key && <Check className="h-3.5 w-3.5 text-primary-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
