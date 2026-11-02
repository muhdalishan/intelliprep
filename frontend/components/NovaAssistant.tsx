import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, X, Settings2, Volume2, VolumeX, Send, Bell, StickyNote, ListTodo, ArrowUpRight, AudioLines, AlertTriangle,
} from 'lucide-react';
import { cn } from './UIComponents';
import { speechSupported, useVoice } from '../hooks/useVoice';
import { AssistantAction, AssistantTurn, loadSubjects, runActions, sendCommand } from '../services/assistantService';
import { allReminders, formatDue, markReminderFired } from '../services/studyStore';

const SECTION_NAMES: Record<string, string> = {
  dashboard: 'your dashboard', overview: 'Overview', upload: 'Documents', summary: 'Summaries', flashcards: 'Flashcards',
  quiz: 'Quiz', exam: 'Timed Exam', 'weak-topics': 'Weak Topics', 'guess-engine': 'Exam Guess', studyroom: 'Study Group',
  kanban: 'Planner', moodboard: 'Moodboard', reminders: 'Reminders',
};

interface Receipt {
  icon: React.ElementType;
  text: string;
  warning?: boolean;
}

const describe = (actions: AssistantAction[], currentSubjectId: string | null): Receipt[] => {
  const names = Object.fromEntries(loadSubjects().map(s => [s.id, s.name]));
  return actions.map(action => {
    const subject = names[action.subject_id ?? currentSubjectId ?? ''] ?? 'this subject';
    switch (action.type) {
      case 'set_reminder':
        return { icon: Bell, text: `Reminder for ${formatDue(action.due ?? '')}: ${action.title}` };
      case 'add_note':
        return { icon: StickyNote, text: `Note saved to ${subject}'s moodboard: ${action.title}` };
      case 'add_task':
        return { icon: ListTodo, text: `Task added to ${subject}'s planner: ${action.title}` };
      default:
        return { icon: ArrowUpRight, text: `Opened ${SECTION_NAMES[action.section ?? ''] ?? action.section}` };
    }
  });
};

// A short rising tone when Nova starts listening after hearing its name.
const chime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* audio not available */ }
};

const askNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
};

