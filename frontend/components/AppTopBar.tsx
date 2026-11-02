import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, Settings, Users } from 'lucide-react';
import { cn } from './UIComponents';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Header for the signed-in pages outside a subject (Groups, Settings). */
export const AppTopBar: React.FC = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Student';
  const profilePic = localStorage.getItem('profilePic') || '';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-md dark:border-slate-900/60 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3" aria-label="IntelliPrep AI dashboard">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-500/25">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold text-slate-900 dark:text-white sm:inline">IntelliPrep AI</span>
        </button>
        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              )}
            >
              <link.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{link.label}</span>
            </NavLink>
          ))}
          <span className="ml-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xs font-bold text-white">
            {profilePic ? <img src={profilePic} alt="" className="h-full w-full object-cover" /> : userName.charAt(0).toUpperCase()}
          </span>
        </nav>
      </div>
    </header>
  );
};
