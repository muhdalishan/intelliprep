import React, { useState, useRef, useEffect } from 'react';
import { KanbanTask, StickyNote } from '../types';
import { Card, Button } from './UIComponents';
import { Plus, X, Image as ImageIcon, Move, MoreHorizontal, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from './UIComponents';

// --- PLANNER: the same tasks as a list (default on phones) or a board ---

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onUpdateTasks: (tasks: KanbanTask[]) => void;
  view?: 'list' | 'board';
}

// Each stage keeps one small dot of colour: it is what tells the stages apart.
const COLUMNS: { id: KanbanTask['status']; title: string; dot: string }[] = [
  { id: 'todo', title: 'To study', dot: 'bg-gray-400' },
  { id: 'learning', title: 'Learning', dot: 'bg-amber-500' },
  { id: 'practiced', title: 'Practiced', dot: 'bg-sky-500' },
  { id: 'mastered', title: 'Mastered', dot: 'bg-emerald-500' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onUpdateTasks, view = 'board' }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<KanbanTask['status'] | null>(null);

  const setStatus = (id: string, status: KanbanTask['status']) =>
    onUpdateTasks(tasks.map(t => (t.id === id ? { ...t, status } : t)));
  const moveTask = (id: string, step: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const next = COLUMNS[COLUMNS.findIndex(c => c.id === task.status) + step];
    if (next) setStatus(id, next.id);
  };
  const remove = (id: string) => onUpdateTasks(tasks.filter(t => t.id !== id));

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {COLUMNS.map((col, colIndex) => {
          const items = tasks.filter(t => t.status === col.id);
          return (
            <section key={col.id}>
              <h3 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} /> {col.title}
                <span className="font-mono text-xs font-normal text-gray-500">{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-[13px] text-gray-400 dark:border-white/[.08]">Nothing here</p>
              ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-white/[.06] dark:border-white/[.07] dark:bg-white/[.015]">
                  {items.map(task => (
                    <li key={task.id} className="group flex items-center gap-2 px-3 py-2.5">
                      <button
                        onClick={() => setStatus(task.id, task.status === 'mastered' ? 'todo' : 'mastered')}
                        className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          task.status === 'mastered' ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 hover:border-gray-400 dark:border-white/25")}
                        aria-label={task.status === 'mastered' ? `Mark ${task.title} as not done` : `Mark ${task.title} as mastered`}
                      >
                        {task.status === 'mastered' && <Check className="h-3 w-3" />}
                      </button>
                      <span className={cn("min-w-0 flex-1 break-words text-[14px]", task.status === 'mastered' ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100")}>{task.title}</span>
                      <div className="flex shrink-0 items-center">
                        {colIndex > 0 && (
                          <button onClick={() => moveTask(task.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex - 1].title}`}>
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                        )}
                        {colIndex < COLUMNS.length - 1 && (
                          <button onClick={() => moveTask(task.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex + 1].title}`}>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => remove(task.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-400" aria-label={`Delete ${task.title}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none xl:grid xl:grid-cols-4 xl:overflow-visible">
      {COLUMNS.map((col, colIndex) => {
        const items = tasks.filter(t => t.status === col.id);
        return (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault(); setOverColumn(col.id); }}
            onDragLeave={() => setOverColumn(c => (c === col.id ? null : c))}
            onDrop={e => { e.preventDefault(); if (draggedTaskId) setStatus(draggedTaskId, col.id); setDraggedTaskId(null); setOverColumn(null); }}
            className={cn(
              "flex w-[min(18rem,80vw)] flex-shrink-0 snap-start flex-col rounded-2xl border p-3 transition-colors xl:w-auto xl:min-w-0",
              overColumn === col.id ? "border-primary-500/50 bg-primary-500/[.04]" : "border-gray-200 bg-gray-50/60 dark:border-white/[.07] dark:bg-white/[.015]"
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={cn("h-2 w-2 rounded-full", col.dot)} />
              <h3 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{col.title}</h3>
              <span className="ml-auto font-mono text-xs text-gray-500">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => { setDraggedTaskId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDraggedTaskId(null); setOverColumn(null); }}
                  className={cn("group cursor-grab rounded-xl border border-gray-200 bg-white p-3 transition-[border-color,opacity] hover:border-gray-300 active:cursor-grabbing dark:border-white/[.08] dark:bg-gray-800 dark:hover:border-white/[.16]", draggedTaskId === task.id && "opacity-50")}
                >
                  <p className="break-words text-[14px] text-gray-900 dark:text-gray-100">{task.title}</p>
                  {/* Touch screens can't drag, so tasks also move with these arrows. */}
                  <div className="mt-2 flex items-center justify-end gap-0.5">
                    {colIndex > 0 && (
                      <button onClick={() => moveTask(task.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex - 1].title}`}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    )}
                    {colIndex < COLUMNS.length - 1 && (
                      <button onClick={() => moveTask(task.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex + 1].title}`}>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => remove(task.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-400" aria-label={`Delete ${task.title}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-[13px] text-gray-400 dark:border-white/[.08]">
                  Drop a task here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- MOODBOARD ---

const NOTE_SIZE = 176;

interface MoodBoardProps {
  notes: StickyNote[];
  onUpdateNotes: (notes: StickyNote[]) => void;
}

export const MoodBoard: React.FC<MoodBoardProps> = ({ notes, onUpdateNotes }) => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.PointerEvent, id: string, x: number, y: number) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setActiveNote(id);
    setOffset({
      x: e.clientX - x,
      y: e.clientY - y
    });
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (activeNote && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      // Keep the note inside the board
      const newX = Math.max(0, Math.min(e.clientX - offset.x, rect.width - NOTE_SIZE));
      const newY = Math.max(0, Math.min(e.clientY - offset.y, rect.height - NOTE_SIZE));

      onUpdateNotes(notes.map(n => n.id === activeNote ? { ...n, x: newX, y: newY } : n));
    }
  };

  const handleMouseUp = () => {
    setActiveNote(null);
  };

  const addNote = () => {
    const newNote: StickyNote = {
      id: Date.now().toString(),
      x: 16 + Math.random() * Math.max(0, (boardRef.current?.clientWidth ?? 300) - NOTE_SIZE - 32),
      y: 72 + Math.random() * 120,
      content: 'New Idea',
      color: ['bg-yellow-200', 'bg-blue-200', 'bg-pink-200', 'bg-green-200'][Math.floor(Math.random() * 4)]
    };
    onUpdateNotes([...notes, newNote]);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl select-none"
      ref={boardRef}
      onPointerMove={handleMouseMove}
      onPointerUp={handleMouseUp}
      onPointerCancel={handleMouseUp}
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
            backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)',
            backgroundSize: '20px 20px'
        }}
      ></div>

      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button onClick={addNote} variant="secondary" className="shadow-lg backdrop-blur-md bg-white/80" icon={Plus}>Add Note</Button>
      </div>

      {notes.map(note => (
        <div
          key={note.id}
          style={{ left: `min(${note.x}px, calc(100% - ${NOTE_SIZE}px))`, top: `min(${note.y}px, calc(100% - ${NOTE_SIZE}px))`, width: NOTE_SIZE, height: NOTE_SIZE }}
          className={cn(
            "absolute p-3 shadow-lg rounded-lg cursor-move touch-none transition-shadow flex flex-col group",
            note.color,
            activeNote === note.id ? "z-50 shadow-2xl scale-105" : "z-0"
          )}
          onPointerDown={(e) => handleMouseDown(e, note.id, Math.min(note.x, (boardRef.current?.clientWidth ?? Infinity) - NOTE_SIZE), Math.min(note.y, (boardRef.current?.clientHeight ?? Infinity) - NOTE_SIZE))}
        >
          <div className="flex justify-between items-start mb-2 transition-opacity md:opacity-0 md:group-hover:opacity-100">
             <Move className="w-4 h-4 text-gray-600" />
             <button
                onClick={(e) => {
                    e.stopPropagation();
                    onUpdateNotes(notes.filter(n => n.id !== note.id));
                }}
                className="text-gray-600 hover:text-red-500"
                aria-label="Delete note"
                onPointerDown={(e) => e.stopPropagation()}
             >
                <X className="w-4 h-4" />
             </button>
          </div>
          <textarea
            className="flex-1 w-full min-h-0 bg-transparent resize-none outline-none text-sm text-gray-800 font-medium placeholder-gray-600/50 touch-auto"
            value={note.content}
            onChange={(e) => onUpdateNotes(notes.map(n => n.id === note.id ? { ...n, content: e.target.value } : n))}
            onPointerDown={(e) => e.stopPropagation()} // Allow typing and selecting without dragging
          />
        </div>
      ))}
    </div>
  );
};