import { useEffect, useState } from 'react';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

// Sign-in. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, accounts are real Supabase
// accounts and every API call carries the access token. Without them (local development before
// the Supabase project is connected) sign-in only sets a flag in this browser, and the backend
// runs every request as a local test student.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Read before the Supabase client cleans the URL: the student arrived from a reset-password email. */
const landing = new URLSearchParams(window.location.search);
const arrivedForRecovery = landing.get('recovery') === '1';
/** Came back from a link in a confirmation or reset email (Supabase adds ?code=). */
export const arrivedFromEmail = () => landing.has('code');

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        // PKCE puts ?code= in the query string; the email links come back to the page that sent them.
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const realAccounts = supabase !== null;

const LOCAL_FLAG = 'isAuthenticated';
const OWNER_KEY = 'ip_owner';

// Per-student data kept in this browser. Cleared when a different account signs in here, so one
// student never sees another's subjects on a shared computer.
const STUDENT_KEYS = /^(prep_subjects|ip_|userName|userEmail|profilePic|goal_days|study_days)/;

const rememberStudent = (session: Session) => {
  const user = session.user;
  const previous = localStorage.getItem(OWNER_KEY);
  if (previous && previous !== user.id) {
    Object.keys(localStorage).filter(k => STUDENT_KEYS.test(k)).forEach(k => localStorage.removeItem(k));
  }
  localStorage.setItem(OWNER_KEY, user.id);
  if (user.email) localStorage.setItem('userEmail', user.email);
  const name = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (name && !localStorage.getItem('userName')) localStorage.setItem('userName', name);
  if (!localStorage.getItem('userName')) localStorage.setItem('userName', (user.email ?? 'Student').split('@')[0]);
};

let current: Session | null = null;
let ready = !supabase;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    current = data.session;
    if (current) rememberStudent(current);
    ready = true;
    emit();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    current = session;
    if (session) rememberStudent(session);
    ready = true;
    emit();
  });
}

const signedIn = () => (supabase ? current !== null : localStorage.getItem(LOCAL_FLAG) === 'true');

/** `{ready, signedIn}`; `ready` is false while a saved session is still being restored. */
export const useAuth = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(t => t + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return { ready, signedIn: signedIn() };
};

/** The access token for API calls, refreshed by the client when it's close to expiring. */
export const accessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

/** True when the student opened the link in a reset-password email. */
export const needsNewPassword = () => arrivedForRecovery;

const redirect = (extra = '') => `${window.location.origin}${window.location.pathname}${extra}`;

const friendly = (message: string) => {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Use a password of at least 8 characters.';
  if (/failed to fetch|network|load failed/i.test(message)) return "Can't reach the sign-in service. Check your internet and try again.";
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return message;
};

export type AuthResult = { ok: boolean; error?: string; needsConfirmation?: boolean };

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  if (!supabase) {
    localStorage.setItem(LOCAL_FLAG, 'true');
    localStorage.setItem('userEmail', email.trim());
    if (!localStorage.getItem('userName')) localStorage.setItem('userName', email.trim().split('@')[0] || 'Student');
    emit();
    return { ok: true };
  }
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
};

export const signUp = async (fullName: string, email: string, password: string): Promise<AuthResult> => {
  if (!supabase) {
    localStorage.setItem('userName', fullName.trim() || 'Student');
    return signIn(email, password);
  }
  if (password.length < 8) return { ok: false, error: 'Use a password of at least 8 characters.' };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirect() },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  if (fullName.trim()) localStorage.setItem('userName', fullName.trim());
  // With "Confirm email" on in Supabase, there's no session until the link is opened.
  return { ok: true, needsConfirmation: !data.session };
};

export const sendPasswordReset = async (email: string): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'Password reset works once accounts are connected.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect('?recovery=1') });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
};

export const setNewPassword = async (password: string): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'Accounts are not connected.' };
  if (password.length < 8) return { ok: false, error: 'Use a password of at least 8 characters.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendly(error.message) };
  window.history.replaceState(null, '', '/dashboard');
  return { ok: true };
};

export const signOut = async () => {
  localStorage.removeItem(LOCAL_FLAG);
  if (supabase) await supabase.auth.signOut();
  emit();
};
