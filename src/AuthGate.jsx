import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, LockKeyhole, Mail, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from './lib/supabase.js';

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', borderRadius: 11,
  border: '1px solid rgba(148,163,184,.38)', background: 'rgba(241,245,249,.88)', color: '#334155',
  WebkitTextFillColor: '#334155', padding: '12px 12px 12px 40px', fontSize: 14, outline: 'none',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', transition: 'border-color .2s, box-shadow .2s',
};

function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const label = score <= 2 ? 'Low' : score === 3 ? 'Good' : score === 4 ? 'Strong' : 'Very strong';
  const width = `${Math.max(12, score * 20)}%`;
  const tone = score <= 2 ? '#ef4444' : score === 3 ? '#f59e0b' : '#16a34a';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:10.5, color:'#e6f0f8' }}>Password strength</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:tone }}>{label}</span>
      </div>
      <div style={{ height:4, borderRadius:99, background:'rgba(255,255,255,.18)', overflow:'hidden' }}>
        <div style={{ height:'100%', width, background:tone, borderRadius:99, transition:'width .2s, background .2s' }} />
      </div>
      <div style={{ marginTop:6, fontSize:10.5, lineHeight:1.45, color:'rgba(230,240,248,.78)' }}>Use 8+ characters with uppercase, lowercase, number and symbol for a stronger password.</div>
    </div>
  );
}

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

    // Safety timeout: Never stay stuck on loading screen
    const timeoutId = setTimeout(() => {
      if (mounted) setChecking(false);
    }, 1200);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        setSession(data?.session ?? null);
        setChecking(false);
      })
      .catch(() => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        setChecking(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const clearFeedback = () => { setError(''); setMessage(''); };

  const handleLogin = async (event) => {
    event.preventDefault(); clearFeedback(); setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message || 'Unable to sign in. Please check your email and password.');
    setBusy(false);
  };

  const handleSignUp = async (event) => {
    event.preventDefault(); clearFeedback();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('For a strong password, use uppercase, lowercase, a number and a symbol.'); return;
    }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: redirectUrl, data: { business_name: businessName.trim() || 'AdLytic' } },
    });
    if (signUpError) { setError(signUpError.message || 'Unable to create your account.'); setBusy(false); return; }
    setPassword(''); setConfirmPassword('');
    if (data.session) setMessage('Account created successfully. Your AdLytic workspace is ready.');
    else { setMode('login'); setMessage('Account created. Check your email to confirm your account, then sign in.'); }
    setBusy(false);
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault(); clearFeedback();
    if (!email.trim()) { setError('Enter your account email first.'); return; }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl });
    if (resetError) setError(resetError.message || 'Unable to send the password reset email.');
    else setMessage('Password reset email sent. Check your inbox and use the newest reset link.');
    setBusy(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault(); clearFeedback();
    if (password.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message || 'Unable to update your password.'); setBusy(false); return; }
    await supabase.auth.signOut({ scope: 'local' });
    if (typeof window !== 'undefined') window.history.replaceState({}, document.title, window.location.pathname);
    setSession(null); setPassword(''); setConfirmPassword(''); setMode('login');
    setMessage('Password updated successfully. Please sign in with your new password.'); setBusy(false);
  };

  if (checking) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07111f', color:'#fff', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14 }}><Loader2 size={17} color="#38bdf8" className="animate-spin" /> Loading AdLytic…</div>
    </div>
  );

  if (session && mode !== 'reset') return (
    <>
      {children}
      <style>{`.adl-shell header button:last-of-type{margin-right:56px!important}.adl-shell header{padding-right:4px!important}`}</style>
      <button type="button" onClick={() => { const el = Array.from(document.querySelectorAll('.adl-shell aside button, .adl-shell aside a')).find((node) => node.textContent?.replace(/\s+/g, ' ').trim() === 'Settings'); if (el) el.click(); }} aria-label="Open Settings" title="Settings" style={{ position:'fixed', top:14, right:14, zIndex:9999, width:38, height:38, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'1px solid #cbd5e1', borderRadius:8, background:'#fff', color:'#334155', boxShadow:'0 6px 18px rgba(15,23,42,.10)', cursor:'pointer' }}><Settings2 size={17} /></button>
    </>
  );

  const isLogin = mode === 'login', isSignup = mode === 'signup', isForgot = mode === 'forgot', isReset = mode === 'reset';
  const formSubmit = isLogin ? handleLogin : isSignup ? handleSignUp : isForgot ? handleForgotPassword : handleUpdatePassword;
  const title = isReset ? 'Reset password' : isForgot ? 'Reset password' : isSignup ? 'Create account' : 'Login';
  const subtitle = isSignup ? 'Create your secure AdLytic workspace.' : isReset ? 'Set a new password for your account.' : isForgot ? 'We’ll send a secure reset link to your email.' : 'Sign in to continue to your workspace.';
  const submitText = busy ? 'Please wait…' : isReset ? 'Update password' : isForgot ? 'Send reset email' : isSignup ? 'Create account' : 'Login';
  const passwordPlaceholder = (isSignup || isReset) ? 'Create a strong password' : 'Enter your password';

  const inputWithIcon = () => ({ position:'relative' });
  const iconStyle = { position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#64748b', pointerEvents:'none' };
  const eyeButtonStyle = { position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', border:0, background:'transparent', color:'#64748b', padding:6, cursor:'pointer', display:'flex', alignItems:'center', borderRadius:7 };
  const labelStyle = { display:'block', fontSize:11.5, fontWeight:650, color:'#ffffff', marginBottom:6 };
  const placeholderStyle = { ...fieldStyle, background:'rgba(248,250,252,.94)', color:'#334155', WebkitTextFillColor:'#334155' };

  return (
    <div className="adl-auth-page" style={{ minHeight:'100dvh', width:'100%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding:'18px 14px', position:'relative', fontFamily:'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color:'#0f172a', background:'radial-gradient(circle at 15% 20%, rgba(14,165,233,.30), transparent 32%), radial-gradient(circle at 85% 15%, rgba(99,102,241,.28), transparent 30%), radial-gradient(circle at 70% 90%, rgba(56,189,248,.18), transparent 34%), linear-gradient(135deg,#07111f 0%,#0b1830 48%,#10172b 100%)' }}>
      <div aria-hidden="true" style={{ position:'absolute', inset:0, background:'linear-gradient(120deg,rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(30deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize:'44px 44px', opacity:.55 }} />
      <style>{`.adl-auth-input::placeholder{color:#334155!important;opacity:1!important;-webkit-text-fill-color:#334155!important}.adl-auth-input::-webkit-input-placeholder{color:#334155!important;opacity:1!important;-webkit-text-fill-color:#334155!important}.adl-auth-input:focus{border-color:rgba(14,165,233,.65)!important;box-shadow:0 0 0 3px rgba(14,165,233,.12)!important}`}</style>

      <form onSubmit={formSubmit} style={{ position:'relative', zIndex:1, width:'100%', maxWidth:430, maxHeight:'calc(100dvh - 28px)', overflowY:'auto', background:'rgba(255,255,255,.88)', border:'1px solid rgba(255,255,255,.68)', borderRadius:22, padding:'22px 22px 18px', boxShadow:'0 28px 80px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.8)', backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)' }}>
        <div style={{ textAlign:'center', marginBottom:18 }}>
          <div style={{ margin:'0 auto', width:52, height:52, borderRadius:15, background:'linear-gradient(135deg,#38bdf8,#2563eb 70%,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:23, fontWeight:850, color:'#fff', WebkitTextFillColor:'#fff', boxShadow:'0 12px 30px rgba(37,99,235,.28)', border:'1px solid rgba(255,255,255,.65)' }}>A</div>
          <div style={{ marginTop:11, fontSize:22, lineHeight:1.15, fontWeight:500, color:'#0f172a' }}>Welcome to <strong style={{ fontWeight:850, color:'#2563eb' }}>AdLytic</strong></div>
          <div style={{ marginTop:6, fontSize:11.5, color:'#ffffff' }}>{subtitle}</div>
        </div>

        <div style={{ padding:'16px 15px 15px', borderRadius:16, background:'rgba(255,255,255,.58)', border:'1px solid rgba(148,163,184,.25)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, fontSize:16, fontWeight:800, color:'#0f172a' }}>
            {isSignup ? <UserRound size={17} color="#0284c7" /> : <ShieldCheck size={17} color="#0284c7" />}
            {title}
          </div>
          <div style={{ height:1, background:'rgba(148,163,184,.20)', margin:'0 0 15px' }} />

          {!isReset && (
            <>
              <label style={labelStyle}>Email</label>
              <div style={inputWithIcon()}><Mail size={16} style={iconStyle} /><input className="adl-auth-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoComplete="email" placeholder="Enter your email address" style={placeholderStyle} /></div>
            </>
          )}

          {isSignup && (
            <>
              <label style={{ ...labelStyle, marginTop:13 }}>Workspace name <span style={{ color:'rgba(255,255,255,.62)', fontWeight:400 }}>(optional)</span></label>
              <input className="adl-auth-input" type="text" value={businessName} onChange={(e)=>setBusinessName(e.target.value)} autoComplete="organization" placeholder="Your business or workspace" style={{ ...fieldStyle, paddingLeft:12 }} />
            </>
          )}

          {!isForgot && (
            <>
              <label style={{ ...labelStyle, marginTop:13 }}>{isReset ? 'New password' : 'Password'}</label>
              <div style={inputWithIcon()}><LockKeyhole size={16} style={iconStyle} /><input className="adl-auth-input" type={showPassword ? 'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={(isSignup || isReset) ? 8 : undefined} autoComplete={(isSignup || isReset) ? 'new-password':'current-password'} placeholder={passwordPlaceholder} style={placeholderStyle} /><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'Hide password':'Show password'} style={eyeButtonStyle}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
              {isLogin && <button type="button" onClick={()=>{clearFeedback();setMode('forgot')}} style={{ display:'block', marginTop:8, marginLeft:'auto', border:0, background:'transparent', color:'#0ea5e9', fontSize:11.5, fontWeight:700, cursor:'pointer', padding:0 }}>Forgot password?</button>}
              {isSignup && <PasswordStrength password={password} />}
            </>
          )}

          {(isSignup || isReset) && (
            <>
              <label style={{ ...labelStyle, marginTop:13 }}>{isReset ? 'Confirm new password':'Confirm password'}</label>
              <div style={inputWithIcon()}><LockKeyhole size={16} style={iconStyle} /><input className="adl-auth-input" type={showConfirmPassword ? 'text':'password'} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Re-enter your password" style={placeholderStyle} /><button type="button" onClick={()=>setShowConfirmPassword(v=>!v)} aria-label={showConfirmPassword ? 'Hide password':'Show password'} style={eyeButtonStyle}>{showConfirmPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
            </>
          )}

          {error && <div style={{ marginTop:12, border:'1px solid #fecaca', background:'rgba(254,242,242,.88)', borderRadius:9, padding:'9px 10px', fontSize:11.5, lineHeight:1.4, color:'#b91c1c' }}>{error}</div>}
          {message && <div style={{ marginTop:12, border:'1px solid #bae6fd', background:'rgba(240,249,255,.9)', borderRadius:9, padding:'9px 10px', fontSize:11.5, lineHeight:1.4, color:'#0369a1' }}>{message}</div>}

          <button type="submit" disabled={busy} style={{ width:'100%', marginTop:16, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:0, borderRadius:10, background:busy ? '#7dd3fc':'linear-gradient(135deg,#0ea5e9,#2563eb)', color:'#fff', WebkitTextFillColor:'#fff', padding:'12px 16px', fontSize:13.5, fontWeight:800, cursor:busy?'not-allowed':'pointer', boxShadow:'0 9px 22px rgba(37,99,235,.22)' }}>{busy ? <Loader2 size={16} className="animate-spin"/> : isSignup ? <UserRound size={16} color="#fff"/> : <LogIn size={16} color="#fff"/>}{submitText}</button>

          {(isForgot || isReset) && <button type="button" onClick={()=>{clearFeedback();setPassword('');setConfirmPassword('');setMode('login')}} style={{ width:'100%', marginTop:11, border:0, background:'transparent', color:'rgba(255,255,255,.80)', fontSize:11.5, fontWeight:650, cursor:'pointer' }}>Back to Login</button>}

          {isLogin && <div style={{ marginTop:14, paddingTop:13, borderTop:'1px solid rgba(255,255,255,.20)', textAlign:'center' }}><span style={{ fontSize:11.5, color:'rgba(255,255,255,.86)' }}>New to AdLytic?</span><button type="button" onClick={()=>{clearFeedback();setMode('signup')}} style={{ marginLeft:5, border:0, background:'transparent', color:'#38bdf8', fontSize:11.5, fontWeight:850, cursor:'pointer' }}>Create account</button></div>}
          {isSignup && <div style={{ marginTop:14, paddingTop:13, borderTop:'1px solid rgba(255,255,255,.20)', textAlign:'center' }}><span style={{ fontSize:11.5, color:'rgba(255,255,255,.86)' }}>Already have an account?</span><button type="button" onClick={()=>{clearFeedback();setPassword('');setConfirmPassword('');setMode('login')}} style={{ marginLeft:5, border:0, background:'transparent', color:'#38bdf8', fontSize:11.5, fontWeight:850, cursor:'pointer' }}>Sign in</button></div>}

          <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:10, color:'rgba(255,255,255,.72)' }}><ShieldCheck size={12} /> Secure account authentication</div>
        </div>
      </form>
    </div>
  );
}