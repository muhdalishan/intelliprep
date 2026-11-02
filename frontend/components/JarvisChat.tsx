import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send, X, MessageSquare, Mic, MicOff, BookOpen, HelpCircle, Lightbulb, GraduationCap, Trash2,
} from 'lucide-react';
import { chatWithAssistant, ChatMessage } from '../services/aiService';
import { loadSubjects } from '../services/assistantService';
import { cn } from '../components/UIComponents';
import { notify } from './Feedback';

// The text tutor. Voice conversation and actions live in Nova (NovaAssistant.tsx).

/** Renders the tutor's plain-text answers: paragraphs, "-" / "1." lists and **bold**. */
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

const PRESET_SUGGESTIONS = [
  { text: "Help me study definitions", icon: BookOpen, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
  { text: "Give me a quick 3-question quiz", icon: HelpCircle, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" },
  { text: "Explain a hard topic with an example", icon: Lightbulb, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
  { text: "How should I plan revision for my exam?", icon: GraduationCap, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/30" }
];

export const JarvisChat: React.FC = () => {
  const location = useLocation();
  const subjectId = location.pathname.match(/^\/subject\/([^/?]+)/)?.[1];
  const subjectName = subjectId ? loadSubjects().find(s => s.id === subjectId)?.name : undefined;

  const [isOpen, setIsOpen] = useState(false);

  // Only one assistant panel is open at a time.
  useEffect(() => {
    if (isOpen) window.dispatchEvent(new CustomEvent('assistant-opened', { detail: 'tutor' }));
  }, [isOpen]);
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== 'tutor') setIsOpen(false); };
    window.addEventListener('assistant-opened', onOther);
    return () => window.removeEventListener('assistant-opened', onOther);
  }, []);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isOpen, isLoading]);

  // Other screens (e.g. Weak topics) can open the tutor with a question ready to send.
  useEffect(() => {
    const open = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setIsOpen(true);
      if (message) setInputValue(message);
    };
    window.addEventListener('open-tutor', open);
    return () => window.removeEventListener('open-tutor', open);
  }, []);

  // Dictation only fills the input; the student still checks and sends it.
  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('Dictation needs Chrome or Edge. You can still type.', 'error');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.onresult = (event: any) => setInputValue(Array.from(event.results).map((r: any) => r[0].transcript).join(''));
    rec.onend = () => setIsDictating(false);
    rec.onerror = () => setIsDictating(false);
    recognitionRef.current = rec;
    rec.start();
    setIsDictating(true);
  };

  const send = async (msg: string) => {
    const text = msg.trim();
    if (!text || isLoading) return;
    recognitionRef.current?.stop();
    setInputValue('');
    const updatedHistory: ChatMessage[] = [...history, { role: 'user', text }];
    setHistory(updatedHistory);
    setIsLoading(true);
    const reply = await chatWithAssistant(subjectName ?? 'General study', updatedHistory, text);
    setHistory([...updatedHistory, { role: 'model', text: reply }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end sm:right-6 md:bottom-6">
      {isOpen && (
        <div className="mb-4 flex max-md:fixed max-md:inset-x-3 max-md:bottom-[9.5rem] max-md:w-auto h-[min(580px,calc(100dvh-12rem))] md:h-[min(580px,calc(100dvh-8rem))] md:w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-2xl animate-in dark:border-slate-800/80 dark:bg-slate-900">

          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-inner">
                <GraduationCap size={20} />
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400"></div>
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-black tracking-wide text-white">
                  Study Tutor
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">AI</span>
                </h3>
                <p className="text-[10px] font-medium text-slate-400">{subjectName ? `Helping with ${subjectName}` : 'Ask me anything you’re studying'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20" title="New chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20" title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 dark:bg-slate-900/50">
            {history.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
                  <GraduationCap size={30} />
                </div>
                <h4 className="text-sm font-black text-gray-800 dark:text-gray-100">Your study tutor</h4>
                <p className="mx-auto mt-2 max-w-[260px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Explanations step by step, quick quizzes and revision plans. Want to talk out loud or set reminders? Use Nova, the mic button next to this one.
                </p>
                <div className="mt-6 w-full space-y-2 text-left">
                  <span className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick start</span>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_SUGGESTIONS.map(sug => (
                      <button
                        key={sug.text}
                        onClick={() => send(sug.text)}
                        className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-left text-[11px] font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <sug.icon size={15} className={cn("mt-0.5 shrink-0", sug.color)} />
                        <span className="leading-tight">{sug.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {history.map((msg, idx) => (
              <div key={idx} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className="flex max-w-[88%] items-start gap-2.5">
                  {msg.role !== 'user' && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <GraduationCap size={12} />
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
            ))}

            {isLoading && (
              <div className="flex w-full items-start justify-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <GraduationCap size={12} />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                  {[0, 150, 300].map(delay => (
                    <div key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-500" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={e => { e.preventDefault(); send(inputValue); }} className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={isDictating ? "Listening… speak your question" : "Ask your tutor…"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-3 text-xs text-slate-800 outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={toggleDictation}
                className={cn("shrink-0 rounded-xl border p-2.5 shadow-sm transition-all active:scale-95",
                  isDictating
                    ? "animate-pulse border-red-600 bg-red-500 text-white"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
                title={isDictating ? "Stop dictation" : "Dictate your question"}
              >
                {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                type="submit"
                aria-label="Send"
                disabled={isLoading || !inputValue.trim()}
                className="shrink-0 rounded-xl bg-emerald-600 p-2.5 text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:shadow-none"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="group relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95",
            isOpen && "rotate-90"
          )}
          title={isOpen ? "Close tutor" : "Open study tutor"}
        >
          {isOpen ? <X size={22} /> : <MessageSquare size={22} className="fill-white" />}
        </button>
        {!isOpen && (
          <div className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900 p-2 px-3 text-[10px] font-bold text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            Chat with your tutor
          </div>
        )}
      </div>
    </div>
  );
};
