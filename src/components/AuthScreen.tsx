'use client';

import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/supabase';

interface AuthScreenProps {
  onAuth: (user: any) => void;
}

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'login') {
      const { data, error } = await signInWithEmail(email, password);
      if (error) {
        setError(error.message);
      } else if (data.user) {
        onAuth(data.user);
      }
    } else if (mode === 'signup') {
      const { data, error } = await signUpWithEmail(email, password);
      if (error) {
        setError(error.message);
      } else if (data.user) {
        if (data.session) {
          onAuth(data.user);
        } else {
          setMessage('Check your email to confirm your account, then sign in.');
          switchMode('login');
        }
      }
    } else if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Password reset email sent — check your inbox.');
        switchMode('login');
      }
    }

    setLoading(false);
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center max-w-md mx-auto bg-bg px-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-fg mb-1">Job Tracka</h1>
        <p className="text-muted-fg text-sm mb-8">Sign in to sync across devices</p>

        <div className="bg-card border border-border rounded-xl p-6">
          {mode !== 'forgot' && (
            <div className="flex mb-6 bg-slate rounded-lg p-1">
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login' ? 'bg-card text-fg shadow-sm' : 'text-muted-fg'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === 'signup' ? 'bg-card text-fg shadow-sm' : 'text-muted-fg'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-fg font-semibold">Reset Password</h2>
              <p className="text-muted-fg text-sm mt-1">Enter your email and we'll send a reset link.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-fg placeholder-muted-fg focus:outline-none focus:border-primary text-sm"
                placeholder="you@example.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-fg placeholder-muted-fg focus:outline-none focus:border-primary text-sm"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-primary/10 text-primary text-sm px-3 py-2 rounded-lg border border-primary/20">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-dark py-2.5 rounded-lg font-medium active:opacity-90 disabled:opacity-50 text-sm"
            >
              {loading ? 'Please wait...' :
                mode === 'login' ? 'Sign In' :
                mode === 'signup' ? 'Create Account' :
                'Send Reset Link'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="w-full text-sm text-muted-fg hover:text-fg text-center"
              >
                Forgot password?
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-sm text-muted-fg hover:text-fg text-center"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
