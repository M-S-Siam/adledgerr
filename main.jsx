import React from 'react';
import ReactDOM from 'react-dom/client';
import AdLedgerApp from './App.jsx';
import AuthGate from './src/AuthGate.jsx';
import { recoverLedgerDataBeforeAppStarts } from './data-recovery-bootstrap.js';
import './index.css';
import './auth-fix.css';
import './auth-placeholder-fix.css';
import './settings-layout.css';

recoverLedgerDataBeforeAppStarts().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthGate>
        <AdLedgerApp />
      </AuthGate>
    </React.StrictMode>
  );
});
