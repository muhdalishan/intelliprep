import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, HelpCircle, Layers, Trash2 } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { confirmAction, notify } from './Feedback';
import { Deck, deleteDeck, DueCard, dueCards, listDecks, Rating, reviewCard, savedAt } from '../services/studyService';

const RATINGS: { rating: Rating; label: string; hint: string; className: string }[] = [
  { rating: 'again', label: 'Again', hint: 'Forgot it', className: 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30' },
  { rating: 'hard', label: 'Hard', hint: 'Barely', className: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:bg-amber-950/30' },
  { rating: 'good', label: 'Good', hint: 'Got it', className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:hover:bg-emerald-950/30' },
  { rating: 'easy', label: 'Easy', hint: 'Instantly', className: 'border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-900/50 dark:hover:bg-primary-950/30' },
];

const days = (n: number) => (n === 1 ? 'tomorrow' : `in ${n} days`);

/**
 * Flashcards for subjects saved to the account (IP-41, IP-51): saved decks, today's due cards
 * and Again / Hard / Good / Easy ratings that schedule each card with SM-2 on the server.
 */
export const AccountFlashcards: React.FC<{
  subjectId: string;
  refreshKey: number;
  input: React.ReactNode;
  onFlagWeak: (card: { front: string; back: string }) => void;
  onReviewed: () => void;
}> = ({ subjectId, refreshKey, input, onFlagWeak, onReviewed }) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState<string | undefined>();
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [dueTotal, setDueTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastNext, setLastNext] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [deckList, due] = await Promise.all([listDecks(subjectId), dueCards(subjectId, deckId)]);
      setDecks(deckList);
      setQueue(due.cards);
      setDueTotal(due.due_total);
      setStreak(due.streak_days);
      setFlipped(false);
    } catch (error) {
      notify(`Couldn't load your flashcards. ${error instanceof Error ? error.message : ''}`, 'error');
    } finally {
      setLoaded(true);
    }
  }, [subjectId, deckId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const card = queue[0];
  const deckName = deckId ? decks.find(d => d.id === deckId)?.title : undefined;

  const rate = async (value: Rating) => {
    if (!card || rating) return;
    setRating(true);
    try {
      const result = await reviewCard(card.id, value);
      onReviewed();
      setStreak(result.streak_days);
      setLastNext(value === 'again' ? 'Again: it comes back tomorrow.' : `Next review ${days(result.interval_days)}.`);
      setQueue(rest => rest.slice(1));
      setDueTotal(n => Math.max(0, n - 1));
      setDecks(list => list.map(d => (d.id === card.deck_id ? { ...d, due_count: Math.max(0, d.due_count - 1) } : d)));
      setFlipped(false);
      if (queue.length === 1) load(); // fetch the next batch, and fresh deck counts
    } catch (error) {
      notify(`Couldn't save the rating. ${error instanceof Error ? error.message : ''}`, 'error');
    } finally {
      setRating(false);
    }
  };

  const remove = async (deck: Deck) => {
    const ok = await confirmAction({
      title: `Delete "${deck.title}"?`,
      message: `Its ${deck.card_count} cards and their review history will be deleted.`,
      confirmLabel: 'Delete deck',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDeck(deck.id);
      if (deckId === deck.id) setDeckId(undefined);
      else load();
      notify('Deck deleted', 'success');
    } catch (error) {
      notify(`Couldn't delete the deck. ${error instanceof Error ? error.message : ''}`, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 items-start animate-in fade-in duration-300">
      <div className="lg:col-span-7 flex min-w-0 flex-col gap-6">
        <div className="flex flex-col items-center bg-slate-50/50 dark:bg-gray-800/10 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="w-full max-w-lg mb-4 sm:mb-6 text-center">
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">{deckName ? deckName : 'Due today'}</h2>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span><strong className="text-gray-800 dark:text-gray-200">{dueTotal}</strong> {dueTotal === 1 ? 'card' : 'cards'} to review</span>
              <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-orange-500" /> {streak}-day streak</span>
              {deckId && <button className="font-bold text-primary-600 hover:underline" onClick={() => setDeckId(undefined)}>Show all decks</button>}
            </p>
          </div>

          {!loaded ? (
            <div className="py-10 text-sm text-gray-400">Loading cards…</div>
          ) : card ? (
            <div className="w-full min-w-0 max-w-lg space-y-5">
              <div className="perspective-1000 w-full h-72 sm:h-80 relative cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setFlipped(f => !f)}>
                <div className={cn("w-full h-full transition-transform duration-500 transform-style-3d relative shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700", flipped ? "rotate-y-180" : "")}>
                  <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 p-5 sm:p-8 flex flex-col justify-between rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="uppercase text-[10px] font-extrabold text-primary-500 tracking-wider">Question</span>
                      <HelpCircle className="w-4 h-4 text-gray-350" />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center text-center py-3">
                      <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-850 dark:text-white leading-snug">{card.front}</p>
                    </div>
                    <div className="text-center text-[11px] text-gray-400 font-medium tracking-wide">
                      {card.repetitions === 0 ? 'New card' : `Seen ${card.repetitions}×`} · Tap the card to see the answer
                    </div>
                  </div>
                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-primary-700 to-primary-950 text-white p-5 sm:p-8 flex flex-col justify-between rounded-2xl shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="uppercase text-[10px] font-bold text-primary-200 tracking-wider">Answer</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center text-center py-3">
                      <p className="text-base sm:text-lg md:text-xl font-bold leading-relaxed text-blue-50">{card.back}</p>
                    </div>
                    <div className="text-center text-[10px] text-primary-200 font-medium">How well did you know it?</div>
                  </div>
                </div>
              </div>

              {flipped ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Rate this card">
                  {RATINGS.map(r => (
                    <button
                      key={r.rating}
                      disabled={rating}
                      onClick={() => rate(r.rating)}
                      className={cn("rounded-xl border bg-white px-3 py-2 text-center transition-colors disabled:opacity-50 dark:bg-gray-800", r.className)}
                    >
                      <span className="block text-xs font-extrabold">{r.label}</span>
                      <span className="block text-[10px] opacity-70">{r.hint}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center flex-wrap items-center gap-3">
                  <Button variant="secondary" size="sm" className="text-xs font-bold" onClick={() => setFlipped(true)}>Show answer</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs font-bold border-red-200/50 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                    onClick={() => onFlagWeak(card)}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Flag as Weak
                  </Button>
                </div>
              )}
              {lastNext && <p className="text-center text-[11px] text-gray-400">{lastNext}</p>}
            </div>
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {decks.length === 0 ? 'No decks yet' : 'All caught up for today'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {decks.length === 0
                  ? 'Attach your notes or type a topic below, then press Generate Deck. Decks are saved to your account.'
                  : 'Cards come back when they are due. Generate a new deck below to learn more.'}
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0">{input}</div>
      </div>

      <div className="lg:col-span-3 flex min-w-0 flex-col lg:sticky lg:top-0">
        <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" /> Saved decks
          </h3>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {decks.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">No decks saved for this subject yet.</div>
            ) : decks.map(deck => (
              <div key={deck.id} className={cn("p-4 bg-gray-50 dark:bg-gray-900 border rounded-xl", deck.id === deckId ? "border-primary-300 dark:border-primary-800" : "border-gray-100 dark:border-gray-800")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">{deck.title}</p>
                    <p className="text-[10px] text-gray-400">{deck.card_count} cards · {deck.due_count} due · {deck.mastered_count} learned · {savedAt(deck.created_at)}</p>
                  </div>
                  <button onClick={() => remove(deck)} className="shrink-0 p-1 text-gray-400 hover:text-red-500" aria-label={`Delete ${deck.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button size="sm" variant="secondary" className="mt-2 h-7 text-[10px] font-bold" disabled={deck.due_count === 0} onClick={() => setDeckId(deck.id)}>
                  {deck.due_count === 0 ? 'Nothing due' : `Review ${deck.due_count} due`}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
