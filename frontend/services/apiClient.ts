// Single entry point for calls to the IntelliPrep backend.
// Sends the Supabase access token with every request once accounts are connected (IP-11).
import { accessToken } from "./authService";

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export class ApiError extends Error {
  /** `code` is set for errors the UI handles specially, e.g. "database_unavailable" or "offline". */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

// Local development only: which test student this browser acts as (the backend ignores it elsewhere).
export const DEV_STUDENT_KEY = 'dev_student';
const devStudentHeader = (): Record<string, string> => {
  const student = localStorage.getItem(DEV_STUDENT_KEY);
  return student ? { 'X-Dev-User': student } : {};
};

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  // File uploads send FormData; the browser sets its multipart Content-Type itself.
  const isForm = init.body instanceof FormData;
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : devStudentHeader()),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the IntelliPrep server. Is the backend running?", 'offline');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : 'The request was rejected. Check the input and try again.';
    if (response.status === 401 && token) {
      throw new ApiError(401, 'Your session has ended. Sign in again.', 'signed_out');
    }
    throw new ApiError(response.status, detail, body.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

/** Downloads a protected file (e.g. a chat attachment) as a Blob, with the same sign-in as apiFetch. */
export const apiBlob = async (path: string): Promise<Blob> => {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : devStudentHeader(),
    });
  } catch {
    throw new ApiError(0, "Can't reach the IntelliPrep server.", 'offline');
  }
  if (!response.ok) throw new ApiError(response.status, response.status === 404 ? 'File not found.' : 'Could not open the file.');
  return response.blob();
};
