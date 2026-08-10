import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, CreditCard, DollarSign, 
  Activity, FileText, Settings, Plus, Search, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, 
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, 
  Trash2, Edit, Eye, Filter, ArrowUpDown
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';

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

// --- INITIAL MOCK DATA ---
const INITIAL_CLIENTS = [
  { 
    id: 'c1', name: 'Mehedi Hasan', company: 'RITMO', phone: '01700000000', email: 'hello@ritmo.com', 
    fb: 'fb.com/ritmo', ig: '@ritmo', website: 'ritmo.com', serviceType: 'Meta Ads',
    status: 'Active', budget: 50000, dateAdded: '2026-07-15', notes: 'Premium retaining client.' 
  },
  { 
    id: 'c2', name: 'John Doe', company: 'TechNova', phone: '01800000000', email: 'john@technova.com', 
    fb: 'fb.com/technova', ig: '@technovatech', website: 'technova.com', serviceType: 'Social Media Management',
    status: 'Active', budget: 25000, dateAdded: '2026-08-01', notes: 'Standard package.' 
  },
];

const INITIAL_CARDS = [
  { id: 'card1', name: 'RedotPay Primary', provider: 'RedotPay', cardType: 'Virtual Card', currency: 'USD', initialBalance: 0, last4: '4567', expiry: '12/28', notes: 'Main Ads Card', status: 'Active' },
  { id: 'card2', name: 'City Bank Dual Currency', provider: 'City Bank', cardType: 'Dual Currency', currency: 'USD', initialBalance: 0, last4: '8899', expiry: '05/27', notes: 'Backup Card', status: 'Active' },
];

const INITIAL_TRANSACTIONS = [
  { id: 't1', date: '2026-08-01', type: 'PAYMENT_RECEIVED', clientId: 'c1', amountBDT: 25000, method: 'bKash', notes: 'August Retainer' },
  { id: 't3', date: '2026-08-02', type: 'USD_PURCHASE', amountBDT: 12500, cashOutCharge: 150, amountUSD: 100, method: 'Bank Transfer', notes: 'Binance P2P' },
  { id: 't5', date: '2026-08-02', type: 'CARD_LOAD', cardId: 'card1', amountUSD: 100, notes: 'Initial Load' },
  { id: 't7', date: '2026-08-04', type: 'AD_SPEND', clientId: 'c1', cardId: 'card1', amountUSD: 25, taxUSD: 3.75, adAccount: 'RITMO Ads 1', campaign: 'Awareness Q3', notes: 'RITMO Awareness' },
];

