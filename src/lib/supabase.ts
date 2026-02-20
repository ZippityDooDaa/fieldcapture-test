import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Log if env vars are missing (for debugging)
if (typeof window !== 'undefined') {
  console.log('[Supabase] URL exists:', !!supabaseUrl);
  console.log('[Supabase] Key exists:', !!supabaseKey);
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing environment variables!');
  }
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseKey || '');

// Auth helpers
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin)
        : process.env.NEXT_PUBLIC_SITE_URL,
    },
  });
  return { data, error };
}

export async function resetPassword(email: string) {
  const redirectTo = typeof window !== 'undefined'
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/reset-password`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (user: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null);
    }
  );
  return subscription;
}