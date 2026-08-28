import React from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './src/lib/supabase.js';
import { recoverLedgerDataBeforeAppStarts } from './data-recovery-bootstrap.js';
import './index.css';
import './auth-fix.css';
import './auth-placeholder-fix.css';
import './settings-layout.css';

async function startAdLytic() {
  try {
    await supabase.auth.getSession();
    await recoverLedgerDataBeforeAppStarts();
  } catch (error) {
    console.error('AdLytic startup recovery failed', error);
  }

  const [{ default: AdLedgerApp }, { default: AuthGate }] = await Promise.all([
    import('./App.jsx'),
    import('./src/AuthGate.jsx'),
  ]);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthGate>
        <AdLedgerApp />
      </AuthGate>
    </React.StrictMode>
  );
}

startAdLytic();
