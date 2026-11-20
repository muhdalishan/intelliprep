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
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-500 transition-colors hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-white/[.04]",
        className
      )}
      title="Local test mode: switch student to try collaboration on one computer"
    >
      <FlaskConical className="h-4 w-4 shrink-0 opacity-80" />
      Testing as
      <select
        value={session.current.key}
        onChange={e => {
          localStorage.setItem(DEV_STUDENT_KEY, e.target.value);
          window.location.reload();
        }}
        className="min-w-0 flex-1 cursor-pointer truncate bg-transparent font-medium text-gray-700 outline-none dark:text-gray-200"
      >
        {session.students.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
    </label>
  );
};
