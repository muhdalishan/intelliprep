import { apiFetch } from "./apiClient";
import { notesPayload } from "./aiService";

export type Level = "easy" | "medium" | "hard" | "very_hard";

export const LEVEL_LABEL: Record<Level, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very hard",
};

export interface AdaptiveAnswer {
  topic: string;
  level: Level;
  correct: boolean;
}

export interface AdaptiveQuestion {
  level: Level;
  focus_topic: string | null;
  question: { question: string; options: string[]; topic: string };
  token: string;
}

export interface AnswerCheck {
  correct: boolean;
  correct_index: number;
  explanation: string;
  topic: string;
  level: Level;
}

export interface AdaptiveSummary {
  score: number;
  total: number;
  final_level: Level;
  highest_level: Level;
  topics: { topic: string; correct: number; total: number }[];
}

export const nextAdaptiveQuestion = (
  text: string,
  history: AdaptiveAnswer[],
  weakTopics: string[],
  previousQuestions: string[],
) =>
  apiFetch<AdaptiveQuestion>("/adaptive-exam/next", {
    method: "POST",
    body: JSON.stringify({
      text: notesPayload(text),
      history,
      weak_topics: weakTopics.slice(0, 20).map(topic => ({ topic: topic.slice(0, 200), misses: 1 })),
      previous_questions: previousQuestions.slice(-60),
    }),
  });

export const checkAdaptiveAnswer = (token: string, chosenIndex: number) =>
  apiFetch<AnswerCheck>("/adaptive-exam/answer", {
    method: "POST",
    body: JSON.stringify({ token, chosen_index: chosenIndex }),
  });

export const adaptiveSummary = (history: AdaptiveAnswer[]) =>
  apiFetch<AdaptiveSummary>("/adaptive-exam/summary", {
    method: "POST",
    body: JSON.stringify({ history }),
  });
