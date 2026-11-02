export interface Subject {
  id: string;
  name: string;
  teacher: string;
  attendance: number;
  credits: number;
  progress: number;
  color: string;
  nextClass?: string;
  examDate?: string; // ISO date of the next paper
  schedule?: { day: string; time: string; room: string; type: string }[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  mastered: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  topic?: string;
}

export interface QuizResult {
  score: number;
  total: number;
  date: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  status: 'todo' | 'learning' | 'practiced' | 'mastered';
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  content: string;
  color: string;
}

export interface Reminder {
  id: string;
  message: string;
  date: string;
  platform: 'app' | 'telegram' | 'email';
  fired?: boolean; // already shown as a notification
}

// Gemini Types
export interface GeneratedContent {
  text: string;
}

export type TabType = 
  | 'overview' 
  | 'upload' 
  | 'summary' 
  | 'flashcards' 
  | 'quiz' 
  | 'kanban' 
  | 'moodboard' 
  | 'exam' 
  | 'reminders'
  | 'guess-engine'
  | 'weak-topics'
  | 'studyroom'
  | 'timetable';