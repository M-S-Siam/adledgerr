import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Users, CreditCard, DollarSign, 
  Activity, FileText, Settings, Plus, Search, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, 
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download,
  MoreVertical, Edit, Archive, Trash2, Info
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';

const INITIAL_CLIENTS = [
  { id: 'c1', name: 'Mehedi Hasan', company: 'RITMO', status: 'Active', budget: 50000, dateAdded: '2026-07-15' },
  { id: 'c2', name: 'John Doe', company: 'TechNova', status: 'Active', budget: 25000, dateAdded: '2026-08-01' },
  { id: 'c3', name: 'Sarah Lee', company: 'StyleBoutique', status: 'Inactive', budget: 10000, dateAdded: '2026-06-10' },
];

const INITIAL_CARDS = [
  { id: 'card1', name: 'RedotPay Primary', provider: 'RedotPay', type: 'Virtual', currency: 'USD', initialBalance: 0, last4: '1234', expiry: '12/28', notes: 'Main ad account card', status: 'Active' },
  { id: 'card2', name: 'City Bank Dual Currency', provider: 'City Bank', type: 'Dual Currency', currency: 'USD', initialBalance: 0, last4: '9876', expiry: '05/29', notes: 'Backup card', status: 'Active' },
];

const INITIAL_TRANSACTIONS = [
  // Payments Received (Revenue)
  { id: 't1', date: '2026-08-01', type: 'PAYMENT_RECEIVED', clientId: 'c1', amountBDT: 25000, method: 'bKash', notes: 'August Retainer' },
  { id: 't2', date: '2026-08-05', type: 'PAYMENT_RECEIVED', clientId: 'c2', amountBDT: 15000, method: 'Bank Transfer', notes: 'Campaign Setup' },
  
  // USD Purchases (Now with cashOutChargeBDT)
  { id: 't3', date: '2026-08-02', type: 'USD_PURCHASE', amountBDT: 12500, cashOutChargeBDT: 150, amountUSD: 100, method: 'Bank Transfer', notes: 'Binance P2P' },
  { id: 't4', date: '2026-08-08', type: 'USD_PURCHASE', amountBDT: 6300, cashOutChargeBDT: 75, amountUSD: 50, method: 'bKash', notes: 'Local Seller' },
  
  // Card Loads
  { id: 't5', date: '2026-08-02', type: 'CARD_LOAD', cardId: 'card1', amountUSD: 100, notes: 'Initial Load' },
  { id: 't6', date: '2026-08-09', type: 'CARD_LOAD', cardId: 'card1', amountUSD: 50, notes: 'Top up' },
  
  // Meta Ad Spend
  { id: 't7', date: '2026-08-04', type: 'AD_SPEND', clientId: 'c1', cardId: 'card1', amountUSD: 25, taxUSD: 3.75, notes: 'RITMO Awareness' },
  { id: 't8', date: '2026-08-06', type: 'AD_SPEND', clientId: 'c2', cardId: 'card1', amountUSD: 15, taxUSD: 2.25, notes: 'TechNova Leads' },
  { id: 't9', date: '2026-08-10', type: 'AD_SPEND', clientId: 'c1', cardId: 'card1', amountUSD: 10, taxUSD: 1.50, notes: 'RITMO Retargeting' },
];

