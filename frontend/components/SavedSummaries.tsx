import React, { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, Eye, Layers, Trash2 } from 'lucide-react';
import { Button, Card } from './UIComponents';
import { confirmAction, notify } from './Feedback';
import { deleteSummary, listSummaries, SavedSummary, savedAt } from '../services/studyService';

/** Summaries saved to the account for this subject (IP-40). */
export const SavedSummaries: React.FC<{
  subjectId: string;
  refreshKey: number;
  onOpen: (summary: SavedSummary) => void;
}> = ({ subjectId, refreshKey, onOpen }) => {
  const [summaries, setSummaries] = useState<SavedSummary[]>([]);

  const load = useCallback(() => {
    listSummaries(subjectId).then(setSummaries).catch(() => {});
  }, [subjectId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = async (summary: SavedSummary) => {
    const ok = await confirmAction({
      title: `Delete "${summary.title}"?`,
      message: 'This saved summary will be deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSummary(summary.id);
      setSummaries(list => list.filter(s => s.id !== summary.id));
    } catch (error) {
      notify(`Couldn't delete the summary. ${error instanceof Error ? error.message : ''}`, 'error');
    }
  };

  return (
    <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary-500" /> Saved summaries
      </h3>
      <div className="max-h-[60vh] overflow-y-auto space-y-3">
        {summaries.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-8">No summaries saved for this subject yet.</div>
        ) : summaries.map(summary => (
          <div key={summary.id} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">{summary.title}</p>
              <p className="flex items-center gap-1 text-[10px] text-gray-400">
                {summary.cites_pages && <><BookOpenCheck className="h-3 w-3 text-emerald-500" /> Cites pages ·</>} {savedAt(summary.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="sm" className="h-6" onClick={() => onOpen(summary)} aria-label={`Open ${summary.title}`}>
                <Eye className="w-3.5 h-3.5 text-gray-500" />
              </Button>
              <button onClick={() => remove(summary)} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Delete ${summary.title}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
