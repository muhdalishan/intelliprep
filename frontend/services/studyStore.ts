import { KanbanTask, Reminder, StickyNote } from "../types";

// Per-subject study data kept in this browser until it moves to the database (IP-100, IP-101,
// IP-110). Both the workspace tabs and Nova read and write through here.

type Kind = "tasks" | "notes" | "reminders";
type ItemOf<K extends Kind> = K extends "tasks" ? KanbanTask : K extends "notes" ? StickyNote : Reminder;

export const GLOBAL_SUBJECT = "global";
export const STORE_EVENT = "studystore-change";

const key = (kind: Kind, subjectId: string) => `ip_${kind}_${subjectId}`;

export const loadItems = <K extends Kind>(kind: K, subjectId: string, fallback: ItemOf<K>[] = []): ItemOf<K>[] => {
  try {
    const saved = localStorage.getItem(key(kind, subjectId));
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

/** Saves items. `notify` tells other open views (e.g. the workspace) to reload. */
export const saveItems = <K extends Kind>(kind: K, subjectId: string, items: ItemOf<K>[], notify = false) => {
  localStorage.setItem(key(kind, subjectId), JSON.stringify(items));
  if (notify) {
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { kind, subjectId } }));
  }
};

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const NOTE_COLORS = ["bg-yellow-200", "bg-blue-200", "bg-pink-200", "bg-green-200"];

export const addTask = (subjectId: string, title: string) => {
  const items = loadItems("tasks", subjectId);
  saveItems("tasks", subjectId, [...items, { id: newId("task"), title, status: "todo" }], true);
};

export const addNote = (subjectId: string, title: string, content?: string | null) => {
  const items = loadItems("notes", subjectId);
  const note: StickyNote = {
    id: newId("note"),
    x: 60 + Math.round(Math.random() * 360),
    y: 80 + Math.round(Math.random() * 220),
    // Avoid "title\ntitle" when the note is a single sentence.
    content: content && !content.trim().toLowerCase().startsWith(title.trim().toLowerCase()) ? `${title}\n${content}` : (content || title),
    color: NOTE_COLORS[items.length % NOTE_COLORS.length],
  };
  saveItems("notes", subjectId, [...items, note], true);
};

/** `dueAt` is local time, YYYY-MM-DDTHH:MM. */
export const addReminder = (subjectId: string | null, message: string, dueAt: string) => {
  const id = subjectId ?? GLOBAL_SUBJECT;
  const items = loadItems("reminders", id);
  saveItems("reminders", id, [...items, { id: newId("rem"), message, date: dueAt, platform: "telegram" }], true);
};

/** Every reminder in this browser, with the subject it belongs to. */
export const allReminders = (): { subjectId: string; reminder: Reminder }[] => {
  const found: { subjectId: string; reminder: Reminder }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith("ip_reminders_")) continue;
    const subjectId = k.slice("ip_reminders_".length);
    for (const reminder of loadItems("reminders", subjectId)) found.push({ subjectId, reminder });
  }
  return found;
};

export const markReminderFired = (subjectId: string, reminderId: string) => {
  const items = loadItems("reminders", subjectId).map(r => (r.id === reminderId ? { ...r, fired: true } : r));
  saveItems("reminders", subjectId, items, true);
};

/** Shows a stored date the way people read it: "Tue 3 Nov, 09:00" or "15 Jun 2026". */
export const formatDue = (value: string) => {
  const date = new Date(value.length === 10 ? `${value}T00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return value.length === 10
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

// Study activity ------------------------------------------------------------
// One entry per day the student did something real (quiz, flashcards, summary, exam...).

const STUDY_DAYS_KEY = "ip_study_days";

const localDay = (date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const studyDays = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STUDY_DAYS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

export const logStudyDay = () => {
  const days = studyDays();
  days.add(localDay());
  localStorage.setItem(STUDY_DAYS_KEY, JSON.stringify([...days].sort().slice(-400)));
};

/** Consecutive study days ending today (or yesterday, if today hasn't been studied yet). */
export const studyStreak = (): number => {
  const days = studyDays();
  const day = new Date();
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

/** Days studied in the last 7 days, including today. */
export const studyDaysThisWeek = (): number => {
  const days = studyDays();
  let count = 0;
  const day = new Date();
  for (let i = 0; i < 7; i++) {
    if (days.has(localDay(day))) count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
};

/** Reads a per-subject list saved by the workspace (e.g. "cards", "quizzes", "weak"). */
export const readSubjectList = <T>(kind: string, subjectId: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(`ip_${kind}_${subjectId}`) || "[]");
  } catch {
    return [];
  }
};

/** Whole days from today until an ISO date; null when there's no date. */
export const daysUntil = (isoDate?: string): number | null => {
  if (!isoDate) return null;
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};