export const NovaAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentSubjectId = location.pathname.match(/^\/subject\/([^/?]+)/)?.[1] ?? null;

  const [isOpen, setIsOpen] = useState(false);

  // Only one assistant panel is open at a time.
  useEffect(() => {
    if (isOpen) window.dispatchEvent(new CustomEvent('assistant-opened', { detail: 'nova' }));
  }, [isOpen]);
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== 'nova') setIsOpen(false); };
    window.addEventListener('assistant-opened', onOther);
    return () => window.removeEventListener('assistant-opened', onOther);
  }, []);
  const [name, setName] = useState(() => localStorage.getItem('nova_name') || 'Nova');
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem('nova_wake') === 'true' && speechSupported);
  const [muted, setMuted] = useState(() => localStorage.getItem('nova_muted') === 'true');
  const [showSettings, setShowSettings] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  // The name is used to wake Nova, so it must never be empty while the field is being edited.
  const assistantName = name.trim() || 'Nova';

  useEffect(() => { localStorage.setItem('nova_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('nova_wake', String(wakeEnabled)); }, [wakeEnabled]);
  useEffect(() => { localStorage.setItem('nova_muted', String(muted)); }, [muted]);

  // The Settings page changes Nova's name, wake word and voice; follow along.
  useEffect(() => {
    const sync = () => {
      setName(localStorage.getItem('nova_name') || 'Nova');
      setWakeEnabled(localStorage.getItem('nova_wake') === 'true' && speechSupported);
      setMuted(localStorage.getItem('nova_muted') === 'true');
    };
    window.addEventListener('nova-settings', sync);
    return () => window.removeEventListener('nova-settings', sync);
  }, []);

  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const speakRef = useRef<(text: string, muted: boolean) => void>(() => {});
  const doneRef = useRef<() => void>(() => {});

  const handleCommand = useCallback(async (text: string) => {
    setIsOpen(true);
    setThinking(true);
    setNotice(null);
    setReceipts([]);
    setTurns(t => [...t, { role: 'user', text }]);

    const result = await sendCommand(text, assistantName, currentSubjectId, turnsRef.current);
    let destination: string | null = null;
    try {
      destination = await runActions(result.actions, currentSubjectId);
    } catch (error) {
      result.skipped.push(error instanceof Error ? error.message : "Something couldn't be saved.");
    }
    setReceipts([
      ...describe(result.actions, currentSubjectId),
      ...result.skipped.map(text => ({ icon: AlertTriangle, text, warning: true })),
    ]);
    if (result.actions.some(a => a.type === 'set_reminder')) askNotificationPermission();
    setTurns(t => [...t, { role: 'assistant', text: result.reply }].slice(-12));
    setThinking(false);
    if (destination) navigate(destination);
    speakRef.current(result.reply, mutedRef.current);
  }, [assistantName, currentSubjectId, navigate]);

  const voice = useVoice({
    name: assistantName,
    wakeEnabled,
    onCommand: handleCommand,
    onError: message => {
      setNotice(message);
      setWakeEnabled(false);
      doneRef.current();
    },
  });
  speakRef.current = voice.speak;
  doneRef.current = voice.done;

  // Hearing the wake word opens the panel with a chime.
  const previousState = useRef(voice.state);
  useEffect(() => {
    if (previousState.current === 'waiting' && voice.state === 'listening') {
      chime();
      setIsOpen(true);
    }
    previousState.current = voice.state;
  }, [voice.state]);

  // Reminders set by Nova (or in Reminders) pop up and are spoken when they fall due.
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const { subjectId, reminder } of allReminders()) {
        if (reminder.fired || !reminder.date.includes('T')) continue;
        if (new Date(reminder.date).getTime() > now) continue;
        markReminderFired(subjectId, reminder.id);
        setNotice(`Reminder: ${reminder.message}`);
        setIsOpen(true);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`${name} reminder`, { body: reminder.message });
        }
        speakRef.current(`Reminder: ${reminder.message}`, mutedRef.current);
      }
    };
    check();
    const timer = window.setInterval(check, 20_000);
    return () => window.clearInterval(timer);
  }, [name]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text || thinking) return;
    setTyped('');
    // "Hey Nova, ..." typed out still works; the rest keeps its original wording and punctuation.
    const greeting = new RegExp(`^\\s*(?:(?:hey|hi|ok|okay|hello)\\s+)?${assistantName}\\b[\\s,:.!-]*`, 'i');
    handleCommand(text.replace(greeting, '').trim() || text);
  };

  const status = thinking
    ? 'Thinking…'
    : voice.state === 'listening'
      ? 'Listening…'
      : voice.state === 'speaking'
        ? 'Speaking…'
        : wakeEnabled
          ? `Say “Hey ${name}” anytime`
          : speechSupported
            ? 'Tap the orb and talk'
            : 'Voice needs Chrome or Edge. Type below.';

  const listening = voice.state === 'listening';
  const lastTurns = turns.slice(-4);

  return (
    <div className="fixed bottom-20 right-[4.75rem] z-50 flex flex-col items-end sm:right-24 md:bottom-6">
      {isOpen && (
        <div className="mb-4 flex max-md:fixed max-md:inset-x-3 max-md:bottom-[9.5rem] max-md:w-auto h-[min(580px,calc(100dvh-12rem))] md:h-[min(580px,calc(100dvh-8rem))] md:w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-2xl animate-in" role="dialog" aria-label={`${name} assistant`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-500/30", listening && "bg-red-500 shadow-red-500/40")}>
                <AudioLines size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide">{name}</h3>
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span className={cn("h-1.5 w-1.5 rounded-full", wakeEnabled ? "bg-emerald-400" : "bg-slate-600")} />
                  {wakeEnabled ? 'Wake word on' : 'Wake word off'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setMuted(!muted)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" title={muted ? 'Speak replies' : 'Mute replies'}>
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20", showSettings && "bg-white/25")} title="Settings">
                <Settings2 size={15} />
              </button>
              <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assistant name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 20) || '')}
                  onBlur={() => !name.trim() && setName('Nova')}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                />
                <span className="mt-1 block text-[11px] text-slate-500">Short, clear names work best, e.g. Nova, Atlas, Echo.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={wakeEnabled}
                  disabled={!speechSupported}
                  onChange={() => { setWakeEnabled(!wakeEnabled); askNotificationPermission(); }}
                  className="mt-1 h-4 w-4 accent-emerald-500"
                />
                <span>
                  <span className="block font-semibold">Listen for “Hey {name}”</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                    Keeps the microphone on while IntelliPrep is open. Chrome sends speech to Google to turn it into text.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-400">
                Try: “Hey {name}, remind me to revise hashing tomorrow at 9”, “take a note: Dijkstra needs non-negative weights”,
                “add practise AVL rotations to my plan”, or “open my flashcards”.
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold hover:bg-emerald-500">Done</button>
            </div>
          ) : (
            <>
              {/* Orb */}
              <div className="relative flex flex-col items-center px-6 pb-4 pt-7 text-center">
                <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
                  {listening && (
                    <>
                      <div className="absolute h-36 w-36 animate-ping rounded-full border border-red-400/30" />
                      <div className="absolute h-44 w-44 animate-ping rounded-full border border-red-400/15 [animation-delay:200ms]" />
                    </>
                  )}
                  {wakeEnabled && voice.state === 'waiting' && (
                    <div className="absolute h-32 w-32 animate-pulse rounded-full bg-emerald-500/10" />
                  )}
                </div>
                <button
                  onClick={listening ? voice.done : voice.listen}
                  disabled={thinking}
                  className={cn(
                    "relative z-10 flex h-24 w-24 items-center justify-center rounded-full border text-white shadow-2xl transition-all hover:scale-105 active:scale-95",
                    listening
                      ? "border-red-400 bg-gradient-to-tr from-red-500 to-rose-600 shadow-red-500/40"
                      : thinking
                        ? "cursor-wait border-slate-700 bg-slate-800 text-slate-400"
                        : "border-emerald-400/30 bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-500/30"
                  )}
                  aria-label={listening ? 'Stop listening' : `Talk to ${name}`}
                >
                  {thinking ? (
                    <span className="flex gap-1">
                      {[0, 150, 300].map(delay => <span key={delay} className="h-6 w-1.5 animate-pulse rounded-full bg-emerald-400" style={{ animationDelay: `${delay}ms` }} />)}
                    </span>
                  ) : listening ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
                <p className="z-10 mt-4 text-xs font-semibold text-slate-300">{status}</p>
                {listening && voice.heard && <p className="z-10 mt-1 line-clamp-2 text-[11px] italic text-slate-500">“{voice.heard}”</p>}
              </div>

              {/* Conversation and what Nova did */}
              <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
                {notice && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    <Bell size={14} className="mt-0.5 shrink-0" /> {notice}
                  </div>
                )}
                {lastTurns.length === 0 && !notice && (
                  <p className="pt-2 text-center text-[11px] leading-relaxed text-slate-500">
                    Ask a study question, or tell {name} to set a reminder, take a note, add a task or open a section.
                  </p>
                )}
                {lastTurns.map((turn, index) => (
                  <div key={index} className={cn("flex", turn.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
                      turn.role === 'user' ? "rounded-tr-none bg-emerald-600 text-white" : "rounded-tl-none bg-slate-800 text-slate-100"
                    )}>
                      {turn.text}
                    </div>
                  </div>
                ))}
                {receipts.map((receipt, index) => (
                  <div key={index} className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px]",
                    receipt.warning ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  )}>
                    <receipt.icon size={14} className="mt-0.5 shrink-0" />
                    <span>{receipt.text}</span>
                  </div>
                ))}
              </div>

              {/* Type instead */}
              <form onSubmit={submitTyped} className="flex items-center gap-2 border-t border-slate-800 p-3">
                <input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={`Type to ${name}…`}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                />
                <button type="submit" disabled={!typed.trim() || thinking} className="rounded-xl bg-emerald-600 p-2.5 hover:bg-emerald-500 disabled:opacity-40" aria-label="Send">
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Launcher */}
      <div className="group relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95",
            listening ? "bg-gradient-to-tr from-red-500 to-rose-600" : "bg-gradient-to-tr from-slate-800 to-slate-950 ring-1 ring-emerald-500/40"
          )}
          title={`Talk to ${name}`}
          aria-label={`Talk to ${name}`}
        >
          <AudioLines size={22} className={listening ? '' : 'text-emerald-400'} />
          {wakeEnabled && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />}
        </button>
        {!isOpen && (
          <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900 p-2 px-3 text-[10px] font-bold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            {wakeEnabled ? `Say “Hey ${name}”` : `Talk to ${name}`}
          </div>
        )}
      </div>
    </div>
  );
};
