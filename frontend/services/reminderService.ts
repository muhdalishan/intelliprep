import { apiFetch } from "./apiClient";

export type ReminderChannel = "app" | "telegram" | "email" | "push" | "whatsapp" | "sms";

/** A reminder kept on the server, so the scheduler can deliver it even when the app is closed. */
export interface ServerReminder {
  id: string;
  message: string;
  due_at: string;
  channel: ReminderChannel;
  source: "manual" | "nova" | "planner" | "flashcards";
  status: "pending" | "sent" | "failed";
  subject_key: string | null;
  subject_name: string | null;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  seen_at: string | null;
}

export interface NotificationPreferences {
  channels_available: ReminderChannel[];
  telegram_linked: boolean;
  email: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
}

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  app: "In the app",
  telegram: "Telegram",
  email: "Email",
  push: "Browser push",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

/** `when` is a local date-time from an input (or any date string the browser understands). */
export const createReminder = (input: {
  message: string;
  when: string;
  channel?: ReminderChannel;
  subjectKey?: string | null;
  subjectName?: string | null;
  source?: ServerReminder["source"];
}) =>
  apiFetch<ServerReminder>("/notifications/reminders", {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      due_at: new Date(input.when).toISOString(),
      channel: input.channel ?? "app",
      subject_key: input.subjectKey ?? null,
      subject_name: input.subjectName ?? null,
      source: input.source ?? "manual",
    }),
  });

export const listReminders = (subjectKey?: string) =>
  apiFetch<ServerReminder[]>(
    `/notifications/reminders${subjectKey ? `?subject_key=${encodeURIComponent(subjectKey)}` : ""}`
  );

export const deleteReminder = (id: string) =>
  apiFetch<void>(`/notifications/reminders/${id}`, { method: "DELETE" });

export const fetchInbox = () => apiFetch<ServerReminder[]>("/notifications/inbox");

export const markSeen = (id: string) =>
  apiFetch<void>(`/notifications/reminders/${id}/seen`, { method: "POST" });

export const getPreferences = () => apiFetch<NotificationPreferences>("/notifications/preferences");

export const updatePreferences = (changes: Partial<Pick<NotificationPreferences, "quiet_hours_start" | "quiet_hours_end" | "timezone">>) =>
  apiFetch<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const telegramLink = () =>
  apiFetch<{ url: string; expires_in_seconds: number }>("/notifications/telegram/link", { method: "POST" });
