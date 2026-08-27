import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from './lib/supabase.js';

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8,
  border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a',
  WebkitTextFillColor: '#0f172a', padding: '11px 12px', fontSize: 14, outline: 'none',
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('login');

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

  const clearFeedback = () => { setError(''); setMessage(''); };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (signInError) setError(signInError.message || 'Unable to sign in. Please check your email and password.');
    setBusy(false);
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { business_name: businessName.trim() || 'AdLytic' },
      },
    });

    if (signUpError) {
      setError(signUpError.message || 'Unable to create your account.');
      setBusy(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');

    if (data.session) {
      setMessage('Account created successfully. Your AdLytic workspace is ready.');
    } else {
      setMode('login');
      setMessage('Account created. Check your email to confirm your account, then sign in.');
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl });
    if (resetError) setError(resetError.message || 'Unable to send the password reset email.');
    else setMessage('Password reset email sent. Check your inbox and use the newest reset link.');
    setBusy(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (password.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || 'Unable to update your password.');
      setBusy(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    if (typeof window !== 'undefined') window.history.replaceState({}, document.title, window.location.pathname);
    setSession(null);
    setPassword('');
    setConfirmPassword('');
    setMode('login');
    setMessage('Password updated successfully. Please sign in with your new password.');
    setBusy(false);
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
    return (
      <>
        {children}
        <style>{`.adl-shell header button:last-of-type{margin-right:56px!important}.adl-shell header{padding-right:4px!important}`}</style>
        <button
          type="button"
          onClick={() => {
            const el = Array.from(document.querySelectorAll('.adl-shell aside button, .adl-shell aside a')).find(
              (node) => node.textContent?.replace(/\s+/g, ' ').trim() === 'Settings'
            );
            if (el) el.click();
          }}
          aria-label="Open Settings" title="Settings"
          style={{ position:'fixed', top:14, right:14, zIndex:9999, width:38, height:38, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'1px solid #cbd5e1', borderRadius:8, background:'#fff', color:'#334155', boxShadow:'0 6px 18px rgba(15,23,42,.10)', cursor:'pointer' }}
        >
          <Settings2 size={17} />
        </button>
      </>
    );
  }

  const inputWrap = { position: 'relative' };
  const passwordInputStyle = { ...fieldStyle, paddingRight: 42 };
  const eyeButtonStyle = { position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', border:0, background:'transparent', color:'#64748b', padding:5, cursor:'pointer', display:'flex', alignItems:'center' };
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const formSubmit = isLogin ? handleLogin : isSignup ? handleSignUp : isForgot ? handleForgotPassword : handleUpdatePassword;
  const title = isReset ? 'Set a new password' : isForgot ? 'Reset your password' : isSignup ? 'Create your AdLytic account' : 'Sign in to your workspace';
  const subtitle = isSignup ? 'Set up your own secure workspace in minutes.' : 'Marketing finance, in one workspace.';
  const submitText = busy ? 'Please wait…' : isReset ? 'Update password' : isForgot ? 'Send reset email' : isSignup ? 'Create account' : 'Sign in';

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', color:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px', fontFamily:'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ margin:'0 auto', width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#38bdf8,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff', WebkitTextFillColor:'#fff', boxShadow:'0 10px 25px rgba(37,99,235,.22)' }}>A</div>
          <h1 style={{ margin:'14px 0 4px', fontSize:24, fontWeight:800, color:'#0f172a' }}>Welcome to AdLytic</h1>
          <p style={{ margin:0, fontSize:14, color:'#64748b' }}>{subtitle}</p>
        </div>

        <form onSubmit={formSubmit} style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:16, padding:24, boxShadow:'0 18px 45px rgba(15,23,42,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:700, marginBottom:20, color:'#0f172a' }}>
            {isSignup ? <UserRound size={17} color="#0284c7" /> : <ShieldCheck size={17} color="#0284c7" />}
            {title}
          </div>

          {!isReset && (
            <>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6 }}>Email</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={fieldStyle} />
            </>
          )}

          {isSignup && (
            <>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6, marginTop:16 }}>Workspace name <span style={{ color:'#94a3b8', fontWeight:400 }}>(optional)</span></label>
              <input type="text" value={businessName} onChange={(e)=>setBusinessName(e.target.value)} autoComplete="organization" placeholder="Your business or workspace" style={fieldStyle} />
            </>
          )}

          {!isForgot && (
            <>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6, marginTop:16 }}>{isReset ? 'New password' : 'Password'}</label>
              <div style={inputWrap}>
                <input type={showPassword ? 'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={(isSignup || isReset) ? 8 : undefined} autoComplete={(isSignup || isReset) ? 'new-password':'current-password'} placeholder={(isSignup || isReset) ? 'At least 8 characters':'Your password'} style={passwordInputStyle} />
                <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'Hide password':'Show password'} style={eyeButtonStyle}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </>
          )}

          {(isSignup || isReset) && (
            <>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6, marginTop:16 }}>{isReset ? 'Confirm new password':'Confirm password'}</label>
              <div style={inputWrap}>
                <input type={showConfirmPassword ? 'text':'password'} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Re-enter your password" style={passwordInputStyle} />
                <button type="button" onClick={()=>setShowConfirmPassword(v=>!v)} aria-label={showConfirmPassword ? 'Hide password':'Show password'} style={eyeButtonStyle}>{showConfirmPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </>
          )}

          {error && <div style={{ marginTop:14, border:'1px solid #fecaca', background:'#fef2f2', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#b91c1c' }}>{error}</div>}
          {message && <div style={{ marginTop:14, border:'1px solid #bae6fd', background:'#f0f9ff', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#0369a1' }}>{message}</div>}

          <button type="submit" disabled={busy} style={{ width:'100%', marginTop:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:0, borderRadius:8, background:busy ? '#7dd3fc':'#0ea5e9', color:'#fff', WebkitTextFillColor:'#fff', padding:'11px 16px', fontSize:14, fontWeight:700, cursor:busy?'not-allowed':'pointer' }}>
            {busy ? <Loader2 size={16} className="animate-spin"/> : isSignup ? <UserRound size={16} color="#fff"/> : <LogIn size={16} color="#fff"/>}
            {submitText}
          </button>

          {isLogin && <button type="button" onClick={()=>{clearFeedback();setMode('forgot')}} style={{ width:'100%', marginTop:12, border:0, background:'transparent', color:'#0284c7', fontSize:12, fontWeight:700, cursor:'pointer' }}>Forgot password?</button>}

          {(isForgot || isReset) && <button type="button" onClick={()=>{clearFeedback();setPassword('');setConfirmPassword('');setMode('login')}} style={{ width:'100%', marginTop:12, border:0, background:'transparent', color:'#64748b', fontSize:12, fontWeight:600, cursor:'pointer' }}>Back to sign in</button>}

          {isLogin && (
            <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid #e2e8f0', textAlign:'center' }}>
              <span style={{ fontSize:12, color:'#64748b' }}>New to AdLytic?</span>
              <button type="button" onClick={()=>{clearFeedback();setMode('signup')}} style={{ marginLeft:5, border:0, background:'transparent', color:'#0284c7', fontSize:12, fontWeight:800, cursor:'pointer' }}>Create account</button>
            </div>
          )}

          {isSignup && (
            <button type="button" onClick={()=>{clearFeedback();setPassword('');setConfirmPassword('');setMode('login')}} style={{ width:'100%', marginTop:12, border:0, background:'transparent', color:'#64748b', fontSize:12, fontWeight:600, cursor:'pointer' }}>Already have an account? Sign in</button>
          )}

          <p style={{ margin:'14px 0 0', textAlign:'center', fontSize:11, color:'#64748b' }}>Your AdLytic account is secured by Supabase Authentication.</p>
        </form>
      </div>
    </div>
  );
}
