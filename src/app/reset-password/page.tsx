'use client';

import { useState } from 'react';
import { updatePassword } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/'), 2000);
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center max-w-md mx-auto bg-bg px-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-fg mb-1">Job Tracka</h1>
        <p className="text-muted-fg text-sm mb-8">Set a new password</p>

        <div className="bg-card border border-border rounded-xl p-6">
          {done ? (
            <div className="bg-primary/10 text-primary text-sm px-3 py-2 rounded-lg border border-primary/20 text-center">
              Password updated! Redirecting...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-fg placeholder-muted-fg focus:outline-none focus:border-primary text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-slate border border-border rounded-lg text-fg placeholder-muted-fg focus:outline-none focus:border-primary text-sm"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-dark py-2.5 rounded-lg font-medium active:opacity-90 disabled:opacity-50 text-sm"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
