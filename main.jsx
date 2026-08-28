import React from 'react';
import ReactDOM from 'react-dom/client';
import AdLedgerApp from './App.jsx';
import AuthGate from './src/AuthGate.jsx';
import './index.css';
import './auth-fix.css';
import './auth-placeholder-fix.css';
import './settings-layout.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      <AdLedgerApp />
    </AuthGate>
  </React.StrictMode>
);

