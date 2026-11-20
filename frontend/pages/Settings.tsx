import React, { useEffect, useState } from 'react';
import { Camera, Moon, Sun, Bell, AudioLines, User, ShieldAlert, Target } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useTheme } from '../services/theme';
import { Button, Card, Input, SoonBadge, cn } from '../components/UIComponents';
import { NotificationPreferences, getPreferences, telegramLink, updatePreferences } from '../services/reminderService';
import { confirmAction, notify } from '../components/Feedback';

const Section: React.FC<{ icon: React.ElementType; title: string; description?: string; children: React.ReactNode }> = ({ icon: Icon, title, description, children }) => (
  <section className="border-t border-gray-200 py-7 first:border-t-0 first:pt-0 dark:border-white/[.07]">
    <div className="mb-4 flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-white/[.07]">{children}</div>
  </section>
);

const Row: React.FC<{ label: React.ReactNode; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
      checked ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-700"
    )}
  >
    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
  </button>
);

const speechSupported = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const Settings: React.FC = () => {
  const [name, setName] = useState(() => localStorage.getItem('userName') || '');
  const [photo, setPhoto] = useState(() => localStorage.getItem('profilePic') || '');
  const [saved, setSaved] = useState(false);
  const email = localStorage.getItem('userEmail') || '';

  const [goalDays, setGoalDays] = useState(() => Number(localStorage.getItem('goal_days') || 5));
  const { theme, setTheme: applyTheme } = useTheme();
  const dark = theme === 'dark';
  const [novaName, setNovaName] = useState(() => localStorage.getItem('nova_name') || 'Nova');
  const [wake, setWake] = useState(() => localStorage.getItem('nova_wake') === 'true');
  const [voiceReplies, setVoiceReplies] = useState(() => localStorage.getItem('nova_muted') !== 'true');
  const [notifications, setNotifications] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = useState(false);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');

  useEffect(() => {
    getPreferences()
      .then(p => {
        setPrefs(p);
        setQuietStart(p.quiet_hours_start?.slice(0, 5) ?? '');
        setQuietEnd(p.quiet_hours_end?.slice(0, 5) ?? '');
      })
      .catch(() => setPrefsError(true));
  }, []);

  const connectTelegram = async () => {
    try {
      const { url } = await telegramLink();
      window.open(url, '_blank', 'noopener');
      notify('Tap Start in the Telegram bot, then come back here.', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't start linking Telegram.", 'error');
    }
  };

  const saveQuietHours = async () => {
    const [start, end] = [quietStart, quietEnd];
    try {
      setPrefs(await updatePreferences({
        quiet_hours_start: start || null,
        quiet_hours_end: end || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }));
      notify(start && end ? `Quiet from ${start} to ${end}` : 'Quiet hours off', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't save quiet hours.", 'error');
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('userName', name.trim() || 'Student');
    localStorage.setItem('profilePic', photo);
    setSaved(true);
    notify('Profile saved', 'success');
    window.setTimeout(() => setSaved(false), 2000);
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const setTheme = (isDark: boolean) => applyTheme(isDark ? 'dark' : 'light');

  const saveNova = (changes: { name?: string; wake?: boolean; voice?: boolean }) => {
    if (changes.name !== undefined) localStorage.setItem('nova_name', changes.name.trim() || 'Nova');
    if (changes.wake !== undefined) localStorage.setItem('nova_wake', String(changes.wake));
    if (changes.voice !== undefined) localStorage.setItem('nova_muted', String(!changes.voice));
    window.dispatchEvent(new Event('nova-settings'));
  };

  const askNotifications = async () => {
    if (!('Notification' in window)) return;
    setNotifications(await Notification.requestPermission());
  };

  const clearDeviceData = async () => {
    const ok = await confirmAction({
      title: 'Clear data on this device?',
      message: 'Deletes the subjects, notes, flashcards, quizzes and reminders saved in this browser. This can’t be undone.',
      confirmLabel: 'Clear data',
      danger: true,
    });
    if (!ok) return;
    Object.keys(localStorage)
      .filter(key => key.startsWith('ip_') || ['prep_subjects', 'nova_name', 'nova_wake', 'nova_muted', 'goal_days'].includes(key))
      .forEach(key => localStorage.removeItem(key));
    window.location.assign('/dashboard');
  };

  return (
    <AppShell title="Settings">
      <main className="mx-auto max-w-2xl px-4 py-8 pb-32 sm:px-8">

        <Section icon={User} title="Profile" description="How you appear to your study groups.">
          <form onSubmit={saveProfile} className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <label className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full bg-gray-200 text-2xl font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
              {photo ? <img src={photo} alt="Your profile photo" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{(name || 'S').charAt(0).toUpperCase()}</span>}
              <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 py-1"><Camera className="h-3.5 w-3.5" /></span>
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} aria-label="Change profile photo" />
            </label>
            <div className="flex-1 space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                Name
                <Input value={name} onChange={e => setName(e.target.value)} maxLength={60} className="mt-1" />
              </label>
              <p className="text-xs text-slate-500">Email: <span className="font-semibold text-slate-700 dark:text-slate-200">{email || 'not set'}</span></p>
              <Button type="submit" size="sm">{saved ? 'Saved' : 'Save profile'}</Button>
            </div>
          </form>
        </Section>

        <Section icon={Target} title="Study goal">
          <Row label="Days a week I want to study" hint="Shown in each subject next to the days you actually studied.">
            <select
              value={goalDays}
              onChange={e => { setGoalDays(Number(e.target.value)); localStorage.setItem('goal_days', e.target.value); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}
            </select>
          </Row>
        </Section>

        <Section icon={dark ? Moon : Sun} title="Appearance">
          <Row label="Theme">
            <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
              {[{ value: false, label: 'Light', icon: Sun }, { value: true, label: 'Dark', icon: Moon }].map(option => (
                <button key={option.label} onClick={() => setTheme(option.value)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold", dark === option.value ? "bg-primary-600 text-white" : "text-slate-500")}>
                  <option.icon className="h-3.5 w-3.5" /> {option.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section icon={AudioLines} title="Nova, your study assistant" description={speechSupported ? undefined : 'Voice needs Chrome or Edge. You can still type to Nova.'}>
          <Row label="Assistant name" hint="You wake it by saying “Hey” and this name.">
            <Input value={novaName} maxLength={20} className="w-40"
              onChange={e => setNovaName(e.target.value.replace(/[^a-zA-Z ]/g, ''))}
              onBlur={() => saveNova({ name: novaName })} />
          </Row>
          <Row label={`Listen for “Hey ${novaName || 'Nova'}”`} hint="Keeps the microphone on while IntelliPrep is open. Chrome sends speech to Google to turn it into text.">
            <Toggle label="Wake word" checked={wake} disabled={!speechSupported} onChange={value => { setWake(value); saveNova({ wake: value }); }} />
          </Row>
          <Row label="Speak replies out loud" hint="When you talk to Nova, it answers out loud. Typed questions get written answers.">
            <Toggle label="Speak replies" checked={voiceReplies} onChange={value => { setVoiceReplies(value); saveNova({ voice: value }); }} />
          </Row>
        </Section>

        <Section icon={Bell} title="Notifications">
          <Row label="Reminder pop-ups" hint="Show reminders as desktop notifications while IntelliPrep is open.">
            {notifications === 'granted'
              ? <span className="text-xs font-bold text-emerald-600">On</span>
              : notifications === 'denied'
                ? <span className="text-xs text-slate-500">Blocked in browser settings</span>
                : <Button size="sm" variant="secondary" onClick={askNotifications}>Turn on</Button>}
          </Row>
          <Row label="Telegram reminders" hint="Reminders sent to your Telegram, even when IntelliPrep is closed.">
            {prefsError ? <span className="text-xs text-slate-500">Can't reach the server</span>
              : !prefs ? <span className="text-xs text-slate-400">Checking…</span>
              : prefs.telegram_linked ? <span className="text-xs font-bold text-emerald-600">Connected</span>
              : prefs.channels_available.includes('telegram') ? <Button size="sm" variant="secondary" onClick={connectTelegram}>Connect Telegram</Button>
              : <span className="text-xs text-slate-500">Not set up on this server yet</span>}
          </Row>
          <Row label="Quiet hours" hint="Telegram and email reminders wait until quiet hours end. In-app reminders still show.">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input type="time" aria-label="Quiet from" value={quietStart} onChange={e => setQuietStart(e.target.value)} disabled={!prefs} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900" />
              <span className="text-slate-400">to</span>
              <input type="time" aria-label="Quiet until" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} disabled={!prefs} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900" />
              <Button size="sm" variant="secondary" disabled={!prefs} onClick={saveQuietHours}>Save</Button>
            </div>
          </Row>
          <Row label={<>Weekly progress email<SoonBadge /></>} hint="A short summary of your week.">
            <Toggle label="Weekly email" checked={false} disabled onChange={() => {}} />
          </Row>
        </Section>

        <Section icon={ShieldAlert} title="Account and data">
          <Row label={<>Change password<SoonBadge /></>} hint="Available when full accounts launch.">
            <Button size="sm" variant="secondary" disabled>Change</Button>
          </Row>
          <Row label={<>Delete my account<SoonBadge /></>} hint="Removes your account and everything in it from our servers.">
            <Button size="sm" variant="danger" disabled>Delete account</Button>
          </Row>
          <Row label="Clear data on this device" hint="Removes subjects, notes, flashcards, quizzes and reminders saved in this browser.">
            <Button size="sm" variant="secondary" onClick={clearDeviceData}>Clear</Button>
          </Row>
        </Section>

      </main>
    </AppShell>
  );
};

