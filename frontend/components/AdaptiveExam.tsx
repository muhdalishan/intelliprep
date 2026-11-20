import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Gauge, Loader2, XCircle } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { notify } from './Feedback';
import {
  AdaptiveAnswer, AdaptiveQuestion, AdaptiveSummary, AnswerCheck, LEVEL_LABEL, Level,
  adaptiveSummary, checkAdaptiveAnswer, nextAdaptiveQuestion,
} from '../services/adaptiveService';

const QUESTIONS = 10;
const LEVEL_ORDER: Level[] = ['easy', 'medium', 'hard', 'very_hard'];

const LevelMeter: React.FC<{ level: Level }> = ({ level }) => (
  <div className="flex items-center gap-2" aria-label={`Difficulty: ${LEVEL_LABEL[level]}`}>
    <Gauge className="h-4 w-4 text-primary-600" />
    <div className="flex gap-1">
      {LEVEL_ORDER.map((l, i) => (
        <span key={l} className={cn('h-2 w-6 rounded-full', i <= LEVEL_ORDER.indexOf(level) ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700')} />
      ))}
    </div>
    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{LEVEL_LABEL[level]}</span>
  </div>
);

/**
 * A 10-question exam that gets harder after two right answers in a row and easier after two
 * wrong, leaning on weak topics (IP-70, IP-71). The correct answer comes from the server only
 * after the student answers.
 */
export const AdaptiveExam: React.FC<{
  /** Attached notes (may be empty) and a typed topic; at least one is set. */
  material: { text: string; focus?: string };
  weakTopics: string[];
  onMissed: (topic: string, explanation: string) => void;
  onFinished: () => void;
  onExit: () => void;
}> = ({ material, weakTopics, onMissed, onFinished, onExit }) => {
  const [history, setHistory] = useState<AdaptiveAnswer[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [current, setCurrent] = useState<AdaptiveQuestion | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerCheck | null>(null);
  const [summary, setSummary] = useState<AdaptiveSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const loadNext = async (nextHistory: AdaptiveAnswer[], nextAsked: string[]) => {
    setBusy(true);
    setChosen(null);
    setResult(null);
    try {
      const question = await nextAdaptiveQuestion(material.text, material.focus, nextHistory, weakTopics, nextAsked);
      setCurrent(question);
      setAsked([...nextAsked, question.question.question]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't get the next question.", 'error');
      if (!current) onExit();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadNext([], []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = async (index: number) => {
    if (!current || result || busy) return;
    setChosen(index);
    setBusy(true);
    try {
      const check = await checkAdaptiveAnswer(current.token, index);
      setResult(check);
      setHistory(prev => [...prev, { topic: check.topic, level: check.level, correct: check.correct }]);
      if (!check.correct) onMissed(check.topic, check.explanation);
    } catch (error) {
      setChosen(null);
      notify(error instanceof Error ? error.message : "Couldn't check the answer.", 'error');
    } finally {
      setBusy(false);
    }
  };

  const proceed = async () => {
    if (history.length >= QUESTIONS) {
      setBusy(true);
      try {
        setSummary(await adaptiveSummary(history));
        onFinished();
      } catch (error) {
        notify(error instanceof Error ? error.message : "Couldn't build the report.", 'error');
      } finally {
        setBusy(false);
      }
      return;
    }
    loadNext(history, asked);
  };

  if (summary) {
    return (
      <Card className="space-y-6 border border-gray-200 bg-white p-6 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-8">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Adaptive exam finished</p>
          <p className="mt-1 text-4xl font-black text-gray-900 dark:text-white">{summary.score} / {summary.total}</p>
          <p className="mt-1 text-sm text-gray-500">
            Highest level reached: <strong>{LEVEL_LABEL[summary.highest_level]}</strong> · finished at <strong>{LEVEL_LABEL[summary.final_level]}</strong>
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">By topic, weakest first</p>
          <ul className="space-y-2">
            {summary.topics.map(t => (
              <li key={t.topic} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm font-semibold text-gray-700 dark:text-gray-200 sm:w-56">{t.topic}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className={cn('h-full rounded-full', t.correct / t.total >= 0.7 ? 'bg-emerald-500' : t.correct / t.total >= 0.4 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${(t.correct / t.total) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-bold text-gray-500">{t.correct}/{t.total}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">Missed topics were added to your weak topics in Practice.</p>
        </div>
        <div className="flex justify-center"><Button onClick={onExit}>Done</Button></div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-gray-500">Question {Math.min(history.length + (result ? 0 : 1), QUESTIONS)} of {QUESTIONS}</span>
        {current && <LevelMeter level={result?.level ?? current.level} />}
        <button onClick={onExit} className="text-xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-white">End exam</button>
      </div>

      {!current ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Writing your first question…</div>
      ) : (
        <>
          {current.focus_topic && !result && (
            <p className="text-[11px] font-semibold text-amber-600">Focusing on a weak topic: {current.focus_topic}</p>
          )}
          <h3 className="text-lg font-bold leading-snug text-gray-900 dark:text-white">{current.question.question}</h3>
          <div className="space-y-2">
            {current.question.options.map((option, i) => {
              const isCorrect = result?.correct_index === i;
              const isWrongPick = result && chosen === i && !result.correct;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={!!result || busy}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors',
                    !result && 'border-gray-200 hover:border-primary-400 hover:bg-primary-50/40 dark:border-gray-700 dark:hover:bg-primary-950/20',
                    isCorrect && 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
                    isWrongPick && 'border-red-400 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200',
                    result && !isCorrect && !isWrongPick && 'border-gray-100 text-gray-400 dark:border-gray-800',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1">{option}</span>
                  {busy && chosen === i && !result && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                  {isWrongPick && <XCircle className="h-4 w-4" />}
                </button>
              );
            })}
          </div>

          {result && (
            <div className={cn('rounded-xl p-4 text-sm', result.correct ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100')}>
              <p className="font-bold">{result.correct ? 'Correct.' : 'Not quite.'}</p>
              <p className="mt-1">{result.explanation}</p>
            </div>
          )}

          {result && (
            <div className="flex justify-end">
              <Button onClick={proceed} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {history.length >= QUESTIONS ? 'See my results' : 'Next question'} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
