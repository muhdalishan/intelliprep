import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';

const InfoLayout: React.FC<{ title: string; updated?: string; children: React.ReactNode }> = ({ title, updated, children }) => (
  <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-extrabold text-slate-900 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white"><GraduationCap className="h-4 w-4" /></span>
          IntelliPrep AI
        </Link>
        <Link to="/" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h1>
      {updated && <p className="mt-2 text-xs text-slate-500">Last updated {updated}</p>}
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-primary-600">
        {children}
      </div>
    </main>
  </div>
);

export const About: React.FC = () => (
  <InfoLayout title="About IntelliPrep AI">
    <p>
      IntelliPrep AI is a BS(CS) Final Year Project at the University of Central Punjab (group S26-CS-037).
      It helps university students prepare for exams from their own material: summaries, flashcards,
      quizzes and likely exam topics are all made from the notes and past papers a student uploads.
    </p>
    <h2>Team</h2>
    <ul>
      <li>Muhammad Murtaza Baber Bajwa: retrieval, exam predictions, spaced repetition, study groups, architecture</li>
      <li>Muhammad Alishan: AI content generation, adaptive exams, diagram understanding, workspace, reminders, accounts and dashboard</li>
      <li>Supervisor: Bilal Shahid</li>
    </ul>
    <h2>Why we built it</h2>
    <p>
      In a survey of 30 UCP students, 87% said they spend three or more hours re-reading notes without feeling
      sure they'll remember them, and 91% wanted quizzes generated from their own notes.
    </p>
  </InfoLayout>
);

export const Privacy: React.FC = () => (
  <InfoLayout title="Privacy" updated="3 November 2026">
    <p>This explains what IntelliPrep AI stores and why. It's written for a student pilot and will be reviewed before a public launch.</p>
    <h2>What we store</h2>
    <ul>
      <li>Your name, email and profile photo, so you can sign in and classmates in your groups can recognise you.</li>
      <li>The subjects, notes and files you upload, and what you make from them (summaries, flashcards, quizzes, plans, reminders).</li>
      <li>Your study activity (for example, which days you studied), to show your streak and progress.</li>
    </ul>
    <h2>How AI features use your notes</h2>
    <p>
      When you ask for a summary, flashcards, a quiz, predictions or a tutor answer, the relevant text from your notes
      is sent to our AI provider (currently OpenAI) to produce the result. It is used only to answer that request.
      API keys stay on our server; your browser never talks to the AI provider directly.
    </p>
    <h2>Voice</h2>
    <p>
      Nova's voice features use your browser's speech recognition. In Chrome, speech is processed by Google to turn
      it into text. The "Hey Nova" wake word is off until you turn it on, and you can turn it off at any time in Settings.
    </p>
    <h2>Who can see your data</h2>
    <p>
      Only you, unless you share a subject with a study group. Group members can then see that subject's documents,
      planner and board. Your flashcards, reminders and other subjects stay private.
    </p>
    <h2>Your choices</h2>
    <ul>
      <li>Clear everything saved in this browser from Settings.</li>
      <li>Deleting your account and exporting your data will be available when full accounts launch.</li>
    </ul>
    <h2>Contact</h2>
    <p>Questions about your data: contact the project team through the University of Central Punjab, Faculty of IT and Computer Science.</p>
  </InfoLayout>
);

export const Terms: React.FC = () => (
  <InfoLayout title="Terms of use" updated="3 November 2026">
    <p>IntelliPrep AI is a student project in a pilot stage. By using it you agree to the following.</p>
    <h2>Use it for your own studies</h2>
    <ul>
      <li>Upload only material you're allowed to use, such as your own notes and course material shared with you.</li>
      <li>Don't use IntelliPrep to cheat in assessments or to share material your university doesn't allow you to share.</li>
    </ul>
    <h2>AI can be wrong</h2>
    <p>
      Summaries, answers, flashcards, quizzes and exam predictions are generated by AI from your notes. They can contain
      mistakes, and predictions are estimates, not guarantees. Check important facts against your course material.
    </p>
    <h2>Availability</h2>
    <p>As a pilot, the service may change, be unavailable at times, or reset data. Keep your own copies of important files.</p>
    <h2>Study groups</h2>
    <p>Be respectful in group chats. Group leads can remove members.</p>
  </InfoLayout>
);

export const NotFound: React.FC = () => (
  <InfoLayout title="Page not found">
    <p>That page doesn't exist or has moved.</p>
    <p><Link to="/dashboard">Go to your dashboard</Link> or <Link to="/">the home page</Link>.</p>
  </InfoLayout>
);