// --- UTILITIES ---
const formatBDT = (amount) => `৳${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const formatUSD = (amount) => `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// --- MAIN APPLICATION ---
export default function AdLedgerApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // State Data (Persisted)
  const [clients, setClients] = useLocalStorage('adledger_clients', INITIAL_CLIENTS);
  const [cards, setCards] = useLocalStorage('adledger_cards', INITIAL_CARDS);
  const [transactions, setTransactions] = useLocalStorage('adledger_transactions', INITIAL_TRANSACTIONS);
  
  // Modal State
  const [activeModal, setActiveModal] = useState(null); // 'payment', 'usd', 'spend', 'add-card', 'edit-card', 'card-details', 'load-card', 'add-client', 'edit-client', 'client-details'
  const [selectedCard, setSelectedCard] = useState(null); 
  const [selectedClient, setSelectedClient] = useState(null); 

  // --- FINANCIAL CALCULATIONS (Auto-derived from transactions) ---
  const metrics = useMemo(() => {
    let totalRevenueBDT = 0;
    
    // USD Variables
    let totalUSDPurchased = 0;
    let totalBDTSpentOnUSD = 0; 
    let totalCashOutCharges = 0; 
    
    let totalAdSpendUSD = 0;
    let totalTaxUSD = 0;
    
    let cardBalances = {};
    let cardStats = {}; 
    cards.forEach(c => {
      cardBalances[c.id] = parseFloat(c.initialBalance || 0);
      cardStats[c.id] = { loaded: 0, spent: 0 };
    });

    transactions.forEach(t => {
      if (t.type === 'PAYMENT_RECEIVED') totalRevenueBDT += t.amountBDT || 0;
      if (t.type === 'USD_PURCHASE') {
        totalUSDPurchased += t.amountUSD || 0;
        totalBDTSpentOnUSD += t.amountBDT || 0;
        totalCashOutCharges += t.cashOutCharge || 0;
      }
      if (t.type === 'CARD_LOAD') {
        if (cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] += t.amountUSD || 0;
          cardStats[t.cardId].loaded += t.amountUSD || 0;
        }
      }
      if (t.type === 'AD_SPEND') {
        const totalSpend = (t.amountUSD || 0) + (t.taxUSD || 0);
        totalAdSpendUSD += t.amountUSD || 0;
        totalTaxUSD += t.taxUSD || 0;
        if (cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] -= totalSpend;
          cardStats[t.cardId].spent += totalSpend;
        }
      }
    });

    const totalBDTCostOfUSD = totalBDTSpentOnUSD + totalCashOutCharges;
    const avgUSDEffectiveRate = totalUSDPurchased > 0 ? (totalBDTCostOfUSD / totalUSDPurchased) : 125; 
    
    const totalAdCostBDT = (totalAdSpendUSD + totalTaxUSD) * avgUSDEffectiveRate;
    const netProfitBDT = totalRevenueBDT - totalAdCostBDT;
    const profitMargin = totalRevenueBDT > 0 ? (netProfitBDT / totalRevenueBDT) * 100 : 0;
    
    const totalLoadedToCards = transactions.filter(t => t.type === 'CARD_LOAD').reduce((sum, t) => sum + (t.amountUSD || 0), 0);
    const globalUSDBalance = totalUSDPurchased - totalLoadedToCards;

    return {
      totalRevenueBDT, totalUSDPurchased, avgUSDEffectiveRate,
      totalAdSpendUSD, totalTaxUSD, netProfitBDT, profitMargin,
      cardBalances, cardStats, globalUSDBalance, totalLoadedToCards
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

  // --- HANDLERS ---
  const handleAddTransaction = (newTx) => {
    const tx = { ...newTx, id: `t${Date.now()}` };
    setTransactions(prev => [tx, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    setActiveModal(null);
  };

  const handleSaveCard = (cardData) => {
    if (activeModal === 'edit-card') {
      setCards(prev => prev.map(c => c.id === cardData.id ? cardData : c));
    } else {
      setCards(prev => [...prev, { ...cardData, id: `card_${Date.now()}`, status: 'Active' }]);
    }
    setActiveModal(null);
  };

  const handleDeleteCard = (cardId) => {
    const hasHistory = transactions.some(t => t.cardId === cardId);
    let msg = "Are you sure you want to delete this card?";
    if (hasHistory) {
      msg = "This card has transaction history. Deleting it may affect historical records. Are you sure?";
    }
    if (window.confirm(msg)) {
      setCards(prev => prev.filter(c => c.id !== cardId));
    }
  };

  const handleSaveClient = (clientData) => {
    if (activeModal === 'edit-client') {
      setClients(prev => prev.map(c => c.id === clientData.id ? clientData : c));
    } else {
      setClients(prev => [...prev, { ...clientData, id: `c_${Date.now()}` }]);
    }
    setActiveModal(null);
  };

  const handleDeleteClient = (clientId) => {
    const hasHistory = transactions.some(t => t.clientId === clientId);
    let msg = "Are you sure you want to delete this client?";
    if (hasHistory) {
      msg = "This client has financial transaction history. Deleting the client may affect historical records. Are you sure?";
    }
    if (window.confirm(msg)) {
      setClients(prev => prev.filter(c => c.id !== clientId));
    }
  };

  const openPaymentForClient = (client) => {
    setSelectedClient(client);
    setActiveModal('payment');
  };

  const openAdSpendForClient = (client) => {
    setSelectedClient(client);
    setActiveModal('spend');
  };

  // --- RENDERERS ---
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} clients={clients} />;
      case 'clients': 
        return <ClientsView 
                  clients={clients} 
                  transactions={transactions} 
                  metrics={metrics}
                  onAddClient={() => { setSelectedClient(null); setActiveModal('add-client'); }}
                  onEditClient={(c) => { setSelectedClient(c); setActiveModal('edit-client'); }}
                  onViewDetails={(c) => { setSelectedClient(c); setActiveModal('client-details'); }}
                  onDeleteClient={handleDeleteClient}
                  onReceivePayment={openPaymentForClient}
                  onAddAdSpend={openAdSpendForClient}
                />;
      case 'ledger': return <LedgerView transactions={transactions} clients={clients} cards={cards} />;
      case 'cards': 
        return <CardsView 
                  cards={cards} 
                  metrics={metrics} 
                  transactions={transactions} 
                  onAddCard={() => { setSelectedCard(null); setActiveModal('add-card'); }}
                  onEditCard={(c) => { setSelectedCard(c); setActiveModal('edit-card'); }}
                  onDeleteCard={handleDeleteCard}
                  onViewDetails={(c) => { setSelectedCard(c); setActiveModal('card-details'); }}
                  onLoadCard={(c) => { setSelectedCard(c); setActiveModal('load-card'); }}
                />;
      default: return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} clients={clients} />;
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
          <NavItem icon={<Users />} label="Client Management" isActive={currentView === 'clients'} onClick={() => {setCurrentView('clients'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Activity />} label="Transaction Ledger" isActive={currentView === 'ledger'} onClick={() => {setCurrentView('ledger'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<CreditCard />} label="Cards & USD" isActive={currentView === 'cards'} onClick={() => {setCurrentView('cards'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<PieChart />} label="Reports" isActive={currentView === 'reports'} onClick={() => {}} />
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <NavItem icon={<Settings />} label="Settings" onClick={() => {}} />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
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
            <div className="hidden lg:flex items-center gap-2 mr-4">
              <span className="text-xs font-medium text-slate-500 uppercase">Avg USD Rate:</span>
              <span className="text-sm font-bold text-slate-800">৳{metrics.avgUSDEffectiveRate.toFixed(2)}</span>
            </div>
            <button onClick={() => { setSelectedClient(null); setActiveModal('payment'); }} className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <ArrowDownRight size={16} className="text-green-600"/> Receive BDT
            </button>
            <button onClick={() => setActiveModal('usd')} className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <DollarSign size={16} className="text-blue-600"/> Buy USD
            </button>
            <button onClick={() => { setSelectedClient(null); setActiveModal('spend'); }} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm">
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
          <TransactionForm type="PAYMENT_RECEIVED" clients={clients} initialClientId={selectedClient?.id} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'usd' && (
        <Modal title="Record USD Purchase" onClose={() => setActiveModal(null)}>
          <TransactionForm type="USD_PURCHASE" onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'spend' && (
        <Modal title="Record Meta Ad Spend" onClose={() => setActiveModal(null)}>
          <TransactionForm type="AD_SPEND" clients={clients} cards={cards} initialClientId={selectedClient?.id} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'load-card' && selectedCard && (
        <Modal title={`Load Money to ${selectedCard.name}`} onClose={() => setActiveModal(null)}>
          <TransactionForm type="CARD_LOAD" cards={[selectedCard]} metrics={metrics} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {(activeModal === 'add-card' || activeModal === 'edit-card') && (
        <Modal title={activeModal === 'add-card' ? 'Add New Card' : 'Edit Card'} onClose={() => setActiveModal(null)}>
          <CardForm initialData={activeModal === 'edit-card' ? selectedCard : null} onSubmit={handleSaveCard} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'card-details' && selectedCard && (
        <Modal title={`Card Ledger: ${selectedCard.name}`} onClose={() => setActiveModal(null)} width="max-w-4xl">
           <CardDetailsModal card={selectedCard} metrics={metrics} transactions={transactions} onClose={() => setActiveModal(null)} />
        </Modal>
      )}
      {(activeModal === 'add-client' || activeModal === 'edit-client') && (
        <Modal title={activeModal === 'add-client' ? 'Add New Client' : 'Edit Client'} onClose={() => setActiveModal(null)} width="max-w-2xl">
          <ClientForm initialData={activeModal === 'edit-client' ? selectedClient : null} onSubmit={handleSaveClient} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'client-details' && selectedClient && (
        <Modal title={`Client Dashboard: ${selectedClient.name}`} onClose={() => setActiveModal(null)} width="max-w-6xl">
           <ClientDetailsModal 
              client={selectedClient} 
              metrics={metrics} 
              transactions={transactions} 
              onClose={() => setActiveModal(null)}
              onReceivePayment={() => openPaymentForClient(selectedClient)}
              onAdSpend={() => openAdSpendForClient(selectedClient)}
            />
        </Modal>
      )}

    </div>
  );
}

// --- VIEWS ---

function DashboardView({ metrics, chartData, transactions, clients }) {
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
        <MetricCard title="Total Revenue" value={formatBDT(metrics.totalRevenueBDT)} icon={<ArrowDownRight size={20} className="text-green-600" />} bgColor="bg-green-50" />
        <MetricCard title="Net Profit" value={formatBDT(metrics.netProfitBDT)} subtitle={`Margin: ${metrics.profitMargin.toFixed(1)}%`} icon={<TrendingUp size={20} className="text-blue-600" />} bgColor="bg-blue-50" />
        <MetricCard title="Meta Ads Spend" value={formatUSD(metrics.totalAdSpendUSD)} subtitle={`+ Tax ${formatUSD(metrics.totalTaxUSD)}`} icon={<Activity size={20} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Global USD Wallet" value={formatUSD(metrics.globalUSDBalance)} subtitle="Available to load" icon={<Wallet size={20} className="text-orange-600" />} bgColor="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-6">Revenue & Ad Spend Flow</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => `৳${val/1000}k`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                <Tooltip />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (BDT)" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area yAxisId="right" type="monotone" dataKey="spendUSD" name="Ad Spend (USD)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Stats</h3>
          <div className="space-y-4 flex-1">
            <StatRow label="Active Clients" value={clients.filter(c=>c.status==='Active').length} />
            <StatRow label="Avg USD Effective Rate" value={`৳${metrics.avgUSDEffectiveRate.toFixed(2)}`} />
            <StatRow label="Total USD Purchased" value={formatUSD(metrics.totalUSDPurchased)} />
            <StatRow label="Total BDT Spent on USD" value={formatBDT(metrics.totalUSDPurchased * metrics.avgUSDEffectiveRate)} />
            <Divider />
            <StatRow label="Total Meta Tax" value={formatUSD(metrics.totalTaxUSD)} className="text-red-600" />
            <StatRow label="Effective Tax Rate" value={`${metrics.totalAdSpendUSD > 0 ? ((metrics.totalTaxUSD / metrics.totalAdSpendUSD) * 100).toFixed(1) : 0}%`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerView({ transactions, clients, cards }) {
  const [filter, setFilter] = useState('ALL');
  const filtered = transactions.filter(t => filter === 'ALL' || t.type === filter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Transaction Ledger</h1>
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={filter} onChange={(e) => setFilter(e.target.value)}>
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
                    {tx.type === 'USD_PURCHASE' && <div className="font-medium text-slate-800">Eff. Rate: ৳{((tx.amountBDT + (tx.cashOutCharge||0)) / tx.amountUSD).toFixed(2)}</div>}
                    {tx.type === 'AD_SPEND' && <div className="text-xs text-slate-500">{tx.adAccount} • {tx.campaign}</div>}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">
                    {tx.type === 'PAYMENT_RECEIVED' ? `+${formatBDT(tx.amountBDT)}` : '-'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">
                    {(tx.type === 'AD_SPEND' || tx.type === 'CARD_LOAD' || tx.type === 'USD_PURCHASE') 
                      ? formatUSD(tx.amountUSD + (tx.taxUSD||0)) 
                      : '-'}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClientsView({ clients, transactions, metrics, onAddClient, onEditClient, onDeleteClient, onViewDetails, onReceivePayment, onAddAdSpend }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });

  // Compute stats dynamically per client
  const clientStats = useMemo(() => {
    return clients.map(client => {
      const clientTx = transactions.filter(t => t.clientId === client.id);
      
      const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + t.amountBDT, 0);
      const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + t.amountUSD, 0);
      const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + (t.taxUSD||0), 0);
      
      const totalCostBDT = (adSpendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
      const profitBDT = revenue - totalCostBDT;
      const profitMargin = revenue > 0 ? (profitBDT / revenue) * 100 : 0;
      
      return { ...client, revenue, adSpendUSD, taxUSD, totalCostBDT, profitBDT, profitMargin };
    });
  }, [clients, transactions, metrics.avgUSDEffectiveRate]);

  // Filter & Sort
  const filteredClients = useMemo(() => {
    let result = clientStats.filter(c => {
      const matchSearch = (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.company.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [clientStats, searchTerm, statusFilter, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 inline text-slate-300" />;
    return <ArrowUpDown size={12} className={`ml-1 inline text-blue-600 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
        <button onClick={onAddClient} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search clients, business..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white min-w-[150px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Completed">Completed</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('name')}>
                  Client <SortIcon columnKey="name"/>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('status')}>
                  Status <SortIcon columnKey="status"/>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('revenue')}>
                  Revenue (BDT) <SortIcon columnKey="revenue"/>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('adSpendUSD')}>
                  Ad Spend (USD) <SortIcon columnKey="adSpendUSD"/>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" title={`Calculated using effective rate: ৳${metrics.avgUSDEffectiveRate.toFixed(2)}`} onClick={() => requestSort('totalCostBDT')}>
                  Total Cost (BDT) <SortIcon columnKey="totalCostBDT"/>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('profitBDT')}>
                  Profit (BDT) <SortIcon columnKey="profitBDT"/>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('profitMargin')}>
                  Margin <SortIcon columnKey="profitMargin"/>
                </th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-slate-500">No clients found.</td></tr>}
              {filteredClients.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.company}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium 
                      ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 
                        c.status === 'Paused' ? 'bg-orange-100 text-orange-700' : 
                        c.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-green-600">{formatBDT(c.revenue)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">{formatUSD(c.adSpendUSD)} <span className="text-xs font-normal text-slate-400 block">+{formatUSD(c.taxUSD)} tax</span></td>
                  <td className="px-5 py-4 text-right text-slate-600">{formatBDT(c.totalCostBDT)}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900">{formatBDT(c.profitBDT)}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-medium ${c.profitMargin > 50 ? 'text-green-600' : c.profitMargin > 20 ? 'text-blue-600' : c.profitMargin < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {c.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <ClientDropdownMenu 
                      onViewDetails={() => onViewDetails(c)}
                      onEdit={() => onEditClient(c)}
                      onReceivePayment={() => onReceivePayment(c)}
                      onAddAdSpend={() => onAddAdSpend(c)}
                      onDelete={() => onDeleteClient(c.id)}
                    />
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

function CardsView({ cards, metrics, transactions, onAddCard, onEditCard, onDeleteCard, onViewDetails, onLoadCard }) {
  const usdPurchases = transactions.filter(t => t.type === 'USD_PURCHASE');
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Cards & USD Ledger</h1>
        <button onClick={onAddCard} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          <Plus size={16} /> Add Card
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* GLOBAL USD POOL */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign size={100} />
          </div>
          <div>
            <p className="text-slate-400 font-medium mb-1">Global USD Wallet</p>
            <h2 className="text-4xl font-bold mb-4">{formatUSD(metrics.globalUSDBalance)}</h2>
            <div className="space-y-1 text-sm text-slate-300">
              <div className="flex justify-between"><span>Total Purchased:</span> <span>{formatUSD(metrics.totalUSDPurchased)}</span></div>
              <div className="flex justify-between"><span>Loaded to Cards:</span> <span>-{formatUSD(metrics.totalLoadedToCards)}</span></div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-sm">Avg. Effective Rate: <span className="font-bold text-white">৳{metrics.avgUSDEffectiveRate.toFixed(2)}</span></p>
          </div>
        </div>

        {/* CARDS */}
        {cards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    {card.name} 
                    {card.last4 && <span className="text-xs font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">*{card.last4}</span>}
                  </h3>
                  <p className="text-sm text-slate-500">{card.provider} • {card.cardType}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mr-2"><CreditCard size={20} /></div>
                  <CardDropdownMenu 
                    onEdit={() => onEditCard(card)} 
                    onDetails={() => onViewDetails(card)} 
                    onDelete={() => onDeleteCard(card.id)} 
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-1">Current Balance</p>
              <h2 className="text-3xl font-bold text-slate-800">{formatUSD(metrics.cardBalances[card.id])}</h2>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => onLoadCard(card)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors">Load Money</button>
              <button onClick={() => onViewDetails(card)} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors">Details</button>
            </div>
          </div>
        ))}
      </div>

      {/* USD PURCHASE HISTORY */}
      <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4">USD Purchase History</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 whitespace-normal align-middle">Date</th>
                <th className="px-5 py-3 whitespace-normal align-middle">Source</th>
                <th className="px-5 py-3 text-right whitespace-normal align-middle">BDT Paid</th>
                <th className="px-5 py-3 text-right text-red-600 whitespace-normal align-middle">C.O Rate</th>
                <th className="px-5 py-3 text-right font-bold text-slate-800 whitespace-normal align-middle">Total Cost</th>
                <th className="px-5 py-3 text-right whitespace-normal align-middle">USD Received</th>
                <th className="px-5 py-3 text-right whitespace-normal align-middle">Base Rate</th>
                <th className="px-5 py-3 text-right text-blue-600 whitespace-normal align-middle">Effective Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usdPurchases.map(tx => {
                const baseRate = (tx.amountBDT / tx.amountUSD).toFixed(2);
                const totalCost = tx.amountBDT + (tx.cashOutCharge || 0);
                const effectiveRate = (totalCost / tx.amountUSD).toFixed(2);

                return (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{tx.notes}</td>
                  <td className="px-5 py-3 text-right text-slate-600 whitespace-nowrap">{formatBDT(tx.amountBDT)}</td>
                  <td className="px-5 py-3 text-right text-red-500 whitespace-nowrap">{tx.cashOutCharge ? formatBDT(tx.cashOutCharge) : '-'}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatBDT(totalCost)}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600 whitespace-nowrap">{formatUSD(tx.amountUSD)}</td>
                  <td className="px-5 py-3 text-right text-slate-500 whitespace-nowrap">৳{baseRate}</td>
                  <td className="px-5 py-3 text-right font-medium text-blue-600 whitespace-nowrap">৳{effectiveRate}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTS ---

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {React.cloneElement(icon, { size: 18, className: isActive ? 'text-white' : 'text-slate-400' })}
      {label}
    </button>
  );
}

function MetricCard({ title, value, subtitle, icon, bgColor, textColorClass = 'text-slate-900' }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <h3 className={`text-2xl font-bold tracking-tight ${textColorClass}`}>{value}</h3>
      <div className="mt-2 flex items-center text-xs">
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

function Divider() { return <div className="h-px w-full bg-slate-100 my-2"></div>; }

function TransactionTypeBadge({ type }) {
  const styles = { PAYMENT_RECEIVED: 'bg-green-100 text-green-700 border-green-200', USD_PURCHASE: 'bg-blue-100 text-blue-700 border-blue-200', AD_SPEND: 'bg-purple-100 text-purple-700 border-purple-200', CARD_LOAD: 'bg-orange-100 text-orange-700 border-orange-200' };
  const labels = { PAYMENT_RECEIVED: 'Payment In', USD_PURCHASE: 'Buy USD', AD_SPEND: 'Meta Ads', CARD_LOAD: 'Card Load' };
  return <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${styles[type] || 'bg-slate-100 text-slate-600'}`}>{labels[type] || type}</span>;
}

function Modal({ title, onClose, children, width = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-xl w-full ${width} overflow-hidden flex flex-col max-h-[95vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

function CardDropdownMenu({ onEdit, onDetails, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
          <button onClick={() => {onEdit(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Edit Card</button>
          <button onClick={() => {onDetails(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">View Details</button>
          <div className="h-px w-full bg-slate-100 my-1"></div>
          <button onClick={() => {onDelete(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between">Delete Card <Trash2 size={14}/></button>
        </div>
      )}
    </div>
  );
}

function ClientDropdownMenu({ onViewDetails, onEdit, onReceivePayment, onAddAdSpend, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
          <button onClick={() => {onViewDetails(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">View Details</button>
          <button onClick={() => {onEdit(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Edit Client</button>
          <div className="h-px w-full bg-slate-100 my-1"></div>
          <button onClick={() => {onReceivePayment(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50">Receive Payment</button>
          <button onClick={() => {onAddAdSpend(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50">Add Ad Spend</button>
          <div className="h-px w-full bg-slate-100 my-1"></div>
          <button onClick={() => {onDelete(); setIsOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between">Delete Client <Trash2 size={14}/></button>
        </div>
      )}
    </div>
  );
}

// --- FORMS & MODALS ---

function ClientForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    name: '', company: '', phone: '', email: '', fb: '', ig: '', website: '',
    serviceType: 'Meta Ads', budget: '', status: 'Active', 
    dateAdded: new Date().toISOString().split('T')[0], notes: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit({...formData, budget: parseFloat(formData.budget||0)}); };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
  const labelClass = "block text-xs font-medium text-slate-700 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><label className={labelClass}>Client Name *</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClass} /></div>
        <div><label className={labelClass}>Business / Company Name *</label><input type="text" name="company" value={formData.company} onChange={handleChange} required className={inputClass} /></div>
        
        <div><label className={labelClass}>Phone Number</label><input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} /></div>
        <div><label className={labelClass}>Email Address</label><input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} /></div>
        
        <div><label className={labelClass}>Facebook Page URL</label><input type="text" name="fb" value={formData.fb} onChange={handleChange} placeholder="fb.com/..." className={inputClass} /></div>
        <div><label className={labelClass}>Instagram Account</label><input type="text" name="ig" value={formData.ig} onChange={handleChange} placeholder="@username" className={inputClass} /></div>
        
        <div><label className={labelClass}>Website URL</label><input type="text" name="website" value={formData.website} onChange={handleChange} placeholder="https://" className={inputClass} /></div>
        <div>
          <label className={labelClass}>Service Type</label>
          <select name="serviceType" value={formData.serviceType} onChange={handleChange} className={inputClass}>
            <option>Meta Ads</option><option>Google Ads</option><option>Social Media Management</option><option>Content Marketing</option><option>Other</option>
          </select>
        </div>
        
        <div><label className={labelClass}>Monthly Budget (Contract/Agreed BDT)</label><input type="number" name="budget" value={formData.budget} onChange={handleChange} placeholder="0.00" className={inputClass} /></div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
            <option>Active</option><option>Paused</option><option>Completed</option><option>Inactive</option>
          </select>
        </div>
        
        <div><label className={labelClass}>Start Date</label><input type="date" name="dateAdded" value={formData.dateAdded} onChange={handleChange} required className={inputClass} /></div>
      </div>
      <div><label className={labelClass}>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass}></textarea></div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Client</button>
      </div>
    </form>
  );
}

function CardForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    name: '', provider: '', cardType: 'Virtual Card', currency: 'USD',
    initialBalance: 0, last4: '', expiry: '', notes: '', status: 'Active'
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };
  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium text-slate-700">Card Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. RedotPay Primary" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Provider</label>
          <input type="text" name="provider" value={formData.provider} onChange={handleChange} required placeholder="e.g. RedotPay, City Bank" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Card Type</label>
          <select name="cardType" value={formData.cardType} onChange={handleChange} className={inputClass}>
            <option>Virtual Card</option><option>Dual Currency</option><option>Credit Card</option><option>Prepaid Card</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Initial Balance</label>
          <input type="number" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} disabled={!!initialData} className={`${inputClass} ${initialData ? 'bg-slate-100' : ''}`} />
          {initialData && <p className="text-xs text-slate-500 mt-1">Cannot edit initial balance after creation.</p>}
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Currency</label>
          <input type="text" name="currency" value={formData.currency} disabled className={`${inputClass} bg-slate-100`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Last 4 Digits (Opt)</label>
          <input type="text" maxLength="4" name="last4" value={formData.last4} onChange={handleChange} placeholder="1234" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Expiry Date (Opt)</label>
          <input type="text" name="expiry" value={formData.expiry} onChange={handleChange} placeholder="MM/YY" className={inputClass} />
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

function ClientDetailsModal({ client, metrics, transactions, onClose, onReceivePayment, onAdSpend }) {
  const clientTx = useMemo(() => transactions.filter(t => t.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date)), [transactions, client.id]);
  
  // Stats Calculation
  const stats = useMemo(() => {
    const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + t.amountBDT, 0);
    const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + t.amountUSD, 0);
    const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + (t.taxUSD||0), 0);
    const totalCostBDT = (adSpendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
    const profitBDT = revenue - totalCostBDT;
    const margin = revenue > 0 ? (profitBDT / revenue) * 100 : 0;
    const outstanding = client.budget ? client.budget - revenue : 0;
    
    return { revenue, adSpendUSD, taxUSD, totalCostBDT, profitBDT, margin, outstanding };
  }, [clientTx, metrics.avgUSDEffectiveRate, client.budget]);

  // Campaign Extraction
  const campaigns = useMemo(() => {
    const map = {};
    clientTx.filter(t => t.type === 'AD_SPEND').forEach(t => {
      const key = `${t.adAccount || 'Unknown'} - ${t.campaign || 'Unknown'}`;
      if(!map[key]) map[key] = { account: t.adAccount||'Unknown', campaign: t.campaign||'Unknown', spend: 0, tax: 0 };
      map[key].spend += t.amountUSD;
      map[key].tax += (t.taxUSD||0);
    });
    return Object.values(map);
  }, [clientTx]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data = [...clientTx].reverse().reduce((acc, t) => {
      const d = t.date.substring(5); // MM-DD
      if(!acc[d]) acc[d] = { date: d, revenue: 0, cost: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += t.amountBDT;
      if (t.type === 'AD_SPEND') acc[d].cost += ((t.amountUSD + (t.taxUSD||0)) * metrics.avgUSDEffectiveRate);
      return acc;
    }, {});
    return Object.values(data);
  }, [clientTx, metrics.avgUSDEffectiveRate]);

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Client Overview Header */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{client.name}</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${client.status === 'Active' ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-300'}`}>{client.status}</span>
          </div>
          <p className="text-slate-400 font-medium">{client.company} • {client.serviceType}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-300">
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span>✉️ {client.email}</span>}
            {client.fb && <span>🌐 {client.fb}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onReceivePayment} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">+ Payment</button>
          <button onClick={onAdSpend} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">+ Ad Spend</button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatBDT(stats.revenue)} icon={<ArrowDownRight size={18} className="text-green-600" />} bgColor="bg-green-50" />
        <MetricCard title="Total Ad Spend" value={formatUSD(stats.adSpendUSD)} subtitle={`Tax: ${formatUSD(stats.taxUSD)}`} icon={<Activity size={18} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Total Cost (BDT)" value={formatBDT(stats.totalCostBDT)} icon={<Wallet size={18} className="text-orange-600" />} bgColor="bg-orange-50" />
        <MetricCard title="Net Profit" value={formatBDT(stats.profitBDT)} subtitle={`Margin: ${stats.margin.toFixed(1)}%`} icon={<TrendingUp size={18} className="text-blue-600" />} bgColor="bg-blue-50" textColorClass={stats.profitBDT < 0 ? 'text-red-600' : 'text-slate-900'} />
      </div>

      {/* Budget & Outstanding */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-4">Contract / Budget Tracking</h4>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Agreed Amount: {formatBDT(client.budget)}</span>
            <span className="font-medium text-slate-800">Received: {formatBDT(stats.revenue)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (stats.revenue / (client.budget || 1)) * 100)}%` }}></div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Outstanding:</span>
            <span className={`font-bold ${stats.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {stats.outstanding > 0 ? formatBDT(stats.outstanding) : 'Fully Paid'}
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-4">Performance Overview</h4>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(val) => `৳${val/1000}k`} />
                <Tooltip />
                <Bar dataKey="revenue" name="Revenue (BDT)" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="cost" name="Cost (BDT)" fill="#f97316" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Campaigns & Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Campaign Summary */}
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h4 className="font-bold text-slate-800">Campaign Summary</h4>
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-white text-slate-500 sticky top-0 border-b border-slate-100 shadow-sm">
                <tr><th className="px-4 py-2">Campaign & Account</th><th className="px-4 py-2 text-right">Spend</th><th className="px-4 py-2 text-right">Tax</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.length === 0 && <tr><td colSpan="3" className="text-center py-6 text-slate-500">No campaigns recorded.</td></tr>}
                {campaigns.map((camp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{camp.campaign}</div>
                      <div className="text-xs text-slate-500">{camp.account}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatUSD(camp.spend)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatUSD(camp.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Client Ledger */}
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-800">Client Ledger</h4>
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-white text-slate-500 sticky top-0 border-b border-slate-100 shadow-sm">
                <tr><th className="px-4 py-2">Date / Type</th><th className="px-4 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clientTx.length === 0 && <tr><td colSpan="2" className="text-center py-6 text-slate-500">No transactions yet.</td></tr>}
                {clientTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-500">{formatDate(tx.date)}</div>
                      <div className="font-medium text-slate-800">{tx.type.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{tx.notes || tx.campaign}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.type === 'PAYMENT_RECEIVED' ? (
                        <span className="font-bold text-green-600">+{formatBDT(tx.amountBDT)}</span>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-800">{formatUSD(tx.amountUSD + (tx.taxUSD||0))}</span>
                          <span className="block text-[10px] text-slate-400">({formatBDT((tx.amountUSD + (tx.taxUSD||0)) * metrics.avgUSDEffectiveRate)})</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function CardDetailsModal({ card, metrics, transactions, onClose }) {
  const cardTxs = transactions.filter(t => t.cardId === card.id).sort((a,b) => new Date(a.date) - new Date(b.date));

  let runningBal = parseFloat(card.initialBalance || 0);
  const historyWithBalance = cardTxs.map(t => {
    let changeUSD = 0;
    if (t.type === 'CARD_LOAD') changeUSD = parseFloat(t.amountUSD || 0);
    if (t.type === 'AD_SPEND') changeUSD = -(parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0));
    runningBal += changeUSD;
    return { ...t, changeUSD, runningBal };
  }).reverse(); 

  const stats = metrics.cardStats[card.id] || { loaded: 0, spent: 0 };
  const currentBal = metrics.cardBalances[card.id] || 0;

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Current Balance</p>
          <p className="text-xl font-bold text-slate-900">{formatUSD(currentBal)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Loaded</p>
          <p className="text-lg font-bold text-green-600">+{formatUSD(stats.loaded)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Total Spent</p>
          <p className="text-lg font-bold text-red-600">-{formatUSD(stats.spent)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Initial Balance</p>
          <p className="text-lg font-semibold text-slate-700">{formatUSD(card.initialBalance)}</p>
        </div>
      </div>
      
      <div className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded border border-blue-100 flex justify-between">
        <span><strong>Provider:</strong> {card.provider}</span>
        <span><strong>Type:</strong> {card.cardType}</span>
        {card.last4 && <span><strong>Last 4:</strong> {card.last4}</span>}
      </div>

      <h4 className="font-bold text-slate-800 mb-3 border-b pb-2">Transaction History</h4>
      
      <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type / Desc</th>
              <th className="px-4 py-3 text-right">Amount (USD)</th>
              <th className="px-4 py-3 text-right font-bold">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyWithBalance.length === 0 && (
              <tr><td colSpan="4" className="text-center py-6 text-slate-500">No transactions found for this card.</td></tr>
            )}
            {historyWithBalance.map(tx => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDate(tx.date)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{tx.type.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-500">{tx.notes || tx.campaign}</div>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${tx.changeUSD > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                  {tx.changeUSD > 0 ? '+' : ''}{formatUSD(tx.changeUSD)}
                  {tx.taxUSD > 0 && <span className="block text-xs text-red-500 font-normal">inc. tax ${tx.taxUSD.toFixed(2)}</span>}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatUSD(tx.runningBal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionForm({ type, clients, cards, metrics, initialClientId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amountBDT: '', cashOutCharge: '', amountUSD: '',
    clientId: initialClientId || (clients?.[0]?.id || ''),
    cardId: cards?.[0]?.id || '',
    taxUSD: '', notes: '',
    adAccount: '', campaign: '' // New fields for Ad Spend
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
      payload.cashOutCharge = parseFloat(formData.cashOutCharge || 0);
      payload.amountUSD = parseFloat(formData.amountUSD);
    } else if (type === 'AD_SPEND') {
      payload.amountUSD = parseFloat(formData.amountUSD);
      payload.taxUSD = parseFloat(formData.taxUSD || 0);
      payload.clientId = formData.clientId;
      payload.cardId = formData.cardId;
      payload.adAccount = formData.adAccount;
      payload.campaign = formData.campaign;
    } else if (type === 'CARD_LOAD') {
      payload.amountUSD = parseFloat(formData.amountUSD);
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

      {type === 'PAYMENT_RECEIVED' && (
        <>
          <div><label className={labelClass}>Client</label>
            <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Amount Received (BDT)</label>
            <input type="number" step="0.01" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="0.00" className={inputClass} />
          </div>
        </>
      )}

      {type === 'CARD_LOAD' && (
        <>
          <div className="bg-orange-50 p-3 rounded border border-orange-100 text-sm mb-4">
            <span className="text-orange-800 font-medium block">Global USD Available: {formatUSD(metrics?.globalUSDBalance)}</span>
            <span className="text-slate-600 text-xs">Loading will deduct from global balance.</span>
          </div>
          <div><label className={labelClass}>Target Card</label>
            <select name="cardId" value={formData.cardId} onChange={handleChange} className={inputClass}>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Amount to Load (USD)</label>
            <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="0.00" className={inputClass} />
          </div>
        </>
      )}

      {type === 'USD_PURCHASE' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>BDT Paid</label>
              <input type="number" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="0" className={inputClass} />
            </div>
            <div><label className={labelClass}>Cash-out Charge (BDT)</label>
              <input type="number" name="cashOutCharge" value={formData.cashOutCharge} onChange={handleChange} placeholder="0" className={inputClass} />
            </div>
          </div>
          <div><label className={labelClass}>USD Received</label>
            <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="0.00" className={inputClass} />
          </div>
          {(formData.amountBDT && formData.amountUSD) ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <div className="flex justify-between"><span>Total BDT Cost:</span> <strong>৳{parseFloat(formData.amountBDT || 0) + parseFloat(formData.cashOutCharge || 0)}</strong></div>
              <div className="flex justify-between text-slate-500"><span>Base Rate:</span> <span>৳{(parseFloat(formData.amountBDT) / parseFloat(formData.amountUSD)).toFixed(2)}</span></div>
              <div className="flex justify-between text-blue-600 font-medium"><span>Effective Rate:</span> <span>৳{((parseFloat(formData.amountBDT) + parseFloat(formData.cashOutCharge || 0)) / parseFloat(formData.amountUSD)).toFixed(2)}</span></div>
            </div>
          ) : null}
        </>
      )}

      {type === 'AD_SPEND' && (
        <>
          <div className="grid grid-cols-2 gap-4">
             <div><label className={labelClass}>Client</label>
              <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>{clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}</select>
            </div>
            <div><label className={labelClass}>Card Used</label>
              <select name="cardId" value={formData.cardId} onChange={handleChange} className={inputClass}>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Ad Account Name</label>
              <input type="text" name="adAccount" value={formData.adAccount} onChange={handleChange} placeholder="e.g. Client Ads 1" className={inputClass} />
            </div>
            <div><label className={labelClass}>Campaign Name</label>
              <input type="text" name="campaign" value={formData.campaign} onChange={handleChange} placeholder="e.g. Lead Gen" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Ad Spend (USD)</label>
              <input type="number" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="0.00" className={inputClass} />
            </div>
            <div><label className={labelClass}>Tax/VAT (USD)</label>
              <input type="number" step="0.01" name="taxUSD" value={formData.taxUSD} onChange={handleChange} placeholder="0.00" className={inputClass} />
            </div>
          </div>
        </>
      )}

      <div><label className={labelClass}>Notes / Details</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass}></textarea>
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Transaction</button>
      </div>
    </form>
  );
}
