import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock, TriangleAlert, X } from 'lucide-react';
import { Badge, Button, Card, Input } from './UIComponents';
import { notify } from './Feedback';
import { formatDue, loadItems, saveItems, STORE_EVENT } from '../services/studyStore';
import {
  CHANNEL_LABEL, NotificationPreferences, ReminderChannel, ServerReminder,
  createReminder, deleteReminder, getPreferences, listReminders,
} from '../services/reminderService';

const ALL_CHANNELS: ReminderChannel[] = ['app', 'telegram', 'email', 'whatsapp', 'sms'];

const statusLine = (r: ServerReminder) => {
  if (r.status === 'sent') return <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Sent</span>;
  if (r.status === 'failed') return <span className="inline-flex items-center gap-1 text-red-600"><TriangleAlert className="h-3 w-3" /> {r.last_error || 'Not delivered'}</span>;
  if (r.attempts > 0) return <span className="inline-flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" /> Retrying: {r.last_error}</span>;
  return null;
};

/**
 * Reminders for one subject, kept on the server so they're delivered at the right time through
 * the chosen channel, even when IntelliPrep is closed (IP-110).
 */
export const RemindersPanel: React.FC<{ subjectKey: string; subjectName: string }> = ({ subjectKey, subjectName }) => {
  const [reminders, setReminders] = useState<ServerReminder[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setReminders(await listReminders(subjectKey));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [subjectKey]);

  // Reminders made in this browser before they moved to the server are moved over once.
  useEffect(() => {
    (async () => {
      try {
        setPrefs(await getPreferences());
        const local = loadItems('reminders', subjectKey).filter(r => !r.fired && r.date.includes('T') && new Date(r.date).getTime() > Date.now());
        for (const r of local) {
          await createReminder({ message: r.message, when: r.date, subjectKey, subjectName });
        }
        if (local.length) saveItems('reminders', subjectKey, []);
      } catch {
        setOffline(true);
      }
      refresh();
    })();
  }, [subjectKey, subjectName, refresh]);

  // Nova sets reminders too; show them as soon as it does.
  useEffect(() => {
    const onChange = (event: Event) => {
      const { kind } = (event as CustomEvent<{ kind: string }>).detail;
      if (kind === 'reminders') refresh();
    };
    window.addEventListener(STORE_EVENT, onChange);
    return () => window.removeEventListener(STORE_EVENT, onChange);
  }, [refresh]);

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const message = (form.elements.namedItem('message') as HTMLInputElement).value.trim();
    const when = (form.elements.namedItem('dueDate') as HTMLInputElement).value;
    const channel = (form.elements.namedItem('channel') as HTMLSelectElement).value as ReminderChannel;
    if (!message || !when) return;
    setSaving(true);
    try {
      await createReminder({ message, when, channel, subjectKey, subjectName });
      form.reset();
      notify('Reminder set', 'success');
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't set the reminder.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReminder(id);
      setReminders(current => current.filter(r => r.id !== id));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't delete the reminder.", 'error');
    }
  };

  const available = prefs?.channels_available ?? ['app'];
  const channelState = (c: ReminderChannel) => {
    if (!available.includes(c)) return 'not available yet';
    if (c === 'telegram' && !prefs?.telegram_linked) return 'connect it in Settings';
    return null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Reminders</h2>
          <p className="mt-1 text-xs text-gray-500">Delivered at the right time, even when IntelliPrep is closed (except in-app ones).</p>
        </div>
        <Badge color="bg-primary-50 text-primary-800 font-bold">{reminders.filter(r => r.status === 'pending').length} upcoming</Badge>
      </div>

      {offline && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Can't reach the IntelliPrep server, so reminders can't be loaded or set right now.
        </p>
      )}

      <div className="space-y-3">
        {reminders.length === 0 && !offline && <p className="text-center text-xs text-gray-400">No reminders for this subject yet.</p>}
        {reminders.map(r => (
          <Card key={r.id} className="flex items-center justify-between gap-3 border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950/40"><Bell size={18} /></div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{r.message}</h3>
                <p className="mt-0.5 text-[11px] text-gray-500">{formatDue(r.due_at)} · {CHANNEL_LABEL[r.channel]}{r.source === 'nova' ? ' · set by Nova' : ''}</p>
                <p className="text-[11px]">{statusLine(r)}</p>
              </div>
            </div>
            <button onClick={() => remove(r.id)} aria-label={`Delete reminder: ${r.message}`} className="shrink-0 rounded-lg border p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:border-gray-700">
              <X size={14} />
            </button>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <h4 className="text-sm font-extrabold text-gray-800 dark:text-white">New reminder</h4>
        <form onSubmit={add} className="space-y-4 text-xs font-medium">
          <div>
            <label className="mb-1 block font-bold text-gray-500" htmlFor="rem-message">What to remind you about</label>
            <Input id="rem-message" name="message" required maxLength={300} placeholder="e.g. Finish Taylor series practice test" className="text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold text-gray-500" htmlFor="rem-when">When</label>
              <Input id="rem-when" name="dueDate" type="datetime-local" required className="text-sm" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-gray-500" htmlFor="rem-channel">How</label>
              <select id="rem-channel" name="channel" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 dark:border-gray-700 dark:bg-gray-800">
                {ALL_CHANNELS.map(c => {
                  const why = channelState(c);
                  return <option key={c} value={c} disabled={!!why}>{CHANNEL_LABEL[c]}{c === 'app' ? ' (pops up while IntelliPrep is open)' : why ? ` (${why})` : ''}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" isLoading={saving} disabled={offline}>Add reminder</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
