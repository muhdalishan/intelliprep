import React, { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Loader2, Search, Trash2, TriangleAlert } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { confirmAction, notify } from './Feedback';
import { askNotes, deleteDocument, listDocuments, NotesAnswer, StoredDocument } from '../services/documentService';

const POLL_MS = 3000;

const pages = (start: number, end: number) => (start === end ? `p. ${start}` : `pp. ${start}–${end}`);

/**
 * Search a subject's own notes and get answers with page citations (IP-31, IP-34).
 * Works for subjects saved to the account, where documents are stored and indexed.
 */
export const AskNotes: React.FC<{ subjectId: string; enabled: boolean; refreshKey: number }> = ({ subjectId, enabled, refreshKey }) => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<{ question: string; answer: NotesAnswer } | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setDocuments(await listDocuments(subjectId));
    } catch {
      // The library just stays as it was; uploads and questions show their own errors.
    }
  }, [enabled, subjectId]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  // Keep checking while a document is still being made searchable.
  const processing = documents.some(d => d.status === 'processing' || d.status === 'uploaded');
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  if (!enabled) {
    return (
      <Card className="flex items-start gap-3 border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800">
        <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
        <div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-white">Ask your notes, with page citations</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Works for subjects saved to your account. Share this subject in the <strong>Group</strong> section to save it, then upload your notes again to make them searchable.
          </p>
        </div>
      </Card>
    );
  }

  const searchable = documents.filter(d => d.status === 'completed').length;

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || asking) return;
    setAsking(true);
    try {
      setResult({ question: q, answer: await askNotes(subjectId, q) });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't search your notes.", 'error');
    } finally {
      setAsking(false);
    }
  };

  const remove = async (doc: StoredDocument) => {
    const ok = await confirmAction({
      title: `Delete ${doc.filename}?`,
      message: 'It will no longer be searched or cited, for you or your groups.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDocument(doc.id);
      setDocuments(current => current.filter(d => d.id !== doc.id));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't delete the document.", 'error');
    }
  };

  return (
    <Card className="space-y-5 border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white">
          <BookOpenCheck className="h-4 w-4 text-primary-500" /> Ask your notes
        </h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Answers come only from this subject's documents, with the page each point came from.
        </p>
      </div>

      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ask-notes">Your question</label>
        <input
          id="ask-notes"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={1000}
          placeholder={searchable ? 'e.g. Explain AVL rotations with an example' : 'Upload notes first to ask about them'}
          disabled={!searchable}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900"
        />
        <Button type="submit" size="sm" disabled={!searchable || asking || question.trim().length < 3} className="gap-2 rounded-xl px-5">
          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Ask
        </Button>
      </form>

      {result && (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40" aria-live="polite">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{result.question}</p>
          <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', result.answer.in_notes ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500')}>
            {result.answer.answer}
          </p>
          {result.answer.citations.length > 0 && (
            <ol className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              {result.answer.citations.map(c => (
                <li key={c.number} className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-bold text-primary-600 dark:text-primary-400">[{c.number}] {c.filename}, {pages(c.page_start, c.page_end)}</span>
                  <span className="mt-0.5 block italic">“{c.excerpt}”</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Searchable documents ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-500">Upload a PDF or text file above; it's saved to this subject and made searchable.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map(doc => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-gray-700 dark:text-gray-200">{doc.filename}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {doc.status === 'completed' && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Searchable · {doc.chunk_count} passages{doc.page_count ? ` · ${doc.page_count} pages` : ''}</span>}
                    {(doc.status === 'processing' || doc.status === 'uploaded') && <span className="inline-flex items-center gap-1 text-primary-600"><Loader2 className="h-3 w-3 animate-spin" /> Making searchable…</span>}
                    {doc.status === 'failed' && <span className="inline-flex items-center gap-1 text-red-600"><TriangleAlert className="h-3 w-3" /> {doc.failure_reason || 'Processing failed'}</span>}
                    {!doc.owned && <span className="ml-1">· shared with you</span>}
                  </p>
                </div>
                {doc.owned && (
                  <button onClick={() => remove(doc)} aria-label={`Delete ${doc.filename}`} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};
