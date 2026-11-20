import React from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StudyGroups } from '../components/StudyGroups';

/** Study groups: the groups page, or one group's chat at /groups/:groupId. */
export const Groups: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  return (
    <AppShell title="Study groups" bodyClassName="flex flex-col overflow-hidden">
      <StudyGroups groupId={groupId} />
    </AppShell>
  );
};
