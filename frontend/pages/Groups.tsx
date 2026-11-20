import React from 'react';
import { AppShell } from '../components/AppShell';
import { StudyGroups } from '../components/StudyGroups';

/** All of the student's study groups, across subjects. */
export const Groups: React.FC = () => (
  <AppShell title="Study groups" bodyClassName="overflow-y-auto">
    <main className="mx-auto h-full w-full max-w-[1400px] max-md:h-auto max-md:pb-32">
      <StudyGroups />
    </main>
  </AppShell>
);
