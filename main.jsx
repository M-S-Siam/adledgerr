import React from 'react';
import ReactDOM from 'react-dom/client';
import AdLedgerApp from './App.jsx';
import AuthGate from './src/AuthGate.jsx';
import CloudSyncGate from './src/CloudSyncGate.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      <CloudSyncGate>
        <AdLedgerApp />
      </CloudSyncGate>
    </AuthGate>
  </React.StrictMode>
);
