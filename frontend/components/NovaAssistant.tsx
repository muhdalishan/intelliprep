import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, X, Settings2, Volume2, VolumeX, Send, Bell, StickyNote, ListTodo, ArrowUpRight, AudioLines,
  AlertTriangle, BookOpen, HelpCircle, Lightbulb, GraduationCap, Trash2, MessageSquare,
} from 'lucide-react';
import { cn } from './UIComponents';
import { speechSupported, useVoice } from '../hooks/useVoice';
import { AssistantAction, AssistantTurn, loadSubjects, runActions, sendCommand } from '../services/assistantService';
import { allReminders, formatDue, markReminderFired } from '../services/studyStore';
import { fetchInbox, markSeen } from '../services/reminderService';
import { listAccountSubjects } from '../services/workspaceService';

// The one assistant: a study tutor you type or talk to, who can also set reminders, save notes,
// add tasks and open sections. Typed questions get full tutor answers; spoken ones get short
// answers read aloud.

const SECTION_NAMES: Record<string, string> = {
  dashboard: 'your dashboard', overview: 'Overview', upload: 'Documents', summary: 'Summaries', flashcards: 'Flashcards',
  diagrams: 'Diagrams', quiz: 'Quiz', exam: 'Timed Exam', 'weak-topics': 'Weak Topics', 'guess-engine': 'Exam Guess', studyroom: 'Study Group',
  kanban: 'Planner', moodboard: 'Moodboard', reminders: 'Reminders',
};

interface Receipt {
  icon: React.ElementType;
  text: string;
  warning?: boolean;
}

interface Message extends AssistantTurn {
  receipts?: Receipt[];
}

const SUGGESTIONS = [
  { text: 'Explain a hard topic with an example', icon: Lightbulb },
  { text: 'Give me a quick 3-question quiz', icon: HelpCircle },
  { text: 'Help me plan revision for my exam', icon: GraduationCap },
  { text: 'Remind me to revise tomorrow at 9', icon: Bell },
];

const describe = (actions: AssistantAction[], currentSubjectId: string | null, accountNames: Record<string, string>): Receipt[] => {
  const names = { ...accountNames, ...Object.fromEntries(loadSubjects().map(s => [s.id, s.name])) };
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

/** Renders answers: paragraphs, "-" / "1." lists and **bold**. */
const FormattedReply: React.FC<{ text: string }> = ({ text }) => {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
    );
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, b) => {
        const lines = block.split('\n').filter(l => l.trim());
        const isList = lines.length > 0 && lines.every(l => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>);
          return ordered
            ? <ol key={b} className="list-decimal space-y-1 pl-4">{items}</ol>
            : <ul key={b} className="list-disc space-y-1 pl-4">{items}</ul>;
        }
        return <p key={b}>{lines.map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</React.Fragment>)}</p>;
      })}
    </div>
  );
};

