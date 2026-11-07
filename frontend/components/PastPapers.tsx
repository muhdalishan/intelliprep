import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileStack, Loader2, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { confirmAction, notify } from './Feedback';
import {
  deletePastPaper, ExamKind, fetchPredictions, listPastPapers, PastPaper, Predictions, uploadPastPaper,
} from '../services/studyService';

const POLL_MS = 4000;
const MAX_BYTES = 25 * 1024 * 1024;
const EXAM_LABEL: Record<ExamKind, string> = { final: 'Final', mid: 'Midterm', quiz: 'Quiz', other: 'Other' };

/**
 * Past papers (IP-60, IP-61): the student uploads earlier papers, the server pulls out their
 * questions, and once there are three or more it ranks topics by how often and how recently
 * they were asked.
 */
export const PastPapers: React.FC<{ subjectId: string; enabled: boolean }> = ({ subjectId, enabled }) => {
  const [papers, setPapers] = useState<PastPaper[]>([]);
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear() - 1);
  const [exam, setExam] = useState<ExamKind>('final');
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [list, ranked] = await Promise.all([listPastPapers(subjectId), fetchPredictions(subjectId)]);
      setPapers(list);
      setPredictions(ranked);
    } catch {
      // Keeps what's shown; uploads show their own errors.
    }
  }, [enabled, subjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const processing = papers.some(p => p.status === 'processing');
  const wasProcessing = useRef(false);
  useEffect(() => {
    if (processing) {
      wasProcessing.current = true;
      const timer = window.setInterval(refresh, POLL_MS);
      return () => window.clearInterval(timer);
    }
    if (!wasProcessing.current) return;
    // Topics are ranked just after the last paper is read, so look again shortly.
    wasProcessing.current = false;
    const timers = [3000, 8000, 15000].map(ms => window.setTimeout(refresh, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [processing, refresh]);

  if (!enabled) {
    return (
      <Card className="flex items-start gap-3 border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800">
        <FileStack className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-white">Predictions from past papers</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Works for subjects saved to your account. Share this subject in the <strong>Group</strong> section to save it, then upload three or more past papers.
          </p>
        </div>
      </Card>
    );
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notify('This file is over 25 MB.', 'error');
      return;
    }
    setUploading(true);
    try {
      const paper = await uploadPastPaper(subjectId, year, exam, file);
      setPapers(list => [paper, ...list]);
      notify(`Reading the questions in ${file.name}…`, 'info');
    } catch (error) {
      notify(`Couldn't upload ${file.name}. ${error instanceof Error ? error.message : ''}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (paper: PastPaper) => {
    const ok = await confirmAction({
      title: `Delete the ${paper.year} ${EXAM_LABEL[paper.exam].toLowerCase()} paper?`,
      message: 'Its questions are removed and the topic ranking is worked out again.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePastPaper(paper.id);
      setPapers(list => list.filter(p => p.id !== paper.id));
      window.setTimeout(refresh, 1500); // the ranking is redone in the background
    } catch (error) {
      notify(`Couldn't delete the paper. ${error instanceof Error ? error.message : ''}`, 'error');
    }
  };

  const completed = papers.filter(p => p.status === 'completed').length;
  const topics = predictions?.ready ? predictions.topics : [];

  return (
    <Card className="space-y-5 border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900 dark:text-white">
          <FileStack className="h-5 w-5 text-emerald-600" /> From past papers
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Upload earlier papers (PDF or text). Topics are ranked by how often and how recently they were asked.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-bold text-gray-500">
          Year
          <input
            type="number"
            min={1990}
            max={2100}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="mt-1 block w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="text-[11px] font-bold text-gray-500">
          Exam
          <select
            value={exam}
            onChange={e => setExam(e.target.value as ExamKind)}
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {(Object.keys(EXAM_LABEL) as ExamKind[]).map(k => <option key={k} value={k}>{EXAM_LABEL[k]}</option>)}
          </select>
        </label>
        <label className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-700", uploading && "pointer-events-none opacity-60")}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload paper'}
          <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={upload} disabled={uploading || year < 1990 || year > 2100} />
        </label>
      </div>

      {papers.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {papers.map(p => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              {p.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                : p.status === 'failed' ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-500" />}
              <span className="font-bold text-gray-800 dark:text-gray-200">{p.year} {EXAM_LABEL[p.exam]}</span>
              <span className="min-w-0 flex-1 truncate text-gray-500">
                {p.status === 'completed' ? `${p.question_count} questions` : p.status === 'failed' ? (p.failure_reason || "Couldn't read it") : 'Reading questions…'} · {p.filename}
              </span>
              <button onClick={() => remove(p)} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Delete ${p.year} paper`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {topics.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Likely topics · from {predictions?.papers} papers</h4>
          {topics.map(t => (
            <div key={t.rank} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{t.rank}. {t.topic_name}</p>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{Math.round(t.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(t.confidence * 100)}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Asked in {[...t.years].sort((a, b) => b - a).join(', ')} · {Math.round(t.frequency * 100)}% of papers</p>
              {t.example_questions.length > 0 && (
                <ul className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                  {t.example_questions.map((q, i) => (
                    <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300">
                      <span className="font-bold text-gray-400">{q.year}{q.marks ? ` · ${q.marks} marks` : ''}:</span> {q.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          {processing
            ? 'Reading questions; the ranking updates when it finishes.'
            : predictions && predictions.papers_needed > 0
              ? `${completed} of 3 papers read. Add ${predictions.papers_needed} more to see ranked topics.`
              : 'No ranked topics yet.'}
        </p>
      )}
    </Card>
  );
};
