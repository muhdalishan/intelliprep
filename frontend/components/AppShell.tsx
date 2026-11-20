import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, LogOut, Menu, Moon, Plus, Settings, Sun, Users } from 'lucide-react';
import { cn } from './UIComponents';
import { DevStudentSwitcher } from './DevStudentSwitcher';
import { signOut } from '../services/authService';
import { useTheme } from '../services/theme';
import { listAccountSubjects } from '../services/workspaceService';
import { Subject } from '../types';

// The signed-in app's frame, in the manner of Linear: a quiet sidebar for moving around, and one
// panel with a thin header for the work. Phones get the sidebar as a drawer.

export const SUBJECTS_CHANGED = 'subjects-changed';

type SidebarSubject = Pick<Subject, 'id' | 'name' | 'color'>;

const useSidebarSubjects = (): SidebarSubject[] => {
  const read = (): SidebarSubject[] => {
    try { return JSON.parse(localStorage.getItem('prep_subjects') || '[]'); } catch { return []; }
  };
  const [local, setLocal] = useState<SidebarSubject[]>(read);
  const [remote, setRemote] = useState<SidebarSubject[]>([]);
  useEffect(() => {
    const load = () => {
      setLocal(read());
      listAccountSubjects()
        .then(list => setRemote(list.map(s => ({ id: s.id, name: s.name, color: s.owned ? 'bg-primary-500' : 'bg-indigo-500' }))))
        .catch(() => setRemote([]));
    };
    load();
    window.addEventListener(SUBJECTS_CHANGED, load);
    return () => window.removeEventListener(SUBJECTS_CHANGED, load);
  }, []);
  return [...local, ...remote.filter(r => !local.some(l => l.id === r.id))];
};

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/groups', label: 'Study groups', icon: Users },
];

const itemClass = (active: boolean) => cn(
  'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
  active
    ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-black/[.06] dark:bg-white/[.07] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-white/[.06]'
    : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.04] dark:hover:text-gray-100'
);

interface SidebarProps {
  context?: React.ReactNode;
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ context, onNavigate }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const subjects = useSidebarSubjects();
  const { theme, toggle } = useTheme();
  const userName = localStorage.getItem('userName') || 'Student';
  const userEmail = localStorage.getItem('userEmail') || '';
  const profilePic = localStorage.getItem('profilePic') || '';
  const currentSubject = pathname.match(/^\/subject\/([^/?]+)/)?.[1];

  const go = (to: string) => { navigate(to); onNavigate?.(); };

  return (
    <div className="flex h-full flex-col px-2.5 py-3">
      <div className="mb-4 flex h-8 items-center justify-between px-1">
        <button onClick={() => go('/dashboard')} className="flex min-w-0 items-center gap-2 rounded-md py-1 pr-2" aria-label="IntelliPrep AI dashboard">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white">
            <GraduationCap className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">IntelliPrep AI</span>
        </button>
        <button
          onClick={() => go('/dashboard?new=1')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white"
          title="Add a subject"
          aria-label="Add a subject"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <nav className="space-y-0.5" aria-label="Main">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
            <item.icon className="h-4 w-4 shrink-0 opacity-80" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <p className="mb-2 px-2.5 text-xs font-medium text-gray-500">Subjects</p>
        {subjects.length === 0 && (
          <button onClick={() => go('/dashboard?new=1')} className="px-2.5 py-1.5 text-left text-[13px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-200">
            Add your first subject
          </button>
        )}
        <div className="space-y-0.5">
          {subjects.map(subject => {
            const active = subject.id === currentSubject;
            return (
              <div key={subject.id}>
                <button onClick={() => go(`/subject/${subject.id}`)} className={itemClass(active && !context)} aria-current={active ? 'page' : undefined}>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', subject.color || 'bg-primary-500')} />
                  <span className="truncate">{subject.name}</span>
                </button>
                {active && context && <div className="mb-1 ml-3 mt-0.5 border-l border-gray-200 pl-2 dark:border-white/[.07]">{context}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-white/[.07]">
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
          <Settings className="h-4 w-4 shrink-0 opacity-80" />
          Settings
        </NavLink>
        <DevStudentSwitcher className="w-full" />
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
            {profilePic ? <img src={profilePic} alt="" className="h-full w-full object-cover" /> : userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{userName}</p>
            {userEmail && <p className="truncate text-[11px] text-gray-500">{userEmail}</p>}
          </div>
          <button
            onClick={toggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white"
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200/60 hover:text-red-600 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-red-400"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface AppShellProps {
  /** Left side of the panel header: a title or breadcrumb. */
  title: React.ReactNode;
  /** Right side of the panel header. */
  actions?: React.ReactNode;
  /** Shown in the sidebar under the open subject (its sections). */
  context?: React.ReactNode;
  /** Classes for the panel body; by default it scrolls. */
  bodyClassName?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ title, actions, context, bodyClassName, children }) => {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname]);

  // The sidebar is resizable: drag its right edge (double-click resets). The width is remembered.
  const [width, setWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem('ip_sidebar_width')); if (saved >= 200 && saved <= 420) return saved; } catch { /* storage blocked */ }
    return 240;
  });
  const [resizing, setResizing] = useState(false);
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setResizing(true);
    const move = (ev: PointerEvent) => setWidth(Math.min(420, Math.max(200, startWidth + ev.clientX - startX)));
    const up = () => {
      setResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setWidth(w => { try { localStorage.setItem('ip_sidebar_width', String(w)); } catch { /* storage blocked */ } return w; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const resetWidth = () => { setWidth(240); try { localStorage.setItem('ip_sidebar_width', '240'); } catch { /* storage blocked */ } };

  return (
    <div className={cn("flex h-dvh overflow-hidden bg-gray-100/70 text-gray-900 dark:bg-gray-950 dark:text-gray-100", resizing && "cursor-col-resize select-none")}>
      <aside className="relative hidden shrink-0 lg:block" style={{ width }}>
        <Sidebar context={context} />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={200}
          aria-valuemax={420}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') setWidth(w => Math.max(200, w - 16));
            if (e.key === 'ArrowRight') setWidth(w => Math.min(420, w + 16));
          }}
          title="Drag to resize · double-click to reset"
          className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
        >
          <span className={cn("absolute inset-y-3 left-1/2 w-px -translate-x-1/2 rounded-full transition-colors", resizing ? "bg-primary-500" : "bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-white/20")} />
        </div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} aria-label="Close navigation" />
          <aside className="ip-drawer absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] border-r border-gray-200 bg-gray-50 shadow-2xl dark:border-white/[.07] dark:bg-gray-950">
            <Sidebar context={context} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900 lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-gray-200 lg:dark:border-white/[.07]">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3 dark:border-white/[.07] sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setDrawer(true)}
              className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{title}</div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
        <div className={cn('relative min-h-0 flex-1', bodyClassName ?? 'overflow-y-auto')}>{children}</div>
      </section>
    </div>
  );
};

/** A sidebar entry for the open subject's sections. */
export const ContextItem: React.FC<{ icon: React.ElementType; label: string; active: boolean; badge?: number; onClick: () => void }> = ({ icon: Icon, label, active, badge, onClick }) => (
  <button onClick={onClick} className={itemClass(active)} aria-current={active ? 'page' : undefined}>
    <Icon className="h-4 w-4 shrink-0 opacity-80" />
    <span className="truncate">{label}</span>
    {badge ? <span className="ml-auto rounded bg-orange-500/15 px-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">{badge}</span> : null}
  </button>
);

