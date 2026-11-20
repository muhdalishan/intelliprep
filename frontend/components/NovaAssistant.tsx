import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, X, Settings2, Volume2, VolumeX, Send, Bell, StickyNote, ListTodo, ArrowUpRight, AudioLines,
  AlertTriangle, HelpCircle, Lightbulb, GraduationCap, Trash2, ArrowUp,
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
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end sm:right-5 lg:bottom-5">
      {isOpen && (
        <div
          className="mb-3 flex max-md:fixed max-md:inset-x-3 max-md:bottom-[8.5rem] max-md:w-auto h-[min(620px,calc(100dvh-11rem))] md:h-[min(620px,calc(100dvh-6rem))] md:w-[400px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ip-sheet dark:border-white/[.08] dark:bg-gray-900"
          role="dialog"
          aria-label={`${name}, your study assistant`}
        >
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3.5 dark:border-white/[.07]">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white", listening ? "bg-red-500" : "bg-primary-600")}>
                <AudioLines size={12} />
              </span>
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{name}</span>
              <span className="truncate rounded border border-gray-200 px-1.5 py-px text-[11px] text-gray-500 dark:border-white/[.09] dark:text-gray-400" aria-live="polite">
                {status}
              </span>
            </div>
            <div className="flex shrink-0 items-center">
              {messages.length > 0 && !showSettings && (
                <button onClick={() => { setMessages([]); setNotice(null); }} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="New chat" aria-label="New chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setMuted(!muted)} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title={muted ? 'Speak spoken replies' : 'Mute spoken replies'} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={cn("flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white", showSettings && "bg-gray-100 text-gray-900 dark:bg-white/[.08] dark:text-white")} title="Assistant settings" aria-label="Assistant settings">
                <Settings2 size={14} />
              </button>
              <button onClick={() => setIsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Close" aria-label="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-4 text-[13px] text-gray-800 dark:text-gray-200">
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Assistant name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 20) || '')}
                  onBlur={() => !name.trim() && setName('Nova')}
                  className="mt-1.5 h-8 w-full rounded-md border border-gray-200 bg-transparent px-2.5 outline-none focus:border-primary-500/70 dark:border-white/[.09]"
                />
                <span className="mt-1 block text-xs text-gray-500">Short, clear names work best, e.g. Nova, Atlas, Echo.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={wakeEnabled}
                  disabled={!speechSupported}
                  onChange={() => { setWakeEnabled(!wakeEnabled); askNotificationPermission(); }}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block font-medium">Listen for “Hey {name}”</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    Keeps the microphone on while IntelliPrep is open. Chrome sends speech to Google to turn it into text.
                  </span>
                </span>
              </label>
              <p className="rounded-md border border-gray-200 p-3 text-xs leading-relaxed text-gray-500 dark:border-white/[.07]">
                Ask anything you’re studying, or try: “remind me to revise hashing tomorrow at 9”, “take a note: Dijkstra needs
                non-negative weights”, “add practise AVL rotations to my plan”, or “open my flashcards”.
              </p>
              <button onClick={() => setShowSettings(false)} className="h-8 w-full rounded-md bg-primary-600 text-[13px] font-medium text-white hover:bg-primary-500">Done</button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                {notice && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <Bell size={13} className="mt-0.5 shrink-0" /> {notice}
                  </div>
                )}

                {messages.length === 0 && (
                  <div className="pt-6">
                    <p className="text-[15px] font-semibold text-gray-900 dark:text-white">Hi, I’m {name}.</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                      Ask me anything you’re studying and I’ll explain it step by step. I can also set reminders, save notes,
                      add tasks and open sections. Type below, or tap the mic and talk.
                    </p>
                    <div className="mt-5 space-y-1">
                      {SUGGESTIONS.map(sug => (
                        <button
                          key={sug.text}
                          onClick={() => send(sug.text)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[.05]"
                        >
                          <sug.icon size={14} className="shrink-0 text-gray-400" />
                          {sug.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className="space-y-2.5">
                    {msg.role === 'user' ? (
                      <div className="ml-auto max-w-[88%] whitespace-pre-wrap break-words rounded-lg bg-gray-100 px-3 py-2 text-[13px] leading-relaxed text-gray-900 dark:bg-white/[.06] dark:text-gray-100">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="break-words text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
                        <FormattedReply text={msg.text} />
                      </div>
                    )}
                    {msg.receipts && msg.receipts.length > 0 && (
                      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-white/[.07] dark:border-white/[.07]">
                        {msg.receipts.map((receipt, i) => (
                          <div key={i} className={cn(
                            "flex items-start gap-2 px-3 py-2 text-xs",
                            receipt.warning ? "text-amber-700 dark:text-amber-300" : "text-gray-700 dark:text-gray-300"
                          )}>
                            <receipt.icon size={13} className={cn("mt-px shrink-0", receipt.warning ? "" : "text-primary-500")} />
                            <span>{receipt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {thinking && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" /> Thinking…
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer: type, or tap the mic to talk */}
              <form onSubmit={e => { e.preventDefault(); send(typed); }} className="m-3 mt-0 rounded-lg border border-gray-200 focus-within:border-gray-300 dark:border-white/[.09] dark:focus-within:border-white/[.16]">
                <input
                  type="text"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={listening ? 'Listening… speak now' : `Ask ${name} anything…`}
                  aria-label={`Message ${name}`}
                  className="w-full bg-transparent px-3 pb-1 pt-2.5 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                />
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="pl-1 text-[11px] text-gray-400">{subjectName ? `In ${subjectName}` : 'Enter to send'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={listening ? voice.done : voice.listen}
                      disabled={thinking}
                      className={cn("flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-40",
                        listening ? "bg-red-500 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white"
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
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-30 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Launcher */}
      <div className={cn("transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)]", tucked && !isOpen && "pointer-events-none translate-y-24 opacity-0")}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium shadow-lg",
            listening
              ? "border-red-500 bg-red-500 text-white"
              : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-white/[.1] dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          )}
          title={wakeEnabled ? `Ask ${name}, or say “Hey ${name}”` : `Ask ${name}`}
          aria-label={isOpen ? `Close ${name}` : `Ask ${name}`}
        >
          {isOpen ? <X size={15} /> : listening ? <Mic size={15} /> : <AudioLines size={15} className="text-primary-500" />}
          <span>{isOpen ? 'Close' : `Ask ${name}`}</span>
          {wakeEnabled && !isOpen && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};
