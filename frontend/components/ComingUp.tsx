import React, { useEffect, useState } from 'react';
import { Bell, BrainCircuit, CheckCircle2, Columns, FileText, Loader2, TriangleAlert } from 'lucide-react';
import { formatDue } from '../services/studyStore';
import { CHANNEL_LABEL, ReminderChannel } from '../services/reminderService';
import { DashboardData, fetchDashboard } from '../services/dashboardService';

const Column: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="min-w-0">
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      <Icon className="h-3.5 w-3.5" /> {title}
    </p>
    {children}
  </div>
);

/**
 * What's next from the server: upcoming reminders, notes being made searchable, the shared
 * planner and top predictions. Hidden when the server can't be reached or there's nothing yet.
 */
export const ComingUp: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;
  const { upcoming_reminders: reminders, recent_documents: documents, tasks, top_predictions: predictions } = data;
  const weakTopics = data.weak_topics ?? 0;
  const lastQuiz = data.recent_quiz_scores?.[0];
  const taskTotal = tasks.todo + tasks.learning + tasks.practiced + tasks.mastered;
  if (!reminders.length && !documents.length && !taskTotal && !predictions.length && !weakTopics && !lastQuiz) return null;

  return (
    <section className="grid grid-cols-1 gap-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 md:grid-cols-2 xl:grid-cols-4" aria-label="Coming up">
      <Column icon={Bell} title="Coming up">
        {reminders.length === 0 ? <p className="text-xs text-slate-400">No reminders set.</p> : (
          <ul className="space-y-2">
            {reminders.slice(0, 3).map(r => (
              <li key={r.id} className="text-sm">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{r.message}</p>
                <p className="text-[11px] text-slate-500">{formatDue(r.due_at)} · {CHANNEL_LABEL[r.channel as ReminderChannel] ?? r.channel}{r.subject_name ? ` · ${r.subject_name}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Column icon={FileText} title="Recent notes">
        {documents.length === 0 ? <p className="text-xs text-slate-400">Nothing uploaded to your account yet.</p> : (
          <ul className="space-y-1.5">
            {documents.slice(0, 3).map(d => (
              <li key={d.id} className="flex items-center gap-1.5 text-sm">
                {d.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : d.status === 'failed' ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-500" />}
                <span className="truncate text-slate-700 dark:text-slate-200">{d.filename}</span>
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Column icon={Columns} title="Planner and practice">
        {taskTotal === 0 ? <p className="text-xs text-slate-400">No planner tasks in shared subjects.</p> : (
          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            <p><strong>{tasks.todo}</strong> to study · <strong>{tasks.learning}</strong> learning</p>
            <p><strong>{tasks.practiced}</strong> practiced · <strong>{tasks.mastered}</strong> mastered</p>
          </div>
        )}
        {(weakTopics > 0 || lastQuiz) && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
            {weakTopics > 0 && <p><strong>{weakTopics}</strong> weak {weakTopics === 1 ? 'topic' : 'topics'} to review</p>}
            {lastQuiz && (
              <p className="truncate" title={`${lastQuiz.quiz_title} · ${lastQuiz.subject_name}`}>
                Last quiz <strong>{lastQuiz.score}/{lastQuiz.total}</strong> <span className="text-[11px] text-slate-500">· {lastQuiz.subject_name}</span>
              </p>
            )}
          </div>
        )}
      </Column>

      <Column icon={BrainCircuit} title="Likely exam topics">
        {predictions.length === 0 ? <p className="text-xs text-slate-400">Upload 3 or more past papers to see predictions.</p> : (
          <ul className="space-y-1.5">
            {predictions.slice(0, 3).map(p => (
              <li key={`${p.subject_name}-${p.topic_name}`} className="text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{p.topic_name}</span>
                <span className="text-[11px] text-slate-500"> · {p.subject_name} · {Math.round(p.confidence * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </Column>
    </section>
  );
};
