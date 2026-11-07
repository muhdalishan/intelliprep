import { apiFetch } from "./apiClient";

/** Everything the dashboard needs from the server in one request (IP-120). */
export interface DashboardData {
  subjects: number;
  next_exam: { subject_id: string; subject_name: string; exam_date: string; days_left: number } | null;
  cards_due_today: number;
  streak_days: number;
  reviewed_today: boolean;
  tasks: { todo: number; learning: number; practiced: number; mastered: number };
  top_predictions: { subject_name: string; topic_name: string; confidence: number }[];
  recent_documents: { id: string; subject_id: string; filename: string; status: string; created_at: string }[];
  upcoming_reminders: { id: string; message: string; due_at: string; channel: string; subject_name: string | null }[];
  weak_topics: number;
  recent_quiz_scores: { quiz_title: string; subject_name: string; score: number; total: number; submitted_at: string }[];
}

export const fetchDashboard = () => apiFetch<DashboardData>("/dashboard");
