import { Flashcard, QuizQuestion } from "../types";
import { apiFetch, ApiError } from "./apiClient";
import { notify } from '../components/Feedback';

// AI features call the IntelliPrep backend; no AI provider keys ever reach the browser.

const MAX_NOTES_CHARS = 60_000;

const notes = (text: string) => text.slice(0, MAX_NOTES_CHARS);

/** A typed topic; sent apart from the notes, and enough on its own when nothing is attached. */
const topic = (focus?: string) => (focus?.trim() ? focus.trim().slice(0, 500) : undefined);

/** Notes text cut to what the backend accepts in one request. */
export const notesPayload = notes;

const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Can't reach the IntelliPrep server. Is the backend running?";

/** Summarises notes; throws on failure (use when the result is saved). */
export const summarise = async (text: string, focus?: string): Promise<string> => {
  const { summary } = await apiFetch<{ summary: string }>("/summary/generate", {
    method: "POST",
    body: JSON.stringify({ text: notes(text), focus: topic(focus) }),
  });
  return summary;
};

export const generateSummary = async (text: string, focus?: string): Promise<string> => {
  try {
    return await summarise(text, focus);
  } catch (error) {
    console.error("Summary failed:", error);
    return `Couldn't generate a summary. ${errorMessage(error)}`;
  }
};

export const generateFlashcards = async (text: string, focus?: string): Promise<Flashcard[]> => {
  try {
    const { cards } = await apiFetch<{ cards: { front: string; back: string }[] }>("/flashcards/generate", {
      method: "POST",
      body: JSON.stringify({ text: notes(text), focus: topic(focus), count: 8 }),
    });
    return cards.map((card, index) => ({
      id: `gen-${Date.now()}-${index}`,
      front: card.front,
      back: card.back,
      mastered: false,
    }));
  } catch (error) {
    console.error("Flashcards failed:", error);
    notify(`Couldn't make flashcards. ${errorMessage(error)}`, 'error');
    return [];
  }
};

export const generateQuiz = async (text: string, focus?: string): Promise<QuizQuestion[]> => {
  try {
    const { questions } = await apiFetch<{
      questions: { question: string; options: string[]; correct_index: number; explanation: string; topic: string }[];
    }>("/quiz/generate", {
      method: "POST",
      body: JSON.stringify({ text: notes(text), focus: topic(focus), count: 5 }),
    });
    return questions.map((q, index) => ({
      id: `quiz-${Date.now()}-${index}`,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      explanation: q.explanation,
      topic: q.topic,
    }));
  } catch (error) {
    console.error("Quiz failed:", error);
    notify(`Couldn't make a quiz. ${errorMessage(error)}`, 'error');
    return [];
  }
};

export interface GuessPaperResult {
  predictions: {
    topic: string;
    probability: string; // "High" | "Medium" | "Low"
    reason: string;
    estimatedWeight: string;
  }[];
  sampleQuestions: {
    question: string;
    format: string; // "Long Answer" | "Short Answer" | "Problem Solving"
    suggestedStructure: string;
  }[];
  strategicAdvice: string;
}

export const generateGuessPaper = async (subjectName: string, materials?: string, focus?: string): Promise<GuessPaperResult> => {
  try {
    return await apiFetch<GuessPaperResult>("/exam-guess/guess", {
      method: "POST",
      body: JSON.stringify({ subject_name: subjectName, text: notes(materials ?? ""), focus: topic(focus) }),
    });
  } catch (error) {
    console.error("Exam guess failed:", error);
    return { predictions: [], sampleQuestions: [], strategicAdvice: `Couldn't predict topics. ${errorMessage(error)}` };
  }
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const chatWithAssistant = async (subjectNameOrContext: string, history: ChatMessage[], message: string): Promise<string> => {
  // Callers pass the subject being studied, or "General study" outside a subject.
  const subject = subjectNameOrContext && subjectNameOrContext !== "General study" ? subjectNameOrContext.slice(0, 120) : undefined;
  // The latest message is sent separately; history excludes it.
  const previous = history.length && history[history.length - 1].text === message ? history.slice(0, -1) : history;
  try {
    const { reply } = await apiFetch<{ reply: string }>("/tutor/chat", {
      method: "POST",
      body: JSON.stringify({ message, history: previous.slice(-20), subject }),
    });
    return reply;
  } catch (error) {
    console.error("Tutor failed:", error);
    return `Sorry, I couldn't answer that. ${errorMessage(error)}`;
  }
};
