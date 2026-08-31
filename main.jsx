import React from 'react';
import ReactDOM from 'react-dom/client';
import AdLedgerApp from './App.jsx';
import AuthGate from './src/AuthGate.jsx';
import './index.css';
import './auth-fix.css';
import './auth-placeholder-fix.css';
import './settings-layout.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App Error caught by ErrorBoundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#081c2e', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '24px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px', color: '#fff' }}>Quantrex Financial Command</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: '1.5' }}>A runtime reload is ready to sync the latest financial ledger updates.</p>
            <button
              onClick={() => { window.location.reload(); }}
              style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', width: '100%', boxShadow: '0 8px 20px rgba(14,165,233,0.3)' }}
            >
              🔄 Reload & Open Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <AdLedgerApp />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>
);

