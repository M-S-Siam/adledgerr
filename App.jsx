import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, CreditCard, DollarSign, 
  Activity, FileText, Settings, Plus, Search, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, 
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, Trash2, CalendarDays
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area
} from 'recharts';

// --- SAFE VERSIONED DATA MIGRATION ---
const APP_DATA_VERSION = "2";

if (typeof window !== "undefined") {
  try {
    const storedVersion = window.localStorage.getItem('adledger_version');
    if (storedVersion !== APP_DATA_VERSION) {
      window.localStorage.removeItem('adledger_clients');
      window.localStorage.removeItem('adledger_cards');
      window.localStorage.removeItem('adledger_transactions');
      window.localStorage.setItem('adledger_version', APP_DATA_VERSION);
      console.log("AdLedger: Safely migrated to data version", APP_DATA_VERSION);
    }
  } catch (error) {
    console.error("AdLedger: Migration failed", error);
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

// --- CLEAN INITIAL STATE ---
const INITIAL_CLIENTS = [];
const INITIAL_CARDS = [];
const INITIAL_TRANSACTIONS = [];

// --- NORMALIZED FORMATTERS (PREVENTS -$0.00) ---
const formatBDT = (amount) => {
  let val = parseFloat(amount) || 0;
  if (Math.abs(val) < 0.005) val = 0; // Normalize microscopic negative values
  return `৳${val.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const formatUSD = (amount) => {
  let val = parseFloat(amount) || 0;
  if (Math.abs(val) < 0.005) val = 0; // Normalize to true zero
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  return `${isNegative ? '-' : ''}$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getBudgetDisplay = (type, amount) => {
  const formatted = formatBDT(amount);
  if (type === 'Daily') return `${formatted} / day`;
  if (type === 'Weekly') return `${formatted} / week`;
  if (type === 'Monthly') return `${formatted} / month`;
  if (type === 'Custom / Total') return `${formatted} total`;
  return formatted;
};

const getClientDisplayStatus = (client) => {
  if (client.currentlyWorking) return 'Active / Currently Working';
  if (!client.endDate) return client.status || 'Active';

  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(client.endDate);
  end.setHours(0,0,0,0);

  if (today > end) return 'Completed / Ended';
  return client.status || 'Active';
};

const getDurationDays = (client) => {
  if (!client.startDate) return 0;
  const start = new Date(client.startDate);
  start.setHours(0,0,0,0);
  
  let end;
  if (client.currentlyWorking) {
    end = new Date();
  } else {
    if (!client.endDate) return 0; 
    end = new Date(client.endDate);
  }
  end.setHours(0,0,0,0);

  const diffTime = end - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  return diffDays > 0 ? diffDays : 0;
};

const getCampaignDurationDisplay = (client) => {
  const days = getDurationDays(client);
  if (days === 0) return 'N/A';
  if (client.currentlyWorking) return `${days} Days and counting`;
  return `${days} Day${days !== 1 ? 's' : ''}`;
};

const getExpectedBudgetBDT = (client, durationDays) => {
  const amt = parseFloat(client.budgetAmount || client.budget || 0);
  if (!amt) return 0;
  
  const type = client.budgetType || 'Monthly';
  if (type === 'Daily') return amt * durationDays;
  if (type === 'Weekly') return (amt / 7) * durationDays;
  if (type === 'Monthly') return (amt / 30) * durationDays;
  return amt; 
};

const DATE_PRESETS = [
  'Lifetime', 'Today', 'Yesterday', 'Last 7 Days', 'Last 14 Days', 
  'Last 28 Days', 'Last 30 Days', 'This Week', 'Last Week', 
  'This Month', 'Last Month', 'This Year', 'Last Year'
];

const getPresetDates = (preset) => {
  if (preset === 'Lifetime') return { start: null, end: null };
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(today);
  const start = new Date(today);

  const formatDateString = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  switch(preset) {
    case 'Today': break;
    case 'Yesterday': 
      start.setDate(start.getDate() - 1); 
      end.setDate(end.getDate() - 1); 
      break;
    case 'Last 7 Days': start.setDate(start.getDate() - 6); break;
    case 'Last 14 Days': start.setDate(start.getDate() - 13); break;
    case 'Last 28 Days': start.setDate(start.getDate() - 27); break;
    case 'Last 30 Days': start.setDate(start.getDate() - 29); break;
    case 'This Week': 
      const day = start.getDay(); 
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      break;
    case 'Last Week':
      const dayLW = start.getDay();
      const diffLW = start.getDate() - dayLW + (dayLW === 0 ? -6 : 1) - 7;
      start.setDate(diffLW);
      end.setDate(diffLW + 6);
      break;
    case 'This Month': start.setDate(1); break;
    case 'Last Month': 
      start.setMonth(start.getMonth() - 1); start.setDate(1);
      end.setDate(0); 
      break;
    case 'This Year': start.setMonth(0); start.setDate(1); break;
    case 'Last Year':
      start.setFullYear(start.getFullYear() - 1); start.setMonth(0); start.setDate(1);
      end.setFullYear(end.getFullYear() - 1); end.setMonth(11); end.setDate(31);
      break;
    default: return { start: null, end: null };
  }
  return { start: formatDateString(start), end: formatDateString(end) };
};

// --- MAIN APPLICATION ---
export default function AdLedgerApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // State Data (Persisted)
  const [clients, setClients] = useLocalStorage('adledger_clients', INITIAL_CLIENTS);
  const [cards, setCards] = useLocalStorage('adledger_cards', INITIAL_CARDS);
  const [transactions, setTransactions] = useLocalStorage('adledger_transactions', INITIAL_TRANSACTIONS);
  
  // Clean invalid Meta Ads on load (Purges old demo data with zero amounts)
  useEffect(() => {
    const hasZeroAdSpend = transactions.some(t => t.type === 'AD_SPEND' && (parseFloat(t.amountUSD) || 0) <= 0);
    if (hasZeroAdSpend) {
      setTransactions(prev => prev.filter(t => !(t.type === 'AD_SPEND' && (parseFloat(t.amountUSD) || 0) <= 0)));
    }
  }, [transactions, setTransactions]);

  // Modal State
  const [activeModal, setActiveModal] = useState(null); 
  const [selectedCard, setSelectedCard] = useState(null); 
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState(null); 

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
      cardStats[c.id] = { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
    });

    transactions.forEach(t => {
      if (t.type === 'PAYMENT_RECEIVED') totalRevenueBDT += parseFloat(t.amountBDT || 0);
      
      if (t.type === 'USD_PURCHASE') {
        const usdVal = parseFloat(t.amountUSD || 0);
        totalUSDPurchased += usdVal;
        totalBDTSpentOnUSD += parseFloat(t.amountBDT || 0);
        totalCashOutCharges += parseFloat(t.cashOutCharge || 0);
        
        if (t.cardId && cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] += usdVal;
          cardStats[t.cardId].purchased += usdVal;
        }
      }
      
      if (t.type === 'AD_SPEND') {
        const spend = parseFloat(t.amountUSD || 0);
        const tax = parseFloat(t.taxUSD || 0);
        const totalSpend = spend + tax;
        totalAdSpendUSD += spend;
        totalTaxUSD += tax;
        if (t.cardId && cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] -= totalSpend;
          cardStats[t.cardId].adSpend += spend;
          cardStats[t.cardId].tax += tax;
        }
      }

      if (t.type === 'FEE') {
        const fee = parseFloat(t.amountUSD || 0);
        if (t.cardId && cardBalances[t.cardId] !== undefined) {
          cardBalances[t.cardId] -= fee;
          cardStats[t.cardId].fees += fee;
        }
      }
    });

    const totalBDTCostOfUSD = totalBDTSpentOnUSD + totalCashOutCharges;
    const avgUSDEffectiveRate = totalUSDPurchased > 0 ? (totalBDTCostOfUSD / totalUSDPurchased) : 0; 
    
    const totalAdCostBDT = (totalAdSpendUSD + totalTaxUSD) * avgUSDEffectiveRate;
    const netProfitBDT = totalRevenueBDT - totalAdCostBDT;
    const profitMargin = totalRevenueBDT > 0 ? (netProfitBDT / totalRevenueBDT) * 100 : 0;
    
    const totalCardBalance = Object.values(cardBalances).reduce((a, b) => a + b, 0);

    return {
      totalRevenueBDT, totalUSDPurchased, avgUSDEffectiveRate,
      totalAdSpendUSD, totalTaxUSD, netProfitBDT, profitMargin,
      cardBalances, cardStats, totalCardBalance
    };
  }, [transactions, cards]);

  const revenueChartData = useMemo(() => {
    const grouped = transactions.filter(t => t.type === 'PAYMENT_RECEIVED' || t.type === 'AD_SPEND').reduce((acc, t) => {
      const d = t.date.substring(5);
      if (!acc[d]) acc[d] = { date: d, revenue: 0, spendUSD: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += parseFloat(t.amountBDT || 0);
      if (t.type === 'AD_SPEND') acc[d].spendUSD += (parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0));
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  const handleAddTransaction = (newTx) => {
    const tx = { 
      ...newTx, 
      id: `t_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      timestamp: Date.now() 
    };
    setTransactions(prev => {
      const updated = [tx, ...prev];
      return updated.sort((a, b) => {
        const tA = a.timestamp || new Date(a.date).getTime();
        const tB = b.timestamp || new Date(b.date).getTime();
        return tB - tA; // Newest first
      });
    });
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

  const handleMarkClientStatus = (client) => {
    const isWorking = client.currentlyWorking || getClientDisplayStatus(client).includes('Active');
    if (isWorking) {
      const today = new Date().toISOString().split('T')[0];
      if (window.confirm(`Mark ${client.name} as completed?`)) {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Completed', currentlyWorking: false, endDate: c.endDate || today } : c));
      }
    } else {
      if (window.confirm(`Mark ${client.name} as active/currently working?`)) {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Active', currentlyWorking: true, endDate: '' } : c));
      }
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
              <input type="text" placeholder="Search..." className="bg-transparent border-none focus:outline-none text-sm ml-2 w-64" />
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
          <TransactionForm type="USD_PURCHASE" cards={cards} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === 'spend' && (
        <Modal title="Record Meta Ad Spend" onClose={() => setActiveModal(null)}>
          <TransactionForm type="AD_SPEND" clients={clients} cards={cards} initialClientId={selectedClient?.id} onSubmit={handleAddTransaction} onCancel={() => setActiveModal(null)} />
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
      {selectedClientHistory && (
        <ClientTransactionHistoryModal
          client={selectedClientHistory}
          transactions={transactions}
          onClose={() => setSelectedClientHistory(null)}
        />
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
        <MetricCard title="Net Profit" value={formatBDT(metrics.netProfitBDT)} subtitle={`Margin: ${metrics.profitMargin.toFixed(1)}%`} icon={<TrendingUp size={20} className="text-blue-600" />} bgColor="bg-blue-50" textColorClass={metrics.netProfitBDT < 0 ? 'text-red-600' : 'text-slate-900'} />
        <MetricCard title="Meta Ads Spend" value={formatUSD(metrics.totalAdSpendUSD)} subtitle={`+ Tax ${formatUSD(metrics.totalTaxUSD)}`} icon={<Activity size={20} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Total Card Balance" value={formatUSD(metrics.totalCardBalance)} subtitle="Available across all cards" icon={<Wallet size={20} className="text-orange-600" />} bgColor="bg-orange-50" textColorClass={metrics.totalCardBalance < 0 ? 'text-red-600' : 'text-slate-900'} />
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
            <StatRow label="Active Clients" value={clients.filter(c => c.status === 'Active' || c.currentlyWorking).length} />
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
  const [dateRange, setDateRange] = useState({ label: 'Lifetime', start: null, end: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);

  const flatTransactions = useMemo(() => {
    let list = [];
    transactions.forEach(t => {
      const client = clients.find(c => c.id === t.clientId);
      const card = cards.find(c => c.id === t.cardId);
      const clientName = client ? client.name : '';
      const cardName = card ? card.name : '';

      if (t.type === 'AD_SPEND') {
        const spend = parseFloat(t.amountUSD || 0);
        const tax = parseFloat(t.taxUSD || 0);
        
        if (spend > 0) {
          list.push({
            ...t, displayType: 'AD_SPEND', inBDT: null, outUSD: spend,
            clientName, cardName, entityDesc: clientName,
            desc: t.notes || 'Meta Ads Spend',
            searchString: `${t.notes||''} ${clientName} ${cardName} Meta Ads`.toLowerCase()
          });
        }
        if (tax > 0) {
          list.push({
            ...t, id: t.id + '_tax', displayType: 'TAX', inBDT: null, outUSD: tax,
            desc: 'Meta Ads Tax' + (t.notes ? ' - ' + t.notes : ''),
            clientName, cardName, entityDesc: clientName,
            searchString: `meta ads tax ${t.notes||''} ${clientName} ${cardName}`.toLowerCase()
          });
        }
      } else if (t.type === 'USD_PURCHASE') {
        list.push({
          ...t, displayType: 'USD_PURCHASE', inBDT: parseFloat(t.amountBDT || 0), outUSD: parseFloat(t.amountUSD || 0),
          clientName, cardName, entityDesc: cardName,
          desc: t.notes || 'Buy USD',
          searchString: `${t.notes||''} ${cardName} USD Purchase`.toLowerCase()
        });
      } else if (t.type === 'PAYMENT_RECEIVED') {
        list.push({
          ...t, displayType: 'PAYMENT_RECEIVED', inBDT: parseFloat(t.amountBDT || 0), outUSD: null,
          clientName, cardName, entityDesc: clientName,
          desc: t.notes || 'Payment Received',
          searchString: `${t.notes||''} ${clientName} Payment Received`.toLowerCase()
        });
      } else {
        list.push({
          ...t, displayType: t.type, inBDT: parseFloat(t.amountBDT || 0), outUSD: parseFloat(t.amountUSD || 0),
          clientName, cardName, entityDesc: clientName || cardName,
          desc: t.notes || t.type,
          searchString: `${t.notes||''} ${clientName} ${cardName} ${t.type}`.toLowerCase()
        });
      }
    });
    
    return list.sort((a, b) => {
      const tA = a.timestamp || new Date(a.date).getTime();
      const tB = b.timestamp || new Date(b.date).getTime();
      return tB - tA; // Newest first
    });
  }, [transactions, clients, cards]);

  const filteredTransactions = useMemo(() => {
    return flatTransactions.filter(t => {
      if (dateRange.start && dateRange.end) {
        if (t.date < dateRange.start || t.date > dateRange.end) return false;
      }
      if (typeFilter !== 'ALL' && t.displayType !== typeFilter) return false;
      if (searchQuery) {
        if (!t.searchString.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [flatTransactions, dateRange, typeFilter, searchQuery]);

  const summary = useMemo(() => {
    let totalBDTIn = 0;
    let totalUSDOut = 0;
    filteredTransactions.forEach(t => {
      if (t.inBDT) totalBDTIn += t.inBDT;
      if (t.outUSD) totalUSDOut += t.outUSD;
    });
    return { totalBDTIn, totalUSDOut, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const getTypeLabel = (type) => {
    const map = {
      'USD_PURCHASE': 'Buy USD',
      'AD_SPEND': 'Meta Ads',
      'TAX': 'Tax',
      'PAYMENT_RECEIVED': 'Receive BDT',
      'FEE': 'Card Fee'
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Transaction Ledger</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search transactions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <select 
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none cursor-pointer"
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="USD_PURCHASE">Buy USD</option>
            <option value="AD_SPEND">Meta Ads</option>
            <option value="TAX">Tax</option>
            <option value="PAYMENT_RECEIVED">Receive BDT</option>
            <option value="FEE">Card Fee</option>
          </select>
          <button 
            onClick={() => setIsDatePickerOpen(true)} 
            className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <CalendarDays size={16} className="text-blue-600" /> 
            {dateRange.label === 'Lifetime' ? 'Filter Date' : dateRange.label}
          </button>
          {dateRange.label !== 'Lifetime' && (
            <button onClick={() => setDateRange({label: 'Lifetime', start: null, end: null})} className="text-xs text-red-600 hover:underline font-medium">Clear</button>
          )}
        </div>
      </div>

      {isDatePickerOpen && (
        <DateRangePickerModal 
          onClose={() => setIsDatePickerOpen(false)} 
          onApply={(range) => { setDateRange(range); setIsDatePickerOpen(false); }} 
          initialRange={dateRange}
        />
      )}

      {selectedTxForModal && (
        <LedgerTransactionModal tx={selectedTxForModal} onClose={() => setSelectedTxForModal(null)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Total BDT In</p>
          <p className="text-xl font-bold text-green-600">{formatBDT(summary.totalBDTIn)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Total USD Out</p>
          <p className="text-xl font-bold text-slate-800">{formatUSD(summary.totalUSDOut)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Transactions</p>
          <p className="text-xl font-bold text-blue-600">{summary.count}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
              {filteredTransactions.length === 0 && (
                <tr><td colSpan="6" className="text-center py-12 text-slate-500">No transactions found.</td></tr>
              )}
              {filteredTransactions.map(tx => (
                <tr key={tx.id} onClick={() => setSelectedTxForModal(tx)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                  <td className="px-5 py-3 text-slate-600">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3 font-medium text-slate-700">{getTypeLabel(tx.displayType)}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate" title={tx.desc}>{tx.desc}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{tx.entityDesc || '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-green-600">
                    {tx.inBDT ? formatBDT(tx.inBDT) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {tx.outUSD ? formatUSD(tx.outUSD) : '—'}
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

function LedgerTransactionModal({ tx, onClose }) {
  return (
    <Modal title="Transaction Details" onClose={onClose} width="max-w-lg">
      <div className="space-y-4 text-sm">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 uppercase font-medium block">Reference ID</span>
            <span className="font-mono text-xs font-bold text-slate-800">{tx.id.replace('_tax', '')}</span>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{tx.displayType.replace('_', ' ')}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Date</span><span className="font-bold text-slate-800">{formatDate(tx.date)}</span></div>
          {tx.clientName && <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Client</span><span className="font-bold text-slate-800">{tx.clientName}</span></div>}
          {tx.cardName && <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Card</span><span className="font-bold text-blue-600">{tx.cardName}</span></div>}
          {tx.type === 'USD_PURCHASE' && <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Source</span><span className="font-bold text-slate-800">{tx.notes || 'N/A'}</span></div>}
        </div>

        {tx.type === 'USD_PURCHASE' && (
          <>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between"><span>BDT Paid:</span><span className="font-medium text-slate-800">{formatBDT(tx.amountBDT)}</span></div>
              <div className="flex justify-between"><span>C.O Rate:</span><span className="font-medium text-slate-800">{formatBDT(tx.cashOutCharge)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 text-sm"><span>Total Cost:</span><span className="text-slate-900">{formatBDT(parseFloat(tx.amountBDT||0) + parseFloat(tx.cashOutCharge||0))}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">USD Received</span><span className="font-bold text-green-600">{formatUSD(tx.amountUSD)}</span></div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded"><span className="text-blue-600 block font-medium">Effective Rate</span><span className="font-bold text-blue-700">৳{((parseFloat(tx.amountBDT||0) + parseFloat(tx.cashOutCharge||0)) / parseFloat(tx.amountUSD||1)).toFixed(2)}</span></div>
            </div>
          </>
        )}

        {(tx.type === 'AD_SPEND') && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between"><span>Ad Spend:</span><span className="font-medium text-slate-800">{formatUSD(tx.amountUSD)}</span></div>
            <div className="flex justify-between"><span>Tax:</span><span className="font-medium text-slate-800">{formatUSD(tx.taxUSD)}</span></div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 text-sm"><span>Total Card Deduction:</span><span className="text-red-600">{formatUSD(parseFloat(tx.amountUSD||0) + parseFloat(tx.taxUSD||0))}</span></div>
          </div>
        )}

        {tx.type === 'PAYMENT_RECEIVED' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm flex justify-between font-bold">
            <span className="text-green-800">Amount Received:</span>
            <span className="text-green-700">{formatBDT(tx.amountBDT)}</span>
          </div>
        )}

        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs text-slate-400 block mb-1">Description / Notes</span>
          <p className="text-sm text-slate-800">{tx.desc || tx.notes || 'No description provided.'}</p>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function ClientsView({ clients, transactions, metrics, onAddClient, onEditClient, onDeleteClient, onViewDetails, onReceivePayment, onAddAdSpend, onClientHistory, onMarkClientStatus }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const clientStats = useMemo(() => {
    return clients.map(client => {
      const clientTx = transactions.filter(t => t.clientId === client.id);
      
      const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT||0), 0);
      const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD||0), 0);
      const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD||0), 0);
      
      const totalCostBDT = (adSpendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
      const profitBDT = revenue - totalCostBDT;
      const profitMargin = revenue > 0 ? (profitBDT / revenue) * 100 : 0;
      
      const durationDays = getDurationDays(client);
      const targetBudgetBDT = getExpectedBudgetBDT(client, durationDays);
      const outstanding = targetBudgetBDT > revenue ? targetBudgetBDT - revenue : 0;
      
      return { ...client, revenue, adSpendUSD, taxUSD, totalCostBDT, profitBDT, profitMargin, outstanding };
    });
  }, [clients, transactions, metrics.avgUSDEffectiveRate]);

  const sortedAndFilteredClients = useMemo(() => {
    let result = clientStats.filter(c => {
      const matchSearch = (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (c.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()));
      const displayStatus = getClientDisplayStatus(c);
      const matchStatus = statusFilter === 'All' || displayStatus.includes(statusFilter);
      const matchService = serviceFilter === 'All' || c.serviceType === serviceFilter;
      return matchSearch && matchStatus && matchService;
    });

    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [clientStats, searchTerm, statusFilter, serviceFilter, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="ml-1 opacity-20 text-[10px]">▼</span>;
    return <span className="ml-1 text-[10px] text-blue-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Client Management</h1>
        <button onClick={onAddClient} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search clients, business, phone..." 
            className="w-full pl-10 pr-4 py-2 border-none bg-slate-50 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-slate-50 min-w-[140px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Active">Active / Working</option>
          <option value="Completed">Completed</option>
          <option value="Paused">Paused</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-slate-50 min-w-[140px]" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
          <option value="All">All Services</option>
          <option value="Meta Ads">Meta Ads</option>
          <option value="Facebook Marketing">Facebook Marketing</option>
          <option value="Google Ads">Google Ads</option>
          <option value="Social Media Management">Social Media</option>
          <option value="Content Marketing">Content Marketing</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 select-none">
              <tr>
                <th className="px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('name')}>Client & Business <SortIcon columnKey="name"/></th>
                <th className="px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('status')}>Status <SortIcon columnKey="status"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('revenue')}>Revenue (BDT) <SortIcon columnKey="revenue"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('adSpendUSD')}>Ad Spend (USD) <SortIcon columnKey="adSpendUSD"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('taxUSD')}>Tax (USD) <SortIcon columnKey="taxUSD"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('totalCostBDT')}>Total Cost (BDT) <SortIcon columnKey="totalCostBDT"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('profitBDT')}>Profit (BDT) <SortIcon columnKey="profitBDT"/></th>
                <th className="px-5 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('profitMargin')}>Margin <SortIcon columnKey="profitMargin"/></th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAndFilteredClients.length === 0 && <tr><td colSpan="9" className="text-center py-12 text-slate-500">No clients found matching your filters.</td></tr>}
              {sortedAndFilteredClients.map(c => {
                const displayStatus = getClientDisplayStatus(c);
                const isWorking = displayStatus.includes('Active') || displayStatus.includes('Currently Working');
                return (
                <tr key={c.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600" onClick={() => onViewDetails(c)}>{c.name}</div>
                    <div className="text-xs text-slate-500">{c.company}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase
                      ${isWorking ? 'bg-green-100 text-green-700' : 
                        displayStatus.includes('Completed') ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-600'}`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600">{formatBDT(c.revenue)}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">{formatUSD(c.adSpendUSD)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{formatUSD(c.taxUSD)}</td>
                  <td className="px-5 py-3 text-right text-orange-600">{formatBDT(c.totalCostBDT)}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">{formatBDT(c.profitBDT)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${c.profitMargin > 50 ? 'text-green-700 bg-green-50' : c.profitMargin < 0 ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-50'}`}>
                      {c.profitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <ClientDropdownMenu 
                      client={c}
                      onViewDetails={() => onViewDetails(c)}
                      onEdit={() => onEditClient(c)}
                      onReceivePayment={() => onReceivePayment(c)}
                      onAddAdSpend={() => onAddAdSpend(c)}
                      onClientHistory={() => onClientHistory(c)}
                      onMarkStatus={() => onMarkClientStatus(c)}
                      onDelete={() => onDeleteClient(c.id)}
                    />
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

function CardsView({ cards, metrics, transactions, onAddCard, onEditCard, onDeleteCard, onViewDetails }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [globalDateRange, setGlobalDateRange] = useState({ label: 'Lifetime', start: null, end: null });
  const [selectedCardFilter, setSelectedCardFilter] = useState('ALL');
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);

  const activeCards = cards; 

  const filteredUSDPurchases = useMemo(() => {
    let list = transactions.filter(t => t.type === 'USD_PURCHASE');
    if (selectedCardFilter !== 'ALL') list = list.filter(t => t.cardId === selectedCardFilter);
    if (globalDateRange.start && globalDateRange.end) {
      list = list.filter(t => t.date >= globalDateRange.start && t.date <= globalDateRange.end);
    }
    return list;
  }, [transactions, globalDateRange, selectedCardFilter]);

  const periodSummary = useMemo(() => {
    const count = filteredUSDPurchases.length;
    const totalUSD = filteredUSDPurchases.reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
    const totalBDTPaid = filteredUSDPurchases.reduce((sum, t) => sum + parseFloat(t.amountBDT || 0), 0);
    const totalCOCharge = filteredUSDPurchases.reduce((sum, t) => sum + parseFloat(t.cashOutCharge || 0), 0);
    const totalCost = totalBDTPaid + totalCOCharge;
    const avgEffectiveRate = totalUSD > 0 ? (totalCost / totalUSD) : 0;
    return { count, totalUSD, totalBDTPaid, totalCOCharge, totalCost, avgEffectiveRate };
  }, [filteredUSDPurchases]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Cards & USD Ledger</h1>
        <button onClick={onAddCard} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm">
          <Plus size={16} /> Add Card
        </button>
      </div>
      
      {isFilterOpen && (
        <DateRangePickerModal 
          onClose={() => setIsFilterOpen(false)} 
          onApply={(range) => { setGlobalDateRange(range); setIsFilterOpen(false); }} 
          initialRange={globalDateRange}
        />
      )}

      {selectedTxForModal && (
        <TransactionDetailsModal 
          tx={selectedTxForModal} 
          cardName={cards.find(c => c.id === selectedTxForModal.cardId)?.name || 'Unknown Card'} 
          onClose={() => setSelectedTxForModal(null)} 
        />
      )}
      
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeCards.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 bg-white border border-slate-200 rounded-xl">No cards added yet.</div>
        )}
        
        {activeCards.map(card => {
          const sortedTxs = [...transactions]
            .filter(t => t.cardId === card.id)
            .sort((a,b) => {
              const timeA = a.timestamp || new Date(a.date).getTime();
              const timeB = b.timestamp || new Date(b.date).getTime();
              return timeB - timeA;
            });
          
          const validTxs = sortedTxs.filter(t => {
             if (t.type === 'AD_SPEND' && parseFloat(t.amountUSD||0) <= 0) return false;
             return true;
          });
          const lastTx = validTxs[0];
          const bal = metrics.cardBalances[card.id] || 0;

          return (
            <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                      {card.name} 
                      {card.last4 && <span className="text-xs font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">*{card.last4}</span>}
                    </h3>
                    <p className="text-sm text-slate-500">{card.provider} • {card.cardType}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mr-1"><CreditCard size={20} /></div>
                    <CardDropdownMenu 
                      onEdit={() => onEditCard(card)} 
                      onDetails={() => onViewDetails(card)} 
                      onDelete={() => onDeleteCard(card.id)} 
                    />
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Current Balance</p>
                <div className="flex flex-col items-start gap-1">
                  <h2 className={`text-3xl font-bold ${bal < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatUSD(bal)}</h2>
                  {bal < 0 && (
                    <span className="inline-flex items-center text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      <AlertCircle size={12} className="mr-1" /> Negative Balance
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 block font-medium mb-1">Last Transaction</span>
                  {lastTx ? (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700 font-medium truncate max-w-[150px]">
                        {formatDate(lastTx.date)} • {lastTx.type === 'USD_PURCHASE' ? 'USD Purchase' : 'Meta Ads'}
                      </span>
                      <span className={`font-bold ${lastTx.type === 'USD_PURCHASE' ? 'text-green-600' : 'text-slate-800'}`}>
                        {lastTx.type === 'USD_PURCHASE' ? '+' : '-'}{formatUSD(lastTx.amountUSD)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No transactions yet</span>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => onViewDetails(card)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg text-sm font-medium transition-colors">Details & History</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* History Header & Filters Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-8 mb-4 gap-3">
        <h3 className="text-lg font-bold text-slate-800">USD Purchase History</h3>
        
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {globalDateRange.label !== 'Lifetime' && (
            <button onClick={() => setGlobalDateRange({label: 'Lifetime', start: null, end: null})} className="text-xs text-red-600 font-medium hover:underline mr-1">
              Clear Filter
            </button>
          )}
          
          <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 shadow-2xs transition-colors">
            <CalendarDays size={14} className="text-blue-600" /> 
            {globalDateRange.label === 'Lifetime' ? 'History: Lifetime' : globalDateRange.label}
          </button>

          <select 
            value={selectedCardFilter} 
            onChange={(e) => setSelectedCardFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 shadow-2xs outline-none cursor-pointer"
          >
            <option value="ALL">All Cards ▼</option>
            {activeCards.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PERIOD SUMMARY */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
          Selected Period: {globalDateRange.label === 'Lifetime' && !globalDateRange.start ? 'Lifetime' : globalDateRange.label}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-6">
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">Total BDT Paid</span>
            <span className="font-bold text-slate-800 text-base">{formatBDT(periodSummary.totalBDTPaid)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">Total C.O Charge</span>
            <span className="font-bold text-slate-800 text-base">{formatBDT(periodSummary.totalCOCharge)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">Total Cost</span>
            <span className="font-bold text-slate-800 text-base">{formatBDT(periodSummary.totalCost)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">USD Purchased</span>
            <span className="font-bold text-green-600 text-base">{formatUSD(periodSummary.totalUSD)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">Avg Effective Rate</span>
            <span className="font-bold text-blue-600 text-base">৳{periodSummary.avgEffectiveRate.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs font-medium uppercase tracking-wider mb-1">Purchases</span>
            <span className="font-bold text-slate-800 text-base">{periodSummary.count}</span>
          </div>
        </div>
      </div>

      {/* USD Purchase History Table */}
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
                <th className="px-5 py-3 whitespace-normal align-middle">Card / Destination</th>
                <th className="px-5 py-3 text-right whitespace-normal align-middle">Base Rate</th>
                <th className="px-5 py-3 text-right text-blue-600 whitespace-normal align-middle">Effective Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUSDPurchases.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-slate-500">No USD purchases in this period.</td></tr>}
              {filteredUSDPurchases.map(tx => {
                const bdtPaid = parseFloat(tx.amountBDT||0);
                const coRate = parseFloat(tx.cashOutCharge||0);
                const usdRcv = parseFloat(tx.amountUSD||1);
                const totalCost = bdtPaid + coRate;
                const baseRate = usdRcv > 0 ? (bdtPaid / usdRcv).toFixed(2) : 0;
                const effectiveRate = usdRcv > 0 ? (totalCost / usdRcv).toFixed(2) : 0;
                const targetCard = cards.find(c => c.id === tx.cardId);
                const cardLabel = targetCard ? targetCard.name : 'Unknown Card';

                return (
                <tr 
                  key={tx.id} 
                  onClick={() => setSelectedTxForModal(tx)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{tx.notes}</td>
                  <td className="px-5 py-3 text-right text-slate-600 whitespace-nowrap">{formatBDT(bdtPaid)}</td>
                  <td className="px-5 py-3 text-right text-red-500 whitespace-nowrap">{coRate ? formatBDT(coRate) : formatBDT(0)}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatBDT(totalCost)}</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600 whitespace-nowrap">{formatUSD(tx.amountUSD)}</td>
                  <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">
                    <span className="bg-slate-100 group-hover:bg-white border border-slate-200 px-2 py-0.5 rounded text-xs">{cardLabel}</span>
                  </td>
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

function CardDetailsModal({ card, metrics, transactions, onClose }) {
  const [filterRange, setFilterRange] = useState({ label: 'Lifetime', start: null, end: null });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { historyWithBalance, openingBalance, expectedBalance, isMatch, diff } = useMemo(() => {
    // 1. Get ALL txs for card, sorted Oldest to Newest for true chronological running balance
    const allCardTxsAsc = [...transactions]
      .filter(t => t.cardId === card.id)
      .sort((a, b) => {
        const tA = a.timestamp || new Date(a.date).getTime();
        const tB = b.timestamp || new Date(b.date).getTime();
        if (tA === tB) return a.id.localeCompare(b.id);
        return tA - tB;
      });

    // 2. Compute exact historical running balances (Balance After)
    const initialBal = parseFloat(card.initialBalance || 0);
    let currentRunningBal = initialBal;
    
    const fullHistory = allCardTxsAsc.reduce((acc, t) => {
      let changeUSD = 0;
      let displayTx = { ...t };
      let includeTx = true;

      if (t.type === 'USD_PURCHASE') {
        changeUSD = parseFloat(t.amountUSD || 0);
      } else if (t.type === 'AD_SPEND') {
        const spend = parseFloat(t.amountUSD || 0);
        const tax = parseFloat(t.taxUSD || 0);
        if (spend <= 0) {
            includeTx = false; // Exclude zeroes 
        } else {
            changeUSD = -(spend + tax); // Deducts both from mathematical balance
        }
      } else if (t.type === 'FEE') {
        changeUSD = -parseFloat(t.amountUSD || 0);
      }

      if (includeTx) {
        currentRunningBal += changeUSD;
        displayTx.changeUSD = changeUSD;
        displayTx.runningBal = currentRunningBal;
        acc.push(displayTx);
      }
      return acc;
    }, []);

    // 3. Reverse for UI (Newest first)
    fullHistory.reverse();

    // 4. Apply history date filter purely for visual isolation
    let displayedHistory = fullHistory;
    if (filterRange.start && filterRange.end) {
      displayedHistory = fullHistory.filter(t => t.date >= filterRange.start && t.date <= filterRange.end);
    }

    // 5. Diagnostics / Breakdown Verification
    const stats = metrics.cardStats[card.id] || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
    const expBal = initialBal + stats.purchased - stats.adSpend - stats.tax - stats.fees;
    const curBal = metrics.cardBalances[card.id] || 0;
    const difference = Math.abs(expBal - curBal);
    
    return { 
      historyWithBalance: displayedHistory,
      openingBalance: initialBal,
      expectedBalance: expBal,
      isMatch: difference < 0.005,
      diff: difference
    };
  }, [transactions, card.id, card.initialBalance, filterRange, metrics]);

  const stats = metrics.cardStats[card.id] || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
  const currentBal = metrics.cardBalances[card.id] || 0;

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      
      {/* Global Card Stats summary - Unchanged by date filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 shrink-0">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">Total USD Purchased</p>
          <p className="text-base font-bold text-green-600">
            {stats.purchased > 0 ? '+' : ''}{formatUSD(stats.purchased)}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">Total Meta Ad Spend</p>
          <p className="text-base font-bold text-slate-800">
            {stats.adSpend > 0 ? '-' : ''}{formatUSD(stats.adSpend)}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">Total Tax</p>
          <p className="text-base font-bold text-slate-700">
            {stats.tax > 0 ? '-' : ''}{formatUSD(stats.tax)}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">Total Fees</p>
          <p className="text-base font-bold text-slate-700">
             {stats.fees > 0 ? '-' : ''}{formatUSD(stats.fees)}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">Current Balance</p>
          <p className={`text-base font-bold ${currentBal < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatUSD(currentBal)}</p>
        </div>
      </div>
      
      <div className="text-xs text-slate-600 mb-4 bg-blue-50 p-3 rounded border border-blue-100 flex justify-between shrink-0">
        <span><strong>Provider:</strong> {card.provider}</span>
        <span><strong>Type:</strong> {card.cardType}</span>
        {card.last4 && <span><strong>Last 4 Digits:</strong> {card.last4}</span>}
      </div>

      {/* BALANCE BREAKDOWN & INTEGRITY CHECK */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 shrink-0 flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">Balance Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Opening Balance</span>
              <span className="font-medium text-slate-800">+{formatUSD(openingBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">USD Purchased</span>
              <span className="font-medium text-green-600">+{formatUSD(stats.purchased)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Meta Ad Spend</span>
              <span className="font-medium text-slate-800">-{formatUSD(stats.adSpend)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax</span>
              <span className="font-medium text-slate-700">-{formatUSD(stats.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Fees</span>
              <span className="font-medium text-slate-700">-{formatUSD(stats.fees)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold">
              <span className="text-slate-800">Current Balance</span>
              <span className={currentBal < 0 ? 'text-red-600' : 'text-slate-900'}>{formatUSD(currentBal)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded p-4 flex flex-col justify-center">
          <h5 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">System Diagnostics</h5>
          {isMatch ? (
            <div className="bg-green-50 text-green-800 p-3 rounded flex items-center gap-2 font-medium text-sm">
              <CheckCircle2 size={18} className="text-green-600" /> Balance Verified
            </div>
          ) : (
            <div className="text-xs text-red-700 bg-red-50 p-3 rounded border border-red-100">
              <div className="font-bold flex items-center mb-2 text-sm">
                <AlertCircle size={16} className="mr-1.5" /> Balance Mismatch
              </div>
              <div className="flex justify-between mb-1"><span>Expected Balance:</span> <span className="font-medium">{formatUSD(expectedBalance)}</span></div>
              <div className="flex justify-between mb-1"><span>Current Balance:</span> <span className="font-medium">{formatUSD(currentBal)}</span></div>
              <div className="flex justify-between font-bold border-t border-red-200 mt-2 pt-2"><span>Difference:</span> <span>{formatUSD(diff)}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mb-3 border-b pb-2 shrink-0">
        <h4 className="font-bold text-slate-800">Transaction History</h4>
        <div className="flex items-center gap-3">
          {filterRange.label !== 'Lifetime' && <button onClick={() => setFilterRange({label: 'Lifetime', start: null, end: null})} className="text-xs text-red-600 hover:underline font-medium">Clear Filter</button>}
          <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 shadow-2xs transition-colors">
            <CalendarDays size={14} className="text-blue-600" /> 
            {filterRange.label === 'Lifetime' ? 'Filter History' : filterRange.label}
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <DateRangePickerModal 
          onClose={() => setIsFilterOpen(false)} 
          onApply={(range) => { setFilterRange(range); setIsFilterOpen(false); }} 
          initialRange={filterRange}
        />
      )}
      
      <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Type / Desc</th>
              <th className="px-4 py-2.5 text-right">USD</th>
              <th className="px-4 py-2.5 text-right font-bold">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {historyWithBalance.length === 0 && (
              <tr><td colSpan="4" className="text-center py-6 text-slate-500">No transactions found for this period.</td></tr>
            )}
            {historyWithBalance.map(tx => {
              const isAdSpend = tx.type === 'AD_SPEND';
              const faceUSDValue = isAdSpend ? -Math.abs(parseFloat(tx.amountUSD)) : parseFloat(tx.amountUSD);
              const displayTax = isAdSpend ? parseFloat(tx.taxUSD || 0) : 0;

              return (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-600 align-top pt-3">{formatDate(tx.date)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800 align-top pt-3">
                  <div className="mb-0.5">{tx.type === 'USD_PURCHASE' ? 'USD Purchase' : tx.type === 'AD_SPEND' ? 'Meta Ads' : tx.type}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{tx.notes || (isAdSpend ? 'Campaign Spend' : 'N/A')}</div>
                </td>
                <td className={`px-4 py-2.5 text-right font-medium align-top pt-3 ${faceUSDValue > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                  {faceUSDValue > 0 ? '+' : ''}{formatUSD(faceUSDValue)}
                  {displayTax > 0 && <span className="block text-[10px] text-slate-500 font-normal mt-1">+ tax {formatUSD(displayTax)}</span>}
                </td>
                <td className={`px-4 py-2.5 text-right font-bold align-top pt-3 ${tx.runningBal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatUSD(tx.runningBal)}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionDetailsModal({ tx, cardName, onClose }) {
  const bdtPaid = parseFloat(tx.amountBDT||0);
  const coRate = parseFloat(tx.cashOutCharge||0);
  const usdRcv = parseFloat(tx.amountUSD||1);
  const baseRate = usdRcv > 0 ? (bdtPaid / usdRcv).toFixed(2) : 0;
  const totalCost = bdtPaid + coRate;
  const effectiveRate = usdRcv > 0 ? (totalCost / usdRcv).toFixed(2) : 0;

  return (
    <Modal title="Transaction Details" onClose={onClose} width="max-w-lg">
      <div className="space-y-4 text-sm">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 uppercase font-medium block">Reference ID</span>
            <span className="font-mono text-xs font-bold text-slate-800">{tx.id}</span>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">USD Purchase</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Date</span><span className="font-bold text-slate-800">{formatDate(tx.date)}</span></div>
          <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Source</span><span className="font-bold text-slate-800">{tx.notes || 'N/A'}</span></div>
          <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">Destination Card</span><span className="font-bold text-blue-600">{cardName}</span></div>
          <div className="p-2.5 bg-white border border-slate-200 rounded"><span className="text-slate-400 block">USD Received</span><span className="font-bold text-green-600">{formatUSD(tx.amountUSD)}</span></div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
          <div className="flex justify-between"><span>BDT Paid:</span><span className="font-medium text-slate-800">{formatBDT(bdtPaid)}</span></div>
          <div className="flex justify-between"><span>C.O Rate:</span><span className="font-medium text-slate-800">{formatBDT(coRate)}</span></div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 text-sm"><span>Total Cost:</span><span className="text-slate-900">{formatBDT(totalCost)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-500 block">Base Rate</span><span className="font-bold text-slate-800">৳{baseRate} / USD</span></div>
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded"><span className="text-blue-600 block font-medium">Effective Rate</span><span className="font-bold text-blue-700">৳{effectiveRate} / USD</span></div>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function DateRangePickerModal({ onClose, onApply, initialRange }) {
  const [selectedPreset, setSelectedPreset] = useState(initialRange?.label || 'Lifetime');
  const [customStart, setCustomStart] = useState(initialRange?.start || '');
  const [customEnd, setCustomEnd] = useState(initialRange?.end || '');

  const handlePresetClick = (preset) => {
    setSelectedPreset(preset);
    if (preset === 'Custom Range') return;
    
    const dates = getPresetDates(preset);
    setCustomStart(dates.start || '');
    setCustomEnd(dates.end || '');
  };

  const handleApply = () => {
    let label = selectedPreset;
    if (selectedPreset === 'Custom Range' || (customStart && customEnd && !DATE_PRESETS.includes(selectedPreset))) {
       label = `${formatDate(customStart)} – ${formatDate(customEnd)}`;
    }
    if (!customStart && !customEnd) label = 'Lifetime';

    onApply({ label, start: customStart, end: customEnd });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CalendarDays size={20} className="text-blue-600"/> Select Date Range</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        
        <div className="flex flex-col md:flex-row h-[400px]">
          <div className="w-full md:w-1/3 border-r border-slate-100 bg-slate-50 overflow-y-auto p-2 space-y-1">
            {DATE_PRESETS.map(preset => (
              <button 
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${selectedPreset === preset ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-200'}`}
              >
                {preset}
              </button>
            ))}
            <button 
              onClick={() => handlePresetClick('Custom Range')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mt-2 border-t border-slate-200 ${selectedPreset === 'Custom Range' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-200'}`}
            >
              Custom Range
            </button>
          </div>
          
          <div className="w-full md:w-2/3 p-6 flex flex-col justify-center bg-white">
            <h4 className="text-sm font-bold text-slate-800 mb-4">Custom Date Range</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Start Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={customStart} 
                    onChange={(e) => { setCustomStart(e.target.value); setSelectedPreset('Custom Range'); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">End Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={customEnd} 
                    onChange={(e) => { setCustomEnd(e.target.value); setSelectedPreset('Custom Range'); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>
            </div>
            {customStart && customEnd && (
               <div className="mt-8 p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                 <p className="text-sm text-blue-800 font-medium">Selected Range:</p>
                 <p className="text-sm text-blue-600">{formatDate(customStart)} – {formatDate(customEnd)}</p>
               </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
          <button onClick={() => { setCustomStart(''); setCustomEnd(''); setSelectedPreset('Lifetime'); }} className="text-sm text-red-600 font-medium hover:underline">Clear Filter</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-100">Cancel</button>
            <button onClick={handleApply} className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 shadow-sm">Apply Filter</button>
          </div>
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

function ClientDropdownMenu({ client, onViewDetails, onEdit, onReceivePayment, onAddAdSpend, onClientHistory, onMarkStatus, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 224;
    const estimatedMenuHeight = 270;
    const gap = 8;
    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;
    if (top + estimatedMenuHeight > window.innerHeight - 12) top = rect.top - estimatedMenuHeight - gap;
    if (top < 12) top = 12;
    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) left = window.innerWidth - menuWidth - 12;
    setMenuPosition({ top, left });
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!isOpen) updateMenuPosition();
    setIsOpen(v => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => { if (event.key === 'Escape') setIsOpen(false); };
    const handleReposition = () => updateMenuPosition();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  const closeAndRun = (action) => { setIsOpen(false); action(); };
  const isWorking = client?.currentlyWorking || getClientDisplayStatus(client).includes('Active');

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggleMenu} aria-label={`Actions for ${client?.name || 'client'}`} aria-expanded={isOpen} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div ref={menuRef} style={{ top: menuPosition.top, left: menuPosition.left }} className="fixed w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-[9999] py-1 overflow-hidden" role="menu">
          <button onClick={() => closeAndRun(onViewDetails)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600" role="menuitem">View Details</button>
          <button onClick={() => closeAndRun(onEdit)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600" role="menuitem">Edit Client</button>
          <button onClick={() => closeAndRun(onClientHistory)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600" role="menuitem">Transaction History</button>
          <div className="h-px w-full bg-slate-100 my-1" />
          <button onClick={() => closeAndRun(onReceivePayment)} className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50" role="menuitem">Receive Payment</button>
          <button onClick={() => closeAndRun(onAddAdSpend)} className="w-full text-left px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50" role="menuitem">Add Ad Spend</button>
          <button onClick={() => closeAndRun(onMarkStatus)} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">{isWorking ? 'Mark Completed' : 'Mark Active'}</button>
          <div className="h-px w-full bg-slate-100 my-1" />
          <button onClick={() => closeAndRun(onDelete)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between" role="menuitem">Delete Client <Trash2 size={14} /></button>
        </div>
      )}
    </>
  );
}

function ClientTransactionHistoryModal({ client, transactions, onClose }) {
  const clientTransactions = useMemo(() => transactions.filter(t => t.clientId === client.id).sort((a,b) => (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime())), [transactions, client.id]);
  const totalReceived = clientTransactions.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum,t) => sum + parseFloat(t.amountBDT || 0), 0);
  const totalAdSpend = clientTransactions.filter(t => t.type === 'AD_SPEND').reduce((sum,t) => sum + parseFloat(t.amountUSD || 0), 0);
  const totalTax = clientTransactions.filter(t => t.type === 'AD_SPEND').reduce((sum,t) => sum + parseFloat(t.taxUSD || 0), 0);
  return (
    <Modal title={`Transaction History: ${client.name}`} onClose={onClose} width="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-lg p-3"><p className="text-xs text-slate-500">Received (BDT)</p><p className="font-bold text-green-700">{formatBDT(totalReceived)}</p></div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3"><p className="text-xs text-slate-500">Ad Spend (USD)</p><p className="font-bold text-purple-700">{formatUSD(totalAdSpend)}</p></div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-3"><p className="text-xs text-slate-500">Tax (USD)</p><p className="font-bold text-red-700">{formatUSD(totalTax)}</p></div>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden"><div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {clientTransactions.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-slate-500">No transactions for this client yet.</td></tr>}
            {clientTransactions.map(t => <tr key={t.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(t.date)}</td><td className="px-4 py-3 font-medium text-slate-800">{t.type === 'PAYMENT_RECEIVED' ? 'Payment Received' : t.type === 'AD_SPEND' ? 'Meta Ads' : t.type.replace(/_/g, ' ')}</td><td className="px-4 py-3 text-slate-500">{t.notes || t.campaign || '—'}</td><td className="px-4 py-3 text-right font-semibold">{t.type === 'PAYMENT_RECEIVED' ? <span className="text-green-600">+{formatBDT(t.amountBDT)}</span> : <span className="text-red-600">-{formatUSD(parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0))}</span>}</td></tr>)}
          </tbody></table>
        </div></div>
        <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800">Close</button></div>
      </div>
    </Modal>
  );
}

function ClientDetailsModal({ client, metrics, transactions, onClose, onReceivePayment, onAdSpend }) {
  const clientTx = useMemo(() => transactions.filter(t => t.clientId === client.id).sort((a,b) => new Date(b.date) - new Date(a.date)), [transactions, client.id]);
  
  const stats = useMemo(() => {
    const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT||0), 0);
    const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD||0), 0);
    const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD||0), 0);
    const totalCostBDT = (adSpendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
    const profitBDT = revenue - totalCostBDT;
    const margin = revenue > 0 ? (profitBDT / revenue) * 100 : 0;
    
    const durationDays = getDurationDays(client);
    const targetBudgetBDT = getExpectedBudgetBDT(client, durationDays);
    const outstanding = targetBudgetBDT > revenue ? targetBudgetBDT - revenue : 0;
    
    return { revenue, adSpendUSD, taxUSD, totalCostBDT, profitBDT, margin, outstanding, targetBudgetBDT };
  }, [clientTx, metrics.avgUSDEffectiveRate, client]);

  const campaigns = useMemo(() => {
    const map = {};
    clientTx.filter(t => t.type === 'AD_SPEND').forEach(t => {
      const key = `${t.adAccount || 'Unknown'} - ${t.campaign || 'Unknown'}`;
      if(!map[key]) map[key] = { account: t.adAccount||'Unknown', campaign: t.campaign||'Unknown', spend: 0, tax: 0 };
      map[key].spend += parseFloat(t.amountUSD||0);
      map[key].tax += parseFloat(t.taxUSD||0);
    });
    return Object.values(map);
  }, [clientTx]);

  const chartData = useMemo(() => {
    const data = [...clientTx].reverse().reduce((acc, t) => {
      const d = t.date.substring(5);
      if(!acc[d]) acc[d] = { date: d, revenue: 0, cost: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += parseFloat(t.amountBDT||0);
      if (t.type === 'AD_SPEND') acc[d].cost += ((parseFloat(t.amountUSD||0) + parseFloat(t.taxUSD||0)) * metrics.avgUSDEffectiveRate);
      return acc;
    }, {});
    return Object.values(data);
  }, [clientTx, metrics.avgUSDEffectiveRate]);

  const displayStatus = getClientDisplayStatus(client);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{client.name}</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${displayStatus.includes('Active') || displayStatus.includes('Working') ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-300'}`}>{displayStatus}</span>
          </div>
          <p className="text-slate-400 font-medium">{client.company} • {client.serviceType}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-800 text-sm">
            <div className="text-slate-300"><span className="text-slate-500 block text-xs">Budget Setting</span> <span className="font-medium text-blue-300">{getBudgetDisplay(client.budgetType, client.budgetAmount || client.budget)}</span></div>
            <div className="text-slate-300"><span className="text-slate-500 block text-xs">Campaign Duration</span> {getCampaignDurationDisplay(client)}</div>
            <div className="text-slate-300"><span className="text-slate-500 block text-xs">Dates</span> {formatDate(client.startDate)} - {client.currentlyWorking ? 'Present' : formatDate(client.endDate)}</div>
            {client.phone && <div className="text-slate-300"><span className="text-slate-500 block text-xs">Phone</span> {client.phone}</div>}
            {client.email && <div className="text-slate-300"><span className="text-slate-500 block text-xs">Email</span> {client.email}</div>}
            {client.fb && <div className="text-slate-300"><span className="text-slate-500 block text-xs">Facebook</span> {client.fb}</div>}
          </div>
        </div>
        <div className="flex flex-row md:flex-col gap-2 shrink-0 self-start md:self-stretch justify-center">
          <button onClick={onReceivePayment} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">+ Payment</button>
          <button onClick={onAdSpend} className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">+ Ad Spend</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatBDT(stats.revenue)} icon={<ArrowDownRight size={18} className="text-green-600" />} bgColor="bg-green-50" />
        <MetricCard title="Total Ad Spend" value={formatUSD(stats.adSpendUSD)} subtitle={`Tax: ${formatUSD(stats.taxUSD)}`} icon={<Activity size={18} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Total Cost (BDT)" value={formatBDT(stats.totalCostBDT)} icon={<Wallet size={18} className="text-orange-600" />} bgColor="bg-orange-50" />
        <MetricCard title="Net Profit" value={formatBDT(stats.profitBDT)} subtitle={`Margin: ${stats.margin.toFixed(1)}%`} icon={<TrendingUp size={18} className="text-blue-600" />} bgColor="bg-blue-50" textColorClass={stats.profitBDT < 0 ? 'text-red-600' : 'text-slate-900'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-slate-800 mb-4">Contract / Budget Tracking</h4>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Target Budget (Scaled): {formatBDT(stats.targetBudgetBDT)}</span>
            <span className="font-medium text-slate-800">Received: {formatBDT(stats.revenue)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (stats.revenue / (stats.targetBudgetBDT || 1)) * 100)}%` }}></div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Outstanding Expected:</span>
            <span className={`font-bold ${stats.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {stats.outstanding > 0 ? formatBDT(stats.outstanding) : 'Fully Paid / Exceeded'}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {campaigns.length === 0 && <tr><td colSpan="3" className="text-center py-6 text-slate-500">No campaigns recorded yet.</td></tr>}
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
                          <span className="font-bold text-slate-800">{formatUSD(parseFloat(tx.amountUSD||0) + parseFloat(tx.taxUSD||0))}</span>
                          <span className="block text-[10px] text-slate-400">({formatBDT((parseFloat(tx.amountUSD||0) + parseFloat(tx.taxUSD||0)) * metrics.avgUSDEffectiveRate)})</span>
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

function ClientForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        budgetAmount: initialData.budgetAmount || '',
        budgetType: initialData.budgetType || 'Monthly',
        currentlyWorking: initialData.currentlyWorking !== undefined ? initialData.currentlyWorking : true,
      };
    }
    return {
      name: '', company: '', phone: '', email: '', fb: '', website: '',
      serviceType: 'Meta Ads', budgetType: 'Monthly', budgetAmount: '', status: 'Active', 
      startDate: new Date().toISOString().split('T')[0], endDate: '', currentlyWorking: true, notes: ''
    };
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    onSubmit({
      ...formData, 
      budgetAmount: parseFloat(formData.budgetAmount) || 0,
      endDate: formData.currentlyWorking ? '' : formData.endDate
    }); 
  };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
  const labelClass = "block text-xs font-medium text-slate-700 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div><label className={labelClass}>Client Name *</label><input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter client name" className={inputClass} /></div>
        <div><label className={labelClass}>Business / Company Name *</label><input type="text" name="company" value={formData.company} onChange={handleChange} required placeholder="Enter company name" className={inputClass} /></div>
        
        <div><label className={labelClass}>Phone Number</label><input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Optional" className={inputClass} /></div>
        <div><label className={labelClass}>Email Address</label><input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Optional" className={inputClass} /></div>
        
        <div><label className={labelClass}>Facebook Page URL</label><input type="text" name="fb" value={formData.fb} onChange={handleChange} placeholder="fb.com/..." className={inputClass} /></div>
        <div><label className={labelClass}>Website URL</label><input type="text" name="website" value={formData.website} onChange={handleChange} placeholder="https://" className={inputClass} /></div>
        
        <div>
          <label className={labelClass}>Service Type</label>
          <select name="serviceType" value={formData.serviceType} onChange={handleChange} className={inputClass}>
            <option>Meta Ads</option><option>Facebook Marketing</option><option>Google Ads</option><option>Social Media Management</option><option>Content Marketing</option><option>Other</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
            <option>Active</option><option>Paused</option><option>Completed</option><option>Inactive</option>
          </select>
        </div>
        
        <div>
          <label className={labelClass}>Budget Period</label>
          <select name="budgetType" value={formData.budgetType} onChange={handleChange} className={inputClass}>
            <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Custom / Total</option>
          </select>
        </div>
        <div><label className={labelClass}>Budget Amount (BDT)</label><input type="number" min="0" step="0.01" name="budgetAmount" value={formData.budgetAmount} onChange={handleChange} placeholder="Enter BDT amount" className={inputClass} /></div>
        
        <div><label className={labelClass}>Start Date</label><input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className={inputClass} /></div>
        <div>
          <label className={labelClass}>End Date</label>
          <div className="flex flex-col gap-2 mt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none cursor-pointer">
              <input type="checkbox" name="currentlyWorking" checked={formData.currentlyWorking} onChange={(e) => setFormData({...formData, currentlyWorking: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
              Currently Working
            </label>
            {!formData.currentlyWorking && (
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required={!formData.currentlyWorking} className={inputClass} style={{marginTop: 0}} />
            )}
          </div>
        </div>
      </div>
      <div><label className={labelClass}>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional details..." rows="2" className={inputClass}></textarea></div>
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
    initialBalance: '', last4: '', expiry: '', notes: '', status: 'Active'
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      initialBalance: parseFloat(formData.initialBalance) || 0
    });
  };

  const inputClass = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium text-slate-700">Card Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter card name" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Provider / Bank</label>
          <input type="text" name="provider" value={formData.provider} onChange={handleChange} required placeholder="Enter provider name" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Card Type</label>
          <select name="cardType" value={formData.cardType} onChange={handleChange} className={inputClass}>
            <option>Virtual Card</option><option>Dual Currency</option><option>Credit Card</option><option>Prepaid Card</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Initial Balance (USD)</label>
          <input type="number" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} disabled={!!initialData} placeholder="Enter initial balance" className={`${inputClass} ${initialData ? 'bg-slate-100' : ''}`} />
          {initialData && <p className="text-xs text-slate-500 mt-1">Cannot edit initial balance after creation.</p>}
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Currency</label>
          <input type="text" name="currency" value={formData.currency} disabled className={`${inputClass} bg-slate-100`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-slate-700">Last 4 Digits</label>
          <input type="text" maxLength="4" name="last4" value={formData.last4} onChange={handleChange} placeholder="Optional 4 digits" className={inputClass} />
        </div>
        <div><label className="block text-sm font-medium text-slate-700">Expiry Date</label>
          <input type="text" name="expiry" value={formData.expiry} onChange={handleChange} placeholder="MM/YY (Optional)" className={inputClass} />
        </div>
      </div>
      <div><label className="block text-sm font-medium text-slate-700">Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className={inputClass} placeholder="Optional details..."></textarea>
      </div>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Card</button>
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
    taxUSD: '', notes: '',
    adAccount: '', campaign: '' 
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { type, date: formData.date, notes: formData.notes };

    if (type === 'PAYMENT_RECEIVED') {
      payload.amountBDT = parseFloat(formData.amountBDT) || 0;
      if (payload.amountBDT <= 0 || !formData.clientId) return;
      payload.clientId = formData.clientId;
    } else if (type === 'USD_PURCHASE') {
      payload.amountBDT = parseFloat(formData.amountBDT) || 0;
      payload.cashOutCharge = parseFloat(formData.cashOutCharge) || 0;
      payload.amountUSD = parseFloat(formData.amountUSD) || 0;
      if (payload.amountBDT <= 0 || payload.amountUSD <= 0 || !formData.cardId) return;
      payload.cardId = formData.cardId;
    } else if (type === 'AD_SPEND') {
      payload.amountUSD = parseFloat(formData.amountUSD) || 0;
      payload.taxUSD = parseFloat(formData.taxUSD) || 0;
      if (payload.amountUSD <= 0 || !formData.cardId || !formData.clientId) return;
      
      payload.clientId = formData.clientId;
      payload.cardId = formData.cardId;
      payload.adAccount = formData.adAccount;
      payload.campaign = formData.campaign;
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
            <select name="clientId" value={formData.clientId} onChange={handleChange} required className={inputClass}>
              {clients?.length === 0 && <option value="" disabled>No clients found</option>}
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Amount Received (BDT)</label>
            <input type="number" min="0" step="0.01" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="Enter BDT amount" className={inputClass} />
          </div>
        </>
      )}

      {type === 'USD_PURCHASE' && (
        <>
          <div><label className={labelClass}>Source</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleChange} required placeholder="e.g. Binance P2P, Local Seller" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>BDT Paid</label>
              <input type="number" min="0" step="0.01" name="amountBDT" value={formData.amountBDT} onChange={handleChange} required placeholder="Enter BDT amount" className={inputClass} />
            </div>
            <div><label className={labelClass}>Cash-out Charge (C.O Rate)</label>
              <input type="number" min="0" step="0.01" name="cashOutCharge" value={formData.cashOutCharge} onChange={handleChange} placeholder="Enter cash-out charge" className={inputClass} />
            </div>
          </div>
          <div><label className={labelClass}>USD Received</label>
            <input type="number" min="0" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="Enter USD amount" className={inputClass} />
          </div>
          <div><label className={labelClass}>Add USD To Card / Destination</label>
            <select name="cardId" value={formData.cardId} onChange={handleChange} required className={inputClass}>
              {cards?.length === 0 ? (
                <option value="" disabled>No active cards available</option>
              ) : (
                cards?.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
                ))
              )}
            </select>
          </div>
          {(formData.amountBDT && formData.amountUSD) ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <div className="flex justify-between"><span>Total BDT Cost:</span> <strong>৳{(parseFloat(formData.amountBDT || 0) + parseFloat(formData.cashOutCharge || 0)).toLocaleString('en-IN')}</strong></div>
              <p className="text-xs text-slate-500 mb-1">Effective Rate = (BDT Paid + C.O Charge) ÷ USD Received</p>
              <div className="flex justify-between text-blue-600 font-medium"><span>Effective Rate:</span> <span>৳{((parseFloat(formData.amountBDT) + parseFloat(formData.cashOutCharge || 0)) / parseFloat(formData.amountUSD)).toFixed(2)} / USD</span></div>
            </div>
          ) : null}
        </>
      )}

      {type === 'AD_SPEND' && (
        <>
          <div className="grid grid-cols-2 gap-4">
             <div><label className={labelClass}>Client</label>
              <select name="clientId" value={formData.clientId} onChange={handleChange} required className={inputClass}>
                {clients?.length === 0 && <option value="" disabled>No clients found</option>}
                {clients?.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Card Used</label>
              <select name="cardId" value={formData.cardId} onChange={handleChange} required className={inputClass}>
                {cards?.length === 0 && <option value="" disabled>No cards found</option>}
                {cards?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Ad Account Name</label>
              <input type="text" name="adAccount" value={formData.adAccount} onChange={handleChange} placeholder="Optional account name" className={inputClass} />
            </div>
            <div><label className={labelClass}>Campaign Name</label>
              <input type="text" name="campaign" value={formData.campaign} onChange={handleChange} placeholder="Optional campaign name" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Ad Spend (USD)</label>
              <input type="number" min="0" step="0.01" name="amountUSD" value={formData.amountUSD} onChange={handleChange} required placeholder="Enter ad spend" className={inputClass} />
            </div>
            <div><label className={labelClass}>Tax (USD)</label>
              <input type="number" min="0" step="0.01" name="taxUSD" value={formData.taxUSD} onChange={handleChange} placeholder="Enter tax amount" className={inputClass} />
            </div>
          </div>
          {formData.amountUSD ? (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800">
              Total Card Deduction = Ad Spend + Tax
              <div className="mt-1 font-bold">Total Card Deduction: ${(parseFloat(formData.amountUSD || 0) + parseFloat(formData.taxUSD || 0)).toFixed(2)}</div>
            </div>
          ) : null}
        </>
      )}

      {type !== 'USD_PURCHASE' && (
        <div><label className={labelClass}>Notes / Details</label>
          <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional details..." rows="2" className={inputClass}></textarea>
        </div>
      )}
      
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Save Transaction</button>
      </div>
    </form>
  );
}

function NavItem({ icon, label, isActive, onClick }) {
  return <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><span className="w-5 h-5 flex items-center justify-center">{React.cloneElement(icon, { size: 18 })}</span><span>{label}</span></button>;
}
function Modal({ title, onClose, children, width = 'max-w-2xl' }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"><div className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90vh] overflow-hidden flex flex-col`}><div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0"><h3 className="text-lg font-bold text-slate-900">{title}</h3><button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><X size={20}/></button></div><div className="p-5 overflow-y-auto">{children}</div></div></div>;
}
function MetricCard({ title, value, subtitle, icon, bgColor='bg-slate-50', textColorClass='text-slate-900' }) {
  return <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500 font-medium">{title}</p><p className={`text-xl font-bold mt-1 ${textColorClass}`}>{value}</p>{subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}</div>{icon && <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>}</div></div>;
}
function StatRow({ label, value, className='' }) { return <div className={`flex items-center justify-between text-sm ${className}`}><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{value}</span></div>; }
function Divider() { return <div className="h-px bg-slate-200 my-2"/>; }
