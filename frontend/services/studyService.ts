import { apiFetch } from "./apiClient";

// Study data saved to the account (subjects saved to the account only): flashcard decks with
// SM-2 review, quizzes scored on the server, weak topics, saved summaries and past papers.

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
const q = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString();

// Flashcards (IP-41, IP-50, IP-51) ---------------------------------------------

export interface Deck {
  id: string;
  subject_id: string;
  title: string;
  card_count: number;
  due_count: number;
  mastered_count: number;
  created_at: string;
}

export interface DueCard {
  id: string;
  deck_id: string | null;
  front: string;
  back: string;
  repetitions: number;
  interval_days: number;
}

export interface DueQueue {
  today: string;
  due_total: number;
  cards: DueCard[];
  streak_days: number;
  reviewed_today: boolean;
}

export type Rating = "again" | "hard" | "good" | "easy";

export const saveDeck = (subjectId: string, title: string, cards: { front: string; back: string }[], sourceDocumentIds: string[] = []) =>
  apiFetch<Deck>("/flashcards/decks", json("POST", {
    subject_id: subjectId, title: title.slice(0, 120), cards, source_document_ids: sourceDocumentIds,
  }));

export const listDecks = (subjectId: string) => apiFetch<Deck[]>(`/flashcards/decks?${q({ subject_id: subjectId })}`);

export const deleteDeck = (deckId: string) => apiFetch<void>(`/flashcards/decks/${deckId}`, json("DELETE"));

export const dueCards = (subjectId: string, deckId?: string) =>
  apiFetch<DueQueue>(`/flashcards/due?${q({ subject_id: subjectId, deck_id: deckId, limit: "50" })}`);

export const reviewCard = (cardId: string, rating: Rating) =>
  apiFetch<{ next_review: string; interval_days: number; streak_days: number }>(`/flashcards/${cardId}/review`, json("POST", { rating }));

// Quizzes and weak topics (IP-42) --------------------------------------------

export interface SavedQuestion {
  id: string;
  position: number;
  question: string;
  options: string[];
  topic: string;
}

export interface SavedQuiz {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
  questions: SavedQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  question_count: number;
  created_at: string;
  attempts: number;
  best_score: number | null;
  last_score: number | null;
}

export interface QuestionResult {
  question_id: string;
  chosen_index: number | null;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
  topic: string;
}

export interface AttemptResult {
  score: number;
  total: number;
  results: QuestionResult[];
  new_weak_topics: string[];
}

export const createQuiz = (subjectId: string, text: string, focus: string | undefined, title: string, sourceDocumentIds: string[] = []) =>
  apiFetch<SavedQuiz>("/quiz/quizzes", json("POST", {
    subject_id: subjectId, text: text.slice(0, 60_000), focus: focus?.trim() ? focus.trim().slice(0, 500) : undefined, count: 5, title: title.slice(0, 120), source_document_ids: sourceDocumentIds,
  }));

export const listQuizzes = (subjectId: string) => apiFetch<QuizSummary[]>(`/quiz/quizzes?${q({ subject_id: subjectId })}`);

export const getQuiz = (quizId: string) => apiFetch<SavedQuiz>(`/quiz/quizzes/${quizId}`);

export const deleteQuiz = (quizId: string) => apiFetch<void>(`/quiz/quizzes/${quizId}`, json("DELETE"));

export const submitAttempt = (quizId: string, answers: { question_id: string; chosen_index: number | null }[], timeTakenS?: number) =>
  apiFetch<AttemptResult>(`/quiz/quizzes/${quizId}/attempts`, json("POST", { answers, time_taken_s: timeTakenS }));

export type WeakOrigin = "quiz" | "flashcard" | "exam" | "manual";

export interface WeakTopic {
  id: string;
  subject_id: string;
  topic: string;
  origin: WeakOrigin;
  note: string | null;
  misses: number;
  last_missed_at: string;
}

export const listWeakTopics = (subjectId: string) => apiFetch<WeakTopic[]>(`/quiz/weak-topics?${q({ subject_id: subjectId })}`);

export const addWeakTopic = (subjectId: string, topic: string, origin: WeakOrigin, note?: string) =>
  apiFetch<WeakTopic>("/quiz/weak-topics", json("POST", {
    subject_id: subjectId, topic: topic.slice(0, 200), origin, note: note ? note.slice(0, 500) : null,
  }));

export const clearWeakTopic = (topicId: string) => apiFetch<void>(`/quiz/weak-topics/${topicId}`, json("DELETE"));

// Saved summaries (IP-40) ----------------------------------------------------

export interface SavedSummary {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  source_document_ids: string[];
  cites_pages: boolean;
  created_at: string;
}

export const listSummaries = (subjectId: string) => apiFetch<SavedSummary[]>(`/summary/saved?${q({ subject_id: subjectId })}`);

export const saveSummary = (subjectId: string, title: string, content: string) =>
  apiFetch<SavedSummary>("/summary/saved", json("POST", { subject_id: subjectId, title: title.slice(0, 160), content }));

/** Summarises documents stored in the library; the summary cites pages and is saved. */
export const summariseDocuments = (subjectId: string, documentIds: string[], focus?: string) =>
  apiFetch<SavedSummary>("/summary/documents", json("POST", {
    subject_id: subjectId, document_ids: documentIds.slice(0, 10), focus: focus ? focus.slice(0, 500) : null,
  }));

export const deleteSummary = (summaryId: string) => apiFetch<void>(`/summary/saved/${summaryId}`, json("DELETE"));

// Past papers and predictions (IP-60, IP-61) -------------------------------------

export type ExamKind = "mid" | "final" | "quiz" | "other";

export interface PastPaper {
  id: string;
  exam: ExamKind;
  year: number;
  filename: string;
  status: "processing" | "completed" | "failed";
  failure_reason: string | null;
  question_count: number;
  created_at: string;
}

export interface RankedTopic {
  rank: number;
  topic_name: string;
  confidence: number;
  frequency: number;
  years: number[];
  example_questions: { text: string; year: number; marks: number | null }[];
}

export interface Predictions {
  papers: number;
  ready: boolean;
  papers_needed: number;
  topics: RankedTopic[];
}

export const uploadPastPaper = (subjectId: string, year: number, exam: ExamKind, file: File) => {
  const form = new FormData();
  form.append("subject_id", subjectId);
  form.append("year", String(year));
  form.append("exam", exam);
  form.append("file", file);
  return apiFetch<PastPaper>("/exam-guess/papers", { method: "POST", body: form });
};

export const listPastPapers = (subjectId: string) => apiFetch<PastPaper[]>(`/exam-guess/papers?${q({ subject_id: subjectId })}`);

export const deletePastPaper = (paperId: string) => apiFetch<void>(`/exam-guess/papers/${paperId}`, json("DELETE"));

export const fetchPredictions = (subjectId: string) => apiFetch<Predictions>(`/exam-guess/predictions?${q({ subject_id: subjectId })}`);

/** "3 Nov, 14:05": when something was saved. */
export const savedAt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
