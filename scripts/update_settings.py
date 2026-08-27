from pathlib import Path
import re
import subprocess

app_path = Path('App.jsx')
auth_path = Path('src/AuthGate.jsx')
app = app_path.read_text(encoding='utf-8')
auth = auth_path.read_text(encoding='utf-8')

if "import { supabase } from './src/lib/supabase.js';" not in app:
    marker = "} from 'lucide-react';\n"
    if marker not in app:
        raise SystemExit('App import marker not found')
    app = app.replace(marker, marker + "import { supabase } from './src/lib/supabase.js';\n", 1)

if 'function AccountSecuritySettings()' not in app:
    component = r'''

// --- ACCOUNT & SECURITY (INTEGRATED INTO SETTINGS) ---
function AccountSecuritySettings() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('account');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSession(data?.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => mounted && setSession(nextSession || null));
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);
  const clearFeedback = () => { setError(''); setMessage(''); };
  const primary = { border: 0, borderRadius: 9, padding: '10px 14px', background: '#0ea5e9', color: '#fff', fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .65 : 1 };
  const secondary = { border: '1px solid #cfe0ea', borderRadius: 9, padding: '9px 12px', background: '#fff', color: '#24536d', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' };
  const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #cfe0ea', borderRadius: 10, padding: '11px 12px', fontSize: 13, color: '#0f2940', background: '#fff', outline: 'none' };
  const tabs = (active) => ({ border: 0, borderRadius: 9, padding: '9px 12px', background: active ? '#e0f5fd' : 'transparent', color: active ? '#0369a1' : '#587188', fontSize: 12, fontWeight: 800, cursor: 'pointer' });
  const changePassword = async (event) => {
    event.preventDefault(); clearFeedback();
    const email = session?.user?.email || '';
    if (!email) return setError('Your authenticated email could not be found.');
    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('New passwords do not match.');
    if (currentPassword === newPassword) return setError('Your new password must be different from the current password.');
    setBusy(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) { setError('Current password is incorrect.'); setBusy(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) { setError(updateError.message || 'Unable to change your password.'); setBusy(false); return; }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password changed successfully.'); setBusy(false);
  };
  const sendReset = async () => {
    clearFeedback(); const email = session?.user?.email || '';
    if (!email) return setError('Your authenticated email could not be found.');
    setBusy(true);
    const redirectTo = typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (resetError) setError(resetError.message || 'Unable to send the reset email.'); else setMessage('Password reset email sent to your account email.');
    setBusy(false);
  };
  const signOutOthers = async () => {
    clearFeedback(); setBusy(true);
    const { error: e } = await supabase.auth.signOut({ scope: 'others' });
    if (e) setError(e.message || 'Unable to sign out other sessions.'); else setMessage('All other active sessions have been signed out.');
    setBusy(false);
  };
  const signOutAll = async () => {
    clearFeedback(); setBusy(true);
    const { error: e } = await supabase.auth.signOut();
    if (e) setError(e.message || 'Unable to sign out.');
    setBusy(false);
  };
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" style={{ marginTop: 18 }}>
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4"><div><h2 className="text-base font-bold text-slate-900">Account &amp; Security</h2><p className="text-xs text-slate-500 mt-1">Manage your AdLytic account, password and active sessions.</p></div><ShieldCheck size={20} className="text-sky-600" /></div>
      <div className="px-4 pt-3 flex flex-wrap gap-2 border-b border-slate-200"><button type="button" onClick={() => { clearFeedback(); setTab('account'); }} style={tabs(tab === 'account')}>Account</button><button type="button" onClick={() => { clearFeedback(); setTab('security'); }} style={tabs(tab === 'security')}>Security</button><button type="button" onClick={() => { clearFeedback(); setTab('sessions'); }} style={tabs(tab === 'sessions')}>Sessions</button></div>
      <div className="p-5">
        {error && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', fontSize: 12 }}>{error}</div>}
        {message && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 12 }}>{message}</div>}
        {tab === 'account' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-bold text-slate-900">Account information</div><div className="text-xs text-slate-500 mt-1">Your authenticated AdLytic identity.</div><div className="mt-4 space-y-3"><div><div className="text-[10px] font-bold text-slate-500 mb-1">EMAIL</div><div style={{ ...input, background: '#f8fafc' }}>{session?.user?.email || 'Loading...'}</div></div><div><div className="text-[10px] font-bold text-slate-500 mb-1">USER ID</div><div style={{ ...input, background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.id || 'Loading...'}</div></div><div><div className="text-[10px] font-bold text-slate-500 mb-1">AUTHENTICATION</div><div className="text-sm font-semibold text-emerald-700">Email + password</div></div></div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-bold text-slate-900">Password recovery</div><div className="text-xs text-slate-500 mt-1">Send a secure password reset link to your account email.</div><button type="button" onClick={sendReset} disabled={busy} style={{ ...primary, marginTop: 18 }}>Send reset email</button></div></div>}
        {tab === 'security' && <form onSubmit={changePassword} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-bold text-slate-900">Change password</div><div className="text-xs text-slate-500 mt-1">Verify your current password before setting a new one.</div><div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4"><label className="text-xs font-semibold text-slate-600">Current password<div className="relative mt-1"><input style={{ ...input, paddingRight: 60 }} type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /><button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: 'absolute', right: 7, top: 8, border: 0, background: 'transparent', color: '#0369a1', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{showCurrent ? 'Hide' : 'Show'}</button></div></label><label className="text-xs font-semibold text-slate-600">New password<div className="relative mt-1"><input style={{ ...input, paddingRight: 60 }} type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: 7, top: 8, border: 0, background: 'transparent', color: '#0369a1', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{showNew ? 'Hide' : 'Show'}</button></div></label><label className="text-xs font-semibold text-slate-600">Confirm password<div className="relative mt-1"><input style={{ ...input, paddingRight: 60 }} type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 7, top: 8, border: 0, background: 'transparent', color: '#0369a1', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{showConfirm ? 'Hide' : 'Show'}</button></div></label></div><div className="mt-4 flex items-center justify-between gap-3 flex-wrap"><span className="text-[11px] text-slate-500">Use at least 8 characters for your new password.</span><button type="submit" disabled={busy} style={primary}>{busy ? 'Updating...' : 'Update password'}</button></div></form>}
        {tab === 'sessions' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-bold text-slate-900">Current session</div><div className="text-xs text-slate-500 mt-1">This browser is currently authenticated.</div><div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active</div><button type="button" onClick={signOutAll} disabled={busy} style={{ ...secondary, marginTop: 14 }}>Log out everywhere</button></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-bold text-slate-900">Other sessions</div><div className="text-xs text-slate-500 mt-1">Invalidate all other active sessions while keeping this one signed in.</div><button type="button" onClick={signOutOthers} disabled={busy} style={{ ...secondary, marginTop: 18 }}>Sign out other devices</button></div></div>}
      </div>
    </section>
  );
}
'''
    marker = '\nfunction SettingsView('
    if marker not in app:
        raise SystemExit('SettingsView marker not found')
    app = app.replace(marker, component + marker, 1)

