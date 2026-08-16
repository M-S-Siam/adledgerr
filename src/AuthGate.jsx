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
    if (signInError) setError(signInError.message || 'Unable to sign in. Please check your email and password.');
    setBusy(false);
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#07111f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#cbd5e1' }}>
          <Loader2 size={18} style={{ color: '#38bdf8' }} className="animate-spin" /> Loading AdLytic…
        </div>
      </div>
    );
  }

  if (session) return children;

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', borderRadius: 10,
    border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a',
    padding: '12px 14px', fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07111f', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ margin: '0 auto', width: 58, height: 58, borderRadius: 16, background: 'linear-gradient(135deg,#38bdf8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: 26, fontWeight: 800, boxShadow: '0 10px 30px rgba(37,99,235,.25)' }}>A</div>
          <h1 style={{ margin: '14px 0 0', fontSize: 25, lineHeight: 1.2, fontWeight: 750, color: '#f8fafc' }}>Welcome to AdLytic</h1>
          <p style={{ margin: '7px 0 0', fontSize: 14, color: '#94a3b8' }}>Marketing finance, in one workspace.</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: '#0f1b2d', border: '1px solid #26364d', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 650, marginBottom: 20, color: '#e2e8f0' }}>
            <ShieldCheck size={17} style={{ color: '#38bdf8' }} /> Sign in to your workspace
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 7 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={inputStyle} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 7, marginTop: 16 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password" style={inputStyle} />

          {error && (
            <div style={{ marginTop: 14, borderRadius: 9, border: '1px solid #7f1d1d', background: '#3f0d12', padding: '10px 12px', fontSize: 12, color: '#fecaca' }}>{error}</div>
          )}

          <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, border: 0, borderRadius: 10, background: busy ? '#64748b' : '#0ea5e9', color: '#ffffff', padding: '12px 16px', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11, color: '#64748b' }}>Your AdLytic account is secured by Supabase Authentication.</p>
        </form>
      </div>
    </div>
  );
}
