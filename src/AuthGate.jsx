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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message || 'Unable to sign in. Please check your email and password.');
    setBusy(false);
  };

  if (checking) {
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',color:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}><div style={{fontSize:14}}>Loading AdLytic…</div></div>;
  }
  if (session) return children;

  const inputStyle = { width:'100%', boxSizing:'border-box', borderRadius:8, border:'1px solid #cbd5e1', background:'#fff', color:'#0f172a', WebkitTextFillColor:'#0f172a', padding:'11px 12px', fontSize:14, outline:'none', opacity:1 };

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',color:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 16px',fontFamily:'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{margin:'0 auto',width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,#38bdf8,#2563eb)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,color:'#fff',WebkitTextFillColor:'#fff',boxShadow:'0 10px 25px rgba(37,99,235,.22)'}}>A</div>
          <h1 style={{margin:'14px 0 4px',fontSize:24,fontWeight:800,color:'#0f172a'}}>Welcome to AdLytic</h1>
          <p style={{margin:0,fontSize:14,color:'#64748b'}}>Marketing finance, in one workspace.</p>
        </div>
        <form onSubmit={handleLogin} style={{background:'#fff',border:'1px solid #cbd5e1',borderRadius:16,padding:24,boxShadow:'0 18px 45px rgba(15,23,42,.12)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700,marginBottom:20,color:'#0f172a'}}><ShieldCheck size={17} color="#0284c7" />Sign in to your workspace</div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6}}>Email</label>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={inputStyle}/>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#475569',marginBottom:6,marginTop:16}}>Password</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password" style={inputStyle}/>
          {error && <div style={{marginTop:14,border:'1px solid #fecaca',background:'#fef2f2',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#b91c1c'}}>{error}</div>}
          <button type="submit" disabled={busy} style={{width:'100%',marginTop:20,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:0,borderRadius:8,background:busy?'#7dd3fc':'#0ea5e9',color:'#fff',WebkitTextFillColor:'#fff',padding:'11px 16px',fontSize:14,fontWeight:700,cursor:busy?'not-allowed':'pointer'}}>{busy?<Loader2 size={16} className="animate-spin"/>:<LogIn size={16} color="#fff"/>}{busy?'Signing in…':'Sign in'}</button>
          <p style={{margin:'14px 0 0',textAlign:'center',fontSize:11,color:'#64748b'}}>Your AdLytic account is secured by Supabase Authentication.</p>
        </form>
      </div>
    </div>
  );
}
