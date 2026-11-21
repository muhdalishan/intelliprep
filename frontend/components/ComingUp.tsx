import React, { useEffect, useState } from 'react';
import { Bell, BrainCircuit, CheckCircle2, Columns, FileText, Loader2, TriangleAlert } from 'lucide-react';
import { formatDue } from '../services/studyStore';
import { CHANNEL_LABEL, ReminderChannel } from '../services/reminderService';
import { DashboardData, fetchDashboard } from '../services/dashboardService';

const Panel: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <section className="min-w-0 rounded-2xl border border-gray-200 p-5 transition-colors hover:border-gray-300 dark:border-white/[.07] dark:hover:border-white/[.12]">
    <h3 className="mb-3 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Icon className="h-3.5 w-3.5" /> {title}
    </h3>
    {children}
  </section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] text-gray-400 dark:text-gray-500">{children}</p>
);

/**
 * The dashboard's side rail, from the server: upcoming reminders, notes being made searchable,
 * the shared planner and top predictions. Hidden when the server can't be reached.
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
  const stages = [
    { label: 'To study', value: tasks.todo, tone: 'bg-gray-400' },
    { label: 'Learning', value: tasks.learning, tone: 'bg-amber-500' },
    { label: 'Practiced', value: tasks.practiced, tone: 'bg-blue-500' },
    { label: 'Mastered', value: tasks.mastered, tone: 'bg-emerald-500' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Planner, predictions and notes">
      <Panel icon={Columns} title="Planner and practice">
        {taskTotal === 0 ? <Empty>No planner tasks yet.</Empty> : (
          <>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]" aria-hidden="true">
              {stages.map(stage => stage.value > 0 && (
                <span key={stage.label} className={stage.tone} style={{ width: `${(stage.value / taskTotal) * 100}%` }} />
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {stages.map(stage => (
                <div key={stage.label} className="flex items-center gap-1.5 text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${stage.tone}`} />
                  <dt className="text-gray-500">{stage.label}</dt>
                  <dd className="ml-auto font-medium tabular-nums text-gray-900 dark:text-gray-100">{stage.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {(weakTopics > 0 || lastQuiz) && (
          <div className="mt-3 space-y-1 border-t border-gray-200 pt-3 text-[13px] text-gray-700 dark:border-white/[.07] dark:text-gray-300">
            {weakTopics > 0 && <p><span className="font-medium text-gray-900 dark:text-white">{weakTopics}</span> weak {weakTopics === 1 ? 'topic' : 'topics'} to review</p>}
            {lastQuiz && (
              <p className="truncate" title={`${lastQuiz.quiz_title} · ${lastQuiz.subject_name}`}>
                Last quiz <span className="font-medium tabular-nums text-gray-900 dark:text-white">{lastQuiz.score}/{lastQuiz.total}</span> <span className="text-xs text-gray-500">· {lastQuiz.subject_name}</span>
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel icon={BrainCircuit} title="Likely exam topics">
        {predictions.length === 0 ? <Empty>Upload 3 or more past papers to see predictions.</Empty> : (
          <ul className="space-y-3">
            {predictions.slice(0, 4).map(p => {
              const pct = Math.round(p.confidence * 100);
              return (
                <li key={`${p.subject_name}-${p.topic_name}`} title={`${p.topic_name} · ${p.subject_name} · ${pct}%`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{p.topic_name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
                    <div className="h-full rounded-full bg-primary-500/80" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-gray-500">{p.subject_name}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel icon={FileText} title="Recent notes">
        {documents.length === 0 ? <Empty>Nothing uploaded to your account yet.</Empty> : (
          <ul className="space-y-1.5">
            {documents.slice(0, 4).map(d => (
              <li key={d.id} className="flex items-center gap-2 text-[13px]">
                {d.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : d.status === 'failed' ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-500" />}
                <span className="truncate text-gray-700 dark:text-gray-300">{d.filename}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};
