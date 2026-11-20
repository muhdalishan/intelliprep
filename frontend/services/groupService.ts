import { apiBlob, apiFetch } from "./apiClient";

export interface GroupSummary {
  id: string;
  name: string;
  invite_code: string;
  role: "lead" | "member";
  member_count: number;
  subject_count: number;
}

export interface GroupMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: "lead" | "member";
  joined_at: string;
}

export interface SharedSubject {
  id: string;
  name: string;
  exam_date: string | null;
  shared_by: string;
  shared_by_name: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  invite_code: string;
  role: "lead" | "member";
  members: GroupMember[];
  subjects: SharedSubject[];
}

export interface GroupAttachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface GroupMessage {
  id: number;
  user_id: string;
  author: string;
  body: string;
  created_at: string;
  attachments: GroupAttachment[];
}

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const listGroups = () => apiFetch<GroupSummary[]>("/groups");
export const getGroup = (id: string) => apiFetch<GroupDetail>(`/groups/${id}`);
export const createGroup = (name: string) => post<GroupDetail>("/groups", { name });
export const joinGroup = (inviteCode: string) => post<GroupDetail>("/groups/join", { invite_code: inviteCode });
export const shareSubject = (groupId: string, subjectId: string) =>
  post<GroupDetail>(`/groups/${groupId}/subjects`, { subject_id: subjectId });
export const unshareSubject = (groupId: string, subjectId: string) =>
  apiFetch<GroupDetail>(`/groups/${groupId}/subjects/${subjectId}`, { method: "DELETE" });
export const removeMember = (groupId: string, userId: string) =>
  apiFetch<GroupDetail>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
export const leaveGroup = (groupId: string) =>
  apiFetch<void>(`/groups/${groupId}/leave`, { method: "POST" });
export const listMessages = (groupId: string, after = 0) =>
  apiFetch<GroupMessage[]>(`/groups/${groupId}/messages?after=${after}`);
export const postMessage = (groupId: string, body: string) =>
  post<GroupMessage>(`/groups/${groupId}/messages`, { body });

/** Sends up to six files (10 MB each) with an optional caption. */
export const postFiles = (groupId: string, files: File[], body: string) => {
  const form = new FormData();
  files.forEach(file => form.append("files", file));
  form.append("body", body);
  return apiFetch<GroupMessage>(`/groups/${groupId}/messages/files`, { method: "POST", body: form });
};
export const deleteMessage = (groupId: string, messageId: number) =>
  apiFetch<void>(`/groups/${groupId}/messages/${messageId}`, { method: "DELETE" });
export const fileBlob = (groupId: string, fileId: string) => apiBlob(`/groups/${groupId}/files/${fileId}`);

/** Subjects saved only in this browser have short local ids; shared subjects need account ids. */
export const isAccountSubjectId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
