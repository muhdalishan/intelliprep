import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
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

  useEffect(() => {
    apiFetch<DevSession>('/auth/dev-session').then(setSession).catch(() => setSession(null));
  }, []);

  if (!session) return null;

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-dashed border-amber-400 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200",
        className
      )}
      title="Local test mode: switch student to try collaboration on one computer"
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Testing as
      <select
        value={session.current.key}
        onChange={e => {
          localStorage.setItem(DEV_STUDENT_KEY, e.target.value);
          window.location.reload();
        }}
        className="cursor-pointer bg-transparent font-bold outline-none"
      >
        {session.students.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
    </label>
  );
};