// A short rising tone when the assistant starts listening after hearing its name.
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

  // The button steps aside while you scroll down through content, and comes back when you
  // scroll up or stop, so it never sits on top of what you are reading for long.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    let settle = 0;
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.scrollingElement : event.target as HTMLElement;
      if (!target || !("scrollTop" in target)) return;
      const top = (target as HTMLElement).scrollTop;
      const previous = last.get(target) ?? 0;
      last.set(target, top);
      if (Math.abs(top - previous) < 4) return;
      setTucked(top > previous && top > 80);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setTucked(false), 1200);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => { document.removeEventListener("scroll", onScroll, { capture: true }); window.clearTimeout(settle); };
  }, []);

  // Names of subjects on the account, for "Helping with …" and what-I-did receipts.
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isOpen) return;
    listAccountSubjects()
      .then(list => setAccountNames(Object.fromEntries(list.map(s => [s.id, s.name]))))
      .catch(() => {});
  }, [isOpen]);
  const subjectName = currentSubjectId
    ? loadSubjects().find(s => s.id === currentSubjectId)?.name ?? accountNames[currentSubjectId]
    : undefined;
  const [name, setName] = useState(() => localStorage.getItem('nova_name') || 'Nova');
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem('nova_wake') === 'true' && speechSupported);
  const [muted, setMuted] = useState(() => localStorage.getItem('nova_muted') === 'true');
  const [showSettings, setShowSettings] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  // The name is used to wake the assistant, so it must never be empty while the field is being edited.
  const assistantName = name.trim() || 'Nova';

  useEffect(() => { localStorage.setItem('nova_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('nova_wake', String(wakeEnabled)); }, [wakeEnabled]);
  useEffect(() => { localStorage.setItem('nova_muted', String(muted)); }, [muted]);

  // The Settings page changes the name, wake word and voice; follow along.
  useEffect(() => {
    const sync = () => {
      setName(localStorage.getItem('nova_name') || 'Nova');
      setWakeEnabled(localStorage.getItem('nova_wake') === 'true' && speechSupported);
      setMuted(localStorage.getItem('nova_muted') === 'true');
    };
    window.addEventListener('nova-settings', sync);
    return () => window.removeEventListener('nova-settings', sync);
  }, []);

  // Other screens (e.g. Weak topics) open the assistant with a question ready to send.
  useEffect(() => {
    const open = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setIsOpen(true);
      setShowSettings(false);
      if (message) setTyped(message);
    };
    window.addEventListener('open-tutor', open);
    return () => window.removeEventListener('open-tutor', open);
  }, []);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const accountNamesRef = useRef(accountNames);
  accountNamesRef.current = accountNames;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const speakRef = useRef<(text: string, muted: boolean) => void>(() => {});
  const doneRef = useRef<() => void>(() => {});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, isOpen]);

  const handleCommand = useCallback(async (text: string, spoken: boolean) => {
    setIsOpen(true);
    setShowSettings(false);
    setThinking(true);
    setNotice(null);
    setMessages(m => [...m, { role: 'user', text }]);

    const history = messagesRef.current.map(({ role, text }) => ({ role, text }));
    const result = await sendCommand(text, assistantName, currentSubjectId, history, spoken);
    let destination: string | null = null;
    try {
      destination = await runActions(result.actions, currentSubjectId);
    } catch (error) {
      result.skipped.push(error instanceof Error ? error.message : "Something couldn't be saved.");
    }
    const receipts = [
      ...describe(result.actions, currentSubjectId, accountNamesRef.current),
      ...result.skipped.map(text => ({ icon: AlertTriangle, text, warning: true })),
    ];
    if (result.actions.some(a => a.type === 'set_reminder')) askNotificationPermission();
    setMessages(m => [...m, { role: 'assistant', text: result.reply, receipts }].slice(-40));
    setThinking(false);
    if (destination) navigate(destination);
    // Spoken to: answer out loud (unless muted), then go back to listening for the wake word.
    if (spoken) speakRef.current(result.reply, mutedRef.current);
  }, [assistantName, currentSubjectId, navigate]);

  const voice = useVoice({
    name: assistantName,
    wakeEnabled,
    onCommand: text => handleCommand(text, true),
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

  // Due in-app reminders pop up and are spoken: from the server's inbox, and any still kept in this browser.
  useEffect(() => {
    const announce = (message: string) => {
      setNotice(`Reminder: ${message}`);
      setIsOpen(true);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`${name} reminder`, { body: message });
      }
      speakRef.current(`Reminder: ${message}`, mutedRef.current);
    };
    const check = async () => {
      const now = Date.now();
      for (const { subjectId, reminder } of allReminders()) {
        if (reminder.fired || !reminder.date.includes('T')) continue;
        if (new Date(reminder.date).getTime() > now) continue;
        markReminderFired(subjectId, reminder.id);
        announce(reminder.message);
      }
      try {
        for (const reminder of await fetchInbox()) {
          await markSeen(reminder.id);
          announce(reminder.subject_name ? `${reminder.subject_name}: ${reminder.message}` : reminder.message);
        }
      } catch {
        // Server unreachable: the browser-kept reminders above still work.
      }
    };
    check();
    const timer = window.setInterval(check, 20_000);
    return () => window.clearInterval(timer);
  }, [name]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    setTyped('');
    window.speechSynthesis?.cancel();
    // "Hey Nova, ..." typed out still works; the rest keeps its original wording and punctuation.
    const greeting = new RegExp(`^\\s*(?:(?:hey|hi|ok|okay|hello)\\s+)?${assistantName}\\b[\\s,:.!-]*`, 'i');
    handleCommand(text.replace(greeting, '').trim() || text, false);
  };

  const listening = voice.state === 'listening';
  const status = thinking
    ? 'Thinking…'
    : listening
      ? (voice.heard ? `“${voice.heard}”` : 'Listening… speak now')
      : voice.state === 'speaking'
        ? 'Speaking…'
        : wakeEnabled
          ? `Say “Hey ${name}” anytime, or type`
          : subjectName ? `Helping with ${subjectName}` : 'Type or tap the mic to talk';

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end sm:right-6 md:bottom-6">
      {isOpen && (
        <div
          className="mb-4 flex max-md:fixed max-md:inset-x-3 max-md:bottom-[9.5rem] max-md:w-auto h-[min(600px,calc(100dvh-12rem))] md:h-[min(600px,calc(100dvh-8rem))] md:w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-2xl ip-sheet dark:border-slate-800/80 dark:bg-slate-900"
          role="dialog"
          aria-label={`${name}, your study assistant`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-md">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-inner",
                listening ? "bg-red-500" : "bg-gradient-to-tr from-emerald-600 to-teal-600"
              )}>
                <AudioLines size={19} />
                {wakeEnabled && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-black tracking-wide">
                  {name}
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">AI</span>
                </h3>
                <p className="truncate text-[10px] font-medium text-slate-400" aria-live="polite">{status}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {messages.length > 0 && !showSettings && (
                <button onClick={() => { setMessages([]); setNotice(null); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" title="New chat" aria-label="New chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setMuted(!muted)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" title={muted ? 'Speak spoken replies' : 'Mute spoken replies'} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20", showSettings && "bg-white/25")} title="Assistant settings" aria-label="Assistant settings">
                <Settings2 size={15} />
              </button>
              <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" title="Close" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm text-slate-800 dark:text-slate-100">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assistant name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 20) || '')}
                  onBlur={() => !name.trim() && setName('Nova')}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
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
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Keeps the microphone on while IntelliPrep is open. Chrome sends speech to Google to turn it into text.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                Ask anything you’re studying, or try: “remind me to revise hashing tomorrow at 9”, “take a note: Dijkstra needs
                non-negative weights”, “add practise AVL rotations to my plan”, or “open my flashcards”.
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">Done</button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {notice && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <Bell size={14} className="mt-0.5 shrink-0" /> {notice}
                  </div>
                )}

                {messages.length === 0 && (
                  <div className="flex flex-col items-center px-2 pt-4 text-center">
                    <button
                      onClick={listening ? voice.done : voice.listen}
                      disabled={thinking}
                      className={cn(
                        "relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all hover:scale-105 active:scale-95",
                        listening
                          ? "bg-gradient-to-tr from-red-500 to-rose-600 shadow-red-500/40"
                          : "bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-500/30"
                      )}
                      aria-label={listening ? 'Stop listening' : `Talk to ${name}`}
                    >
                      {listening && <span className="absolute inset-0 animate-ping rounded-full border border-red-400/40" />}
                      {listening ? <MicOff size={28} /> : <Mic size={28} />}
                    </button>
                    <h4 className="mt-4 text-sm font-black text-slate-800 dark:text-slate-100">Hi, I’m {name}</h4>
                    <p className="mx-auto mt-1.5 max-w-[280px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Ask me anything you’re studying, step by step. I can also set reminders, save notes, add tasks and open sections.
                      Type below, or tap the mic and talk.
                    </p>
                    <div className="mt-5 grid w-full grid-cols-2 gap-2 text-left">
                      {SUGGESTIONS.map(sug => (
                        <button
                          key={sug.text}
                          onClick={() => send(sug.text)}
                          className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-[11px] font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <sug.icon size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                          <span className="leading-tight">{sug.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                      <div className="flex max-w-[88%] items-start gap-2.5">
                        {msg.role !== 'user' && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                            <AudioLines size={12} />
                          </div>
                        )}
                        <div className={cn(
                          "break-words border px-4 py-2.5 text-xs leading-relaxed shadow-sm",
                          msg.role === 'user'
                            ? "whitespace-pre-wrap rounded-2xl rounded-tr-none border-emerald-500/35 bg-emerald-600 text-white"
                            : "rounded-2xl rounded-tl-none border-slate-200/80 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        )}>
                          {msg.role === 'user' ? msg.text : <FormattedReply text={msg.text} />}
                        </div>
                      </div>
                    </div>
                    {msg.receipts?.map((receipt, i) => (
                      <div key={i} className={cn(
                        "ml-8 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px]",
                        receipt.warning
                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      )}>
                        <receipt.icon size={14} className="mt-0.5 shrink-0" />
                        <span>{receipt.text}</span>
                      </div>
                    ))}
                  </div>
                ))}

                {thinking && (
                  <div className="flex w-full items-start justify-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <AudioLines size={12} />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                      {[0, 150, 300].map(delay => (
                        <div key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Type, or tap the mic to talk */}
              <div className="border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <form onSubmit={e => { e.preventDefault(); send(typed); }} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    placeholder={listening ? 'Listening… speak now' : `Ask ${name} anything…`}
                    aria-label={`Message ${name}`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-3 text-xs text-slate-800 outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={listening ? voice.done : voice.listen}
                    disabled={thinking}
                    className={cn("shrink-0 rounded-xl border p-2.5 shadow-sm transition-all active:scale-95 disabled:opacity-40",
                      listening
                        ? "animate-pulse border-red-600 bg-red-500 text-white"
                        : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                    title={listening ? 'Stop listening' : 'Talk'}
                    aria-label={listening ? 'Stop listening' : `Talk to ${name}`}
                  >
                    {listening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={thinking || !typed.trim()}
                    className="shrink-0 rounded-xl bg-emerald-600 p-2.5 text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:shadow-none"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* Launcher */}
      <div className={cn("group relative transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)]", tucked && !isOpen && "pointer-events-none translate-y-24 opacity-0")}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95",
            listening ? "bg-gradient-to-tr from-red-500 to-rose-600" : "bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700"
          )}
          title={isOpen ? `Close ${name}` : `Ask ${name}`}
          aria-label={isOpen ? `Close ${name}` : `Ask ${name}`}
        >
          {isOpen ? <X size={22} /> : listening ? <Mic size={22} /> : <MessageSquare size={22} className="fill-white" />}
          {wakeEnabled && !isOpen && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-300" />}
        </button>
        {!isOpen && (
          <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900 p-2 px-3 text-[10px] font-bold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            {wakeEnabled ? `Ask ${name}, or say “Hey ${name}”` : `Ask ${name}`}
          </div>
        )}
      </div>
    </div>
  );
};
