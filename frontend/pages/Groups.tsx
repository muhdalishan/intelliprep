import React from 'react';
import { AppTopBar } from '../components/AppTopBar';
import { StudyGroups } from '../components/StudyGroups';

/** All of the student's study groups, across subjects. */
export const Groups: React.FC = () => (
  <div className="min-h-screen bg-[#fafbff] dark:bg-slate-950">
    <AppTopBar />
    <main className="mx-auto h-[calc(100vh-4rem)] w-full max-w-[1600px] max-md:h-auto max-md:pb-32">
      <StudyGroups />
    </main>
  </div>
);