if '<AccountSecuritySettings />' not in app:
    m = re.search(r'(function SettingsView\([\s\S]*?return \(\s*<div[^>]*>)', app)
    if not m:
        raise SystemExit('SettingsView root container not found')
    app = app[:m.start()] + m.group(1) + '\n      <AccountSecuritySettings />' + app[m.end():]

app_path.write_text(app, encoding='utf-8')

listener_start = auth.find('  // The main application already has a Settings item in its sidebar.')
if listener_start != -1:
    listener_end = auth.find('  const clearFeedback', listener_start)
    if listener_end == -1:
        raise SystemExit('AuthGate listener end not found')
    auth = auth[:listener_start] + '  // Account & security is integrated into the main Settings page.\n\n' + auth[listener_end:]

auth = re.sub(r'\n        \{settingsOpen && \([\s\S]*?\n        \)\}\n', '\n', auth, count=1)
button_re = re.compile(r'\n        <button\n          type="button"\n          onClick=\{\(\) => \{\n            clearSettingsFeedback\(\);\n            setSettingsSection\(\'account\'\);\n            setSettingsOpen\(true\);\n          \}\}\n          aria-label="Open account settings"[\s\S]*?\n        </button>\n')
button_replacement = '''
        <style>{` .adl-shell header button:last-of-type{margin-right:56px!important;} .adl-shell header{padding-right:4px!important;} `}</style>
        <button type="button" onClick={() => { const el = Array.from(document.querySelectorAll('.adl-shell aside button, .adl-shell aside a')).find((node) => node.textContent?.replace(/\\s+/g, ' ').trim() === 'Settings'); if (el) el.click(); }} aria-label="Open Settings" title="Settings" style={{ position: 'fixed', top: 14, right: 14, zIndex: 9999, width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: 8, background: '#ffffff', color: '#334155', boxShadow: '0 6px 18px rgba(15,23,42,.10)', cursor: 'pointer' }}>
          <Settings2 size={17} />
        </button>
'''
if not button_re.search(auth):
    raise SystemExit('AuthGate settings button block not found')
auth = button_re.sub(lambda _match: button_replacement, auth, count=1)
auth_path.write_text(auth, encoding='utf-8')

for p in ['.github/workflows/ui-settings-fix.yml', '.github/workflows/ui-settings-fix2.yml', 'scripts/update_settings.py']:
    path = Path(p)
    if path.exists():
        path.unlink()

subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', 'add', 'App.jsx', 'src/AuthGate.jsx', '.github/workflows/deploy.yml'], check=True)
subprocess.run(['git', 'add', '-u'], check=True)
subprocess.run(['git', 'diff', '--cached', '--check'], check=True)
subprocess.run(['git', 'commit', '-m', 'Integrate account security into settings [skip ci]'], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('Focused settings update committed and pushed.')
