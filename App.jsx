import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, CreditCard, DollarSign, 
  Activity, FileText, Settings, Plus, Search, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, 
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, Trash2
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertCircle size={48} className="text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Something went wrong.</h1>
          <p className="text-slate-600 max-w-md mb-6">A corrupted data state caused the application to crash. This typically happens when older saved data formats conflict with new updates.</p>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 max-w-2xl w-full text-left overflow-auto text-sm text-red-600 font-mono">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('adledger_data_version');
              localStorage.removeItem('adledger_clients');
              localStorage.removeItem('adledger_cards');
              localStorage.removeItem('adledger_transactions');
              window.location.reload();
            }}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
          >
            Clear Corrupted Data & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- CUSTOM HOOK FOR LOCAL STORAGE PERSISTENCE ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };
  return [storedValue, setValue];
}

// --- UTILITIES ---
const formatBDT = (amount) => {
  const num = parseFloat(amount || 0);
  if (Math.abs(num) < 0.005) return '৳0.00';
  return `৳${num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const formatUSD = (amount) => {
  const num = parseFloat(amount || 0);
  if (Math.abs(num) < 0.005) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// --- MAIN APPLICATION COMPONENT ---
function AdLedgerMain() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [clients, setClients] = useLocalStorage('adledger_clients', []);
  const [cards, setCards] = useLocalStorage('adledger_cards', []);
  const [transactions, setTransactions] = useLocalStorage('adledger_transactions', []);
  
  // Modal State
  const [activeModal, setActiveModal] = useState(null); 
  const [selectedItem, setSelectedItem] = useState(null); 

  // Version Migration / Initial Wipe Check
  useEffect(() => {
    const CURRENT_VERSION = "3";
    const savedVersion = localStorage.getItem('adledger_data_version');
    
    if (savedVersion !== CURRENT_VERSION) {
      // Purge old demo data
      setClients([]);
      setCards([]);
      setTransactions([]);
      localStorage.setItem('adledger_data_version', CURRENT_VERSION);
    }
  }, [setClients, setCards, setTransactions]);

  // Clean empty AD_SPEND transactions safely
  useEffect(() => {
    setTransactions(prev => {
      if (!Array.isArray(prev)) return [];
      const clean = prev.filter(t => {
        if (t.type === 'AD_SPEND') {
          return (parseFloat(t.amountUSD || 0) > 0.005 || parseFloat(t.taxUSD || 0) > 0.005);
        }
        return true;
      });
      return clean.length !== prev.length ? clean : prev;
    });
  }, [setTransactions]);

  // --- FINANCIAL CALCULATIONS ---
  const metrics = useMemo(() => {
    let totalRevenueBDT = 0;
    let totalUSDPurchased = 0;
    let totalBDTSpentOnUSD = 0;
    let totalCashOutCharges = 0;
    let totalAdSpendUSD = 0;
    let totalTaxUSD = 0;
    
    let cardBalances = {};
    let cardStats = {}; 
    
    (cards || []).forEach(c => {
      cardBalances[c.id] = parseFloat(c.initialBalance || 0);
      cardStats[c.id] = { purchased: 0, spent: 0, tax: 0, fees: 0 };
    });

    (transactions || []).forEach(t => {
      if (t.type === 'PAYMENT_RECEIVED') totalRevenueBDT += parseFloat(t.amountBDT || 0);
      
      if (t.type === 'USD_PURCHASE') {
        const usdRec = parseFloat(t.amountUSD || 0);
        totalUSDPurchased += usdRec;
        totalBDTSpentOnUSD += parseFloat(t.amountBDT || 0);
        totalCashOutCharges += parseFloat(t.cashOutCharge || 0);
        
        if (t.cardId && cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] += usdRec;
          cardStats[t.cardId].purchased += usdRec;
        }
      }
      
      if (t.type === 'AD_SPEND') {
        const spend = parseFloat(t.amountUSD || 0);
        const tax = parseFloat(t.taxUSD || 0);
        
        totalAdSpendUSD += spend;
        totalTaxUSD += tax;
        
        if (t.cardId && cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] -= (spend + tax);
          cardStats[t.cardId].spent += spend;
          cardStats[t.cardId].tax += tax;
        }
      }
    });

    const totalBDTCostOfUSD = totalBDTSpentOnUSD + totalCashOutCharges;
    const avgUSDEffectiveRate = totalUSDPurchased > 0.005 ? (totalBDTCostOfUSD / totalUSDPurchased) : 0; 
    
    const totalAdCostBDT = (totalAdSpendUSD + totalTaxUSD) * avgUSDEffectiveRate;
    const netProfitBDT = totalRevenueBDT - totalAdCostBDT;
    const profitMargin = totalRevenueBDT > 0.005 ? (netProfitBDT / totalRevenueBDT) * 100 : 0;
    
    // Sum of all individual card balances
    const totalCardBalance = Object.values(cardBalances).reduce((sum, val) => sum + val, 0);

    return {
      totalRevenueBDT,
      totalUSDPurchased,
      avgUSDEffectiveRate,
      totalAdSpendUSD,
      totalTaxUSD,
      netProfitBDT,
      profitMargin,
      cardBalances,
      cardStats,
      totalCardBalance
    };
  }, [transactions, cards]);

  const revenueChartData = useMemo(() => {
    const grouped = (transactions || []).filter(t => t.type === 'PAYMENT_RECEIVED' || t.type === 'AD_SPEND').reduce((acc, t) => {
      if (!t.date) return acc;
      const d = t.date.substring(5);
      if (!acc[d]) acc[d] = { date: d, revenue: 0, spendUSD: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += parseFloat(t.amountBDT || 0);
      if (t.type === 'AD_SPEND') acc[d].spendUSD += (parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0));
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);


  // --- HANDLERS ---
  const handleAddTransaction = (newTx) => {
    const tx = { ...newTx, id: `t${Date.now()}`, createdAt: new Date().toISOString() };
    setTransactions(prev => [tx, ...(prev || [])]);
    setActiveModal(null);
  };

  const handleDeleteCard = (cardId) => {
    setCards(prev => (prev || []).filter(c => c.id !== cardId));
  };

  const handleSaveCard = (cardData) => {
    if (activeModal === 'edit-card') {
      setCards(prev => (prev || []).map(c => c.id === cardData.id ? cardData : c));
    } else {
      setCards(prev => [...(prev || []), { ...cardData, id: `card_${Date.now()}`, status: 'Active' }]);
    }
    setActiveModal(null);
  };

  const handleSaveClient = (clientData) => {
    if (activeModal === 'edit-client') {
      setClients(prev => (prev || []).map(c => c.id === clientData.id ? clientData : c));
    } else {
      setClients(prev => [...(prev || []), { ...clientData, id: `client_${Date.now()}` }]);
    }
    setActiveModal(null);
  };

  // --- RENDERERS ---
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} />;
      case 'clients': 
        return <ClientsView 
                  clients={clients} 
                  transactions={transactions} 
                  metrics={metrics}
                  onAddClient={() => {setSelectedItem(null); setActiveModal('add-client');}}
                  onEditClient={(c) => {setSelectedItem(c); setActiveModal('edit-client');}}
                  onViewDetails={(c) => {setSelectedItem(c); setActiveModal('client-details');}}
                />;
      case 'ledger': return <LedgerView transactions={transactions} clients={clients} cards={cards} />;
      case 'cards': 
        return <CardsView 
                  cards={cards} 
                  metrics={metrics} 
                  transactions={transactions} 
                  onAddCard={() => {setSelectedItem(null); setActiveModal('add-card');}}
                  onEditCard={(c) => {setSelectedItem(c); setActiveModal('edit-card');}}
                  onDeleteCard={handleDeleteCard}
                  onViewDetails={(c) => {setSelectedItem(c); setActiveModal('card-details');}}
                />;
      default: return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:flex flex-col`}>
        <div className="p-6 flex items-center justify-between md:justify-center border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-lg">A</div>
            <span className="text-xl font-bold tracking-tight">AdLedger</span>
          </div>
          <button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => {setCurrentView('dashboard'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Users />} label="Clients" isActive={currentView === 'clients'} onClick={() => {setCurrentView('clients'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Activity />} label="Transaction Ledger" isActive={currentView === 'ledger'} onClick={() => {setCurrentView('ledger'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<CreditCard />} label="Cards & USD" isActive={currentView === 'cards'} onClick={() => {setCurrentView('cards'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<PieChart />} label="Reports" isActive={currentView === 'reports'} onClick={() => {}} />
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 mr-4">
              <span className="text-xs font-medium text-slate-500 uppercase">Avg USD Rate:</span>
              <span className="text-sm font-bold text-slate-800">{formatBDT(metrics.avgUSDEffectiveRate)}</span>
            </div>
            <button onClick={() => setActiveModal('payment')} className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <ArrowDownRight size={16} className="text-green-600"/> Receive BDT
            </button>
            <button onClick={() => setActiveModal('usd')} className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <DollarSign size={16} className="text-blue-600"/> Buy USD
            </button>
            <button onClick={() => setActiveModal('spend')} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> Ad Spend
            </button>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </div>
      </main>

      {/* MODALS */}
      {activeModal === 'payment' && (
        <Modal title="Receive Client Payment" onClose={() => setActiveModal(null)}>
          <TransactionForm type="PAYMENT_RECEIVED" clients={clients} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'usd' && (
        <Modal title="Record USD Purchase" onClose={() => setActiveModal(null)}>
          <TransactionForm type="USD_PURCHASE" cards={cards.filter(c=>c.status!=='Archived')} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'spend' && (
        <Modal title="Record Meta Ad Spend" onClose={() => setActiveModal(null)}>
          <TransactionForm type="AD_SPEND" clients={clients} cards={cards.filter(c=>c.status!=='Archived')} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {(activeModal === 'add-card' || activeModal === 'edit-card') && (
        <Modal title={activeModal === 'add-card' ? 'Add New Card' : 'Edit Card'} onClose={() => setActiveModal(null)}>
          <CardForm initialData={selectedItem} onSubmit={handleSaveCard} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {(activeModal === 'add-client' || activeModal === 'edit-client') && (
        <Modal title={activeModal === 'add-client' ? 'Add New Client' : 'Edit Client'} onClose={() => setActiveModal(null)} width="max-w-2xl">
          <ClientForm initialData={selectedItem} onSubmit={handleSaveClient} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'card-details' && selectedItem && (
        <CardDetailsModal card={selectedItem} metrics={metrics} transactions={transactions} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

// ==========================================
// VIEWS
// ==========================================

function DashboardView({ metrics, chartData, transactions }) {
  const recentTx = [...(transactions || [])].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
        <p className="text-slate-500 text-sm">Track every dollar, know every taka.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard title="Total Revenue" value={formatBDT(metrics.totalRevenueBDT)} icon={<ArrowDownRight size={20} className="text-green-600" />} bgColor="bg-green-50" />
        <MetricCard title="Net Profit" value={formatBDT(metrics.netProfitBDT)} subtitle={`Margin: ${metrics.profitMargin.toFixed(1)}%`} icon={<TrendingUp size={20} className="text-blue-600" />} bgColor="bg-blue-50" />
        <MetricCard title="Meta Ads Spend" value={formatUSD(metrics.totalAdSpendUSD)} subtitle={`+ Tax ${formatUSD(metrics.totalTaxUSD)}`} icon={<Activity size={20} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Total Card Balance" value={formatUSD(metrics.totalCardBalance)} icon={<Wallet size={20} className="text-orange-600" />} bgColor="bg-orange-50" />
      </div>
    </div>
  );
}

function ClientsView({ clients, transactions, metrics, onAddClient, onEditClient, onViewDetails }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const clientStats = (clients || []).map(client => {
    const clientTx = (transactions || []).filter(t => t.clientId === client.id);
    const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT || 0), 0);
    const spendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
    const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);
    
    const adCostBDT = (spendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
    const profitBDT = revenue - adCostBDT;
    const profitMargin = revenue > 0.005 ? (profitBDT / revenue) * 100 : 0;

    return { ...client, revenue, spendUSD, taxUSD, adCostBDT, profitBDT, profitMargin };
  });

  const filteredClients = clientStats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
        <button onClick={onAddClient} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
           <div className="p-8 text-center text-slate-500">No clients yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">Client / Business</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Revenue (BDT)</th>
                  <th className="px-5 py-4 text-right">Ad Spend (USD)</th>
                  <th className="px-5 py-4 text-right">Profit (BDT)</th>
                  <th className="px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.company}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${c.currentlyWorking ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {c.currentlyWorking ? 'Active' : (c.status || 'Inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-green-600">{formatBDT(c.revenue)}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-800">{formatUSD(c.spendUSD)}</td>
                    <td className="px-5 py-4 text-right font-medium text-blue-600">
                      {formatBDT(c.profitBDT)}
                      <div className="text-xs text-slate-500">{c.profitMargin.toFixed(1)}% margin</div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => onEditClient(c)} className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerView({ transactions, clients, cards }) {
  const [dateFilter, setDateFilter] = useState('lifetime');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = (transactions || []).filter(tx => {
    // Basic Filters
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
    
    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const client = clients.find(c => c.id === tx.clientId);
      const card = cards.find(c => c.id === tx.cardId);
      const matchesSearch = 
        (tx.notes && tx.notes.toLowerCase().includes(term)) ||
        (tx.source && tx.source.toLowerCase().includes(term)) ||
        (tx.type && tx.type.toLowerCase().includes(term)) ||
        (client && client.name.toLowerCase().includes(term)) ||
        (card && card.name.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date));

  // Explode AD_SPEND into two visual rows (Spend + Tax) for ledger reporting
  const displayRows = [];
  filtered.forEach(tx => {
    if (tx.type === 'AD_SPEND') {
      const spend = parseFloat(tx.amountUSD || 0);
      const tax = parseFloat(tx.taxUSD || 0);
      if (spend > 0.005) displayRows.push({...tx, _displayType: 'Meta Ads', _outUSD: spend, _isTaxRow: false});
      if (tax > 0.005) displayRows.push({...tx, _displayType: 'Tax', _outUSD: tax, _isTaxRow: true, id: tx.id+'_tax'});
    } else {
      let outUsd = 0;
      if (tx.type === 'USD_PURCHASE') outUsd = parseFloat(tx.amountUSD || 0);
      displayRows.push({...tx, _displayType: tx.type.replace('_', ' '), _outUSD: outUsd});
    }
  });

  let totalBdtIn = 0;
  let totalUsdOut = 0;
  displayRows.forEach(row => {
    if (row.type === 'PAYMENT_RECEIVED') totalBdtIn += parseFloat(row.amountBDT || 0);
    if (row.type === 'USD_PURCHASE' || row.type === 'AD_SPEND') totalUsdOut += row._outUSD;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Transaction Ledger</h1>
        <div className="flex flex-wrap gap-2">
          <input type="text" placeholder="Search transactions..." className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All Transactions</option>
            <option value="PAYMENT_RECEIVED">Receive BDT</option>
            <option value="USD_PURCHASE">Buy USD</option>
            <option value="AD_SPEND">Meta Ads & Tax</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total BDT In</p>
          <p className="text-lg font-bold text-green-600">{formatBDT(totalBdtIn)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total USD Out</p>
          <p className="text-lg font-bold text-slate-900">{formatUSD(totalUsdOut)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-lg font-bold text-slate-900">{displayRows.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {displayRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Card / Client</th>
                  <th className="px-5 py-3 text-right">In (BDT)</th>
                  <th className="px-5 py-3 text-right">Out (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((tx, idx) => {
                  const client = clients.find(c => c.id === tx.clientId);
                  const card = cards.find(c => c.id === tx.cardId);
                  return (
                  <tr key={tx.id || idx} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{formatDate(tx.date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{tx._displayType}</td>
                    <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{tx._isTaxRow ? 'Meta Ads Tax' : (tx.notes || tx.source || '-')}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {client ? <span className="block">{client.name}</span> : null}
                      {card ? <span className="block text-xs">{card.name}</span> : null}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-green-600">
                      {tx.type === 'PAYMENT_RECEIVED' ? `+${formatBDT(tx.amountBDT)}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {tx._outUSD > 0.005 ? formatUSD(tx._outUSD) : '—'}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CardsView({ cards, metrics, transactions, onAddCard, onEditCard, onDeleteCard, onViewDetails }) {
  const usdPurchases = (transactions || []).filter(t => t.type === 'USD_PURCHASE');
  const activeCards = (cards || []).filter(c => c.status !== 'Archived');
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Cards & USD Ledger</h1>
        <button onClick={onAddCard} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          <Plus size={16} /> Add Card
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeCards.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white border border-dashed border-slate-300 rounded-xl text-slate-500">
            No cards added yet.
          </div>
        ) : activeCards.map(card => {
          const cardTxs = (transactions || []).filter(t => t.cardId === card.id).sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date));
          const lastTx = cardTxs[0];

          return (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    {card.name} 
                    {card.last4 && <span className="text-xs font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">*{card.last4}</span>}
                  </h3>
                  <p className="text-sm text-slate-500">{card.provider} • {card.cardType}</p>
                </div>
                <CardDropdownMenu 
                  onEdit={() => onEditCard(card)} 
                  onDetails={() => onViewDetails(card)} 
                  onDelete={() => {
                    const hasTx = cardTxs.length > 0;
                    const msg = hasTx 
                      ? `This card has transaction history. Deleting it may affect historical records. Are you sure?`
                      : `Are you sure you want to delete ${card.name}?`;
                    if(window.confirm(msg)) onDeleteCard(card.id);
                  }} 
                />
              </div>
              <p className="text-sm text-slate-500 mb-1">Current Balance</p>
              <h2 className={`text-3xl font-bold ${metrics.cardBalances[card.id] < -0.005 ? 'text-red-600' : 'text-slate-800'}`}>
                {metrics.cardBalances[card.id] < -0.005 ? '-' : ''}{formatUSD(Math.abs(metrics.cardBalances[card.id] || 0))}
              </h2>
              {metrics.cardBalances[card.id] < -0.005 && <p className="text-xs text-red-600 font-medium mt-1">⚠ Negative Balance</p>}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-1 uppercase font-semibold">Last Transaction</p>
              {lastTx ? (
                <div className="text-sm">
                  <span className="font-medium text-slate-700">{formatDate(lastTx.date)} • {lastTx.type === 'USD_PURCHASE' ? 'USD Purchase' : 'Meta Ads'}</span>
                  <p className={lastTx.type === 'USD_PURCHASE' ? 'text-green-600 font-bold' : 'text-slate-800 font-bold'}>
                    {lastTx.type === 'USD_PURCHASE' ? `+${formatUSD(lastTx.amountUSD)}` : `-${formatUSD(lastTx.amountUSD)}`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No transactions yet</p>
              )}
            </div>

            <div className="mt-4">
              <button onClick={() => onViewDetails(card)} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors">Details & History</button>
            </div>
          </div>
        )})}
      </div>

      <div className="flex justify-between items-center mt-8 mb-4">
        <h3 className="text-lg font-bold text-slate-800">USD Purchase History</h3>
        <div className="flex gap-2">
          <button className="text-sm border border-slate-300 bg-white px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-50 font-medium">
            📅 History: Lifetime
          </button>
          <select className="text-sm border border-slate-300 bg-white px-3 py-1.5 rounded-md text-slate-700 focus:outline-none">
            <option>All Cards</option>
            {activeCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {usdPurchases.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No USD purchases yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-normal min-w-[90px]">Date</th>
                  <th className="px-4 py-3 whitespace-normal">Source</th>
                  <th className="px-4 py-3 text-right whitespace-normal">BDT Paid</th>
                  <th className="px-4 py-3 text-right whitespace-normal text-slate-500">C.O Rate</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-800 whitespace-normal">Total Cost</th>
                  <th className="px-4 py-3 text-right whitespace-normal">USD Received</th>
                  <th className="px-4 py-3 whitespace-normal">Card / Destination</th>
                  <th className="px-4 py-3 text-right whitespace-normal">Base Rate</th>
                  <th className="px-4 py-3 text-right text-blue-600 whitespace-normal">Effective Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usdPurchases.map(tx => {
                  const baseRate = parseFloat(tx.amountBDT || 0) / parseFloat(tx.amountUSD || 1);
                  const totalCost = parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0);
                  const effectiveRate = totalCost / parseFloat(tx.amountUSD || 1);
                  const card = cards.find(c => c.id === tx.cardId);

                  return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{tx.source || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatBDT(tx.amountBDT)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{parseFloat(tx.cashOutCharge || 0) > 0 ? formatBDT(tx.cashOutCharge) : '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatBDT(totalCost)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatUSD(tx.amountUSD)}</td>
                    <td className="px-4 py-3 text-slate-600">{card ? card.name : 'Unknown'}</td>
                    <td className="px-4 py-3 text-right text-slate-500">৳{baseRate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">৳{effectiveRate.toFixed(2)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// FORMS & MODALS
// ==========================================

function CardForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    name: '', provider: '', cardType: '', currency: 'USD',
    initialBalance: '', last4: '', expiry: '', notes: '', status: 'Active'
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({...formData, initialBalance: parseFloat(formData.initialBalance || 0)});
  };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium text-slate-700">Card Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter card name" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Provider / Bank</label>
          <input type="text" name="provider" value={formData.provider} onChange={handleChange} required placeholder="Enter provider" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Card Type</label>
          <select name="cardType" value={formData.cardType} onChange={handleChange} className={inputClass}>
            <option value="">Select Type</option><option>Virtual Card</option><option>Dual Currency</option><option>Credit Card</option><option>Prepaid Card</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Initial Balance (USD)</label>
          <input type="number" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} disabled={!!initialData} placeholder="0.00" className={`${inputClass} ${initialData ? 'bg-slate-100 cursor-not-allowed' : ''}`} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Last 4 Digits</label>
          <input type="text" maxLength="4" name="last4" value={formData.last4} onChange={handleChange} placeholder="e.g. 1234" className={inputClass} />
        </div>
      </div>
      <div><label className="block text-sm font-medium text-slate-700">Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass}></textarea>
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Card</button>
      </div>
    </form>
  );
}

function ClientForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    name: '', company: '', phone: '', email: '', facebook: '', website: '',
    serviceType: '', budgetType: 'Monthly', budgetAmount: '', 
    startDate: new Date().toISOString().split('T')[0], endDate: '', currentlyWorking: true, notes: '', status: 'Active'
  });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Client Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter client name" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Business / Company Name *</label>
          <input type="text" name="company" value={formData.company} onChange={handleChange} required placeholder="Enter business name" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Facebook Page URL</label>
          <input type="url" name="facebook" value={formData.facebook} onChange={handleChange} placeholder="https://facebook.com/..." className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Budget Amount (BDT)</label>
          <input type="number" name="budgetAmount" value={formData.budgetAmount} onChange={handleChange} placeholder="Enter amount" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Budget Period</label>
          <select name="budgetType" value={formData.budgetType} onChange={handleChange} className={inputClass}>
            <option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option><option value="Custom / Total">Custom / Total</option>
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Start Date</label>
          <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Client</button>
      </div>
    </form>
  );
}

function TransactionForm({ type, clients, cards, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amountBDT: '', cashOutCharge: '', amountUSD: '',
    clientId: clients?.[0]?.id || '',
    cardId: cards?.[0]?.id || '',
    taxUSD: '', source: '', notes: '',
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { type, date: formData.date, notes: formData.notes };

    if (type === 'USD_PURCHASE') {
      const bdt = parseFloat(formData.amountBDT || 0);
      const usd = parseFloat(formData.amountUSD || 0);
      if (bdt <= 0 || usd <= 0) return alert("BDT Paid and USD Received must be greater than 0");
      
      payload.amountBDT = bdt;
      payload.cashOutCharge = parseFloat(formData.cashOutCharge || 0);
      payload.amountUSD = usd;
      payload.cardId = formData.cardId;
      payload.source = formData.source;
    } else if (type === 'AD_SPEND') {
      const spend = parseFloat(formData.amountUSD || 0);
      if (spend <= 0.005) return alert("Ad Spend must be greater than 0");

      payload.amountUSD = spend;
      payload.taxUSD = parseFloat(formData.taxUSD || 0);
      payload.clientId = formData.clientId;
      payload.cardId = formData.cardId;
    }
    onSubmit(payload);
  };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className={labelClass}>Date</label>
        <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClass} />
      </div>

      {type === 'USD_PURCHASE' && (
        <>
          <div><label className={labelClass}>Source</label>
            <input type="text" name="source" value={formData.source} onChange={handleChange} required placeholder="e.g. Binance P2P" className={inputClass} />
          </div>
          <div><label className={labelClass}>Card / Destination</label>
            <select name="cardId" value={formData.cardId} onChange={handleChange} required className={inputClass}>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>BDT Paid</label>
              <input type="number" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="Enter BDT amount" className={inputClass} />
            </div>
            <div><label className={labelClass}>Cash-out Charge (C.O Rate)</label>
              <input type="number" name="cashOutCharge" value={formData.cashOutCharge} onChange={handleChange} placeholder="Enter cash-out charge" className={inputClass} />
            </div>
          </div>
          <div><label className={labelClass}>USD Received</label>
            <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="Enter USD amount" className={inputClass} />
          </div>

          {(formData.amountBDT && formData.amountUSD) ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <div className="flex justify-between"><span>Total BDT Cost:</span> <strong>{formatBDT(parseFloat(formData.amountBDT || 0) + parseFloat(formData.cashOutCharge || 0))}</strong></div>
              <div className="flex justify-between text-blue-600 font-medium"><span>Effective Rate:</span> <span>৳{((parseFloat(formData.amountBDT) + parseFloat(formData.cashOutCharge || 0)) / parseFloat(formData.amountUSD)).toFixed(2)}</span></div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Effective Rate = (BDT Paid + C.O Charge) ÷ USD Received</p>
          )}
        </>
      )}

      {type === 'AD_SPEND' && (
        <>
          <div><label className={labelClass}>Client</label>
            <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div><label className={labelClass}>Card Used</label>
            <select name="cardId" value={formData.cardId} onChange={handleChange} className={inputClass}>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Ad Spend (USD)</label>
              <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="Enter ad spend" className={inputClass} />
            </div>
            <div><label className={labelClass}>Tax (USD)</label>
              <input type="number" step="0.01" name="taxUSD" value={formData.taxUSD} onChange={handleChange} placeholder="Enter tax amount" className={inputClass} />
            </div>
          </div>
          {(formData.amountUSD) ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <div className="flex justify-between text-slate-800 font-medium"><span>Total Card Deduction:</span> <span>{formatUSD(parseFloat(formData.amountUSD || 0) + parseFloat(formData.taxUSD || 0))}</span></div>
            </div>
          ) : null}
        </>
      )}

      <div><label className={labelClass}>Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass}></textarea>
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Transaction</button>
      </div>
    </form>
  );
}

function CardDetailsModal({ card, metrics, transactions, onClose }) {
  const cardTxs = (transactions || []).filter(t => t.cardId === card.id).sort((a,b) => new Date(a.createdAt||a.date) - new Date(b.createdAt||b.date));

  let runningBal = parseFloat(card.initialBalance || 0);
  const historyWithBalance = cardTxs.map(t => {
    let faceUsd = 0;
    if (t.type === 'USD_PURCHASE') {
      faceUsd = parseFloat(t.amountUSD || 0);
      runningBal += faceUsd;
    }
    if (t.type === 'AD_SPEND') {
      const spend = parseFloat(t.amountUSD || 0);
      const tax = parseFloat(t.taxUSD || 0);
      faceUsd = -spend;
      runningBal -= (spend + tax);
    }
    return { ...t, faceUsd, runningBal };
  }).reverse(); 

  const stats = metrics.cardStats[card.id] || { purchased: 0, spent: 0, tax: 0, fees: 0 };
  const currentBal = metrics.cardBalances[card.id] || 0;
  const isNegative = currentBal < -0.005;

  const expectedBalance = parseFloat(card.initialBalance || 0) + stats.purchased - stats.spent - stats.tax - stats.fees;
  const balanceVerified = Math.abs(expectedBalance - currentBal) < 0.01;

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Current Balance</p>
          <p className={`text-xl font-bold ${isNegative ? 'text-red-600' : 'text-slate-900'}`}>{isNegative ? '-' : ''}{formatUSD(Math.abs(currentBal))}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Purchased</p>
          <p className="text-lg font-bold text-green-600">+{formatUSD(stats.purchased)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Meta Ad Spend</p>
          <p className="text-lg font-bold text-slate-800">-{formatUSD(stats.spent)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Tax</p>
          <p className="text-lg font-semibold text-slate-700">-{formatUSD(stats.tax)}</p>
        </div>
      </div>
      
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
        <h4 className="text-sm font-bold text-slate-800 mb-2 border-b pb-1">Balance Breakdown</h4>
        <div className="space-y-1 text-sm text-slate-600">
          <div className="flex justify-between"><span>Opening Balance</span> <span>+{formatUSD(card.initialBalance)}</span></div>
          <div className="flex justify-between"><span>USD Purchased</span> <span>+{formatUSD(stats.purchased)}</span></div>
          <div className="flex justify-between"><span>Meta Ad Spend</span> <span>-{formatUSD(stats.spent)}</span></div>
          <div className="flex justify-between"><span>Tax</span> <span>-{formatUSD(stats.tax)}</span></div>
          <div className="flex justify-between"><span>Fees</span> <span>-{formatUSD(stats.fees)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold text-slate-900">
            <span>Current Balance</span> 
            <span className={isNegative ? 'text-red-600' : ''}>{isNegative ? '-' : ''}{formatUSD(Math.abs(currentBal))}</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-200 text-xs font-medium">
          {balanceVerified ? (
            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Balance Verified</span>
          ) : (
            <span className="text-red-600">⚠ Balance Mismatch (Expected: {formatUSD(expectedBalance)})</span>
          )}
        </div>
      </div>

      <h4 className="font-bold text-slate-800 mb-2 border-b pb-2">Transaction History</h4>
      <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">USD</th>
              <th className="px-4 py-3 text-right font-bold">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyWithBalance.length === 0 && <tr><td colSpan="3" className="text-center py-6 text-slate-500">No transactions found.</td></tr>}
            {historyWithBalance.map((tx, idx) => {
              const isNegBal = tx.runningBal < -0.005;
              return (
              <tr key={tx.id || idx} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{tx.type === 'USD_PURCHASE' ? 'USD Purchase' : 'Meta Ads'}</div>
                  {tx.taxUSD > 0.005 && <div className="text-xs text-slate-500">• Tax {formatUSD(tx.taxUSD)}</div>}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {tx.faceUsd > 0.005 ? <span className="text-green-600">+{formatUSD(tx.faceUsd)}</span> : <span className="text-slate-800">-{formatUSD(Math.abs(tx.faceUsd))}</span>}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${isNegBal ? 'text-red-600' : 'text-slate-900'}`}>
                  {isNegBal ? '-' : ''}{formatUSD(Math.abs(tx.runningBal))}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// SHARED HELPER COMPONENTS
// ==========================================

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {React.cloneElement(icon, { size: 18, className: isActive ? 'text-white' : 'text-slate-400' })}
      {label}
    </button>
  );
}

function MetricCard({ title, value, subtitle, icon, bgColor }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col group">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      {subtitle && <div className="mt-2 flex items-center text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}

function StatRow({ label, value, className = 'text-slate-900' }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${className}`}>{value}</span>
    </div>
  );
}

function Divider() { return <div className="h-px w-full bg-slate-100 my-2"></div>; }

function TransactionTypeBadge({ type }) {
  const styles = { PAYMENT_RECEIVED: 'bg-green-100 text-green-700', USD_PURCHASE: 'bg-blue-100 text-blue-700', AD_SPEND: 'bg-purple-100 text-purple-700' };
  const labels = { PAYMENT_RECEIVED: 'Payment In', USD_PURCHASE: 'Buy USD', AD_SPEND: 'Meta Ads' };
  return <span className={`px-2.5 py-1 rounded text-xs font-semibold ${styles[type] || 'bg-slate-100 text-slate-600'}`}>{labels[type] || type}</span>;
}

function Modal({ title, onClose, children, width = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-xl w-full ${width} overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CardDropdownMenu({ onEdit, onDetails, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) { if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><MoreVertical size={20} /></button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
          <button onClick={() => {onEdit(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Edit Card</button>
          <button onClick={() => {onDetails(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">View Details</button>
          <div className="h-px w-full bg-slate-100 my-1"></div>
          <button onClick={() => {onDelete(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between">Delete <Trash2 size={14}/></button>
        </div>
      )}
    </div>
  );
}

// Wrapper to inject ErrorBoundary at the very top level
export default function AdLedgerApp() {
  return (
    <ErrorBoundary>
      <AdLedgerMain />
    </ErrorBoundary>
  );
}
