import { Subject } from "../types";
import { apiFetch, ApiError } from "./apiClient";
import { addNote, addReminder, addTask } from "./studyStore";

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

export const sendCommand = async (
  message: string,
  assistantName: string,
  currentSubjectId: string | null,
  history: AssistantTurn[],
): Promise<CommandResult> => {
  try {
    return await apiFetch<CommandResult>("/assistant/command", {
      method: "POST",
      body: JSON.stringify({
        message,
        assistant_name: assistantName,
        now: localNow(),
        subjects: loadSubjects().map(s => ({ id: s.id, name: s.name })),
        current_subject_id: currentSubjectId,
        history: history.slice(-8),
      }),
    });
  } catch (error) {
    const reason = error instanceof ApiError ? error.message : "I can't reach the IntelliPrep server right now.";
    return { reply: reason, actions: [], skipped: [] };
  }
};

/** Carries out the actions in this browser. Returns where to go if Nova was asked to open something. */
export const runActions = (actions: AssistantAction[], currentSubjectId: string | null): string | null => {
  let destination: string | null = null;
  for (const action of actions) {
    const subjectId = action.subject_id ?? currentSubjectId;
    if (action.type === "add_task" && subjectId && action.title) addTask(subjectId, action.title);
    if (action.type === "add_note" && subjectId && action.title) addNote(subjectId, action.title, action.content);
    if (action.type === "set_reminder" && action.title && action.due) addReminder(subjectId, action.title, action.due);
    if (action.type === "open_section" && action.section) {
      destination = action.section === "dashboard" || !subjectId
        ? "/dashboard"
        : `/subject/${subjectId}?tab=${action.section}`;
    }
  }
  return destination;
};
