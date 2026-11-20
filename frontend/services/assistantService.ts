import { Subject } from "../types";
import { apiFetch, ApiError } from "./apiClient";
import { addNote, addReminder, addTask, STORE_EVENT } from "./studyStore";
import { createNote, createTask, isAccountSubjectId, listAccountSubjects } from "./workspaceService";
import { createReminder } from "./reminderService";

export type ActionType = "add_note" | "set_reminder" | "add_task" | "open_section";

export interface AssistantAction {
  type: ActionType;
  subject_id: string | null;
  title: string | null;
  content: string | null;
  due: string | null;
  section: string | null;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface CommandResult {
  reply: string;
  actions: AssistantAction[];
  skipped: string[];
}

const localNow = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekday = now.toLocaleDateString("en-GB", { weekday: "short" });
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())} ${weekday}`;
};

export const loadSubjects = (): Subject[] => {
  try {
    return JSON.parse(localStorage.getItem("prep_subjects") || "[]");
  } catch {
    return [];
  }
};

/** Subjects in this browser plus those on the account (a new device has only the latter). */
const knownSubjects = async () => {
  const local = loadSubjects().map(s => ({ id: s.id, name: s.name }));
  const remote = await listAccountSubjects().catch(() => []);
  return [...local, ...remote.filter(r => !local.some(l => l.id === r.id)).map(r => ({ id: r.id, name: r.name }))].slice(0, 50);
};

export const sendCommand = async (
  message: string,
  assistantName: string,
  currentSubjectId: string | null,
  history: AssistantTurn[],
  voice = false,
): Promise<CommandResult> => {
  try {
    return await apiFetch<CommandResult>("/assistant/command", {
      method: "POST",
      body: JSON.stringify({
        message,
        assistant_name: assistantName,
        now: localNow(),
        subjects: await knownSubjects(),
        current_subject_id: currentSubjectId,
        history: history.slice(-8).map(t => ({ role: t.role, text: t.text.slice(0, 4000) })),
        voice,
      }),
    });
  } catch (error) {
    const reason = error instanceof ApiError ? error.message : "I can't reach the IntelliPrep server right now.";
    return { reply: reason, actions: [], skipped: [] };
  }
};

const notifyShared = (subjectId: string) =>
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { kind: "shared", subjectId } }));

/**
 * Carries out the actions. Account subjects use the shared planner and board on the server;
 * subjects kept in this browser use local storage. Returns where to go if Nova was asked to open something.
 */
export const runActions = async (actions: AssistantAction[], currentSubjectId: string | null): Promise<string | null> => {
  let destination: string | null = null;
  for (const action of actions) {
    const subjectId = action.subject_id ?? currentSubjectId;
    const shared = subjectId !== null && isAccountSubjectId(subjectId);
    if (action.type === "add_task" && subjectId && action.title) {
      if (shared) { await createTask(subjectId, action.title); notifyShared(subjectId); }
      else addTask(subjectId, action.title);
    }
    if (action.type === "add_note" && subjectId && action.title) {
      const content = action.content && !action.content.toLowerCase().startsWith(action.title.toLowerCase())
        ? `${action.title}
${action.content}` : (action.content || action.title);
      if (shared) { await createNote(subjectId, { content, color: "bg-yellow-200", x: 120, y: 120 }); notifyShared(subjectId); }
      else addNote(subjectId, action.title, action.content);
    }
    if (action.type === "set_reminder" && action.title && action.due) {
      // Saved on the server so it's delivered even if the app is closed; kept in this browser if the server is unreachable.
      const subjectName = loadSubjects().find(s => s.id === subjectId)?.name ?? null;
      try {
        await createReminder({ message: action.title, when: action.due, subjectKey: subjectId, subjectName, source: "nova" });
        window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { kind: "reminders", subjectId } }));
      } catch {
        addReminder(subjectId, action.title, action.due);
      }
    }
    if (action.type === "open_section" && action.section) {
      destination = action.section === "dashboard" || !subjectId
        ? "/dashboard"
        : `/subject/${subjectId}?tab=${action.section}`;
    }
  }
  return destination;
};
