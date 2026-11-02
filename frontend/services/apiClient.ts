// Single entry point for calls to the IntelliPrep backend.
// IP-11 adds the Supabase access token to every request.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  // File uploads send FormData; the browser sets its multipart Content-Type itself.
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: isForm ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : 'The request was rejected. Check the input and try again.';
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
};
