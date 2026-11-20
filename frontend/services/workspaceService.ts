import { KanbanTask, StickyNote, Subject } from "../types";
import { apiFetch } from "./apiClient";
import { isAccountSubjectId } from "./groupService";
import { loadItems } from "./studyStore";

// Subjects saved to the student's account (and subjects shared with them through groups),
// plus the shared planner and board those subjects use.

export interface AccountSubject {
  id: string;
  name: string;
  instructor: string | null;
  credits: number | null;
  exam_date: string | null;
  owned: boolean;
  shared_in: string[];
}

interface RemoteTask {
  id: string;
  subject_id: string;
  title: string;
  status: KanbanTask["status"];
  created_by: string;
}

interface RemoteNote {
  id: string;
  subject_id: string;
  content: string;
  color: string;
  x: number;
  y: number;
  created_by: string;
}

export const toSubject = (remote: AccountSubject): Subject & { owned: boolean; sharedIn: string[] } => ({
  id: remote.id,
  name: remote.name,
  teacher: remote.instructor ?? (remote.owned ? "" : "Shared with you"),
  attendance: 100,
  credits: remote.credits ?? 3,
  progress: 0,
  color: remote.owned ? "bg-primary-500" : "bg-indigo-500",
  examDate: remote.exam_date ?? undefined,
  owned: remote.owned,
  sharedIn: remote.shared_in,
});

export const listAccountSubjects = () => apiFetch<AccountSubject[]>("/workspace/subjects");

/** Deletes a subject you own from your account, with everything saved under it. */
export const deleteAccountSubject = (subjectId: string) => apiFetch<void>(`/workspace/subjects/${subjectId}`, { method: "DELETE" });

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const listTasks = async (subjectId: string): Promise<KanbanTask[]> =>
  (await apiFetch<RemoteTask[]>(`/workspace/subjects/${subjectId}/tasks`)).map(t => ({ id: t.id, title: t.title, status: t.status }));

export const createTask = async (subjectId: string, title: string, status: KanbanTask["status"] = "todo") => {
  const t = await apiFetch<RemoteTask>(`/workspace/subjects/${subjectId}/tasks`, json("POST", { title, status }));
  return { id: t.id, title: t.title, status: t.status } as KanbanTask;
};

export const updateTask = (taskId: string, changes: Partial<Pick<KanbanTask, "title" | "status">>) =>
  apiFetch<RemoteTask>(`/workspace/tasks/${taskId}`, json("PATCH", changes));

export const deleteTask = (taskId: string) => apiFetch<void>(`/workspace/tasks/${taskId}`, json("DELETE"));

export const listNotes = async (subjectId: string): Promise<StickyNote[]> =>
  (await apiFetch<RemoteNote[]>(`/workspace/subjects/${subjectId}/notes`)).map(({ id, content, color, x, y }) => ({ id, content, color, x, y }));

export const createNote = async (subjectId: string, note: Omit<StickyNote, "id">) => {
  const n = await apiFetch<RemoteNote>(`/workspace/subjects/${subjectId}/notes`, json("POST", {
    content: note.content, color: note.color, x: Math.max(0, Math.round(note.x)), y: Math.max(0, Math.round(note.y)),
  }));
  return { id: n.id, content: n.content, color: n.color, x: n.x, y: n.y } as StickyNote;
};

export const updateNote = (noteId: string, changes: Partial<Omit<StickyNote, "id">>) =>
  apiFetch<RemoteNote>(`/workspace/notes/${noteId}`, json("PATCH", {
    ...changes,
    ...(changes.x !== undefined ? { x: Math.max(0, Math.round(changes.x)) } : {}),
    ...(changes.y !== undefined ? { y: Math.max(0, Math.round(changes.y)) } : {}),
  }));

export const deleteNote = (noteId: string) => apiFetch<void>(`/workspace/notes/${noteId}`, json("DELETE"));

/**
 * Saves a subject that so far lived only in this browser to the student's account, carrying its
 * planner tasks and moodboard notes over. Returns the new account id.
 */
export const saveSubjectToAccount = async (subject: Subject): Promise<string> => {
  const created = await apiFetch<AccountSubject>("/workspace/subjects", json("POST", {
    name: subject.name,
    instructor: subject.teacher || null,
    credits: subject.credits >= 1 && subject.credits <= 6 ? subject.credits : null,
    exam_date: subject.examDate ?? null,
  }));
  for (const task of loadItems("tasks", subject.id)) await createTask(created.id, task.title, task.status);
  for (const note of loadItems("notes", subject.id)) await createNote(created.id, note);

  // Point this browser's copy at the account subject so links and reminders keep working.
  const saved: Subject[] = JSON.parse(localStorage.getItem("prep_subjects") || "[]");
  localStorage.setItem("prep_subjects", JSON.stringify(saved.map(s => (s.id === subject.id ? { ...s, id: created.id } : s))));
  const oldReminders = localStorage.getItem(`ip_reminders_${subject.id}`);
  if (oldReminders) localStorage.setItem(`ip_reminders_${created.id}`, oldReminders);
  return created.id;
};

export { isAccountSubjectId };
