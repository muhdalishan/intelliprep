import React, { useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Camera, ImageUp, Loader2, Sigma, Trash2 } from 'lucide-react';
import { Button, Card, cn } from './UIComponents';
import { notify } from './Feedback';
import { usePersistentState } from '../hooks/usePersistentState';
import { DiagramExplanation, explainImage, prepareImage } from '../services/multimodalService';

interface SavedExplanation extends DiagramExplanation {
  id: string;
  thumbnail: string;
  question?: string;
  date: string;
}

const Formula: React.FC<{ latex: string }> = ({ latex }) => {
  // KaTeX escapes the input itself; a formula it can't parse is shown as plain text instead.
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, output: 'html' });
  return <div className="overflow-x-auto py-1 text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: html }} />;
};

const ExplanationView: React.FC<{ item: SavedExplanation }> = ({ item }) => (
  <div className="space-y-4">
    <div className="flex items-start gap-4">
      <img src={item.thumbnail} alt={`Photo: ${item.title}`} className="h-24 w-24 shrink-0 rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
      <div className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">{item.kind}</span>
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{item.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.summary}</p>
        {item.question && <p className="mt-1 text-xs italic text-gray-400">You asked: {item.question}</p>}
      </div>
    </div>

    <ol className="space-y-2">
      {item.steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>

    {item.equations.length > 0 && (
      <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400"><Sigma className="h-3.5 w-3.5" /> Equations</p>
        {item.equations.map((eq, i) => (
          <div key={i}>
            <Formula latex={eq.latex} />
            <p className="text-xs text-gray-500 dark:text-gray-400">{eq.meaning}</p>
          </div>
        ))}
      </div>
    )}

    {item.key_terms.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {item.key_terms.map(term => (
          <span key={term} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">{term}</span>
        ))}
      </div>
    )}
  </div>
);

/** Photograph a diagram or handwritten equation and get it explained, with typeset maths (IP-80). */
export const DiagramExplainer: React.FC<{ subjectId: string; subjectName: string }> = ({ subjectId, subjectName }) => {
  const [history, setHistory] = usePersistentState<SavedExplanation[]>(`ip_diagrams_${subjectId}`, () => []);
  const [question, setQuestion] = useState('');
  const [working, setWorking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => history[0]?.id ?? null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorking(true);
    try {
      const { blob, thumbnail } = await prepareImage(file);
      const explanation = await explainImage(blob, subjectName, question);
      const saved: SavedExplanation = {
        ...explanation,
        id: `img-${Date.now()}`,
        thumbnail,
        question: question.trim() || undefined,
        date: new Date().toLocaleDateString(),
      };
      setHistory(prev => [saved, ...prev].slice(0, 20));
      setOpenId(saved.id);
      setQuestion('');
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't explain this image.", 'error');
    } finally {
      setWorking(false);
    }
  };

  const open = history.find(h => h.id === openId);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-10 lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        <Card className="border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><ImageUp className="h-4 w-4 text-primary-500" /> Explain a diagram or equation</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Take a photo of a diagram, graph, circuit or handwritten equation. You get a step-by-step explanation, with maths written out properly.</p>

          <label className="mt-4 block text-xs font-semibold text-gray-500" htmlFor="diagram-question">Anything specific to ask? (optional)</label>
          <input
            id="diagram-question"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="e.g. Why does the current split here?"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-900"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary-500/25 hover:bg-primary-700', working && 'pointer-events-none opacity-60')}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {working ? 'Reading the image…' : 'Take or choose a photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={handleFile} disabled={working} />
            </label>
            <span className="self-center text-[11px] text-gray-400">JPEG, PNG or WebP. Photos are shrunk before upload.</span>
          </div>
        </Card>

        {open ? (
          <Card className="border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-6">
            <ExplanationView item={open} />
          </Card>
        ) : (
          <Card className="border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <Sigma className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No explanations yet</p>
            <p className="mt-1 text-xs text-gray-400">Your explained photos for this subject will appear here.</p>
          </Card>
        )}
      </div>

      <Card className="flex flex-col border border-gray-200 bg-white p-5 text-left dark:border-gray-700 dark:bg-gray-800 sm:p-6 lg:sticky lg:top-0 lg:col-span-3">
        <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Earlier photos</h3>
        {history.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Nothing explained yet for this subject.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {history.map(item => (
              <li key={item.id} className={cn('flex items-center gap-3 rounded-xl border p-2', item.id === openId ? 'border-primary-300 bg-primary-50/60 dark:border-primary-800 dark:bg-primary-950/30' : 'border-gray-100 dark:border-gray-700')}>
                <button onClick={() => setOpenId(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <img src={item.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-gray-800 dark:text-gray-100">{item.title}</span>
                    <span className="text-[10px] text-gray-400">{item.date}</span>
                  </span>
                </button>
                <button onClick={() => { setHistory(prev => prev.filter(h => h.id !== item.id)); if (openId === item.id) setOpenId(null); }} aria-label={`Delete ${item.title}`} className="rounded-lg p-1.5 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
