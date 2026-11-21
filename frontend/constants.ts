import { Subject, Flashcard, QuizQuestion, KanbanTask, StickyNote } from './types';

export const MOCK_SUBJECTS: Subject[] = [
  {
    id: '1',
    name: 'Advanced Mathematics',
    teacher: 'Dr. A. Smith',
    attendance: 85,
    credits: 4,
    progress: 65,
    color: 'bg-blue-500',
    nextClass: 'Mon 10:00 AM'
  },
  {
    id: '2',
    name: 'Computer Science 101',
    teacher: 'Prof. J. Doe',
    attendance: 92,
    credits: 3,
    progress: 40,
    color: 'bg-indigo-500',
    nextClass: 'Tue 02:00 PM'
  },
  {
    id: '3',
    name: 'Physics II',
    teacher: 'Dr. R. Feynman',
    attendance: 78,
    credits: 4,
    progress: 25,
    color: 'bg-purple-500',
    nextClass: 'Wed 11:00 AM'
  },
  {
    id: '4',
    name: 'Modern History',
    teacher: 'Ms. L. Croft',
    attendance: 95,
    credits: 2,
    progress: 80,
    color: 'bg-pink-500',
    nextClass: 'Thu 09:00 AM'
  }
];

export const MOCK_FLASHCARDS: Flashcard[] = [
  { id: '1', front: 'What is the powerhouse of the cell?', back: 'Mitochondria', mastered: false },
  { id: '2', front: 'What is the derivative of x^2?', back: '2x', mastered: true },
  { id: '3', front: 'Capital of France?', back: 'Paris', mastered: false },
];

export const MOCK_QUIZ: QuizQuestion[] = [
  {
    id: '1',
    question: 'What allows React components to have state?',
    options: ['Props', 'Hooks', 'HTML', 'Classes'],
    correctIndex: 1
  },
  {
    id: '2',
    question: 'Which method is used to render a React app?',
    options: ['ReactDOM.render', 'React.start', 'renderApp', 'mount'],
    correctIndex: 0
  }
];

export const MOCK_KANBAN: KanbanTask[] = [
  { id: '1', title: 'Chapter 1: Limits', status: 'mastered' },
  { id: '2', title: 'Chapter 2: Derivatives', status: 'practiced' },
  { id: '3', title: 'Chapter 3: Integrals', status: 'learning' },
  { id: '4', title: 'Chapter 4: Series', status: 'todo' },
];

export const MOCK_NOTES: StickyNote[] = [
  { id: '1', x: 100, y: 100, content: 'Remember to practice integrals!', color: 'bg-yellow-200' },
  { id: '2', x: 300, y: 150, content: 'Exam date: Dec 15th', color: 'bg-pink-200' },
];
