import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button, cn } from './UIComponents';

type Tone = 'info' | 'success' | 'error';

interface Toast { id: number; message: string; tone: Tone }

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const TOAST_EVENT = 'ip-toast';
const CONFIRM_EVENT = 'ip-confirm';

/** Shows a short message in the corner. Works from components and plain service files. */
export const notify = (message: string, tone: Tone = 'info') => {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }));
};

/** Asks the student to confirm an action in an in-app dialog. Resolves true if they confirm. */
export const confirmAction = (options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> =>
  new Promise(resolve => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, { detail: { ...options, resolve } }));
  });

const TONE_STYLES: Record<Tone, { icon: React.ElementType; className: string }> = {
  info: { icon: Info, className: 'text-primary-600 dark:text-primary-300' },
  success: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: AlertTriangle, className: 'text-red-600 dark:text-red-400' },
};

/** Mounted once in App: renders toasts and the confirm dialog. */
export const FeedbackHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    let nextId = 0;
    const onToast = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail;
      const id = ++nextId;
      setToasts(prev => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), tone === 'error' ? 6000 : 3500);
    };
    const onConfirm = (e: Event) => setRequest((e as CustomEvent).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request]);

  const answer = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end" aria-live="polite">
        {toasts.map(toast => {
          const { icon: Icon, className } = TONE_STYLES[toast.tone];
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl animate-in fade-in slide-in-from-top-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} />
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {request && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => answer(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h2 id="confirm-title" className="text-base font-extrabold text-slate-900 dark:text-white">{request.title}</h2>
            {request.message && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{request.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => answer(false)}>Cancel</Button>
              <Button autoFocus size="sm" variant={request.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>
                {request.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
