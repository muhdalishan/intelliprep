import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Subject, TabType, Flashcard, QuizQuestion, KanbanTask, StickyNote, Reminder } from '../types';
import { MOCK_SUBJECTS, MOCK_FLASHCARDS, MOCK_QUIZ, MOCK_KANBAN, MOCK_NOTES } from '../constants';
import { Button, Card, cn, Input, ProgressBar, Badge, SoonBadge } from '../components/UIComponents';
import { KanbanBoard, MoodBoard } from '../components/WorkspaceTools';
import { StudyGroups } from '../components/StudyGroups';
import { useSharedBoard } from '../hooks/useSharedBoard';
import { usePersistentState } from '../hooks/usePersistentState';
import { isAccountSubjectId, listAccountSubjects, toSubject } from '../services/workspaceService';
import {
  generateSummary,
  generateFlashcards,
  generateQuiz,
  generateGuessPaper,
  chatWithAssistant,
  ChatMessage,
  GuessPaperResult
} from '../services/aiService';
import { daysUntil, formatDue, GLOBAL_SUBJECT, loadItems, logStudyDay, saveItems, STORE_EVENT, studyDaysThisWeek, studyStreak } from '../services/studyStore';
import { isIndexable, readStudyFile, uploadDocument } from '../services/documentService';
import { AskNotes } from '../components/AskNotes';
import { DiagramExplainer } from '../components/DiagramExplainer';
import { confirmAction, notify } from '../components/Feedback';
import {
  ArrowLeft, LayoutDashboard, Upload, FileText, Layers, CheckSquare,
  Columns, Layout, GraduationCap, Bell, ChevronLeft, ChevronRight, RotateCw,
  Play, Send, Image as ImageIcon, Flame, MessageSquare, AlertTriangle,
  CheckCircle2, Plus, Clock, HelpCircle, X, BrainCircuit, Activity, Trash2, Volume2,
  Users, Compass, BookOpen, PenTool, FileUp, Calendar, Hash, Shield, Share2, LogOut, PlusCircle,
  Eye, History, Paperclip
} from 'lucide-react';
// Recharts removed for native SVG performance and absolute reliability

