import React, { useState, useRef, useEffect } from 'react';
import { KanbanTask, StickyNote } from '../types';
import { Card, Button } from './UIComponents';
import { Plus, X, Image as ImageIcon, Move, MoreHorizontal } from 'lucide-react';
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

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => (
        <div 
          key={col.id}
          onDragOver={allowDrop}
          onDrop={(e) => handleDrop(e, col.id)}
          className={cn("flex-shrink-0 w-72 rounded-xl bg-gray-100 dark:bg-gray-800/50 p-4 border-t-4", col.color)}
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
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{task.title}</p>
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

interface MoodBoardProps {
  notes: StickyNote[];
  onUpdateNotes: (notes: StickyNote[]) => void;
}

export const MoodBoard: React.FC<MoodBoardProps> = ({ notes, onUpdateNotes }) => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, id: string, x: number, y: number) => {
    setActiveNote(id);
    setOffset({
      x: e.clientX - x,
      y: e.clientY - y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeNote && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      // Calculate new position relative to the board
      const newX = e.clientX - offset.x;
      const newY = e.clientY - offset.y;
      
      onUpdateNotes(notes.map(n => n.id === activeNote ? { ...n, x: newX, y: newY } : n));
    }
  };

  const handleMouseUp = () => {
    setActiveNote(null);
  };

  const addNote = () => {
    const newNote: StickyNote = {
      id: Date.now().toString(),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      content: 'New Idea',
      color: ['bg-yellow-200', 'bg-blue-200', 'bg-pink-200', 'bg-green-200'][Math.floor(Math.random() * 4)]
    };
    onUpdateNotes([...notes, newNote]);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl select-none"
      ref={boardRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
          style={{ left: note.x, top: note.y }}
          className={cn(
            "absolute w-48 h-48 p-4 shadow-lg rounded-lg cursor-move transition-shadow flex flex-col group",
            note.color,
            activeNote === note.id ? "z-50 shadow-2xl scale-105" : "z-0"
          )}
          onMouseDown={(e) => handleMouseDown(e, note.id, note.x, note.y)}
        >
          <div className="flex justify-between items-start mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <Move className="w-4 h-4 text-gray-600" />
             <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onUpdateNotes(notes.filter(n => n.id !== note.id));
                }}
                className="text-gray-600 hover:text-red-500"
             >
                <X className="w-4 h-4" />
             </button>
          </div>
          <textarea
            className="flex-1 w-full bg-transparent resize-none outline-none text-gray-800 font-medium placeholder-gray-600/50"
            value={note.content}
            onChange={(e) => onUpdateNotes(notes.map(n => n.id === note.id ? { ...n, content: e.target.value } : n))}
            onMouseDown={(e) => e.stopPropagation()} // Allow text selection without dragging
          />
        </div>
      ))}
    </div>
  );
};