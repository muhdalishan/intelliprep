import { useCallback, useEffect, useState } from 'react';
import { usePersistentState } from './usePersistentState';
import { notify } from '../components/Feedback';
import { addWeakTopic, clearWeakTopic, listWeakTopics, savedAt, WeakOrigin } from '../services/studyService';

export interface WeakItem {
  id: string;
  name: string;
  origin: WeakOrigin;
  date: string;
  reviewIdea: string;
  misses?: number;
}

/**
 * Weak topics for one subject. Subjects saved to the account keep them on the server (quiz
 * attempts add them there too); other subjects keep them in this browser.
 */
export const useWeakTopics = (subjectId: string, onServer: boolean) => {
  const [local, setLocal] = usePersistentState<WeakItem[]>(`ip_weak_${subjectId}`, () => []);
  const [remote, setRemote] = useState<WeakItem[]>([]);

  const refresh = useCallback(async () => {
    if (!onServer) return;
    try {
      const topics = await listWeakTopics(subjectId);
      setRemote(topics.map(t => ({
        id: t.id,
        name: t.topic,
        origin: t.origin,
        date: savedAt(t.last_missed_at),
        reviewIdea: t.note || 'Ask the tutor for a simple example, then try a quiz on it.',
        misses: t.misses,
      })));
    } catch {
      // Keeps the last list; actions below show their own errors.
    }
  }, [onServer, subjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (name: string, origin: WeakOrigin, reviewIdea: string) => {
    if (!onServer) {
      setLocal(prev => prev.some(w => w.name === name) ? prev : [
        { id: `weak-${Date.now()}-${Math.floor(Math.random() * 1000)}`, name, origin, date: 'Just now', reviewIdea },
        ...prev,
      ]);
      return;
    }
    try {
      await addWeakTopic(subjectId, name, origin, reviewIdea);
      await refresh();
    } catch (error) {
      notify(`Couldn't save the weak topic. ${error instanceof Error ? error.message : ''}`, 'error');
    }
  }, [onServer, refresh, setLocal, subjectId]);

  const clear = useCallback(async (id: string) => {
    if (!onServer) {
      setLocal(prev => prev.filter(w => w.id !== id));
      return;
    }
    setRemote(prev => prev.filter(w => w.id !== id));
    try {
      await clearWeakTopic(id);
    } catch (error) {
      notify(`Couldn't clear it. ${error instanceof Error ? error.message : ''}`, 'error');
      refresh();
    }
  }, [onServer, refresh, setLocal]);

  return { topics: onServer ? remote : local, add, clear, refresh };
};
