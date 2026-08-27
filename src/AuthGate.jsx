import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Monitor,
  ShieldCheck,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { supabase } from './lib/supabase.js';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  WebkitTextFillColor: '#0f172a',
  padding: '11px 12px',
  fontSize: 14,
  outline: 'none',
};

const buttonStyle = {
  border: 0,
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('login');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState('account');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const redirectUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    const isRecoveryUrl = typeof window !== 'undefined' && /(^|&)type=recovery(&|$)/.test(window.location.hash.replace(/^#/, ''));

    if (isRecoveryUrl) setMode('reset');

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setChecking(false);
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setError('');
        setMessage('Choose a new password for your AdLytic account.');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Account & security is integrated into the main Settings page.

  const clearFeedback = () => {
    setError('');
    setMessage('');
  };

  const clearSettingsFeedback = () => {
    setSettingsError('');
    setSettingsMessage('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearFeedback();
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

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!email.trim()) {
      setError('Enter your account email first.');
      return;
    }

    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      setError(resetError.message || 'Unable to send the password reset email.');
    } else {
      setMessage('Password reset email sent. Check your inbox and use the newest reset link.');
    }
    setBusy(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message || 'Unable to update your password.');
      setBusy(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setSession(null);
    setPassword('');
    setConfirmPassword('');
    setMode('login');
    setMessage('Password updated successfully. Please sign in with your new password.');
    setBusy(false);
  };

  const handleLogout = async () => {
    clearSettingsFeedback();
    setSettingsBusy(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) setSettingsError(signOutError.message || 'Unable to sign out.');
    setSettingsBusy(false);
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    clearSettingsFeedback();

    if (currentPassword.length === 0) {
      setSettingsError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setSettingsError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSettingsError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setSettingsError('Your new password must be different from the current password.');
      return;
    }

    setSettingsBusy(true);

    // Re-authenticate first, then update the password. This is compatible with
    // the Supabase JS version currently used by this project.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session?.user?.email || '',
      password: currentPassword,
    });

    if (verifyError) {
      setSettingsError('Current password is incorrect.');
      setSettingsBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setSettingsError(updateError.message || 'Unable to change your password.');
      setSettingsBusy(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSettingsMessage('Password changed successfully. Your current session remains signed in.');
    setSettingsBusy(false);
  };

  const handleSendSettingsReset = async () => {
    clearSettingsFeedback();
    const accountEmail = session?.user?.email || '';
    if (!accountEmail) {
      setSettingsError('No account email is available for this session.');
      return;
    }

    setSettingsBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(accountEmail, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      setSettingsError(resetError.message || 'Unable to send the password reset email.');
    } else {
      setSettingsMessage('A password reset email has been sent to your account email.');
    }
    setSettingsBusy(false);
  };

  const handleSignOutOthers = async () => {
    clearSettingsFeedback();
    setSettingsBusy(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) {
      setSettingsError(signOutError.message || 'Unable to sign out other sessions.');
    } else {
      setSettingsMessage('All other active sessions have been signed out. This session remains active.');
    }
    setSettingsBusy(false);
  };

  const handleSignOutAll = async () => {
    clearSettingsFeedback();
    setSettingsBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setSettingsError(signOutError.message || 'Unable to sign out.');
    setSettingsBusy(false);
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <Loader2 size={17} color="#0284c7" className="animate-spin" /> Loading AdLytic…
        </div>
      </div>
    );
  }

  if (session && mode !== 'reset') {
    const accountEmail = session.user?.email || 'Unknown account';
    const userId = session.user?.id || '';

    return (
      <>
        {children}

        <style>{` .adl-shell header button:last-of-type{margin-right:56px!important;} .adl-shell header{padding-right:4px!important;} `}</style>
        <button type="button" onClick={() => { const el = Array.from(document.querySelectorAll('.adl-shell aside button, .adl-shell aside a')).find((node) => node.textContent?.replace(/\s+/g, ' ').trim() === 'Settings'); if (el) el.click(); }} aria-label="Open Settings" title="Settings" style={{ position: 'fixed', top: 14, right: 14, zIndex: 9999, width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#334155', boxShadow: '0 6px 18px rgba(15,23,42,.10)', cursor: 'pointer' }}>
          <Settings2 size={17} />
        </button>

      </>
    );
  }

  const inputWrap = { position: 'relative' };
  const inputStyle = fieldStyle;
  const passwordInputStyle = { ...inputStyle, paddingRight: 42 };
  const eyeButtonStyle = { position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#64748b', padding: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ margin: '0 auto', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#38bdf8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', WebkitTextFillColor: '#fff', boxShadow: '0 10px 25px rgba(37,99,235,.22)' }}>A</div>
          <h1 style={{ margin: '14px 0 4px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Welcome to AdLytic</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Marketing finance, in one workspace.</p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgotPassword : handleUpdatePassword} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 24, boxShadow: '0 18px 45px rgba(15,23,42,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#0f172a' }}><ShieldCheck size={17} color="#0284c7" />{mode === 'reset' ? 'Set a new password' : mode === 'forgot' ? 'Reset your password' : 'Sign in to your workspace'}</div>

          {mode !== 'reset' && <><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={inputStyle} /></>}

          {mode !== 'forgot' && <><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, marginTop: 16 }}>{mode === 'reset' ? 'New password' : 'Password'}</label><div style={inputWrap}><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'reset' ? 8 : undefined} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} placeholder={mode === 'reset' ? 'At least 8 characters' : 'Your password'} style={passwordInputStyle} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={eyeButtonStyle}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></>}

          {mode === 'reset' && <><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, marginTop: 16 }}>Confirm new password</label><div style={inputWrap}><input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Re-enter your new password" style={passwordInputStyle} /><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} style={eyeButtonStyle}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></>}

          {error && <div style={{ marginTop: 14, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#b91c1c' }}>{error}</div>}
          {message && <div style={{ marginTop: 14, border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#0369a1' }}>{message}</div>}

          <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 8, background: busy ? '#7dd3fc' : '#0ea5e9', color: '#fff', WebkitTextFillColor: '#fff', padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>{busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'reset' ? <ShieldCheck size={16} color="#fff" /> : <LogIn size={16} color="#fff" />}{busy ? 'Please wait…' : mode === 'reset' ? 'Update password' : mode === 'forgot' ? 'Send reset email' : 'Sign in'}</button>

          {mode === 'login' && <button type="button" onClick={() => { clearFeedback(); setMode('forgot'); }} style={{ width: '100%', marginTop: 12, border: 0, background: 'transparent', color: '#0284c7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Forgot password?</button>}
          {(mode === 'forgot' || mode === 'reset') && <button type="button" onClick={() => { clearFeedback(); setPassword(''); setConfirmPassword(''); setMode('login'); }} style={{ width: '100%', marginTop: 12, border: 0, background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Back to sign in</button>}
          <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11, color: '#64748b' }}>Your AdLytic account is secured by Supabase Authentication.</p>
        </form>
      </div>
    </div>
  );
}