export const SubjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load consolidated subjects state so added/edited subjects exist here
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('prep_subjects');
    return saved ? JSON.parse(saved) : MOCK_SUBJECTS;
  });

  // Subjects from the account (e.g. shared with you through a group) aren't in this browser's list.
  const localSubject = subjects.find(s => s.id === id);
  const [remoteSubject, setRemoteSubject] = useState<Subject | null>(null);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const subject = localSubject ?? remoteSubject ?? undefined;

  useEffect(() => {
    if (localSubject || !id || !isAccountSubjectId(id)) {
      setRemoteChecked(true);
      return;
    }
    listAccountSubjects()
      .then(list => {
        const found = list.find(s => s.id === id);
        if (found) setRemoteSubject(toSubject(found));
      })
      .catch(() => {})
      .finally(() => setRemoteChecked(true));
  }, [id, localSubject]);

  useEffect(() => {
    if (subjects.length > 0) {
      localStorage.setItem('prep_subjects', JSON.stringify(subjects));
    }
  }, [subjects]);

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(() => (searchParams.get('tab') as TabType) || 'overview');

  // Nova can open a section by linking to ?tab=...
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);

  const userName = localStorage.getItem('userName') || 'Scholar';
  const profilePic = localStorage.getItem('profilePic') || '';

  // High fidelity default study notes based on course topic
  const getDefaultSyllabusNotes = (subjectName: string) => {
    if (subjectName.includes("Math")) {
      return `LECTURE NOTES: Advanced Calculus & Integration Principles
Course weight: Major Final Course

Section 1: Core Theorems
1. Rolle's Theorem: If f is continuous on [a, b] and differentiable on (a, b), and f(a) = f(b), then there exists a c in (a, b) such that f'(c) = 0.
2. Mean Value Theorem (MVT): If f(x) is continuous on [a, b] and differentiable on (a, b), then f'(c) = (f(b) - f(a)) / (b - a).
3. Fundamental Theorem of Calculus: Connecting differentiation and integration.

Section 2: Multi-Variable Double Integrals
Double integrals over generic regions are computed using iterated integrals. Switching limits using Fubini's theorem:
Integrate with respect to x first, then y. If the boundary curves are algebraic (e.g., y = x^2), polar coordinate coordinates (r, theta) are highly optimal where dA = r dr dtheta.

Section 3: Infinite Series Convergence limits
- Geometric Series converges if |r| < 1.
- Ratio Test: L = lim |a_{n+1}/a_n|. Converges if L < 1, diverges if L > 1.
- Taylor Series Expansion: f(x) = sum [f^(n)(a) / n!] * (x - a)^n.`;
    }
    if (subjectName.includes("Computer") || subjectName.includes("Science")) {
      return `LECTURE NOTES: Computer Systems Framework & Algorithmic Analysis
Course weight: Core Technical

Section 1: Data Structures
1. Linked Lists vs Arrays: Arrays offer O(1) random index access but O(N) insertion in random offsets. Linked lists offer O(1) pointer updates but require O(N) sequential search patterns.
2. Binary Search Trees (BST): Left children hold lower keys, right children hold greater keys. Average search complexity is O(log N). Worst case degenerates to O(N) if tree is un-balanced.
3. Hash Tables: Key-value mapped configurations mapping key inputs using standard hash divisions. Solves collisions using chaining loops or open addressing.

Section 2: Master Algorithmic Complexity (Big O)
Big O represents the asymptotic upperbound on running time or memory:
- Bubble Sort and Insertion Sort: O(N^2)
- Merge Sort and Quick Sort: O(N log N)
- Binary Search algorithms: O(log N)`;
    }
    if (subjectName.includes("Physics")) {
      return `LECTURE NOTES: General Electromagnetism and Coulombic Waves
Course weight: Lab Science Core

Section 1: Electrostatic forces
1. Coulomb's Law: The force F between point charges q1, q2 is proportional to the values and inversely proportional to the square of physical distance: F = k * (q1*q2)/r^2.
2. Gauss's Law: Int[ E * dA ] = Q_enclosed / epsilon_0.
3. Capacitors: Devices storing electro-potential charges in dual metal planes. C = Q/V. Standard parallel configurations have C = (epsilon * A)/d.

Section 2: DC Circuits & Kirchhoff Laws
- KCL (Current Law): The sum of incoming currents in any circuit junction is exactly equal to outgoing sums. (Conservation of charge).
- KVL (Voltage Law): The sum of net voltage drops across any closed loop equals exactly zero. (Conservation of energy).`;
    }
    return `LECTURE NOTES: Foundations & Core Syllabi review
Subject: ${subjectName}

Section 1: Core Paradigms
- Comprehensive historical analysis of methodologies.
- Comparative reviews of standard practices versus contemporary iterations.
- Analyzing regional, administrative, and strategic configurations.

Section 2: Practice applications
- Practical case analyses on implementation.
- Standard formulas, system workflows, and structural dependencies.
- Analyzing common failures and optimization thresholds.`;
  };

  // State Management
  const [summaryText, setSummaryText] = useState(() => getDefaultSyllabusNotes(subject?.name || 'Default'));
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadedFiles, setLoadedFiles] = usePersistentState<{name: string, content: string, date: string}[]>(`ip_files_${id}`, () => [
    { name: `Sample notes – ${subject?.name ?? 'this subject'}.txt`, content: getDefaultSyllabusNotes(subject?.name || ''), date: "Sample" }
  ]);

  // Flashcards state
  const [flashcards, setFlashcards] = usePersistentState<Flashcard[]>(`ip_cards_${id}`, () => {
    // Generate some mock topic specific flashcards initially
    const subName = subject?.name || '';
    if (subName.includes("Math")) {
      return [
        { id: 'mat-1', front: "What is the derivative of x * sin(x)?", back: "sin(x) + x*cos(x) using the Product Rule f'g + fg'", mastered: false },
        { id: 'mat-2', front: "What is Taylor Series Expansion for e^x?", back: "1 + x + x^2/2! + x^3/3! + ...", mastered: false },
        { id: 'mat-3', front: " Fubini's Theorem parameter", back: "Allows switching order of double integration boundaries over continuous areas.", mastered: true }
      ];
    }
    if (subName.includes("Computer")) {
      return [
        { id: 'cs-1', front: "What is Binary Search time complexity?", back: "O(log N)", mastered: false },
        { id: 'cs-2', front: "Difference between Stack and Queue?", back: "Stack is Last-In First-Out (LIFO); Queue is First-In First-Out (FIFO)", mastered: false },
        { id: 'cs-3', front: "Average sorting cost for Merge Sort?", back: "O(N log N) in all scenarios", mastered: true }
      ];
    }
    return MOCK_FLASHCARDS;
  });
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Weak Topic list dynamically aggregated from Quiz failures and manual flags
  const [weakTopics, setWeakTopics] = usePersistentState<{id: string, name: string, origin: 'quiz' | 'flashcard', date: string, reviewIdea: string}[]>(`ip_weak_${id}`, () => []);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => {
    const subName = subject?.name || '';
    if (subName.includes("Math")) {
      return [
        { id: 'qm-1', question: "What represents Rolle's Theorem requirement under continuous [a, b] limits?", options: ["f(a) must equal f(b)", "f'(a) = f'(b)", "Interval has to cross zero value", "Integral equals 1"], correctIndex: 0 },
        { id: 'qm-2', question: "What is the result of integrating cos(2x) dx?", options: ["sin(2x) + C", "0.5 * sin(2x) + C", "-0.5 * sin(2x) + C", "-2 * sin(2x)"], correctIndex: 1 },
        { id: 'qm-3', question: "Which test confirms geometric series convergence parameters?", options: ["Ratio test only", "Asymptotic bound checking", "Checking whether absolute common ratio |r| < 1", "Root evaluation"], correctIndex: 2 }
      ];
    }
    if (subName.includes("Computer")) {
      return [
        { id: 'qc-1', question: "Which search algorithm holds O(log N) worst efficiency limits?", options: ["Linear Search", "Binary Search over sorted data", "Depth First Search", "Breadth First Search"], correctIndex: 1 },
        { id: 'qc-2', question: "What happens if a Binary Search Tree degenerates to a single sorted sequential chain?", options: ["Complexity is still O(log N)", "Complexity improves to O(1)", "Complexity decays to O(N)", "Stack overflow"], correctIndex: 2 },
        { id: 'qc-3', question: "Which sorting algorithm is guaranteed to execute O(N log N) in worst case?", options: ["Quick Sort", "Bubble Sort", "Merge Sort", "Insertion Sort"], correctIndex: 2 }
      ];
    }
    return MOCK_QUIZ;
  });
  const [quizActive, setQuizActive] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
  const [lastQuestionFeedback, setLastQuestionFeedback] = useState<{correct: boolean, chosen: number, explanation: string} | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);

  // Exam mode countdown stats
  const [examActive, setExamActive] = useState(false);
  const [examTimeLeft, setExamTimeLeft] = useState(600); // 10 mins
  const [selectedExamAnswers, setSelectedExamAnswers] = useState<Record<string, number>>({});
  const [examFeedbackText, setExamFeedbackText] = useState('');

  // Guess Engine state
  const [guessResults, setGuessResults] = useState<GuessPaperResult | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);

  // Kanban and Moodboard state
  // Plan, moodboard and reminders persist per subject through the shared store (Nova writes there too)
  const storeId = id ?? GLOBAL_SUBJECT;
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>(() => loadItems('tasks', storeId, MOCK_KANBAN));
  const [moodNotes, setMoodNotes] = useState<StickyNote[]>(() => loadItems('notes', storeId, MOCK_NOTES));

  // Account subjects use the planner and board shared with their groups; others stay in this browser.
  const isAccountSubject = isAccountSubjectId(storeId);
  const sharedBoard = useSharedBoard(storeId, isAccountSubject);
  const planTasks = isAccountSubject ? sharedBoard.tasks : kanbanTasks;
  const setPlanTasks = isAccountSubject ? sharedBoard.setTasks : setKanbanTasks;
  const boardNotes = isAccountSubject ? sharedBoard.notes : moodNotes;
  const setBoardNotes = isAccountSubject ? sharedBoard.setNotes : setMoodNotes;

  // Workspace AI Assistant Chatbot
  const [tutorHistory, setTutorHistory] = useState<ChatMessage[]>([]);
  const [tutorInputValue, setTutorInputValue] = useState('');
  const [tutorIsLoading, setTutorIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Reminders list
  const [reminders, setReminders] = useState<Reminder[]>(() => loadItems('reminders', storeId, []));

  useEffect(() => { saveItems('tasks', storeId, kanbanTasks); }, [storeId, kanbanTasks]);
  useEffect(() => { saveItems('notes', storeId, moodNotes); }, [storeId, moodNotes]);
  useEffect(() => { saveItems('reminders', storeId, reminders); }, [storeId, reminders]);

  // Pick up changes made elsewhere (e.g. Nova adding a task while this subject is open)
  useEffect(() => {
    const reload = (event: Event) => {
      const { kind, subjectId } = (event as CustomEvent<{ kind: string; subjectId: string }>).detail;
      if (subjectId !== storeId) return;
      if (kind === 'tasks') setKanbanTasks(loadItems('tasks', storeId));
      if (kind === 'notes') setMoodNotes(loadItems('notes', storeId));
      if (kind === 'reminders') setReminders(loadItems('reminders', storeId));
    };
    window.addEventListener(STORE_EVENT, reload);
    return () => window.removeEventListener(STORE_EVENT, reload);
  }, [storeId]);

  const scrollChatToBottom = () => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [tutorHistory]);

  // FEATURE REFACTOR: DUAL-INPUT & HISTORY
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [showDocSelector, setShowDocSelector] = useState(false);

  const [summaryHistory, setSummaryHistory] = usePersistentState<{id: string, doc: string[], content: string, date: string}[]>(`ip_summaries_${id}`, () => []);
  const [quizHistory, setQuizHistory] = usePersistentState<{id: string, doc: string[], score: number, total: number, date: string, questions?: QuizQuestion[]}[]>(`ip_quizzes_${id}`, () => []);
  const [flashcardDeckHistory, setFlashcardDeckHistory] = usePersistentState<{id: string, doc: string[], cardCount: number, date: string, cards?: Flashcard[]}[]>(`ip_decks_${id}`, () => []);
  const [guessPaperHistory, setGuessPaperHistory] = usePersistentState<{id: string, doc: string[], date: string, questions: number, result?: GuessPaperResult}[]>(`ip_guesses_${id}`, () => []);

  const [previewContent, setPreviewContent] = useState<{title: string, text: string} | null>(null);
  const [documentsVersion, setDocumentsVersion] = useState(0);

  // Reads a .txt/.md/.pdf file into the library. PDFs are read by the backend.
  const addStudyFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const { content, note } = await readStudyFile(file);
      setLoadedFiles(prev => [{ name: file.name, content, date: new Date().toLocaleDateString() }, ...prev.filter(f => f.name !== file.name)]);
      notify(note || `${file.name} added`, note ? 'info' : 'success');
      // Account subjects also keep the document and make it searchable with citations.
      if (isAccountSubject && isIndexable(file)) {
        uploadDocument(storeId, file)
          .then(() => setDocumentsVersion(v => v + 1))
          .catch(error => notify(`Couldn't save ${file.name} for search: ${error instanceof Error ? error.message : 'try again'}`, 'error'));
      }
      return content;
    } catch (error) {
      notify(error instanceof Error ? error.message : "This file couldn't be read.", 'error');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadFromChat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const content = await addStudyFile(file);
    if (content !== null) setSelectedDocs(prev => prev.includes(file.name) ? prev : [...prev, file.name]);
  };

  const renderDualInputHeader = (title: string, subtext: string, onGenerate: () => void, isGenerating: boolean, actionLabel: string = "Generate") => {
    const isReady = customTopic.trim() !== '' || selectedDocs.length > 0;

    return (
    <div className="w-full mt-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl p-1 relative">

        {/* Header Title (Subtle) */}
        <div className="px-4 pt-3 pb-1 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
            <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
             {selectedDocs.map(doc => (
                <span key={doc} className="bg-primary-50/80 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" />
                  <span className="max-w-[100px] truncate">{doc}</span>
                  <button onClick={() => setSelectedDocs(docs => docs.filter(d => d !== doc))} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5"/></button>
                </span>
             ))}
          </div>
        </div>

        {/* Chat Input Area */}
        <div className="relative">
          <textarea
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Type a custom topic or leave blank to only use attached documents..."
            className="w-full bg-transparent border-0 resize-none outline-none text-sm p-4 min-h-[60px] text-gray-800 dark:text-gray-100 placeholder-gray-400"
          />

          <div className="flex flex-wrap justify-between items-center gap-2 px-3 pb-3">
            <div className="relative flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-full text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950 px-4 h-9 shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700" onClick={() => setShowDocSelector(!showDocSelector)}>
                <Paperclip className="w-4 h-4 mr-2" />
                <span className="font-bold text-xs">{selectedDocs.length > 0 ? `${selectedDocs.length} Attached` : 'Attach'}</span>
              </Button>

              <label>
                <span className="cursor-pointer inline-flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950 px-4 h-9 shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-xs transition-colors">
                  <Upload className="w-4 h-4 mr-2 text-gray-400" />
                  {isUploading ? 'Reading…' : 'Upload'}
                </span>
                <input type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={(e) => {
                  handleUploadFromChat(e);
                  setShowDocSelector(true); // Open the selector so they see it
                }} />
              </label>

              {showDocSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-3rem))] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-4 z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-3">
                     <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Library Documents</h4>
                     <button onClick={() => setShowDocSelector(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"><X className="w-4 h-4"/></button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                    {loadedFiles.length === 0 ? <p className="text-[10px] text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">No documents in library.</p> : null}
                    {loadedFiles.map(file => {
                      const isSelected = selectedDocs.includes(file.name);
                      return (
                        <div
                          key={file.name}
                          onClick={() => setSelectedDocs(prev => isSelected ? prev.filter(d => d !== file.name) : [...prev, file.name])}
                          className={cn("text-xs p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all font-medium", isSelected ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300")}
                        >
                           <div className="flex items-center gap-2 truncate">
                             <FileText className="w-3.5 h-3.5 opacity-70"/>
                             <span className="truncate">{file.name}</span>
                           </div>
                           {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-500" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 max-sm:w-full">
              <span className="text-[10px] font-medium text-gray-400 hidden sm:inline-block tracking-wider uppercase">
                {isReady ? 'Ready for AI' : 'Provide Input'}
              </span>
              <Button
                size="sm"
                className={cn("rounded-full px-6 font-bold shadow-sm max-sm:w-full", !isReady && "opacity-50 cursor-not-allowed")}
                onClick={isReady ? onGenerate : undefined}
                isLoading={isGenerating}
                disabled={!isReady}
              >
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )};

  // Seven sections. Sections with several screens show them as sub-tabs.
  const sections: { id: string; label: string; icon: any; tabs: { id: TabType; label: string }[] }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, tabs: [{ id: 'overview', label: 'Overview' }] },
    { id: 'notes', label: 'Notes', icon: FileText, tabs: [{ id: 'upload', label: 'Documents' }, { id: 'summary', label: 'Summaries' }, { id: 'diagrams', label: 'Diagrams' }] },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, tabs: [{ id: 'flashcards', label: 'Flashcards' }] },
    { id: 'practice', label: 'Practice', icon: CheckSquare, tabs: [{ id: 'quiz', label: 'Quiz' }, { id: 'exam', label: 'Timed exam' }, { id: 'weak-topics', label: 'Weak topics' }] },
    { id: 'predictions', label: 'Exam predictions', icon: BrainCircuit, tabs: [{ id: 'guess-engine', label: 'Predictions' }] },
    { id: 'plan', label: 'Plan', icon: Columns, tabs: [{ id: 'kanban', label: 'Tasks' }, { id: 'reminders', label: 'Reminders' }, { id: 'moodboard', label: 'Board' }] },
    { id: 'group', label: 'Group', icon: Users, tabs: [{ id: 'studyroom', label: 'Study groups' }] },
  ];
  const activeSection = sections.find(section => section.tabs.some(tab => tab.id === activeTab)) ?? sections[0];
  const openSection = (section: typeof sections[number]) => {
    setActiveTab(section.tabs[0].id);
    setLastQuestionFeedback(null);
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const day = (form.elements.namedItem('schedule_day') as HTMLSelectElement).value;
    const time = (form.elements.namedItem('schedule_time') as HTMLInputElement).value;
    const room = (form.elements.namedItem('schedule_room') as HTMLInputElement).value;

    if (subject) {
      const updatedSubject = {
        ...subject,
        schedule: [...(subject.schedule || []), { day, time, room, type: 'Lecture' }]
      };

      setSubjects(subjects.map(s => s.id === subject.id ? updatedSubject : s));
    }

    setShowAddScheduleModal(false);
  };

  const handleRemoveSchedule = (idx: number) => {
    if (subject) {
      const updatedSubject = {
        ...subject,
        schedule: (subject.schedule || []).filter((_, i) => i !== idx)
      };
      setSubjects(subjects.map(s => s.id === subject.id ? updatedSubject : s));
    }
  };

  // -- High Stakes Exam Mode Timer --
  useEffect(() => {
    let interval: any;
    if (examActive && examTimeLeft > 0) {
      interval = setInterval(() => {
        setExamTimeLeft(p => p - 1);
      }, 1000);
    } else if (examActive && examTimeLeft === 0) {
      handleExamSubmit();
    }
    return () => clearInterval(interval);
  }, [examActive, examTimeLeft]);

  // Early return must stay below every hook, or React crashes when the subject disappears
  if (!subject) {
    if (!remoteChecked) {
      return <div className="p-16 text-center text-sm text-gray-400">Loading subject…</div>;
    }
    return (
      <div className="p-16 text-center">
        <ArrowLeft className="w-8 h-8 text-primary-500 mx-auto mb-4 cursor-pointer" onClick={() => navigate('/dashboard')} />
        <h3 className="text-xl font-bold">Workspace Not Found</h3>
        <p className="text-gray-400 mt-2">The selected curriculum workspace could not be located.</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>Return to Panel</Button>
      </div>
    );
  }

  // -- Dynamic File Upload Handler (FileReader) --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const content = await addStudyFile(file);
    if (content === null) return;
    setSummaryText(content);
    setSelectedDocs([file.name]);
    setActiveTab('summary'); // Direct immediately to study summary!
  };

  // Set selected upload as active material
  const handleSelectMaterial = (content: string) => {
    setSummaryText(content);
    setActiveTab('summary');
  };

  // AI Summary generation
  const handleGenerateSummary = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += summaryText;
    }

    if (!textToSummarize.trim()) return;
    setIsGenerating(true);
    const result = await generateSummary(textToSummarize);
    setGeneratedSummary(result);
    logStudyDay();
    setSummaryHistory(prev => [{
      id: Math.random().toString(),
      doc: [...selectedDocs],
      content: result,
      date: new Date().toLocaleTimeString()
    }, ...prev]);
    setIsGenerating(false);
  };

  // AI Flashcard generation based on textbooks
  const handleGenerateFlashcards = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += summaryText;
    }

    setIsGenerating(true);
    const result = await generateFlashcards(textToSummarize);
    if (result && result.length > 0) {
      setFlashcards(result);
      setActiveCardIndex(0);
      setIsFlipped(false);
      logStudyDay();
      setFlashcardDeckHistory(prev => [{
        id: Math.random().toString(),
        doc: [...selectedDocs],
        cardCount: result.length,
        cards: result,
        date: new Date().toLocaleTimeString()
      }, ...prev]);
    }
    setIsGenerating(true); // Complete
    setTimeout(() => setIsGenerating(false), 300);
  };

  // Flag active flashcard as weak topic
  const flagFlashcardAsWeak = (card: Flashcard) => {
    // Avoid double entries
    if (weakTopics.some(wt => wt.name.includes(card.front))) return;

    const newWeak = {
      id: `fc-weak-${Date.now()}`,
      name: `Flashcard query: "${card.front}"`,
      origin: 'flashcard' as const,
      date: "Just now",
      reviewIdea: `Check answer explanation: "${card.back}". Consider reviewing related lecture notes.`
    };
    setWeakTopics([newWeak, ...weakTopics]);
    notify('Added to your weak topics in Practice.', 'success');
  };

  // Quiz submission & explanation block
  const handleQuizAnswer = (chosenIndex: number) => {
    const q = quizQuestions[currentQuestion];
    const isCorrect = chosenIndex === q.correctIndex;

    setLastQuestionFeedback({
      correct: isCorrect,
      chosen: chosenIndex,
      explanation: q.explanation
        ? `${isCorrect ? "Correct!" : `The answer is "${q.options[q.correctIndex]}".`} ${q.explanation}`
        : isCorrect
        ? "Excellent work! Your knowledge base aligns perfectly with this subject point."
        : `Correction: The proper answer is "${q.options[q.correctIndex]}". Let's sync this question to your Weak Topics Tracker panel so we can review later.`
    });

    if (isCorrect) {
      setQuizScore(s => s + 1);
    } else {
      // Auto register quiz failure to Weak Topics!
      if (!weakTopics.some(wt => wt.name.includes(q.question))) {
        setWeakTopics(wt => [
          ...wt,
          {
            id: `q-weak-${Date.now()}`,
            name: `Incorrect Quiz Point: "${q.question}"`,
            origin: 'quiz',
            date: "Today",
            reviewIdea: `Study correct answer parameters: "${q.options[q.correctIndex]}". Practice active recall inside practice quizzes.`
          }
        ]);
      }
    }
  };

  const handleNextQuizQuestion = () => {
    setLastQuestionFeedback(null);
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(c => c + 1);
    } else {
      setShowQuizResult(true);
      logStudyDay();
      setQuizHistory(prev => [{
        id: Math.random().toString(),
        doc: [...selectedDocs],
        score: quizScore,
        total: quizQuestions.length,
        questions: quizQuestions,
        date: new Date().toLocaleTimeString()
      }, ...prev]);
    }
  };

  const handleResetQuiz = () => {
    setQuizActive(false);
    setQuizScore(0);
    setCurrentQuestion(0);
    setLastQuestionFeedback(null);
    setShowQuizResult(false);
  };

  const handleGenerateQuiz = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += summaryText;
    }

    setIsGenerating(true);
    try {
      const gQuestions = await generateQuiz(textToSummarize);
      if (gQuestions && gQuestions.length > 0) {
        setQuizQuestions(gQuestions);
        setQuizActive(true);
        setCurrentQuestion(0);
        setQuizScore(0);
        setLastQuestionFeedback(null);
        setShowQuizResult(false);
      }
    } catch (err) {
      console.error(err);
      notify("Couldn't make a quiz. Try again in a moment.", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Run AI Guess Engine
  const handleRunGuessEngine = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += summaryText;
    }

    setIsGuessing(true);
    const result = await generateGuessPaper(subject.name, textToSummarize);
    setGuessResults(result);
    logStudyDay();
    setGuessPaperHistory(prev => [{
      id: Math.random().toString(),
      doc: [...selectedDocs],
      date: new Date().toLocaleTimeString(),
      questions: result.sampleQuestions.length,
      result
    }, ...prev]);
    setIsGuessing(false);
  };

  // Custom AI Interactive Tutor Assistant Chat bubble
  const handleSendTutorChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorInputValue.trim()) return;

    const userMsg = tutorInputValue.trim();
    setTutorInputValue('');
    const updatedHistory: ChatMessage[] = [
      ...tutorHistory,
      { role: 'user', text: userMsg }
    ];
    setTutorHistory(updatedHistory);
    setTutorIsLoading(true);

    const reply = await chatWithAssistant(subject.name, updatedHistory, userMsg);
    setTutorHistory([
      ...updatedHistory,
      { role: 'model', text: reply }
    ]);
    setTutorIsLoading(false);
  };


  // Start exam mode
  const startExamModeSession = () => {
    setSelectedExamAnswers({});
    setExamTimeLeft(600); // 10 minutes session
    setExamFeedbackText('');
    setExamActive(true);
  };

  // High Stakes Exam submission
  const handleExamSubmit = () => {
    logStudyDay();
    setExamActive(false);
    // Grade calculations
    let correctCount = 0;
    quizQuestions.forEach(q => {
      if (selectedExamAnswers[q.id] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const scorePct = Math.round((correctCount / quizQuestions.length) * 100);
    const mockFeedbacks = scorePct >= 80
      ? `Amazing final grade: ${scorePct}%! Your syllabus knowledge base is highly advanced. Keep this steady study momentum!`
      : `Final grade achieved: ${scorePct}%. Several gaps of core theory were flagged. Recommended action: Review your synchronized terms inside the Weak Topics Tracker panel immediately.`;

    // Auto register wrong questions to Weak Topics tracker
    quizQuestions.forEach(q => {
      if (selectedExamAnswers[q.id] !== q.correctIndex) {
        if (!weakTopics.some(wt => wt.name.includes(q.question))) {
          setWeakTopics(wt => [
            ...wt,
            {
              id: `q-exam-weak-${Date.now()}`,
              name: `Missed Exam Question: "${q.question}"`,
              origin: 'quiz' as const,
              date: "Exam final",
              reviewIdea: `Focus on corrective syllabus terms: "${q.options[q.correctIndex]}" immediately.`
            }
          ]);
        }
      }
    });

    setExamFeedbackText(mockFeedbacks);
  };

  // Delete dynamic weak item
  const handleClearWeakTopic = (id: string) => {
    setWeakTopics(weakTopics.filter(wt => wt.id !== id));
  };

  // Reminders creation
  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const msg = (form.elements.namedItem('message') as HTMLInputElement).value;
    const dateInput = (form.elements.namedItem('dueDate') as HTMLInputElement).value;
    const platform = (form.elements.namedItem('platform') as HTMLSelectElement).value as any;

    if (!msg.trim()) return;

    setReminders([...reminders, {
      id: `rem-${Date.now()}`,
      message: msg,
      date: dateInput,
      platform: platform || 'app'
    }]);
    form.reset();
  };

  // Remove dynamic reminder
  const handleRemoveReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };


  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans">

      {/* 1. Left Vertical Action Sidebar */}
      <aside className="hidden md:flex w-18 lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col z-20">

        {/* Course Return banner */}
        <button
          className="p-4 flex w-full items-center gap-3 border-b border-gray-200 dark:border-gray-700 h-16 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <div className="hidden lg:block truncate">
            <span className="block text-[10px] text-gray-400 font-extrabold uppercase leading-none">Back</span>
            <span className="font-extrabold text-base text-primary-900 dark:text-white leading-tight truncate block">{subject.name}</span>
          </div>
        </button>

        {/* Tab List */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2.5 no-scrollbar">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => openSection(section)}
              title={section.label}
              aria-label={section.label}
              aria-current={activeSection.id === section.id ? 'page' : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative",
                activeSection.id === section.id
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 font-bold shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-gray-700/60"
              )}
            >
              <section.icon className={cn("w-5 h-5 transition-colors", activeSection.id === section.id ? "text-primary-600 dark:text-primary-400" : "text-gray-400 group-hover:text-primary-500")} />
              <span className="font-medium text-xs lg:text-sm hidden lg:block leading-none">{section.label}</span>

              {/* Weak topics waiting, shown on Practice */}
              {section.id === 'practice' && weakTopics.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-[10px] animate-pulse">
                  {weakTopics.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Study days in the last week, from real activity */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 hidden lg:block bg-gray-50/50 dark:bg-gray-800/40">
          <div className="bg-primary-900 rounded-xl p-3.5 text-white shadow-inner relative overflow-hidden">
            <p className="text-[10px] uppercase font-bold text-primary-200 leading-none">Study goal this week</p>
            <div className="flex justify-between items-baseline mt-1.5 mb-1 text-xs">
              <span className="font-black text-sm">{studyDaysThisWeek()} of {Number(localStorage.getItem('goal_days') || 5)} days</span>
              <span className="opacity-80">studied</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-white h-full" style={{ width: `${Math.min(100, Math.round((studyDaysThisWeek() / Number(localStorage.getItem('goal_days') || 5)) * 100))}%` }}></div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Module Viewer Space / Header */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative">

        {/* Wide Header Info */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 px-4 md:px-8 z-10">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="-ml-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden" aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className={cn("w-3 h-3 shrink-0 rounded-full", subject.color)}></div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                {subject.name} <span className="hidden text-xs text-gray-400 font-normal sm:inline">· {subject.credits} credit hours</span>
              </h1>
              <p className="truncate text-xs text-gray-500 font-medium">{subject.teacher ? `Instructor: ${subject.teacher}` : 'No instructor added'}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden items-center gap-2 bg-[#ccfbf1] text-[#0f172a] dark:bg-primary-900/50 dark:text-primary-100 px-3 py-1 rounded-full text-xs font-bold border border-transparent sm:flex" title="Days in a row you've studied">
              <Flame className="w-4 h-4 text-[#0b957f]" /> {studyStreak()}-day streak
            </div>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </header>

        {/* 3. Deep Focus High-Stakes Exam Mode Screen Overlay (Takes full height/width) */}
        {activeTab === 'exam' && examActive && (
          <div className="absolute inset-0 z-[100] bg-gray-950 text-white flex flex-col animate-in fade-in duration-300">

            {/* Header focused timer */}
            <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-8 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-650 flex items-center justify-center text-white text-sm font-bold">
                  EX
                </div>
                <div>
                  <h1 className="font-bold text-sm">Exam Mode Session: {subject.name}</h1>
                  <span className="block text-[10px] text-gray-400">Strict academic evaluation mode is active</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 px-4 py-1.5 rounded-xl font-mono text-base font-black text-red-400 animate-pulse">
                  <Clock className="w-4 h-4" /> {Math.floor(examTimeLeft / 60)}:{String(examTimeLeft % 60).padStart(2, '0')}
                </div>

                <Button variant="ghost" className="text-gray-400 hover:text-white" size="sm" onClick={async () => {
                  if (await confirmAction({ title: 'Leave this exam?', message: "Your answers so far won't be marked.", confirmLabel: 'Leave exam', danger: true })) {
                    setExamActive(false);
                    setActiveTab('overview');
                  }
                }}>
                  Leave exam
                </Button>
              </div>
            </header>

            {/* Scrollable Questions Board */}
            <div className="flex-1 overflow-y-auto py-10 px-6 max-w-3xl mx-auto w-full space-y-8">
              <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h2 className="text-base font-bold flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" /> Instructions For Scoring
                </h2>
                <ul className="list-disc pl-5 text-xs text-gray-400 space-y-1">
                  <li>Questions come from your current practice quiz set.</li>
                  <li>Questions got wrong are auto-synced into weak topics tracking to help you review parameters easily.</li>
                  <li>Do not navigate away from this screen or close the tab, otherwise score is deleted.</li>
                </ul>
              </div>

              {quizQuestions.map((q, qIndex) => (
                <Card key={q.id} className="bg-gray-900 border border-gray-800 p-6 space-y-4 shadow-sm text-left">
                  <span className="uppercase text-[10px] font-extrabold text-primary-400 tracking-wider">
                    Question {qIndex + 1} of {quizQuestions.length}
                  </span>
                  <h3 className="text-base font-bold text-gray-100">{q.question}</h3>

                  <div className="space-y-2 pt-2">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = selectedExamAnswers[q.id] === optIndex;
                      return (
                        <label
                          key={optIndex}
                          className={cn(
                            "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all text-xs touch-manipulation",
                            isSelected
                              ? "border-primary-500 bg-primary-950/20 text-white"
                              : "border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700 hover:text-white"
                          )}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={isSelected}
                            onChange={() => setSelectedExamAnswers({ ...selectedExamAnswers, [q.id]: optIndex })}
                            className="w-4 h-4 text-primary-600 border-gray-700 bg-gray-800 focus:ring-primary-500"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </Card>
              ))}

              <div className="pt-4 pb-12 flex justify-center">
                <Button size="lg" className="w-full" onClick={handleExamSubmit}>
                  Finalize and Submit Exam Paper
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeSection.tabs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800 md:px-8 no-scrollbar" role="tablist" aria-label={activeSection.label}>
            {activeSection.tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => { setActiveTab(tab.id); setLastQuestionFeedback(null); }}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors",
                  activeTab === tab.id
                    ? "bg-primary-600 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                )}
              >
                {tab.label}
                {tab.id === 'weak-topics' && weakTopics.length > 0 && <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] text-white">{weakTopics.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* 4. Content area. Phones scroll every screen and leave room for the bottom bar. */}
        <div className={cn(
          "flex-1 min-h-0 relative w-full flex flex-col overflow-y-auto",
          activeTab === 'studyroom' ? "" : "p-4 md:p-8",
          "pb-40 md:pb-28"
        )}>

          {/* TAB 4.1: OVERVIEW: real numbers for this subject and what to do next */}
          {activeTab === 'overview' && (() => {
            const daysLeft = daysUntil(subject.examDate);
            const mastered = flashcards.filter(c => c.mastered).length;
            const lastQuiz = quizHistory[0];
            const ownNotes = loadedFiles.filter(file => file.date !== 'Sample').length;
            const isLocalSubject = subjects.some(s => s.id === subject.id);
            const nextSteps: { label: string; detail: string; tab: TabType }[] = [];
            if (ownNotes === 0) nextSteps.push({ label: 'Upload your lecture notes', detail: 'Everything the AI makes comes from them.', tab: 'upload' });
            if (flashcards.length - mastered > 0) nextSteps.push({ label: `Review ${flashcards.length - mastered} flashcard${flashcards.length - mastered === 1 ? '' : 's'}`, detail: 'Mark the ones you know as mastered.', tab: 'flashcards' });
            if (weakTopics.length > 0) nextSteps.push({ label: `Go over ${weakTopics.length} weak topic${weakTopics.length === 1 ? '' : 's'}`, detail: 'From questions you got wrong or flagged.', tab: 'weak-topics' });
            if (!lastQuiz) nextSteps.push({ label: 'Take a practice quiz', detail: 'Find out what you already know.', tab: 'quiz' });
            if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) nextSteps.push({ label: 'Do a timed exam', detail: 'Practise under exam conditions.', tab: 'exam' });

            return (
            <div className="space-y-6 animate-in fade-in duration-300 text-left">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
                  <p className="text-xs font-bold uppercase text-gray-400">Next paper</p>
                  {daysLeft !== null && daysLeft >= 0 ? (
                    <>
                      <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{daysLeft === 0 ? 'Today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</p>
                      <p className="text-xs text-gray-500">{formatDue(subject.examDate!)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">{daysLeft !== null ? 'This exam date has passed.' : 'No exam date set yet.'}</p>
                  )}
                  {isLocalSubject && (
                    <label className="mt-4 block text-[11px] font-semibold text-gray-500">
                      Exam date
                      <Input type="date" value={subject.examDate ?? ''} className="mt-1 text-xs"
                        onChange={e => setSubjects(subjects.map(s => s.id === subject.id ? { ...s, examDate: e.target.value || undefined } : s))} />
                    </label>
                  )}
                </Card>

                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 md:col-span-2">
                  <p className="text-xs font-bold uppercase text-gray-400">Your progress</p>
                  <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Flashcards mastered', value: `${mastered} / ${flashcards.length}` },
                      { label: 'Last quiz', value: lastQuiz ? `${lastQuiz.score} / ${lastQuiz.total}` : '—' },
                      { label: 'Weak topics', value: String(weakTopics.length) },
                      { label: 'Your documents', value: String(ownNotes) },
                    ].map(item => (
                      <div key={item.label}>
                        <dt className="text-[11px] font-medium text-gray-500">{item.label}</dt>
                        <dd className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {flashcards.length > 0 && <ProgressBar value={Math.round((mastered / flashcards.length) * 100)} className="mt-5 h-2" />}
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 lg:col-span-2">
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">What to do next</h3>
                  {nextSteps.length === 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> You're on top of this subject. Keep reviewing to stay there.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                      {nextSteps.map(step => (
                        <li key={step.label} className="flex items-center justify-between gap-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{step.label}</p>
                            <p className="text-xs text-gray-500">{step.detail}</p>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => setActiveTab(step.tab)}>Start</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <div className="space-y-6">
                  {/* Subject Timetable Snapshot */}
                  <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left flex flex-col shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary-500" /> Subject Timetable
                      </h3>
                      <button
                        onClick={() => setShowAddScheduleModal(true)}
                        className="p-1 px-2 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors text-xs font-semibold flex items-center gap-1"
                        title="Add Scheduled Time"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>

                    <div className="space-y-3.5 flex-1">
                      {subject?.schedule && subject.schedule.length > 0 ? (
                        subject.schedule.map((item, idx) => (
                          <div
                            key={idx}
                            className="group/item flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors"
                          >
                            <div className="relative pl-3 border-l-2 border-primary-500 py-0.5">
                              <div className="absolute w-1.5 h-1.5 rounded-full bg-primary-500 -left-[4px] top-1.5"></div>
                              <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">{item.day}</span>
                              <span className="block text-[10px] text-gray-500 mt-0.5">{item.time} • {item.room}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveSchedule(idx)}
                              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                              title="Delete timing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 italic py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/30 dark:bg-gray-900/10">
                          <Compass className="w-6 h-6 mx-auto text-gray-350 mb-1.5" />
                          No scheduled class timings set.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
            );
          })()}

          {/* TAB 4.2: UPLOAD & DISK FILES INTERACTION (FFileReader) */}
          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">

              <div className="text-center p-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800/20">
                <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4 opacity-75" />
                <h3 className="text-xl font-bold mb-1">Your notes</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">
                  Upload lecture PDFs or text notes. Summaries, flashcards, quizzes and predictions are made from them.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center justify-center rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 px-5 py-2.5 text-xs shadow-lg shadow-primary-500/25">
                      {isUploading ? 'Reading file…' : 'Upload PDF or text file'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>

                  <span className="text-xs text-gray-400">PDF, TXT or Markdown, up to 25 MB</span>
                </div>
              </div>

              <AskNotes subjectId={storeId} enabled={isAccountSubject} refreshKey={documentsVersion} />

              {/* Log List of upload history */}
              <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left">
                <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-500" /> Tracked Upload History ({loadedFiles.length})
                </h4>

                <div className="space-y-2.5">
                  {loadedFiles.map((f, fIdx) => (
                    <div key={fIdx} className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-800 rounded-xl border border-gray-200/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0 leading-none">
                          <span className="font-bold text-xs text-gray-700 dark:text-gray-200 truncate block">{f.name}</span>
                          <span className="text-[10px] text-gray-400 mt-1 block">Uploaded: {f.date} • {f.content.length} chars</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={() => handleSelectMaterial(f.content)}>
                          Process AI
                        </Button>
                        <button onClick={() => setLoadedFiles(loadedFiles.filter((_, i) => i !== fIdx))} className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors bg-white border border-gray-200 shadow-sm">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          )}

          {/* Diagrams and equations from photos */}
          {activeTab === 'diagrams' && (
            <DiagramExplainer subjectId={storeId} subjectName={subject.name} />
          )}

          {/* TAB 4.3: AI SUMMARIES */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 items-start animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex min-w-0 flex-col gap-6">
                {/* Left pane: structured parsed output */}
                <Card className="flex flex-col bg-slate-50/50 dark:bg-gray-800/10 border border-gray-200 dark:border-gray-700 text-left p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-emerald-500" /> Summary
                    </h3>

                    {generatedSummary && (
                      <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={() => {
                        navigator.clipboard.writeText(generatedSummary);
                        notify('Summary copied', 'success');
                      }}>
                        Copy Summary
                      </Button>
                    )}
                  </div>

                  <div className="min-h-[280px] max-h-[65vh] overflow-auto bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    {generatedSummary ? (
                      <div className="whitespace-pre-wrap text-xs text-gray-750 dark:text-gray-200 leading-relaxed space-y-4 font-sans prose dark:prose-invert">
                        {generatedSummary}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                        <BrainCircuit className="w-12 h-12 mb-3 text-gray-300 animate-pulse" />
                        <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No summary yet</p>
                        <p className="text-[11px] text-gray-400 mt-1 max-w-sm text-center">
                          Generate an AI summary from your selected document or custom topic below.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
                <div className="shrink-0">
                  {renderDualInputHeader("AI Summaries", "Distill concepts into concise notes", handleGenerateSummary, isGenerating, "Generate Summary")}
                </div>
              </div>

              <div className="lg:col-span-3 flex min-w-0 flex-col lg:sticky lg:top-0">
                {/* Right pane: Earlier summaries */}
                <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-500"/> Local History Vault
                  </h3>
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {summaryHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No summaries generated for this source yet.</div>
                    ) : (
                      summaryHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Generated Summary</p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6" onClick={() => setPreviewContent({title: "Summary Preview", text: hist.content})}>
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.4: FLASHCARDS */}
          {activeTab === 'flashcards' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 items-start animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex min-w-0 flex-col gap-6">
                {/* Left Pane: Flashcard Interaction */}
                <div className="flex flex-col items-center bg-slate-50/50 dark:bg-gray-800/10 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
                  <div className="w-full max-w-lg mb-4 sm:mb-6">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white text-center">Flashcards</h2>
                  </div>

                  {flashcards.length > 0 ? (
                    <div className="w-full max-w-3xl flex items-start justify-center gap-4">

                      {/* Left Navigation Arrow */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-[136px] shrink-0 w-12 h-12 rounded-full hidden sm:flex bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700"
                        aria-label="Previous card"
                        onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.max(0, i-1)); }}
                        disabled={activeCardIndex === 0}
                      >
                        <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                      </Button>

                      {/* Card Container */}
                      <div className="w-full min-w-0 max-w-lg space-y-5">
                        {/* Rotating Card */}
                        <div
                          className="perspective-1000 w-full h-72 sm:h-80 relative cursor-pointer active:scale-[0.99] transition-transform"
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <div className={cn(
                            "w-full h-full transition-transform duration-500 transform-style-3d relative shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700",
                            isFlipped ? "rotate-y-180" : ""
                          )}>
                            {/* Front face query block */}
                            <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 p-5 sm:p-8 flex flex-col justify-between rounded-2xl">
                              <div className="flex justify-between items-center">
                                <span className="uppercase text-[10px] font-extrabold text-primary-500 tracking-wider">Question</span>
                                <HelpCircle className="w-4 h-4 text-gray-350" />
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center text-center py-3">
                                <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-850 dark:text-white leading-snug">
                                  {flashcards[activeCardIndex].front}
                                </p>
                              </div>

                              <div className="text-center text-[11px] text-gray-400 font-medium tracking-wide">
                                <span className="font-mono text-gray-300">[{activeCardIndex + 1}/{flashcards.length}]</span> Tap the card to see the answer
                              </div>
                            </div>

                            {/* Back face explanation block */}
                            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-primary-700 to-primary-950 text-white p-5 sm:p-8 flex flex-col justify-between rounded-2xl shadow-inner">
                              <div className="flex justify-between items-center">
                                <span className="uppercase text-[10px] font-bold text-primary-200 tracking-wider">Answer</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto flex items-center justify-center text-center py-3">
                                <p className="text-base sm:text-lg md:text-xl font-bold leading-relaxed text-blue-50">
                                  {flashcards[activeCardIndex].back}
                                </p>
                              </div>

                              <div className="text-center text-[10px] text-primary-200 font-medium">
                                <span className="font-mono text-primary-300/50">[{activeCardIndex + 1}/{flashcards.length}]</span> Tap again for the question
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Feedback Action Row: Mastered vs Flag Weak */}
                        <div className="flex justify-center flex-wrap items-center gap-3">
                          <Button
                            variant="secondary"
                            className="text-xs font-bold border-red-200/50 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              flagFlashcardAsWeak(flashcards[activeCardIndex]);
                            }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Flag as Weak
                          </Button>

                          <Button
                            variant="secondary"
                            className={cn(
                              "text-xs font-bold flex items-center gap-1.5",
                              flashcards[activeCardIndex].mastered
                                ? "bg-green-150 border-green-300 text-green-700"
                                : "hover:bg-green-50 text-emerald-600"
                            )}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = flashcards.map((c, i) => i === activeCardIndex ? { ...c, mastered: !c.mastered } : c);
                              logStudyDay();
                              setFlashcards(updated);
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {flashcards[activeCardIndex].mastered ? "Mastered ✓" : "Mark Mastered"}
                          </Button>
                        </div>

                        {/* Mobile Navigation (only visible on small screens) */}
                        <div className="flex sm:hidden items-center justify-between">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.max(0, i-1)); }}
                            disabled={activeCardIndex === 0}
                          >
                            <ChevronLeft className="w-4 h-4" /> Prev
                          </Button>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            {activeCardIndex + 1} / {flashcards.length}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label="Next card"
                        onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.min(flashcards.length-1, i+1)); }}
                            disabled={activeCardIndex === flashcards.length-1}
                          >
                            Next <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Right Navigation Arrow */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-[136px] shrink-0 w-12 h-12 rounded-full hidden sm:flex bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700"
                        aria-label="Next card"
                        onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.min(flashcards.length-1, i+1)); }}
                        disabled={activeCardIndex === flashcards.length-1}
                      >
                        <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-gray-500">No flashcards yet. Attach your notes or type a topic below, then press Generate Deck.</div>
                  )}
                </div>
                <div className="shrink-0">
                  {renderDualInputHeader("Flashcards Room", "Flip cards to test active recall definitions", handleGenerateFlashcards, isGenerating, "Generate Deck")}
                </div>
              </div>

              <div className="lg:col-span-3 flex min-w-0 flex-col lg:sticky lg:top-0">
                {/* Right Pane: Flashcard Deck History */}
                <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500"/> Earlier decks
                  </h3>
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {flashcardDeckHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No flashcard decks generated for this source yet.</div>
                    ) : (
                      flashcardDeckHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Revision Deck ({hist.cardCount} cards)</p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => { if (hist.cards?.length) { setFlashcards(hist.cards); setActiveCardIndex(0); setIsFlipped(false); } }} disabled={!hist.cards?.length}>
                            Launch Study Session
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.5: PRACTICE QUIZ */}
          {activeTab === 'quiz' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 items-start animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex min-w-0 flex-col gap-6 text-left">
                <div className="flex flex-col space-y-6">

                  {!quizActive ? (
                    <Card className="flex-1 flex flex-col items-center justify-center text-center py-12 p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6 min-h-[300px]">
                      <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 flex items-center justify-center mx-auto shadow-md">
                        <CheckSquare className="w-8 h-8" />
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold mb-1 self-center text-gray-900 dark:text-white">Practice quiz</h2>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                          Generate a randomized MCQ set review. Wrong items will auto-sync with your Weak Topic tracker review pane.
                        </p>
                      </div>

                      {/* Adaptive toggle switch */}
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 p-4 rounded-xl max-w-sm mx-auto flex items-center justify-between">
                        <div className="text-left leading-none">
                          <span className="font-bold text-xs text-gray-800 dark:text-gray-200 block">Adaptive difficulty<SoonBadge /></span>
                          <span className="text-[10px] text-gray-400 mt-1 block">Questions get harder or easier as you answer.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-not-allowed opacity-50" title="Coming soon">
                          <input
                            type="checkbox"
                            checked={isAdaptiveMode}
                            disabled
                            aria-label="Adaptive difficulty (coming soon)"
                            onChange={() => setIsAdaptiveMode(!isAdaptiveMode)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex justify-center gap-3 pt-2">
                        <Button onClick={() => {
                          setQuizActive(true);
                          setCurrentQuestion(0);
                          setQuizScore(0);
                          setLastQuestionFeedback(null);
                          setShowQuizResult(false);
                        }}>
                          Start MCQ Session
                        </Button>
                      </div>
                    </Card>
                  ) : showQuizResult ? (
                    <Card className="text-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
                      <div className="w-14 h-14 rounded-full bg-emerald-105 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">MCQ Session Finalized!</h2>
                        <p className="text-xs text-gray-400 mt-1">Check grade accomplishments below.</p>
                      </div>

                      <div className="inline-block px-10 py-4 bg-gray-50 rounded-2xl border">
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase leading-none mb-1">Achieved Grade</p>
                        <span className="text-4xl font-black text-primary-600">
                          {quizScore} / {quizQuestions.length}
                        </span>
                        <span className="block text-xs font-bold text-gray-500 mt-1">
                          Score: {Math.round((quizScore / quizQuestions.length) * 100)}%
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                        Missed parameters are marked inside your tutor checklist. Click reset to review other material questions.
                      </p>

                      <div className="flex justify-center gap-2 pt-2">
                        <Button variant="ghost" onClick={handleResetQuiz}>Exit Quiz</Button>
                        <Button onClick={handleResetQuiz}>Rerun Practice Set</Button>
                      </div>
                    </Card>
                  ) : (
                <Card className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">

                  {/* Top slide tracker progress */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                    <div
                      className="h-full bg-primary-500 transition-all duration-350"
                      style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                    />
                  </div>

                  <div className="p-6 md:p-8 space-y-6">
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span className="font-bold">Syllabus Quiz Practice • Question {currentQuestion + 1} of {quizQuestions.length}</span>
                      <span className="font-bold text-primary-500 bg-primary-50 px-2.5 py-0.5 rounded-full dark:bg-primary-950/40">Current Score: {quizScore}</span>
                    </div>

                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-snug">
                      {quizQuestions[currentQuestion].question}
                    </h3>

                    {/* MCQ Options */}
                    <div className="space-y-2.5 pt-2">
                      {quizQuestions[currentQuestion].options.map((opt, idx) => {
                        const feedbackGiven = lastQuestionFeedback !== null;
                        const isCorrectAnswer = idx === quizQuestions[currentQuestion].correctIndex;
                        const isChosenAnswer = lastQuestionFeedback?.chosen === idx;

                        return (
                          <button
                            key={idx}
                            disabled={feedbackGiven}
                            onClick={() => handleQuizAnswer(idx)}
                            className={cn(
                              "w-full text-left p-4 rounded-xl border transition-all text-xs flex items-center justify-between group",
                              feedbackGiven
                                ? isCorrectAnswer
                                  ? "border-green-500 bg-green-50 text-green-800"
                                  : isChosenAnswer
                                    ? "border-red-500 bg-red-50 text-red-800"
                                    : "border-gray-200 bg-gray-50 text-gray-400"
                                : "border-gray-200 hover:border-primary-500 hover:bg-primary-50/20 text-gray-700 dark:text-gray-300"
                            )}
                          >
                            <span>{opt}</span>
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center",
                              feedbackGiven
                                ? isCorrectAnswer
                                  ? "border-green-500 bg-green-500 text-white text-[9px] font-bold"
                                  : isChosenAnswer
                                    ? "border-red-500 bg-red-500 text-white text-[9px] font-bold"
                                    : "border-gray-300"
                                : "border-gray-300 group-hover:border-primary-500"
                            )}>
                              {feedbackGiven && isCorrectAnswer && "✓"}
                              {feedbackGiven && isChosenAnswer && !isCorrectAnswer && "✗"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Rich Explanation Corrective box */}
                    {lastQuestionFeedback && (
                      <div className={cn(
                        "p-4 rounded-xl border text-xs leading-relaxed transition-all animate-in fade-in",
                        lastQuestionFeedback.correct
                          ? "bg-green-50 border-green-200 text-green-800"
                          : "bg-orange-50 border-orange-200/50 text-orange-850"
                      )}>
                        <p className="font-bold flex items-center gap-1.5">
                          {lastQuestionFeedback.correct ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-orange-600" />}
                          AI Explanation Review:
                        </p>
                        <p className="mt-1">{lastQuestionFeedback.explanation}</p>

                        <div className="mt-4 flex justify-end">
                          <Button size="sm" onClick={handleNextQuizQuestion}>
                            {currentQuestion === quizQuestions.length - 1 ? "Finish Quiz" : "Proceed Next Question"}
                          </Button>
                        </div>
                      </div>
                    )}

                  </div>
                </Card>
              )}
                </div>
                <div className="shrink-0 mt-auto">
                  {renderDualInputHeader("Practice Quiz", "Generate randomized MCQ set reviews", handleGenerateQuiz, isGenerating, "Generate MCQs")}
                </div>
              </div>

              <div className="lg:col-span-3 flex min-w-0 flex-col lg:sticky lg:top-0">
                {/* Right Pane: Past quizzes */}
                <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-pink-500"/> Quiz History Vault
                  </h3>
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {quizHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No past quiz evaluations for this source.</div>
                    ) : (
                      quizHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              Score: <span className="text-primary-600">{hist.score}/{hist.total}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6" disabled={!hist.questions?.length}
                            onClick={() => { if (hist.questions?.length) { setQuizQuestions(hist.questions); setQuizActive(true); setCurrentQuestion(0); setQuizScore(0); setLastQuestionFeedback(null); setShowQuizResult(false); } }}>
                            Retake
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.6: EXAM FEEDBACK RESULTS ONLY (Hidden if active exam is overlays) */}
          {activeTab === 'exam' && !examActive && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300 text-left">
              <Card className="text-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                  <GraduationCap className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Timed exam</h2>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                    Answer every question in 10 minutes, like the real exam. Wrong answers go to your weak topics.
                  </p>
                </div>

                {examFeedbackText && (
                  <div className="p-4 bg-gray-50 border rounded-2xl text-xs space-y-3">
                    <p className="font-bold uppercase text-[10px] text-gray-400">Previous Exam Results Diagnostic</p>
                    <p className="text-gray-700 leading-relaxed font-semibold">{examFeedbackText}</p>
                    <p className="text-[11px] text-gray-400 italic">Incorrect answers were automatically directed to your Weak Topics tracking pane.</p>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <Button size="md" icon={Play} onClick={startExamModeSession}>
                    Start 10-minute exam
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4.7: EXAM GUESS ENGINE (Predicted final questions) */}
          {activeTab === 'guess-engine' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 items-start animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex min-w-0 flex-col gap-6 text-left">
                <div className="flex flex-col space-y-6 sm:space-y-8">
                  {/* Trigger header */}
                  <div className="shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-emerald-600" /> Exam Guess Engine
                      </h2>
                      <p className="text-xs text-gray-450 mt-1">
                        AI analyzes your notes or subject title to predict key exam topics, probable questions, and structures.
                      </p>
                    </div>
                  </div>

                  {!guessResults ? (
                    <Card className="flex-1 flex flex-col items-center justify-center text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[300px]">
                      <BrainCircuit className="w-14 h-14 text-emerald-500/80 mx-auto mb-4 animate-bounce" />
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No predictions yet</h3>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                        Attach a document or provide a topic and click "Predict Exams" below to rank likely exam topics.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">

                      {/* Predicted Topics Grid */}
                      <div>
                        <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-4">Predicted Exam-Topic Probability Models</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {guessResults.predictions.map((p, idx) => {
                            const isHigh = p.probability === 'High';
                            const isMed = p.probability === 'Medium';

                            return (
                              <Card key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                  <span className="font-extrabold text-xs text-gray-800 dark:text-gray-200 leading-tight">{p.topic}</span>
                                  <Badge color={
                                    isHigh
                                      ? "bg-red-50 text-red-700 font-bold"
                                      : isMed
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-gray-50 text-gray-600"
                                  }>
                                    {p.probability} Prob
                                  </Badge>
                                </div>

                                <p className="text-[11px] text-gray-500 leading-relaxed text-left">{p.reason}</p>

                                <div className="pt-2 border-t text-[10px] text-gray-400 flex justify-between">
                                  <span>Estimated weight of overall test:</span>
                                  <span className="font-bold text-gray-700">{p.estimatedWeight}</span>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sample Questions Structure */}
                      <div className="space-y-4">
                        <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Estimated High-Yield Final Exam Questions</h3>
                        <div className="space-y-4">
                          {guessResults.sampleQuestions.map((sq, idx) => (
                            <Card key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-primary-600 uppercase">Question Type: {sq.format}</span>
                                <span className="text-gray-400">Candidate Draft #{idx+1}</span>
                              </div>
                              <h4 className="font-bold text-sm text-gray-900 border-l-2 border-primary-500 pl-3 text-left leading-snug">
                                {sq.question}
                              </h4>
                              <div className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border text-xs leading-relaxed text-left space-y-1">
                                <span className="font-extrabold text-[10px] uppercase text-gray-400">Perfect Exam Structure Outline:</span>
                                <p className="whitespace-pre-wrap text-gray-600 font-mono text-[11px] mt-1 pr-4">{sq.suggestedStructure}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Prep Strategic Advices */}
                      <Card className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 p-6 space-y-2 text-left">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                          <BrainCircuit className="w-5 h-5 text-emerald-600" />
                          <h4 className="font-bold text-sm">Strategic Grade-A Preparation Blueprint</h4>
                        </div>
                        <p className="text-xs text-yellow-900 leading-relaxed text-left">
                          {guessResults.strategicAdvice}
                        </p>
                      </Card>

                    </div>
                  )}
                </div>
                <div className="shrink-0 mt-auto">
                  {renderDualInputHeader("Exam Guess Engine", "Predict final exam question structures", handleRunGuessEngine, isGuessing, "Predict Exams")}
                </div>
              </div>

              <div className="lg:col-span-3 flex min-w-0 flex-col lg:sticky lg:top-0">
                {/* Right Pane: Guess Engine History Vault */}
                <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-5 sm:p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-500"/> Earlier predictions
                  </h3>
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {guessPaperHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No predicted exams for this source.</div>
                    ) : (
                      guessPaperHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              {hist.questions} sample questions
                            </p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6" disabled={!hist.result} onClick={() => hist.result && setGuessResults(hist.result)}>
                            Open
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.8: WEAK-TOPIC TRACKER */}
          {activeTab === 'weak-topics' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 text-left">

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-500" /> Weak topics
                  </h2>
                  <p className="text-xs text-gray-450 mt-1">
                    Track dynamic syllabus components failed during practice testing or flagged in flashcard sessions.
                  </p>
                </div>
                <Badge color="bg-amber-50 text-amber-800 font-bold">{weakTopics.length} to review</Badge>
              </div>

              {weakTopics.length === 0 ? (
                <Card className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No weak topics. You're on it.</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                    No weak items recorded. Run more practice quizzes or flag card modules to track focus areas.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {weakTopics.map(wt => (
                    <Card key={wt.id} className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            wt.origin === 'quiz' ? "bg-pink-500" : "bg-purple-500"
                          )}></span>
                          <div>
                            <span className="font-black text-xs text-gray-800 dark:text-gray-200 leading-tight block">{wt.name}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider block">Source origin: {wt.origin} • Added: {wt.date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-tutor', {
                              detail: { message: `Can you explain this weak area with a simple example: ${wt.name}` },
                            }));
                          }}>
                            Ask the tutor
                          </Button>

                          <button
                            onClick={() => handleClearWeakTopic(wt.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded border border-gray-200 transition-colors bg-white shadow-sm"
                            title="Mark Cleared / Mastered"
                          >
                            <CheckCircle2 size={13} className="text-emerald-500 hover:text-white" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900/55 p-3 rounded-xl border text-xs text-gray-650 leading-relaxed italic text-left">
                        <span className="font-bold text-[10px] uppercase text-gray-400 not-italic block mb-0.5">Remedial Focus recommendation:</span>
                        {wt.reviewIdea}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 4.9: STUDY GROUPS (shared subjects, planner and chat; access rules on the server) */}
          {activeTab === 'studyroom' && (
            <StudyGroups subject={subject} />
          )}

          {/* TAB 4.10: KANBAN BOARD */}
          {activeTab === 'kanban' && (
            <div className="flex min-h-full flex-col space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:px-6 rounded-2xl flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">Planner</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Drag tasks between columns, or use the arrows on a task.</p>
                  {isAccountSubject && <p className="mt-1 text-[11px] font-semibold text-emerald-600">{sharedBoard.error ?? 'Shared with your study groups · changes sync for everyone'}</p>}
                </div>
                <Button size="sm" icon={Plus} onClick={() => {
                  const title = prompt("Enter target study task title:");
                  if (title && title.trim()) {
                    setPlanTasks([...planTasks, { id: Date.now().toString(), title: title.trim(), status: 'todo' }]);
                  }
                }}>
                  Add task
                </Button>
              </div>

              <div className="flex-1 min-h-[420px]">
                <KanbanBoard tasks={planTasks} onUpdateTasks={setPlanTasks} />
              </div>
            </div>
          )}

          {/* TAB 4.11: MOODBOARD */}
          {activeTab === 'moodboard' && (
            <div className="flex min-h-full flex-col space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:px-6 rounded-xl flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">Board</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Drag a note by its top edge to move it. Tap inside a note to write.</p>
                  {isAccountSubject && <p className="mt-1 text-[11px] font-semibold text-emerald-600">{sharedBoard.error ?? 'Shared with your study groups · changes sync for everyone'}</p>}
                </div>
              </div>

              <div className="flex-1 min-h-[520px]">
                <MoodBoard notes={boardNotes} onUpdateNotes={setBoardNotes} />
              </div>
            </div>
          )}

          {/* TAB 4.12: REMINDERS */}
          {activeTab === 'reminders' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300 text-left">

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Reminders</h2>
                  <p className="text-xs text-gray-405 mt-1">Review active reminder configurations below.</p>
                </div>
                <Badge color="bg-primary-50 text-primary-800 font-bold">{reminders.length} Active</Badge>
              </div>

              <div className="space-y-3">
                {reminders.map(rem => (
                  <Card key={rem.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                        <Bell size={18} />
                      </div>
                      <div className="leading-none text-left">
                        <h3 className="font-black text-xs text-gray-800">{rem.message}</h3>
                        <span className="text-[10px] text-gray-400 mt-1 block">Due: {formatDue(rem.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {rem.platform === 'app' ? (rem.fired ? 'Shown' : 'In-app') : <>{rem.platform}<SoonBadge /></>}
                      </span>
                      <button onClick={() => handleRemoveReminder(rem.id)} className="p-1 hover:bg-red-50 text-gray-450 hover:text-red-500 rounded border">
                        <X size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Form creation card */}
              <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left space-y-4">
                <h4 className="font-extrabold text-sm text-gray-800">New reminder</h4>

                <form onSubmit={handleCreateReminder} className="space-y-4 text-xs font-medium">
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">What to remind you about</label>
                    <Input name="message" required placeholder="e.g. Finish Taylor Series practice test..." className="text-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">When</label>
                      <Input name="dueDate" type="datetime-local" required className="text-xs" />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">How</label>
                      <select name="platform" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:border-primary-500">
                        <option value="app">In the app (pops up while IntelliPrep is open)</option>
                        <option value="telegram" disabled>Telegram (coming soon)</option>
                        <option value="email" disabled>Email (coming soon)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit">Add reminder</Button>
                  </div>
                </form>
              </Card>

            </div>
          )}

        </div>

      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 md:hidden" aria-label="Subject sections">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => openSection(section)}
            aria-current={activeSection.id === section.id ? 'page' : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-semibold",
              activeSection.id === section.id ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400"
            )}
          >
            <section.icon className="h-5 w-5" />
            <span className="max-w-full truncate px-0.5">{section.id === 'predictions' ? 'Predict' : section.label}</span>
            {section.id === 'practice' && weakTopics.length > 0 && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-orange-500" />}
          </button>
        ))}
      </nav>

      {/* Add Schedule Modal */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" /> Add Timetable
              </h2>
              <button onClick={() => setShowAddScheduleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Class Day</label>
                  <select name="schedule_day" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none">
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Timing</label>
                  <Input name="schedule_time" placeholder="e.g. 10:00 AM - 11:30 AM" defaultValue="10:00 AM - 11:30 AM" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Room / Location</label>
                  <Input name="schedule_room" placeholder="e.g. Room 301" defaultValue="Room 301" />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-100 dark:border-gray-700">
                <Button type="button" variant="ghost" onClick={() => setShowAddScheduleModal(false)}>Cancel</Button>
                <Button type="submit">Save Class</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* History Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl animate-in zoom-in-95 duration-200 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-500" /> {previewContent.title}
              </h2>
              <button onClick={() => setPreviewContent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-sm text-gray-700 dark:text-gray-200 font-serif whitespace-pre-wrap">
              {previewContent.text}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setPreviewContent(null)}>Close Preview</Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
