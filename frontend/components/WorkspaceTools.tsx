import React, { useState, useRef, useEffect } from 'react';
import { KanbanTask, StickyNote } from '../types';
import { Card, Button } from './UIComponents';
import { Plus, X, Image as ImageIcon, Move, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './UIComponents';

// --- KANBAN ---

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onUpdateTasks: (tasks: KanbanTask[]) => void;
}

const COLUMNS: { id: KanbanTask['status']; title: string; color: string }[] = [
  { id: 'todo', title: 'To Study', color: 'border-red-400' },
  { id: 'learning', title: 'Learning', color: 'border-yellow-400' },
  { id: 'practiced', title: 'Practiced', color: 'border-blue-400' },
  { id: 'mastered', title: 'Mastered', color: 'border-green-400' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onUpdateTasks }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: KanbanTask['status']) => {
    e.preventDefault();
    if (draggedTaskId) {
      const updated = tasks.map(t => t.id === draggedTaskId ? { ...t, status } : t);
      onUpdateTasks(updated);
      setDraggedTaskId(null);
    }
  };

  const moveTask = (id: string, step: number) => {
    onUpdateTasks(tasks.map(t => {
      if (t.id !== id) return t;
      const next = COLUMNS[COLUMNS.findIndex(c => c.id === t.status) + step];
      return next ? { ...t, status: next.id } : t;
    }));
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none xl:grid xl:grid-cols-4 xl:overflow-visible">
      {COLUMNS.map((col, colIndex) => (
        <div
          key={col.id}
          onDragOver={allowDrop}
          onDrop={(e) => handleDrop(e, col.id)}
          className={cn("flex-shrink-0 w-[min(18rem,80vw)] xl:w-auto xl:min-w-0 snap-start rounded-xl bg-gray-100 dark:bg-gray-800/50 p-4 border-t-4", col.color)}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200">{col.title}</h3>
            <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
              {tasks.filter(t => t.status === col.id).length}
            </span>
          </div>
          <div className="space-y-3">
            {tasks.filter(t => t.status === col.id).map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words">{task.title}</p>
                {/* Touch screens can't drag, so tasks also move with these arrows. */}
                <div className="mt-2 flex justify-end gap-1">
                  {colIndex > 0 && (
                    <button onClick={() => moveTask(task.id, -1)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex - 1].title}`}>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {colIndex < COLUMNS.length - 1 && (
                    <button onClick={() => moveTask(task.id, 1)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-white" aria-label={`Move to ${COLUMNS[colIndex + 1].title}`}>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {tasks.filter(t => t.status === col.id).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}
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