const formatBDT = (amount) => `৳${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatUSD = (amount) => `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdLedgerApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State with LocalStorage Persistence
  const [clients, setClients] = useState(() => JSON.parse(localStorage.getItem('al_clients')) || INITIAL_CLIENTS);
  const [cards, setCards] = useState(() => JSON.parse(localStorage.getItem('al_cards')) || INITIAL_CARDS);
  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem('al_transactions')) || INITIAL_TRANSACTIONS);
  
  useEffect(() => localStorage.setItem('al_clients', JSON.stringify(clients)), [clients]);
  useEffect(() => localStorage.setItem('al_cards', JSON.stringify(cards)), [cards]);
  useEffect(() => localStorage.setItem('al_transactions', JSON.stringify(transactions)), [transactions]);

  // Modal State
  const [activeModal, setActiveModal] = useState(null); // 'payment', 'usd', 'spend', 'addCard', 'editCard', 'cardDetails', 'loadCard'
  const [selectedEntity, setSelectedEntity] = useState(null); // Used to pass IDs to modals

  const metrics = useMemo(() => {
    let totalRevenueBDT = 0;
    let totalUSDPurchased = 0;
    let totalBDTSpentOnUSD = 0; // Includes Base + Cash-out Charge
    let totalAdSpendUSD = 0;
    let totalTaxUSD = 0;
    
    let cardBalances = {};
    cards.forEach(c => cardBalances[c.id] = parseFloat(c.initialBalance || 0));

    transactions.forEach(t => {
      if (t.type === 'PAYMENT_RECEIVED') totalRevenueBDT += t.amountBDT || 0;
      
      if (t.type === 'USD_PURCHASE') {
        totalUSDPurchased += t.amountUSD || 0;
        const baseCost = t.amountBDT || 0;
        const feeCost = t.cashOutChargeBDT || 0;
        totalBDTSpentOnUSD += (baseCost + feeCost);
      }
      
      if (t.type === 'CARD_LOAD') {
        if (cardBalances[t.cardId] !== undefined) cardBalances[t.cardId] += t.amountUSD || 0;
      }
      
      if (t.type === 'AD_SPEND') {
        totalAdSpendUSD += t.amountUSD || 0;
        totalTaxUSD += t.taxUSD || 0;
        if (cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] -= (t.amountUSD + (t.taxUSD || 0));
        }
      }
    });

    // Effective Average USD Rate
    const avgUSDRate = totalUSDPurchased > 0 ? (totalBDTSpentOnUSD / totalUSDPurchased) : 125; 
    
    // Cost estimation
    const totalAdCostBDT = (totalAdSpendUSD + totalTaxUSD) * avgUSDRate;
    const netProfitBDT = totalRevenueBDT - totalAdCostBDT;
    const profitMargin = totalRevenueBDT > 0 ? (netProfitBDT / totalRevenueBDT) * 100 : 0;
    
    // Global USD Wallet Balance
    const totalLoadedToCards = transactions.filter(t => t.type === 'CARD_LOAD').reduce((sum, t) => sum + (t.amountUSD || 0), 0);
    const globalUSDBalance = totalUSDPurchased - totalLoadedToCards;

    return {
      totalRevenueBDT,
      totalUSDPurchased,
      avgUSDRate,
      totalAdSpendUSD,
      totalTaxUSD,
      netProfitBDT,
      profitMargin,
      cardBalances,
      globalUSDBalance,
      totalLoadedToCards
    };
  }, [transactions, cards]);

  const revenueChartData = useMemo(() => {
    const grouped = transactions.filter(t => t.type === 'PAYMENT_RECEIVED' || t.type === 'AD_SPEND').reduce((acc, t) => {
      const d = t.date.substring(5);
      if (!acc[d]) acc[d] = { date: d, revenue: 0, spendUSD: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += t.amountBDT;
      if (t.type === 'AD_SPEND') acc[d].spendUSD += (t.amountUSD + t.taxUSD);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  const handleAddTransaction = (newTx) => {
    const tx = { ...newTx, id: `t${Date.now()}` };
    setTransactions(prev => [tx, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    setActiveModal(null);
  };

  const handleSaveCard = (cardData) => {
    if (cardData.id) {
      setCards(prev => prev.map(c => c.id === cardData.id ? cardData : c));
    } else {
      setCards(prev => [...prev, { ...cardData, id: `card${Date.now()}` }]);
    }
    setActiveModal(null);
  };

  const handleArchiveCard = (cardId) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'Archived' } : c));
  };

  const openCardDetails = (cardId) => {
    setSelectedEntity(cards.find(c => c.id === cardId));
    setActiveModal('cardDetails');
  };

  const openEditCard = (cardId) => {
    setSelectedEntity(cards.find(c => c.id === cardId));
    setActiveModal('editCard');
  };

  const openLoadCard = (cardId) => {
    setSelectedEntity(cards.find(c => c.id === cardId));
    setActiveModal('loadCard');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} />;
      case 'clients': return <ClientsView clients={clients} transactions={transactions} />;
      case 'ledger': return <LedgerView transactions={transactions} clients={clients} cards={cards} />;
      case 'cards': return (
        <CardsView 
          cards={cards} 
          metrics={metrics} 
          transactions={transactions} 
          onAddCard={() => { setSelectedEntity(null); setActiveModal('addCard'); }}
          onEditCard={openEditCard}
          onDetailsCard={openCardDetails}
          onArchiveCard={handleArchiveCard}
          onLoadCard={openLoadCard}
        />
      );
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
        { }
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden sm:flex items-center bg-slate-100 rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="Search transactions..." className="bg-transparent border-none focus:outline-none text-sm ml-2 w-64" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end mr-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg USD Cost</span>
              <span className="text-sm font-bold text-slate-800">৳{metrics.avgUSDRate.toFixed(2)}</span>
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

        {}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </div>
      </main>

      {}
      {/* MODALS */}
      {activeModal === 'payment' && (
        <Modal title="Receive Client Payment" onClose={() => setActiveModal(null)}>
          <TransactionForm type="PAYMENT_RECEIVED" clients={clients} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'usd' && (
        <Modal title="Record USD Purchase" onClose={() => setActiveModal(null)}>
          <TransactionForm type="USD_PURCHASE" onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'spend' && (
        <Modal title="Record Meta Ad Spend" onClose={() => setActiveModal(null)}>
          <TransactionForm type="AD_SPEND" clients={clients} cards={cards.filter(c=>c.status!=='Archived')} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'loadCard' && (
        <Modal title="Load USD to Card" onClose={() => setActiveModal(null)}>
          <CardLoadForm card={selectedEntity} cards={cards.filter(c=>c.status!=='Archived')} metrics={metrics} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {(activeModal === 'addCard' || activeModal === 'editCard') && (
        <Modal title={activeModal === 'addCard' ? "Add New Card" : "Edit Card Details"} onClose={() => setActiveModal(null)}>
          <CardForm cardData={selectedEntity} onSubmit={handleSaveCard} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'cardDetails' && selectedEntity && (
        <CardDetailsModal card={selectedEntity} transactions={transactions} onClose={() => setActiveModal(null)} />
      )}

    </div>
  );
}

function DashboardView({ metrics, chartData, transactions }) {
  const recentTx = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 text-sm">Track every dollar, know every taka.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard title="Total Revenue" value={formatBDT(metrics.totalRevenueBDT)} trend="+12%" trendUp={true} icon={<ArrowDownRight size={20} className="text-green-600" />} bgColor="bg-green-50" />
        <MetricCard title="Net Profit" value={formatBDT(metrics.netProfitBDT)} subtitle={`Margin: ${metrics.profitMargin.toFixed(1)}%`} icon={<TrendingUp size={20} className="text-blue-600" />} bgColor="bg-blue-50" />
        <MetricCard title="Meta Ads Spend" value={formatUSD(metrics.totalAdSpendUSD)} subtitle={`+ Tax ${formatUSD(metrics.totalTaxUSD)}`} icon={<Activity size={20} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Current USD Balance" value={formatUSD(metrics.globalUSDBalance)} subtitle="Ready to load to cards" icon={<Wallet size={20} className="text-orange-600" />} bgColor="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">Revenue & Ad Spend Flow</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => `৳${val/1000}k`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (BDT)" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area yAxisId="right" type="monotone" dataKey="spendUSD" name="Ad Spend (USD)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Stats</h3>
          <div className="space-y-4 flex-1">
            <StatRow label="Avg Effective USD Rate" value={`৳${metrics.avgUSDRate.toFixed(2)}`} />
            <StatRow label="Total USD Purchased" value={formatUSD(metrics.totalUSDPurchased)} />
            <StatRow label="Total BDT Spent on USD" value={formatBDT(metrics.totalUSDPurchased * metrics.avgUSDRate)} />
            <Divider />
            <StatRow label="Total Meta Tax" value={formatUSD(metrics.totalTaxUSD)} className="text-red-600" />
            <StatRow label="Effective Tax Rate" value={`${metrics.totalAdSpendUSD > 0 ? ((metrics.totalTaxUSD / metrics.totalAdSpendUSD) * 100).toFixed(1) : 0}%`} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
          <button className="text-sm text-blue-600 font-medium hover:text-blue-700">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTx.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-600">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3"><TransactionTypeBadge type={tx.type} /></td>
                  <td className="px-5 py-3 text-slate-800 font-medium">{tx.notes || tx.type.replace('_', ' ')}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    {tx.amountBDT ? (
                      <span className={tx.type === 'PAYMENT_RECEIVED' ? 'text-green-600' : 'text-slate-800'}>
                        {tx.type === 'PAYMENT_RECEIVED' ? '+' : ''}{formatBDT(tx.amountBDT + (tx.cashOutChargeBDT||0))}
                      </span>
                    ) : (
                      <span className="text-slate-800">{formatUSD(tx.amountUSD + (tx.taxUSD||0))}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClientsView({ clients, transactions }) {
  const clientStats = clients.map(client => {
    const clientTx = transactions.filter(t => t.clientId === client.id);
    const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + t.amountBDT, 0);
    const spendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + t.amountUSD + (t.taxUSD||0), 0);
    return { ...client, revenue, spendUSD };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-4">Client</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Total Revenue (BDT)</th>
                <th className="px-5 py-4 text-right">Ad Spend (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientStats.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.company}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-green-600">{formatBDT(c.revenue)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">{formatUSD(c.spendUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LedgerView({ transactions, clients, cards }) {
  const [filter, setFilter] = useState('ALL');
  const filtered = transactions.filter(t => filter === 'ALL' || t.type === filter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Transaction Ledger</h1>
        <select 
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Transactions</option>
          <option value="PAYMENT_RECEIVED">Payments Received</option>
          <option value="USD_PURCHASE">USD Purchases</option>
          <option value="AD_SPEND">Meta Ad Spend</option>
          <option value="CARD_LOAD">Card Loads</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Entity / Details</th>
                <th className="px-5 py-3 text-right">In (BDT)</th>
                <th className="px-5 py-3 text-right">Out (USD)</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(tx => {
                const client = clients.find(c => c.id === tx.clientId);
                const card = cards.find(c => c.id === tx.cardId);
                return (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3"><TransactionTypeBadge type={tx.type} /></td>
                  <td className="px-5 py-3">
                    {client && <div className="font-medium text-slate-800">{client.name}</div>}
                    {card && <div className="text-xs text-slate-500">Card: {card.name}</div>}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">
                    {tx.type === 'PAYMENT_RECEIVED' ? `+${formatBDT(tx.amountBDT)}` : '-'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">
                    {(tx.type === 'AD_SPEND' || tx.type === 'CARD_LOAD' || tx.type === 'USD_PURCHASE') 
                      ? formatUSD(tx.amountUSD + (tx.taxUSD||0)) 
                      : '-'}
                  </td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate" title={tx.notes}>{tx.notes}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardsView({ cards, metrics, transactions, onAddCard, onEditCard, onDetailsCard, onArchiveCard, onLoadCard }) {
  const activeCards = cards.filter(c => c.status !== 'Archived');
  const usdPurchases = transactions.filter(t => t.type === 'USD_PURCHASE');
  
  const [openMenuId, setOpenMenuId] = useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    if (openMenuId) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [openMenuId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Cards & USD Ledger</h1>
        <button onClick={onAddCard} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
          <Plus size={16} /> Add Card
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* GLOBAL USD POOL */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={100} /></div>
          <div>
            <p className="text-slate-400 font-medium mb-1">Global USD Wallet</p>
            <h2 className="text-4xl font-bold mb-4">{formatUSD(metrics.globalUSDBalance)}</h2>
            <div className="space-y-1 text-sm text-slate-300">
              <div className="flex justify-between"><span>Total Purchased:</span> <span>{formatUSD(metrics.totalUSDPurchased)}</span></div>
              <div className="flex justify-between"><span>Loaded to Cards:</span> <span>-{formatUSD(metrics.totalLoadedToCards)}</span></div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-sm">Avg. Effective Cost: <span className="font-bold text-white">৳{metrics.avgUSDRate.toFixed(2)}</span></p>
          </div>
        </div>

        {/* CARDS */}
        {activeCards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between relative group">
            {/* Card Menu Dropdown */}
            <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setOpenMenuId(openMenuId === card.id ? null : card.id)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              {openMenuId === card.id && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-sm font-medium animate-in fade-in zoom-in-95 duration-100">
                  <button onClick={() => { onDetailsCard(card.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"><Info size={14}/> Details</button>
                  <button onClick={() => { onEditCard(card.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"><Edit size={14}/> Edit Card</button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button onClick={() => { onArchiveCard(card.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Archive size={14}/> Archive</button>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-start mb-4 pr-8">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">{card.name}</h3>
                  <p className="text-sm text-slate-500">{card.provider} • {card.type || 'Standard'}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-1">Current Balance</p>
              <h2 className="text-3xl font-bold text-slate-800">{formatUSD(metrics.cardBalances[card.id])}</h2>
              {card.last4 && <p className="text-xs text-slate-400 mt-2 font-mono">•••• {card.last4}</p>}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => onLoadCard(card.id)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors">Load Money</button>
              <button onClick={() => onDetailsCard(card.id)} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors">Ledger</button>
            </div>
          </div>
        ))}
      </div>

      {/* USD PURCHASE HISTORY */}
      <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4">USD Purchase History (Cost Analysis)</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Source/Seller</th>
                <th className="px-5 py-3 text-right">BDT Paid</th>
                <th className="px-5 py-3 text-right">Cash-out</th>
                <th className="px-5 py-3 text-right font-bold text-slate-700">Total Cost</th>
                <th className="px-5 py-3 text-right">USD Received</th>
                <th className="px-5 py-3 text-right">Base Rate</th>
                <th className="px-5 py-3 text-right text-blue-700 font-bold">Effective Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usdPurchases.map(tx => {
                const base = tx.amountBDT || 0;
                const charge = tx.cashOutChargeBDT || 0;
                const total = base + charge;
                const usd = tx.amountUSD || 1;
                
                return (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{tx.notes}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{formatBDT(base)}</td>
                  <td className="px-5 py-3 text-right text-red-500">{charge > 0 ? formatBDT(charge) : '-'}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800">{formatBDT(total)}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600">{formatUSD(usd)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">৳{(base/usd).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-bold text-blue-700">৳{(total/usd).toFixed(2)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {React.cloneElement(icon, { size: 18, className: isActive ? 'text-white' : 'text-slate-400' })}
      {label}
    </button>
  );
}

function MetricCard({ title, value, subtitle, trend, trendUp, icon, bgColor }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      <div className="mt-2 flex items-center text-xs">
        {trend && (
          <span className={`font-medium mr-2 flex items-center ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trendUp ? <ArrowUpRight size={14} className="mr-0.5"/> : <ArrowDownRight size={14} className="mr-0.5"/>}
            {trend}
          </span>
        )}
        {subtitle && <span className="text-slate-500">{subtitle}</span>}
      </div>
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

function Divider() {
  return <div className="h-px w-full bg-slate-100 my-2"></div>;
}

function TransactionTypeBadge({ type }) {
  const styles = {
    PAYMENT_RECEIVED: 'bg-green-100 text-green-700 border-green-200',
    USD_PURCHASE: 'bg-blue-100 text-blue-700 border-blue-200',
    AD_SPEND: 'bg-purple-100 text-purple-700 border-purple-200',
    CARD_LOAD: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  const labels = {
    PAYMENT_RECEIVED: 'Payment In',
    USD_PURCHASE: 'Buy USD',
    AD_SPEND: 'Meta Ads',
    CARD_LOAD: 'Card Load',
  };
  return (
    <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider border ${styles[type] || 'bg-slate-100 text-slate-600'}`}>
      {labels[type] || type}
    </span>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

function CardDetailsModal({ card, transactions, onClose }) {
  // Compute ledger
  const ledger = useMemo(() => {
    const cardTxs = transactions.filter(t => t.cardId === card.id).sort((a,b) => new Date(a.date) - new Date(b.date));
    let runBal = parseFloat(card.initialBalance || 0);
    
    let totalLoaded = 0;
    let totalSpent = 0;
    let totalTax = 0;

    const mapped = cardTxs.map(tx => {
      let impact = 0;
      if (tx.type === 'CARD_LOAD') {
        impact = tx.amountUSD;
        totalLoaded += impact;
      }
      if (tx.type === 'AD_SPEND') {
        impact = -(tx.amountUSD + (tx.taxUSD || 0));
        totalSpent += tx.amountUSD;
        totalTax += (tx.taxUSD || 0);
      }
      runBal += impact;
      return { ...tx, impact, runBal };
    });

    return { history: mapped.reverse(), totalLoaded, totalSpent, totalTax, currentBal: runBal };
  }, [card, transactions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Bal</p><p className="text-xl font-bold text-slate-900">{formatUSD(ledger.currentBal)}</p></div>
        <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Loaded</p><p className="text-xl font-bold text-green-600">{formatUSD(ledger.totalLoaded)}</p></div>
        <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Spent</p><p className="text-xl font-bold text-slate-800">{formatUSD(ledger.totalSpent)}</p></div>
        <div><p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Tax</p><p className="text-xl font-bold text-red-500">{formatUSD(ledger.totalTax)}</p></div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200 shadow-sm z-10">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Transaction Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount (USD)</th>
              <th className="px-4 py-3 text-right font-bold text-slate-800">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.history.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-slate-500">No transactions found for this card.</td></tr>}
            {ledger.history.map(tx => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDate(tx.date)}</td>
                <td className="px-4 py-3"><TransactionTypeBadge type={tx.type} /></td>
                <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">{tx.notes}</td>
                <td className={`px-4 py-3 text-right font-medium ${tx.impact > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                  {tx.impact > 0 ? '+' : ''}{formatUSD(tx.impact)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800 bg-slate-50/50">{formatUSD(tx.runBal)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/80">
               <td className="px-4 py-3 text-slate-500 italic">-</td>
               <td className="px-4 py-3 text-slate-500 font-medium">INITIAL BALANCE</td>
               <td className="px-4 py-3 text-slate-500">Opening Balance</td>
               <td className="px-4 py-3 text-right text-slate-500">-</td>
               <td className="px-4 py-3 text-right font-bold text-slate-800">{formatUSD(card.initialBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800">Close Ledger</button>
      </div>
    </div>
  );
}

const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
const labelClass = "block text-sm font-medium text-slate-700";

function CardForm({ cardData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(cardData || {
    name: '', provider: '', type: 'Virtual', currency: 'USD', initialBalance: '', last4: '', expiry: '', notes: '', status: 'Active'
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, initialBalance: parseFloat(formData.initialBalance || 0) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Card Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. RedotPay Main" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Provider</label>
          <input type="text" name="provider" value={formData.provider} onChange={handleChange} required placeholder="e.g. RedotPay" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Card Type</label>
          <select name="type" value={formData.type} onChange={handleChange} className={inputClass}>
            <option value="Virtual">Virtual</option>
            <option value="Dual Currency">Dual Currency</option>
            <option value="Credit">Credit</option>
            <option value="Debit">Debit</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select name="currency" value={formData.currency} onChange={handleChange} className={inputClass}>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Initial Balance</label>
          <div className="relative mt-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
            <input type="number" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} placeholder="0.00" disabled={!!cardData} className={`${inputClass} pl-8 ${cardData ? 'bg-slate-50 cursor-not-allowed' : ''}`} />
          </div>
          {cardData && <p className="text-[10px] text-slate-400 mt-1">Initial balance cannot be changed.</p>}
        </div>
        <div>
          <label className={labelClass}>Last 4 Digits (Optional)</label>
          <input type="text" maxLength="4" name="last4" value={formData.last4} onChange={handleChange} placeholder="1234" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expiry (Optional)</label>
          <input type="text" name="expiry" value={formData.expiry} onChange={handleChange} placeholder="MM/YY" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass}></textarea>
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Card</button>
      </div>
    </form>
  );
}

function CardLoadForm({ card, cards, metrics, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cardId: card?.id || cards[0]?.id || '',
    amountUSD: '',
    notes: 'Load from Global Wallet',
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      type: 'CARD_LOAD',
      date: formData.date,
      cardId: formData.cardId,
      amountUSD: parseFloat(formData.amountUSD),
      notes: formData.notes
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
        <span className="text-sm font-medium text-slate-600">Global USD Available:</span>
        <span className="text-lg font-bold text-slate-900">{formatUSD(metrics.globalUSDBalance)}</span>
      </div>
      
      <div>
        <label className={labelClass}>Date</label>
        <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Select Card to Load</label>
        <select name="cardId" value={formData.cardId} onChange={handleChange} className={inputClass} required>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name} (Bal: {formatUSD(metrics.cardBalances[c.id])})</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Amount to Load (USD)</label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
          <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required max={metrics.globalUSDBalance} placeholder="0.00" className={`${inputClass} pl-8`} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <input type="text" name="notes" value={formData.notes} onChange={handleChange} className={inputClass} />
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={parseFloat(formData.amountUSD) > metrics.globalUSDBalance} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Load Card</button>
      </div>
    </form>
  );
}

function TransactionForm({ type, clients, cards, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amountBDT: '',
    cashOutChargeBDT: '', // NEW
    amountUSD: '',
    clientId: clients?.[0]?.id || '',
    cardId: cards?.[0]?.id || '',
    taxUSD: '',
    notes: '',
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { type, date: formData.date, notes: formData.notes };

    if (type === 'PAYMENT_RECEIVED') {
      payload.amountBDT = parseFloat(formData.amountBDT);
      payload.clientId = formData.clientId;
    } else if (type === 'USD_PURCHASE') {
      payload.amountBDT = parseFloat(formData.amountBDT);
      payload.cashOutChargeBDT = parseFloat(formData.cashOutChargeBDT || 0);
      payload.amountUSD = parseFloat(formData.amountUSD);
    } else if (type === 'AD_SPEND') {
      payload.amountUSD = parseFloat(formData.amountUSD);
      payload.taxUSD = parseFloat(formData.taxUSD || 0);
      payload.clientId = formData.clientId;
      payload.cardId = formData.cardId;
    }
    
    onSubmit(payload);
  };

  // Calculations for USD Purchase visual feedback
  const parsedBDT = parseFloat(formData.amountBDT || 0);
  const parsedFee = parseFloat(formData.cashOutChargeBDT || 0);
  const totalCost = parsedBDT + parsedFee;
  const parsedUSD = parseFloat(formData.amountUSD || 0);
  
  const baseRate = parsedUSD > 0 ? (parsedBDT / parsedUSD).toFixed(2) : '0.00';
  const effectiveRate = parsedUSD > 0 ? (totalCost / parsedUSD).toFixed(2) : '0.00';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Date</label>
        <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClass} />
      </div>

      {type === 'PAYMENT_RECEIVED' && (
        <>
          <div>
            <label className={labelClass}>Client</label>
            <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount Received (BDT)</label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">৳</span>
              <input type="number" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="0.00" className={`${inputClass} pl-8`} />
            </div>
          </div>
        </>
      )}

      {type === 'USD_PURCHASE' && (
        <>
          <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
            <div>
              <label className={labelClass}>BDT Paid (Base)</label>
              <input type="number" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="৳0.00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Cash-out / Payment Charge</label>
              <input type="number" name="cashOutChargeBDT" value={formData.cashOutChargeBDT} onChange={handleChange} placeholder="৳0.00" className={inputClass} />
            </div>
            <div className="col-span-2 bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center">
               <span className="text-sm font-medium text-slate-700">Total BDT Cost:</span>
               <span className="font-bold text-slate-900 text-lg">৳{totalCost.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="pt-2">
            <label className={labelClass}>USD Received</label>
            <div className="relative mt-1 mb-4">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
              <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="0.00" className={`${inputClass} pl-8`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Base Rate</label>
              <div className="mt-1 font-medium text-slate-600">৳{baseRate}/USD</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Effective Rate</label>
              <div className="mt-1 font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">৳{effectiveRate}/USD</div>
            </div>
          </div>
        </>
      )}

      {type === 'AD_SPEND' && (
        <>
          <div>
            <label className={labelClass}>Client Campaign</label>
            <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Card Used</label>
            <select name="cardId" value={formData.cardId} onChange={handleChange} className={inputClass}>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ad Spend (USD)</label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                <input type="number" name="amountUSD" step="0.01" value={formData.amountUSD} onChange={handleChange} required placeholder="0.00" className={`${inputClass} pl-8`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Tax/VAT (USD)</label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                <input type="number" name="taxUSD" step="0.01" value={formData.taxUSD} onChange={handleChange} placeholder="0.00" className={`${inputClass} pl-8`} />
              </div>
            </div>
          </div>
          {formData.amountUSD && (
            <div className="p-3 bg-blue-50 rounded border border-blue-100 text-sm text-blue-800">
              Total Deduction from Card: <strong>${(parseFloat(formData.amountUSD) + parseFloat(formData.taxUSD || 0)).toFixed(2)}</strong>
            </div>
          )}
        </>
      )}

      <div>
        <label className={labelClass}>Notes / Description</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass} placeholder="Optional details..."></textarea>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Transaction</button>
      </div>
    </form>
  );
}
