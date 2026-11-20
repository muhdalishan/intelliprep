import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, History, Trash2, XCircle } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { confirmAction, notify } from './Feedback';
import { AttemptResult, QuestionResult, deleteQuiz, getQuiz, listQuizzes, QuizSummary, SavedQuiz, savedAt, submitAttempt } from '../services/studyService';

/**
 * Takes a quiz saved to the account (IP-42). The server keeps the answers until the attempt is
 * submitted, then scores it, explains every question and adds missed topics to weak topics.
 */
export const SavedQuizRunner: React.FC<{
  quiz: SavedQuiz;
  onFinished: (result: AttemptResult) => void;
  onExit: () => void;
}> = ({ quiz, onFinished, onExit }) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const started = useRef(Date.now());

  const questions = quiz.questions;
  const question = questions[index];
  const chosen = answers[question?.id];
  const last = index === questions.length - 1;

  const submit = async () => {
    setSubmitting(true);
    try {
      const attempt = await submitAttempt(
        quiz.id,
        questions.map(q => ({ question_id: q.id, chosen_index: answers[q.id] ?? null })),
        Math.round((Date.now() - started.current) / 1000),
      );
      setResult(attempt);
      onFinished(attempt);
    } catch (error) {
      notify(`Couldn't submit the quiz. ${error instanceof Error ? error.message : ''}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const byId = new Map<string, QuestionResult>(result.results.map(r => [r.question_id, r]));
    return (
      <Card className="p-6 md:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6 text-left">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm dark:bg-emerald-950/40">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{quiz.title}</h2>
          <div className="inline-block px-10 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 font-extrabold uppercase leading-none mb-1">Score</p>
            <span className="text-4xl font-black text-primary-600">{result.score} / {result.total}</span>
            <span className="block text-xs font-bold text-gray-500 mt-1">{Math.round((result.score / result.total) * 100)}%</span>
          </div>
          {result.new_weak_topics.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Added to weak topics: <strong>{result.new_weak_topics.join(', ')}</strong>
            </p>
          )}
        </div>

        <ol className="space-y-3">
          {questions.map((q, i) => {
            const r = byId.get(q.id);
            if (!r) return null;
            return (
              <li key={q.id} className={cn("rounded-xl border p-4 text-xs", r.is_correct ? "border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20" : "border-orange-200 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20")}>
                <p className="flex items-start gap-1.5 font-bold text-gray-800 dark:text-gray-100">
                  {r.is_correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />}
                  {i + 1}. {q.question}
                </p>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  Answer: <strong>{q.options[r.correct_index]}</strong>
                  {!r.is_correct && <> · You chose: {r.chosen_index === null ? 'skipped' : q.options[r.chosen_index]}</>}
                </p>
                {r.explanation && <p className="mt-1 text-gray-600 dark:text-gray-400">{r.explanation}</p>}
              </li>
            );
          })}
        </ol>

        <div className="flex justify-center">
          <Button onClick={onExit}>Done</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700">
        <div className="h-full bg-primary-500 transition-all duration-350" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="p-6 md:p-8 space-y-6 text-left">
        <div className="flex justify-between items-center gap-2 text-xs text-gray-400">
          <span className="font-bold">{quiz.title} · Question {index + 1} of {questions.length}</span>
          <button className="font-bold hover:text-gray-600 dark:hover:text-gray-200" onClick={onExit}>Exit</button>
        </div>
        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-snug">{question.question}</h3>
        <div className="space-y-2.5 pt-2" role="radiogroup" aria-label="Options">
          {question.options.map((opt, idx) => (
            <button
              key={idx}
              role="radio"
              aria-checked={chosen === idx}
              onClick={() => setAnswers(a => ({ ...a, [question.id]: idx }))}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all text-xs flex items-center justify-between group",
                chosen === idx
                  ? "border-primary-500 bg-primary-50/60 text-primary-800 dark:bg-primary-950/30 dark:text-primary-200"
                  : "border-gray-200 hover:border-primary-500 hover:bg-primary-50/20 text-gray-700 dark:border-gray-700 dark:text-gray-300"
              )}
            >
              <span>{opt}</span>
              <span className={cn("w-4 h-4 rounded-full border", chosen === idx ? "border-primary-500 bg-primary-500" : "border-gray-300 group-hover:border-primary-500")} />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">Answers and explanations are shown when you finish.</p>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Back</Button>
          {last ? (
            <Button size="sm" isLoading={submitting} onClick={submit}>
              {Object.keys(answers).length < questions.length ? `Finish (${questions.length - Object.keys(answers).length} skipped)` : 'Finish quiz'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIndex(i => i + 1)}>{chosen === undefined ? 'Skip' : 'Next question'}</Button>
          )}
        </div>
      </div>
    </Card>
  );
};

/** Quizzes saved to the account for this subject, with their scores. */
export const SavedQuizList: React.FC<{
  subjectId: string;
  refreshKey: number;
  onOpen: (quiz: SavedQuiz) => void;
}> = ({ subjectId, refreshKey, onOpen }) => {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(() => {
    listQuizzes(subjectId).then(setQuizzes).catch(() => {});
  }, [subjectId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const open = async (id: string) => {
    setOpening(id);
    try {
      onOpen(await getQuiz(id));
    } catch (error) {
      notify(`Couldn't open the quiz. ${error instanceof Error ? error.message : ''}`, 'error');
    } finally {
      setOpening(null);
    }
  };

  const remove = async (quiz: QuizSummary) => {
    const ok = await confirmAction({
      title: `Delete "${quiz.title}"?`,
      message: 'The quiz and its scores will be deleted. Weak topics stay.',
      confirmLabel: 'Delete quiz',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQuiz(quiz.id);
      setQuizzes(list => list.filter(q => q.id !== quiz.id));
    } catch (error) {
      notify(`Couldn't delete the quiz. ${error instanceof Error ? error.message : ''}`, 'error');
    }
  };

  return (
    <section className="flex flex-col rounded-2xl border border-gray-200 bg-white text-left dark:border-white/[.07] dark:bg-white/[.015]">
      <h3 className="flex items-baseline justify-between px-5 pb-2 pt-5 text-[15px] font-medium text-gray-900 dark:text-white">
        Saved quizzes <span className="font-mono text-xs font-normal text-gray-500">{quizzes.length}</span>
      </h3>
      <div className="max-h-[60vh] space-y-0.5 overflow-y-auto px-2 pb-2">
        {quizzes.length === 0 ? (
          <div className="px-3 py-8 text-center text-[13px] text-gray-500">No saved quizzes yet. Make one below</div>
        ) : quizzes.map(quiz => (
          <div key={quiz.id} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[.03]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{quiz.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {quiz.attempts === 0 ? 'Not taken yet' : <>Best <span className="font-mono tabular-nums text-gray-800 dark:text-gray-200">{quiz.best_score}/{quiz.question_count}</span> · last <span className="font-mono tabular-nums">{quiz.last_score}/{quiz.question_count}</span></>} · {savedAt(quiz.created_at)}
              </p>
            </div>
            <Button size="sm" variant="secondary" isLoading={opening === quiz.id} onClick={() => open(quiz.id)}>
              {quiz.attempts === 0 ? 'Start' : 'Retake'}
            </Button>
            <button onClick={() => remove(quiz)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-400" aria-label={`Delete ${quiz.title}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
