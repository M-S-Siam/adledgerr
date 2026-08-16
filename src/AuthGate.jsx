import React, { useEffect, useState } from 'react';
import { LogIn, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase.js';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message || 'Unable to sign in. Please check your email and password.');
    }

    setBusy(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 size={18} className="animate-spin text-sky-400" />
          Loading AdLytic…
        </div>
      </div>
    );
  }

  if (session) return children;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-2xl font-extrabold shadow-lg shadow-sky-500/20">
            A
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Welcome to AdLytic</h1>
          <p className="mt-1 text-sm text-slate-400">Marketing finance, in one workspace.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold mb-5">
            <ShieldCheck size={17} className="text-sky-400" />
            Sign in to your workspace
          </div>

          <label className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
          />

          <label className="block text-xs font-medium text-slate-300 mb-1.5 mt-4">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Your password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
          />

          {error && (
            <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Your AdLytic account is secured by Supabase Authentication.
          </p>
        </form>
      </div>
    </div>
  );
}
