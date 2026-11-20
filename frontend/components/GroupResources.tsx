import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckSquare, FileText, Layers, Loader2, RotateCcw, Search, Share2, X } from 'lucide-react';
import { cn } from './UIComponents';
import { listShareables, ResourceKind, Shareable, SharedResource } from '../services/groupService';

// Study material shared into a group chat: what you can share, how it shows in the chat, and the
// quiz player, flashcard viewer and summary reader classmates open from it.

export const RESOURCE_STYLE: Record<ResourceKind, { icon: React.ElementType; tone: string; label: string; action: string }> = {
  quiz: { icon: CheckSquare, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Quiz', action: 'Take quiz' },
  deck: { icon: Layers, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Flashcards', action: 'Study cards' },
  summary: { icon: BookOpen, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Summary', action: 'Read' },
  document: { icon: FileText, tone: 'text-gray-500 bg-gray-100 dark:bg-white/[.06] dark:text-gray-400', label: 'Notes', action: 'Open' },
};

const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose} role="dialog">
      <div
        className={cn("flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl animate-in dark:border-white/[.08] dark:bg-gray-900 sm:rounded-xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 dark:border-white/[.07]">
          <div className="min-w-0 truncate text-[13px] font-semibold text-gray-900 dark:text-white">{title}</div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

/** Pick something from your subjects to share into the group. */
export const SharePicker: React.FC<{ groupId: string; groupName: string; onShare: (item: Shareable, comment: string) => Promise<boolean>; onClose: () => void }> = ({ groupId, groupName, onShare, onClose }) => {
  const [items, setItems] = useState<Shareable[] | null>(null);
  const [filter, setFilter] = useState<ResourceKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Shareable | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { listShareables(groupId).then(setItems).catch(() => setItems([])); }, [groupId]);

  const shown = useMemo(() => (items ?? []).filter(item =>
    (filter === 'all' || item.kind === filter) &&
    `${item.title} ${item.subject_name}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [items, filter, query]);

  const tabs: { id: ResourceKind | 'all'; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'document', label: 'Notes' }, { id: 'quiz', label: 'Quizzes' },
    { id: 'deck', label: 'Flashcards' }, { id: 'summary', label: 'Summaries' },
  ];

  return (
    <Modal title={chosen ? `Share to ${groupName}` : 'Share from your subjects'} onClose={onClose} wide>
      {chosen ? (
        <div className="space-y-4 p-4">
          <ResourceRow item={chosen} />
          <textarea
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add a note for the group (optional)"
            className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-[13px] outline-none focus:border-primary-500/70 dark:border-white/[.09]"
          />
          <p className="text-xs text-gray-500">The group gets a copy. Changing or deleting yours later won't change theirs.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setChosen(null)} className="h-8 rounded-md px-3 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[.06]">Back</button>
            <button
              disabled={busy}
              onClick={async () => { setBusy(true); const ok = await onShare(chosen, comment); setBusy(false); if (ok) onClose(); }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="space-y-3 border-b border-gray-200 p-3 dark:border-white/[.07]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your notes, quizzes, flashcards and summaries" aria-label="Search"
                className="h-8 w-full rounded-md border border-gray-200 bg-transparent pl-8 pr-2.5 text-[13px] outline-none focus:border-primary-500/70 dark:border-white/[.09]" />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setFilter(tab.id)} className={cn("h-7 shrink-0 rounded-full px-3 text-xs", filter === tab.id ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06]")}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-[260px] p-2">
            {items === null && <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your material…</p>}
            {items !== null && shown.length === 0 && (
              <div className="px-6 py-10 text-center">
                <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{items.length === 0 ? 'Nothing to share yet' : 'Nothing matches'}</p>
                <p className="mt-1 text-xs text-gray-500">{items.length === 0 ? 'Upload notes, or make a quiz, flashcard deck or summary in one of your subjects. Only material saved to your account can be shared.' : 'Try another word or type.'}</p>
              </div>
            )}
            {shown.map(item => (
              <button key={`${item.kind}-${item.id}`} onClick={() => setChosen(item)} className="w-full rounded-lg p-1 text-left hover:bg-gray-50 dark:hover:bg-white/[.03]">
                <ResourceRow item={item} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

const ResourceRow: React.FC<{ item: Shareable }> = ({ item }) => {
  const style = RESOURCE_STYLE[item.kind];
  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.tone)}><style.icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
        <p className="truncate text-xs text-gray-500">{style.label} · {item.subject_name} · {item.detail}</p>
      </div>
      <span className="shrink-0 text-[11px] text-gray-400">{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
    </div>
  );
};

/** How a shared item shows inside a chat message. */
export const ResourceCard: React.FC<{ resource: SharedResource; mine: boolean; onOpen: () => void }> = ({ resource, mine, onOpen }) => {
  const style = RESOURCE_STYLE[resource.kind];
  const meta = resource.kind === 'quiz' ? `${resource.questions.length} questions`
    : resource.kind === 'deck' ? `${resource.cards.length} cards`
    : resource.kind === 'summary' ? (resource.cites_pages ? 'Cites pages' : 'Summary')
    : resource.pages ? `${resource.pages} page${resource.pages === 1 ? '' : 's'}` : 'Notes';
  return (
    <div className={cn("w-72 max-w-full overflow-hidden rounded-xl border", mine ? "border-white/20 bg-white/10" : "border-gray-200 bg-white dark:border-white/[.08] dark:bg-white/[.03]")}>
      <div className="flex items-start gap-3 p-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/15 text-white" : style.tone)}><style.icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-medium", mine ? "text-white/70" : "text-gray-500")}>{style.label} · {resource.subject}</p>
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{resource.title}</p>
          <p className={cn("mt-0.5 text-[11px]", mine ? "text-white/70" : "text-gray-500")}>{meta}</p>
        </div>
      </div>
      {resource.kind === 'summary' && (
        <p className={cn("line-clamp-3 px-3 pb-2 text-xs", mine ? "text-white/80" : "text-gray-600 dark:text-gray-400")}>
          {resource.content.replace(/^#+\s*/gm, '').replace(/\n+/g, ' · ').slice(0, 220)}
        </p>
      )}
      {resource.kind !== 'document' && (
        <button onClick={onOpen} className={cn("flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs font-medium transition-colors", mine ? "border-white/15 hover:bg-white/10" : "border-gray-200 text-primary-600 hover:bg-gray-50 dark:border-white/[.07] dark:text-primary-400 dark:hover:bg-white/[.04]")}>
          {style.action} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/** Opens a shared quiz, deck or summary. */
export const ResourceViewer: React.FC<{ resource: SharedResource; from: string; onClose: () => void }> = ({ resource, from, onClose }) => {
  const style = RESOURCE_STYLE[resource.kind];
  const title = <span className="flex items-center gap-2"><style.icon className="h-4 w-4 text-gray-400" /> {resource.title} <span className="font-normal text-gray-500">· from {from}</span></span>;
  if (resource.kind === 'quiz') return <Modal title={title} onClose={onClose} wide><QuizPlayer questions={resource.questions} /></Modal>;
  if (resource.kind === 'deck') return <Modal title={title} onClose={onClose}><DeckViewer cards={resource.cards} /></Modal>;
  if (resource.kind === 'summary') return <Modal title={title} onClose={onClose} wide><SummaryText content={resource.content} /></Modal>;
  return null;
};

const QuizPlayer: React.FC<{ questions: Extract<SharedResource, { kind: 'quiz' }>['questions'] }> = ({ questions }) => {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const done = index >= questions.length;
  const score = chosen.filter((c, i) => c === questions[i]?.correct_index).length;

  if (questions.length === 0) return <p className="p-6 text-center text-[13px] text-gray-500">This quiz has no questions.</p>;
  if (done) {
    return (
      <div className="space-y-4 p-6 text-center">
        <p className="text-4xl font-semibold tabular-nums text-gray-900 dark:text-white">{score}<span className="text-gray-400">/{questions.length}</span></p>
        <p className="text-[13px] text-gray-500">{score === questions.length ? 'Perfect. You know this.' : score >= questions.length / 2 ? 'Good. Review the ones you missed below.' : 'Worth another go after revising.'}</p>
        <ul className="space-y-2 text-left">
          {questions.map((q, i) => (
            <li key={i} className={cn("rounded-lg border p-3 text-[13px]", chosen[i] === q.correct_index ? "border-emerald-500/30" : "border-red-500/30")}>
              <p className="font-medium text-gray-900 dark:text-gray-100">{i + 1}. {q.question}</p>
              <p className="mt-1 text-xs text-gray-500">Answer: <span className="text-gray-800 dark:text-gray-200">{q.options[q.correct_index]}</span> · {q.explanation}</p>
            </li>
          ))}
        </ul>
        <button onClick={() => { setIndex(0); setChosen(questions.map(() => null)); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-[13px] hover:bg-gray-50 dark:border-white/[.09] dark:hover:bg-white/[.05]">
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }
  const q = questions[index];
  const picked = chosen[index];
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
          <div className="h-full rounded-full bg-primary-500 transition-[width] duration-300" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-gray-500">{index + 1} / {questions.length}</span>
      </div>
      <p className="text-[15px] font-medium leading-relaxed text-gray-900 dark:text-white">{q.question}</p>
      <div className="mt-4 space-y-2">
        {q.options.map((option, i) => {
          const isRight = i === q.correct_index;
          const show = picked !== null;
          return (
            <button
              key={i}
              disabled={show}
              onClick={() => setChosen(c => c.map((v, j) => (j === index ? i : v)))}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors",
                !show && "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-white/[.08] dark:hover:bg-white/[.04]",
                show && isRight && "border-emerald-500/50 bg-emerald-500/10",
                show && picked === i && !isRight && "border-red-500/50 bg-red-500/10",
                show && picked !== i && !isRight && "border-gray-200 opacity-60 dark:border-white/[.06]"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 text-xs font-medium text-gray-500">{'ABCD'[i]}</span>
              <span className="flex-1 text-gray-800 dark:text-gray-200">{option}</span>
              {show && isRight && <Check className="h-4 w-4 text-emerald-500" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-[13px] text-gray-700 animate-in dark:bg-white/[.04] dark:text-gray-300">
          <span className={cn("font-medium", picked === q.correct_index ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{picked === q.correct_index ? 'Correct. ' : 'Not quite. '}</span>
          {q.explanation}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button disabled={picked === null} onClick={() => setIndex(i => i + 1)} className="flex h-8 items-center gap-1.5 rounded-md bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500 disabled:opacity-40">
          {index === questions.length - 1 ? 'See score' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

const DeckViewer: React.FC<{ cards: { front: string; back: string }[] }> = ({ cards }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (cards.length === 0) return <p className="p-6 text-center text-[13px] text-gray-500">This deck has no cards.</p>;
  const card = cards[index];
  const go = (step: number) => { setFlipped(false); setIndex(i => Math.min(cards.length - 1, Math.max(0, i + step))); };
  return (
    <div className="p-5">
      <button
        onClick={() => setFlipped(f => !f)}
        className={cn("flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border p-6 text-center transition-colors", flipped ? "border-primary-500/40 bg-primary-500/[.06]" : "border-gray-200 hover:bg-gray-50 dark:border-white/[.08] dark:hover:bg-white/[.03]")}
        aria-label={flipped ? 'Show question' : 'Show answer'}
      >
        <span className="mb-3 text-[11px] font-medium text-gray-500">{flipped ? 'Answer' : 'Question'}</span>
        <span key={`${index}-${flipped}`} className="text-[15px] font-medium leading-relaxed text-gray-900 animate-in dark:text-white">{flipped ? card.back : card.front}</span>
        <span className="mt-4 text-[11px] text-gray-400">Tap to {flipped ? 'see the question' : 'reveal the answer'}</span>
      </button>
      <div className="mt-4 flex items-center justify-between">
        <button disabled={index === 0} onClick={() => go(-1)} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-white/[.06]"><ArrowLeft className="h-3.5 w-3.5" /> Previous</button>
        <span className="text-xs tabular-nums text-gray-500">{index + 1} / {cards.length}</span>
        <button disabled={index === cards.length - 1} onClick={() => go(1)} className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-white/[.06]">Next <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
};

const SummaryText: React.FC<{ content: string }> = ({ content }) => (
  <div className="space-y-1.5 p-5 text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
    {content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2" />;
      if (/^#{1,6}\s/.test(trimmed)) return <h3 key={i} className="pt-3 text-[15px] font-semibold text-gray-900 first:pt-0 dark:text-white">{trimmed.replace(/^#+\s*/, '')}</h3>;
      if (/^[-*•]\s/.test(trimmed)) return <p key={i} className="flex gap-2 pl-1"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" /><span>{trimmed.replace(/^[-*•]\s*/, '')}</span></p>;
      return <p key={i}>{trimmed}</p>;
    })}
  </div>
);
