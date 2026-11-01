import { Flashcard, QuizQuestion } from "../types";

// AI generation moves to the backend (no provider keys in the browser).
// Until each backend endpoint lands, these return demo data so the UI stays usable.
// Summaries: IP-40 · Flashcards: IP-41 · Quizzes: IP-42 · Exam-Guess: IP-60/61 · Q&A: IP-34

const DEMO_DELAY = 1200;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const generateSummary = async (text: string): Promise<string> => {
  await delay(DEMO_DELAY);
  return `[DEMO SUMMARY]\nAI summaries arrive with the backend (IP-40).\n\nThe input text was about: "${text.substring(0, 50)}..."\n\nKey points:\n1. Main concept identified.\n2. Supporting arguments listed.\n3. Conclusion reached.`;
};

export const generateFlashcards = async (topic: string): Promise<Flashcard[]> => {
  await delay(DEMO_DELAY);
  return [
    { id: `demo-${Date.now()}-1`, front: `Demo Q1 about ${topic}`, back: 'Answer 1', mastered: false },
    { id: `demo-${Date.now()}-2`, front: `Demo Q2 about ${topic}`, back: 'Answer 2', mastered: false },
    { id: `demo-${Date.now()}-3`, front: `Demo Q3 about ${topic}`, back: 'Answer 3', mastered: false },
  ];
};

export const generateQuiz = async (topic: string): Promise<QuizQuestion[]> => {
  await delay(DEMO_DELAY);
  return [
    {
      id: `demo-q-${Date.now()}-1`,
      question: `What is a key feature of ${topic}?`,
      options: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
      correctIndex: 0
    },
    {
      id: `demo-q-${Date.now()}-2`,
      question: `Why is ${topic} important?`,
      options: ['Reason 1', 'Reason 2', 'Reason 3', 'Reason 4'],
      correctIndex: 2
    }
  ];
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

export const generateGuessPaper = async (subjectName: string, _materials?: string): Promise<GuessPaperResult> => {
  await delay(DEMO_DELAY);
  return {
    predictions: [
      { topic: `Fundamental Theorems of ${subjectName}`, probability: "High", reason: "Demo prediction. Real predictions come from your uploaded past papers (IP-60/61).", estimatedWeight: "25%" },
      { topic: "Practical Applications and System Architecture", probability: "High", reason: "Demo prediction.", estimatedWeight: "20%" },
      { topic: "Historical Developments & Timeline Analysis", probability: "Medium", reason: "Demo prediction.", estimatedWeight: "15%" },
      { topic: "Advanced Calculations and Stress-testing Cases", probability: "Low", reason: "Demo prediction.", estimatedWeight: "10%" }
    ],
    sampleQuestions: [
      { question: `Compare and contrast classical models versus modern paradigms within "${subjectName}".`, format: "Long Answer", suggestedStructure: "1. Short introduction\n2. Side-by-side comparison\n3. Worked example\n4. Limits and applications" },
      { question: `Derive the key result of a basic "${subjectName}" model and state its assumptions.`, format: "Problem Solving", suggestedStructure: "1. List assumptions\n2. Set up the equations\n3. Solve step by step\n4. Interpret the result" }
    ],
    strategicAdvice: "Demo advice: review past papers first, practise active recall with flashcards, and take short timed quizzes twice a week."
  };
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const chatWithAssistant = async (subjectNameOrContext: string, _history: ChatMessage[], message: string): Promise<string> => {
  await delay(600);
  const isVoiceMode = subjectNameOrContext.includes("live voice conversation");
  const normalized = message.toLowerCase();

  if (normalized.includes("hello") || normalized.includes("hi")) {
    return "Hi! I'm the IntelliPrep study copilot. Answers grounded in your own notes are coming with the backend. What would you like to study?";
  }
  if (isVoiceMode) {
    return "Good question. Let's break it into smaller steps. Which part should we start with?";
  }
  return "This is a demo reply. Once the backend is connected (IP-34), I'll answer from your uploaded notes with page citations.";
};
