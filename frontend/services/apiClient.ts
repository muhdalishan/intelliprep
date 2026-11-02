// Single entry point for calls to the IntelliPrep backend.
// IP-11 adds the Supabase access token to every request.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export class ApiError extends Error {
  /** `code` is set for errors the UI handles specially, e.g. "database_unavailable" or "offline". */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  // File uploads send FormData; the browser sets its multipart Content-Type itself.
  const isForm = init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: isForm ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the IntelliPrep server. Is the backend running?", 'offline');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : 'The request was rejected. Check the input and try again.';
    throw new ApiError(response.status, detail, body.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};
