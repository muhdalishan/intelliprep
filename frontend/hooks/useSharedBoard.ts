import { useCallback, useEffect, useRef, useState } from 'react';
import { KanbanTask, StickyNote } from '../types';
import * as workspace from '../services/workspaceService';
import { STORE_EVENT } from '../services/studyStore';

const POLL_MS = 4000;

/**
 * The planner and moodboard of an account subject, shared with everyone in its groups.
 * Exposes the same "whole list" setters the Kanban and Moodboard components already use, and
 * turns each change into the matching API call. Refreshes every few seconds so classmates'
 * edits show up (Supabase Realtime can replace the polling later).
 */
export const useSharedBoard = (subjectId: string, enabled: boolean) => {
  const [tasks, setTasksState] = useState<KanbanTask[]>([]);
  const [notes, setNotesState] = useState<StickyNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  const notesRef = useRef(notes);
  tasksRef.current = tasks;
  notesRef.current = notes;
  const pendingNoteMoves = useRef<Record<string, Partial<StickyNote>>>({});
  const moveTimer = useRef<number | undefined>(undefined);
  const editing = useRef(0); // skip polling while a local change is in flight

  const refresh = useCallback(async () => {
    if (!enabled || editing.current > 0 || Object.keys(pendingNoteMoves.current).length) return;
    try {
      const [freshTasks, freshNotes] = await Promise.all([workspace.listTasks(subjectId), workspace.listNotes(subjectId)]);
      setTasksState(freshTasks);
      setNotesState(freshNotes);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the shared planner.');
    }
  }, [enabled, subjectId]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    // Nova adds tasks and notes through the API, then signals here.
    const onStore = (event: Event) => {
      if ((event as CustomEvent<{ subjectId: string }>).detail.subjectId === subjectId) refresh();
    };
    window.addEventListener(STORE_EVENT, onStore);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(STORE_EVENT, onStore);
    };
  }, [enabled, refresh, subjectId]);

  const track = async (work: () => Promise<unknown>) => {
    editing.current += 1;
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.');
    } finally {
      editing.current -= 1;
    }
  };

  const setTasks = useCallback((next: KanbanTask[]) => {
    const before = tasksRef.current;
    setTasksState(next);
    track(async () => {
      const known = new Map<string, KanbanTask>(before.map(t => [t.id, t]));
      for (const task of next) {
        const old = known.get(task.id);
        if (!old) await workspace.createTask(subjectId, task.title, task.status);
        else if (old.status !== task.status || old.title !== task.title) {
          await workspace.updateTask(task.id, { status: task.status, title: task.title });
        }
      }
      const kept = new Set(next.map(t => t.id));
      for (const task of before) if (!kept.has(task.id)) await workspace.deleteTask(task.id);
    }).then(refresh);
  }, [subjectId, refresh]);

  const setNotes = useCallback((next: StickyNote[]) => {
    const before = notesRef.current;
    setNotesState(next);
    const known = new Map<string, StickyNote>(before.map(n => [n.id, n]));
    const created = next.filter(n => !known.has(n.id));
    const kept = new Set(next.map(n => n.id));
    const removed = before.filter(n => !kept.has(n.id));
    if (created.length || removed.length) {
      track(async () => {
        for (const note of created) await workspace.createNote(subjectId, note);
        for (const note of removed) await workspace.deleteNote(note.id);
      }).then(refresh);
    }
    // Moves and typing happen many times a second: send the latest values once things settle.
    for (const note of next) {
      const old = known.get(note.id);
      if (!old) continue;
      const changes: Partial<StickyNote> = {};
      if (old.x !== note.x) changes.x = note.x;
      if (old.y !== note.y) changes.y = note.y;
      if (old.content !== note.content) changes.content = note.content;
      if (old.color !== note.color) changes.color = note.color;
      if (old.w !== note.w) changes.w = note.w;
      if (old.h !== note.h) changes.h = note.h;
      if (Object.keys(changes).length) pendingNoteMoves.current[note.id] = { ...pendingNoteMoves.current[note.id], ...changes };
    }
    window.clearTimeout(moveTimer.current);
    moveTimer.current = window.setTimeout(() => {
      const pending = pendingNoteMoves.current;
      pendingNoteMoves.current = {};
      track(async () => {
        for (const [id, changes] of Object.entries(pending)) await workspace.updateNote(id, changes);
      });
    }, 600);
  }, [subjectId, refresh]);

  return { tasks, notes, setTasks, setNotes, error };
};
