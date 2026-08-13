import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, Users, CreditCard, DollarSign, 
  Activity, FileText, Settings, Plus, Search, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, 
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, Trash2, CalendarDays,
  BriefcaseBusiness, PlugZap, UsersRound, Database, Upload, ShieldCheck, SlidersHorizontal,
  UserPlus, Link2, BarChart3, Target, Globe2, Save, RotateCcw
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell
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

  // Additive SaaS modules. Existing financial data remains untouched.
  const [campaigns, setCampaigns] = useLocalStorage('adledger_campaigns', []);
  const [workspaceSettings, setWorkspaceSettings] = useLocalStorage('adledger_settings', {
    businessName: 'AdLytic',
    timezone: 'Asia/Dhaka',
    alerts: true,
    defaultReportRange: 'This Month',
    logoData: ''
  });
  const [teamMembers, setTeamMembers] = useLocalStorage('adledger_team', []);
  const [globalSearch, setGlobalSearch] = useState('');
  
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    clients.forEach(c => {
      if ([c.name, c.company, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(q))) {
        results.push({ type:'Client', label:c.name || 'Unnamed Client', meta:c.company || 'Client', view:'clients', id:c.id });
      }
    });
    cards.forEach(c => {
      if ([c.name, c.provider, c.last4].some(v => String(v || '').toLowerCase().includes(q))) {
        results.push({ type:'Card', label:c.name || 'Unnamed Card', meta:c.provider || 'Card', view:'cards', id:c.id });
      }
    });
    campaigns.forEach(c => {
      if ([c.name, c.platform, c.goal].some(v => String(v || '').toLowerCase().includes(q))) {
        results.push({ type:'Campaign', label:c.name || 'Unnamed Campaign', meta:c.platform || 'Campaign', view:'campaigns', id:c.id });
      }
    });
    transactions.slice(0, 80).forEach(t => {
      const text = [t.type,t.notes,t.adAccount,t.campaign,t.clientName,t.client,t.sourceClient].join(' ').toLowerCase();
      if (text.includes(q)) {
        results.push({ type:'Transaction', label:t.notes || t.campaign || String(t.type || 'Transaction').replace(/_/g,' '), meta:t.date || 'Ledger entry', view:'ledger', id:t.id });
      }
    });
    return results.slice(0, 8);
  }, [globalSearch, clients, cards, campaigns, transactions]);

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

  const handleToggleClientStatus = (client, nextStatus) => {
    setClients(prev => prev.map(c => {
      if (c.id !== client.id) return c;

      if (nextStatus === 'active') {
        return {
          ...c,
          currentlyWorking: true,
          status: 'Active',
          endDate: ''
        };
      }

      if (nextStatus === 'inactive') {
        return {
          ...c,
          currentlyWorking: false,
          status: 'Inactive'
        };
      }

      if (nextStatus === 'completed') {
        return {
          ...c,
          currentlyWorking: false,
          status: 'Completed',
          endDate: new Date().toISOString().split('T')[0]
        };
      }

      return c;
    }));
  };

  const openPaymentForClient = (client) => {
    setSelectedClient(client);
    setActiveModal('payment');
  };

  const openAdSpendForClient = (client) => {
    setSelectedClient(client);
    setActiveModal('spend');
  };

  // --- SaaS MODULE HANDLERS (isolated from existing financial modules) ---
  const handleSaveCampaign = (campaignData) => {
    if (campaignData.id) {
      setCampaigns(prev => prev.map(c => c.id === campaignData.id ? campaignData : c));
    } else {
      setCampaigns(prev => [...prev, { ...campaignData, id: `camp_${Date.now()}_${Math.floor(Math.random() * 1000)}` }]);
    }
  };

  const handleDeleteCampaign = (campaignId) => {
    if (window.confirm('Delete this campaign? Historical transactions will not be deleted.')) {
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    }
  };

  const handleSaveWorkspaceSettings = (nextSettings) => {
    setWorkspaceSettings(prev => ({ ...prev, ...nextSettings }));
  };

  const handleAddTeamMember = (member) => {
    setTeamMembers(prev => [...prev, { ...member, id: `team_${Date.now()}_${Math.floor(Math.random() * 1000)}` }]);
  };

  const handleRemoveTeamMember = (memberId) => {
    if (window.confirm('Remove this team member?')) {
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const exportBackup = () => {
    const payload = {
      app: 'AdLedger',
      version: 1,
      exportedAt: new Date().toISOString(),
      clients, cards, transactions, campaigns, workspaceSettings, teamMembers
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adlytic-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || data.app !== 'AdLedger') throw new Error('Invalid backup');
        if (Array.isArray(data.clients)) setClients(data.clients);
        if (Array.isArray(data.cards)) setCards(data.cards);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
        if (data.workspaceSettings) setWorkspaceSettings(data.workspaceSettings);
        if (Array.isArray(data.teamMembers)) setTeamMembers(data.teamMembers);
        window.alert('Backup restored successfully.');
      } catch (error) {
        window.alert('This file is not a valid AdLedger backup.');
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = () => {
    if (!window.confirm('This will permanently clear all AdLedger data stored in this browser. Continue?')) return;
    setClients([]);
    setCards([]);
    setTransactions([]);
    setCampaigns([]);
    setTeamMembers([]);
    setWorkspaceSettings({
      businessName: 'AdLytic',
      timezone: 'Asia/Dhaka',
      alerts: true,
      defaultReportRange: 'This Month',
      logoData: ''
    });
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} clients={clients} cards={cards} />;
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
                   onViewHistory={(c) => { setSelectedClient(c); setActiveModal('client-history'); }}
                   onToggleStatus={handleToggleClientStatus}
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
      case 'reports':
        return <ReportsView clients={clients} cards={cards} transactions={transactions} />;
      case 'campaigns':
        return <CampaignsView campaigns={campaigns} clients={clients} transactions={transactions} metrics={metrics} onSave={handleSaveCampaign} onDelete={handleDeleteCampaign} />;
      case 'integrations':
        return <IntegrationsView />;
      case 'team':
        return <TeamView teamMembers={teamMembers} onAdd={handleAddTeamMember} onRemove={handleRemoveTeamMember} />;
      case 'settings':
        return <SettingsView settings={workspaceSettings} onSave={handleSaveWorkspaceSettings} onExport={exportBackup} onImport={importBackup} onReset={resetAllData} />;
      default: return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} clients={clients} cards={cards} />;
    }
  };

  return (
    <div className="adlytic-app flex h-screen overflow-hidden">

      <style>{`
        /* =========================================================
           AdLytic — Reference-inspired SaaS Design System
           Old dark/light theme overrides are intentionally removed.
           This is the single visual system for the whole app.
           ========================================================= */
        :root {
          --adl-bg: #f1f3f6;
          --adl-surface: #ffffff;
          --adl-surface-2: #f8fafc;
          --adl-text: #182338;
          --adl-muted: #718096;
          --adl-border: #e4e9f0;
          --adl-primary: #38a8f5;
          --adl-primary-2: #7c5cff;
          --adl-primary-soft: #edf7ff;
          --adl-green: #10b981;
          --adl-red: #ef5b68;
          --adl-orange: #f59e0b;
          --adl-purple: #8b5cf6;
          --adl-shadow: 0 12px 30px rgba(35, 47, 72, .07);
          --adl-shadow-hover: 0 18px 38px rgba(35, 47, 72, .12);
        }

        .adlytic-app {
          min-height: 100vh;
          background:
            radial-gradient(circle at 85% -10%, rgba(56,168,245,.10), transparent 28%),
            radial-gradient(circle at 8% 10%, rgba(124,92,255,.06), transparent 22%),
            var(--adl-bg) !important;
          color: var(--adl-text) !important;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          gap: 16px;
          padding: 16px;
        }

        .adlytic-sidebar {
          width: 232px;
          flex: 0 0 232px;
          height: calc(100vh - 32px);
          position: relative;
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,.96);
          border: 1px solid var(--adl-border);
          border-radius: 22px;
          box-shadow: var(--adl-shadow);
          overflow: hidden;
          z-index: 40;
        }

        .adlytic-brand {
          padding: 20px 18px 18px;
          border-bottom: 1px solid #edf0f4;
        }
        .adlytic-brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #fff;
          font-weight: 800;
          background: linear-gradient(135deg, #38a8f5, #6c7cff);
          box-shadow: 0 8px 18px rgba(56,168,245,.22);
        }
        .adlytic-brand-name {
          font-size: 18px;
          line-height: 1;
          font-weight: 800;
          color: #172238;
          letter-spacing: -.03em;
        }
        .adlytic-brand-sub {
          font-size: 9px;
          margin-top: 5px;
          color: #94a0b4;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .adlytic-sidebar nav {
          padding: 16px 12px;
        }
        .adlytic-section-label {
          padding: 14px 11px 7px;
          color: #a0aabd;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .adlytic-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 11px;
          margin: 3px 0;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #718096;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: .18s ease;
        }
        .adlytic-nav-item:hover {
          background: #f4f8fc;
          color: #27364e;
          transform: translateX(1px);
        }
        .adlytic-nav-item.active {
          color: #fff;
          background: linear-gradient(135deg, #43aef5, #6d7df7);
          box-shadow: 0 7px 16px rgba(69,142,237,.22);
        }
        .adlytic-nav-item svg {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
        }
        .adlytic-nav-item:not(.active) svg { color: #93a0b4; }
        .adlytic-nav-item.active svg { color: #fff; }

        .adlytic-sidebar-footer {
          margin-top: auto;
          padding: 12px;
          border-top: 1px solid #edf0f4;
        }

        .adlytic-main {
          min-width: 0;
          height: calc(100vh - 32px);
          background: transparent !important;
        }

        .adlytic-topbar {
          height: 58px;
          flex: 0 0 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 14px;
          background: rgba(255,255,255,.94);
          border: 1px solid var(--adl-border);
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(35,47,72,.045);
          backdrop-filter: blur(14px);
        }

        .adlytic-search {
          width: min(410px, 46vw);
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid #dfe6ef;
          border-radius: 11px;
          background: #f8fafc;
          transition: .18s ease;
        }
        .adlytic-search:focus-within {
          background: #fff;
          border-color: #8acaf7;
          box-shadow: 0 0 0 3px rgba(56,168,245,.10);
        }
        .adlytic-search input {
          width: 100%;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          color: #26354d !important;
          font-size: 12px;
        }
        .adlytic-search input::placeholder { color: #9aa6b8 !important; }

        .adlytic-toolbar-rate {
          display: flex;
          align-items: baseline;
          gap: 6px;
          white-space: nowrap;
        }
        .adlytic-toolbar-rate span:first-child {
          color: #9aa5b6;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
          font-weight: 700;
        }
        .adlytic-toolbar-rate span:last-child {
          color: #26354d;
          font-size: 13px;
          font-weight: 800;
        }

        .adlytic-toolbar-btn {
          height: 36px;
          padding: 0 12px !important;
          border-radius: 10px !important;
          border: 1px solid #dce4ee !important;
          background: #fff !important;
          color: #40506a !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          box-shadow: none !important;
          transition: .18s ease;
        }
        .adlytic-toolbar-btn:hover {
          transform: translateY(-1px);
          border-color: #b8d9f4 !important;
          background: #f7fbff !important;
        }
        .adlytic-toolbar-btn.primary {
          color: #fff !important;
          border-color: transparent !important;
          background: linear-gradient(135deg,#36a8f4,#5c83f6) !important;
          box-shadow: 0 7px 15px rgba(62,137,236,.20) !important;
        }

        .adlytic-content {
          padding: 24px 4px 30px !important;
          background: transparent !important;
        }

        /* Global surface language for existing screens. */
        .adlytic-app .bg-white {
          background: var(--adl-surface) !important;
          color: var(--adl-text) !important;
          border-color: var(--adl-border) !important;
          box-shadow: var(--adl-shadow) !important;
        }
        .adlytic-app .bg-slate-50,
        .adlytic-app .bg-slate-100 { background: var(--adl-surface-2) !important; }
        .adlytic-app .bg-slate-200 { background: #edf1f5 !important; }
        /* Remove legacy dark surfaces from older dialogs/sections. */
        .adlytic-app .bg-slate-900:not(button) {
          background: #fff !important;
          color: var(--adl-text) !important;
          border: 1px solid var(--adl-border);
          box-shadow: var(--adl-shadow);
        }
        .adlytic-app button.bg-slate-900 {
          background: linear-gradient(135deg,#3aaaf4,#637ff4) !important;
          color: #fff !important;
          border: 0 !important;
        }
        .adlytic-app .bg-slate-900\/70 {
          background: #fff !important;
          color: #41516a !important;
          border-color: #dce4ee !important;
        }
        .adlytic-app .bg-slate-700 { background: #f0f4f8 !important; color: #64748b !important; }
        .adlytic-app .bg-slate-800 { background: #f7f9fc !important; }
        .adlytic-app .border-slate-700,
        .adlytic-app .border-slate-800 { border-color: var(--adl-border) !important; }

        .adlytic-app .text-slate-900,
        .adlytic-app .text-slate-800 { color: #1a2740 !important; }
        .adlytic-app .text-slate-700 { color: #3d4d67 !important; }
        .adlytic-app .text-slate-600 { color: #61718a !important; }
        .adlytic-app .text-slate-500 { color: #8190a6 !important; }
        .adlytic-app .text-slate-400 { color: #9aa6b8 !important; }

        .adlytic-app .border-slate-100,
        .adlytic-app .border-slate-200,
        .adlytic-app .border-slate-300 {
          border-color: var(--adl-border) !important;
        }

        .adlytic-app input,
        .adlytic-app select,
        .adlytic-app textarea {
          background: #fbfcfe !important;
          color: #24334c !important;
          border-color: #dce4ee !important;
          border-radius: 10px;
        }
        .adlytic-app input::placeholder,
        .adlytic-app textarea::placeholder { color: #9aa6b8 !important; }
        .adlytic-app input:focus,
        .adlytic-app select:focus,
        .adlytic-app textarea:focus {
          border-color: #83c7f5 !important;
          box-shadow: 0 0 0 3px rgba(56,168,245,.10) !important;
        }

        .adlytic-app table thead {
          background: #f7f9fc !important;
        }
        .adlytic-app table th {
          color: #6c7b91 !important;
          font-weight: 700 !important;
        }
        .adlytic-app table tbody tr {
          background: #fff;
          transition: .16s ease;
        }
        .adlytic-app table tbody tr:hover {
          background: #f7fbff !important;
        }

        .adlytic-app .shadow-sm {
          box-shadow: var(--adl-shadow) !important;
        }
        .adlytic-app .shadow-md,
        .adlytic-app .shadow-lg,
        .adlytic-app .shadow-xl,
        .adlytic-app .shadow-2xl {
          box-shadow: var(--adl-shadow-hover) !important;
        }

        /* Semantic colors */
        .adlytic-app .bg-emerald-50,
        .adlytic-app .bg-green-50 { background: #ecfbf5 !important; }
        .adlytic-app .bg-red-50 { background: #fff1f2 !important; }
        .adlytic-app .bg-orange-50 { background: #fff8e8 !important; }
        .adlytic-app .bg-blue-50,
        .adlytic-app .bg-sky-50 { background: #eef8ff !important; }
        .adlytic-app .bg-purple-50 { background: #f5f0ff !important; }

        .adlytic-app .text-emerald-600,
        .adlytic-app .text-emerald-700 { color: #0aaf78 !important; }
        .adlytic-app .text-red-500,
        .adlytic-app .text-red-600,
        .adlytic-app .text-red-700 { color: #e84d5b !important; }
        .adlytic-app .text-orange-500,
        .adlytic-app .text-orange-600,
        .adlytic-app .text-orange-700 { color: #e99208 !important; }
        .adlytic-app .text-blue-600,
        .adlytic-app .text-blue-700 { color: #3d8ee8 !important; }
        .adlytic-app .text-sky-600,
        .adlytic-app .text-sky-700 { color: #1c9fe8 !important; }
        .adlytic-app .text-purple-600,
        .adlytic-app .text-purple-700 { color: #8055df !important; }

        /* Metric cards become compact reference-style analytics tiles. */
        .adlytic-app .adlytic-metric {
          border: 1px solid var(--adl-border);
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 8px 22px rgba(35,47,72,.055);
        }

        /* Recharts */
        .adlytic-app .recharts-cartesian-grid line {
          stroke: #e7ebf1 !important;
        }
        .adlytic-app .recharts-cartesian-axis-line,
        .adlytic-app .recharts-cartesian-axis-tick-line {
          stroke: #dbe2ea !important;
        }
        .adlytic-app .recharts-text { fill: #8390a4 !important; }
        .adlytic-app .recharts-legend-item-text { color: #697890 !important; }
        .adlytic-app .recharts-default-tooltip {
          background: rgba(255,255,255,.98) !important;
          border: 1px solid #dce4ee !important;
          color: #25344d !important;
          border-radius: 12px !important;
          box-shadow: 0 16px 35px rgba(35,47,72,.13) !important;
        }

        /* Generic modern panels already used by the app. */
        .adlytic-app .rounded-2xl { border-radius: 16px !important; }
        .adlytic-app .rounded-xl { border-radius: 13px !important; }
        .adlytic-app .rounded-lg { border-radius: 10px !important; }

        @media (max-width: 767px) {
          .adlytic-app { padding: 0; gap: 0; }
          .adlytic-sidebar {
            position: fixed;
            top: 12px;
            bottom: 12px;
            left: 12px;
            height: auto;
            transform: translateX(-120%);
            transition: transform .2s ease;
            z-index: 80;
          }
          .adlytic-sidebar.mobile-open { transform: translateX(0); }
          .adlytic-main { height: 100vh; }
          .adlytic-topbar {
            border-radius: 0 0 14px 14px;
            border-left: 0;
            border-right: 0;
            border-top: 0;
          }
          .adlytic-search { width: min(48vw, 260px); }
          .adlytic-content { padding: 18px 14px 26px !important; }
        }
      `}</style>

      
      {/* SIDEBAR */}
      <aside className={`adlytic-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} md:translate-x-0`}>
        <div className="adlytic-brand">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="adlytic-brand-mark">
                {workspaceSettings.logoData ? <img src={workspaceSettings.logoData} alt="Workspace logo" className="w-full h-full object-cover" /> : <span>A</span>}
              </div>
              <div>
                <div className="adlytic-brand-name">{workspaceSettings.businessName || 'AdLytic'}</div>
                <div className="adlytic-brand-sub">Marketing Finance</div>
              </div>
            </div>
            <button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={19} />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => {setCurrentView('dashboard'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Users />} label="Clients" isActive={currentView === 'clients'} onClick={() => {setCurrentView('clients'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<BriefcaseBusiness />} label="Campaigns" isActive={currentView === 'campaigns'} onClick={() => {setCurrentView('campaigns'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<Activity />} label="Transactions" isActive={currentView === 'ledger'} onClick={() => {setCurrentView('ledger'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<CreditCard />} label="Cards & USD" isActive={currentView === 'cards'} onClick={() => {setCurrentView('cards'); setIsMobileMenuOpen(false);}} />
          <NavItem icon={<PieChart />} label="Reports" isActive={currentView === 'reports'} onClick={() => {setCurrentView('reports'); setIsMobileMenuOpen(false);}} />

          <div className="pt-5 mt-4 border-t border-slate-800/80">
            <p className="adlytic-section-label">Workspace</p>
            <NavItem icon={<PlugZap />} label="Integrations" isActive={currentView === 'integrations'} onClick={() => {setCurrentView('integrations'); setIsMobileMenuOpen(false);}} />
            <NavItem icon={<UsersRound />} label="Team" isActive={currentView === 'team'} onClick={() => {setCurrentView('team'); setIsMobileMenuOpen(false);}} />
          </div>
        </nav>

        <div className="adlytic-sidebar-footer">
          <NavItem icon={<Settings />} label="Settings" isActive={currentView === 'settings'} onClick={() => {setCurrentView('settings'); setIsMobileMenuOpen(false);}} />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="adlytic-main flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="adlytic-topbar">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden sm:block relative">
              <div className="adlytic-search">
                <Search size={17} className="text-sky-500 shrink-0" />
                <input type="text" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setGlobalSearch('')}} placeholder="Search clients, cards, campaigns..." className="bg-transparent border-none !shadow-none !ring-0 focus:outline-none text-sm ml-2 w-full" />
                {globalSearch && <button type="button" onClick={()=>setGlobalSearch('')} className="text-slate-400 hover:text-slate-700 p-1"><X size={15}/></button>}
              </div>
              {globalSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-sky-100 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                  {globalSearchResults.length ? globalSearchResults.map(item => (
                    <button key={`${item.type}-${item.id}`} type="button" onClick={()=>{setCurrentView(item.view);setGlobalSearch('');setIsMobileMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sky-50 transition-colors">
                      <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-[10px] font-bold">{item.type.slice(0,2).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 truncate">{item.label}</span><span className="block text-[11px] text-slate-500">{item.type} · {item.meta}</span></span>
                      <ArrowUpRight size={14} className="text-slate-300"/>
                    </button>
                  )) : <div className="px-4 py-6 text-center text-sm text-slate-400">No matching records found.</div>}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="adlytic-toolbar-rate hidden lg:flex">
              <span className="text-xs font-medium text-slate-500 uppercase">Avg USD Rate:</span>
              <span className="text-sm font-bold text-slate-800">৳{metrics.avgUSDEffectiveRate.toFixed(2)}</span>
            </div>
            <button onClick={() => { setSelectedClient(null); setActiveModal('payment'); }} className="adlytic-toolbar-btn hidden sm:flex items-center gap-1">
              <ArrowDownRight size={16} className="text-green-600"/> Receive BDT
            </button>
            <button onClick={() => setActiveModal('usd')} className="adlytic-toolbar-btn hidden sm:flex items-center gap-1">
              <DollarSign size={16} className="text-blue-600"/> Buy USD
            </button>
            <button onClick={() => { setSelectedClient(null); setActiveModal('spend'); }} className="adlytic-toolbar-btn primary flex items-center gap-1">
              <Plus size={16} /> Ad Spend
            </button>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 adlytic-content">
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
      {activeModal === 'client-history' && selectedClient && (
        <Modal title={`Transaction History: ${selectedClient.name}`} onClose={() => setActiveModal(null)} width="max-w-5xl">
          <ClientTransactionHistoryModal
            client={selectedClient}
            transactions={transactions}
            metrics={metrics}
          />
        </Modal>
      )}


    </div>
  );
}

// --- VIEWS ---

// --- REPORTS VIEW ---
// This view is read-only: it derives its numbers from the existing clients/cards/transactions.
// It does not mutate Card Ledger, Transaction Ledger, or Client Management data.
function ReportsView({ clients, cards, transactions }) {
  const [datePreset, setDatePreset] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const dateRange = useMemo(() => {
    if (datePreset === 'Custom') {
      return { start: customStart || null, end: customEnd || null };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customStart, customEnd]);

  const inRange = (dateValue) => {
    if (!dateValue) return false;
    const date = String(dateValue).slice(0, 10);
    if (dateRange.start && date < dateRange.start) return false;
    if (dateRange.end && date > dateRange.end) return false;
    return true;
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!inRange(t.date)) return false;
      if (clientFilter !== 'all' && t.clientId !== clientFilter) return false;
      if (cardFilter !== 'all' && t.cardId !== cardFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, dateRange.start, dateRange.end, clientFilter, cardFilter, typeFilter]);

  const report = useMemo(() => {
    const result = {
      revenueBDT: 0,
      bdtOut: 0,
      usdPurchased: 0,
      usdSpent: 0,
      taxUSD: 0,
      feesUSD: 0,
      cashOutBDT: 0,
      usdPurchaseBDT: 0,
      transactionCount: filteredTransactions.length
    };

    filteredTransactions.forEach(t => {
      if (t.type === 'PAYMENT_RECEIVED') {
        result.revenueBDT += parseFloat(t.amountBDT || 0);
      }

      if (t.type === 'USD_PURCHASE') {
        const bdt = parseFloat(t.amountBDT || 0);
        const charge = parseFloat(t.cashOutCharge || 0);
        const usd = parseFloat(t.amountUSD || 0);
        result.usdPurchaseBDT += bdt;
        result.cashOutBDT += charge;
        result.usdPurchased += usd;
        result.bdtOut += bdt + charge;
      }

      if (t.type === 'AD_SPEND') {
        result.usdSpent += parseFloat(t.amountUSD || 0);
        result.taxUSD += parseFloat(t.taxUSD || 0);
      }

      if (t.type === 'FEE') {
        result.feesUSD += parseFloat(t.amountUSD || 0);
      }
    });

    const totalUSDOut = result.usdSpent + result.taxUSD + result.feesUSD;
    const totalBDTCost = result.usdPurchaseBDT + result.cashOutBDT;
    const effectiveRate = result.usdPurchased > 0 ? totalBDTCost / result.usdPurchased : 0;
    const adCostBDT = (result.usdSpent + result.taxUSD) * effectiveRate;
    const profitBDT = result.revenueBDT - adCostBDT;
    const margin = result.revenueBDT > 0 ? (profitBDT / result.revenueBDT) * 100 : 0;

    return {
      ...result,
      totalUSDOut,
      totalBDTCost,
      effectiveRate,
      adCostBDT,
      profitBDT,
      margin,
      netBDT: result.revenueBDT - result.bdtOut
    };
  }, [filteredTransactions]);

  const clientRows = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      map[c.id] = {
        id: c.id,
        name: c.name || 'Unnamed Client',
        revenue: 0,
        adSpend: 0,
        tax: 0,
        profit: 0,
        transactions: 0
      };
    });

    filteredTransactions.forEach(t => {
      const explicitClientName = String(
        t.clientName || t.client || t.sourceClient || t.clientNameSnapshot || ''
      ).trim().toLowerCase();

      const namedClient = explicitClientName
        ? clients.find(c => String(c.name || '').trim().toLowerCase() === explicitClientName)
        : null;

      const clientIdExists = t.clientId && clients.some(c => c.id === t.clientId);

      const targetClientId = (
        (clientIdExists ? t.clientId : null) ||
        namedClient?.id ||
        (clients.length === 1 ? clients[0].id : null)
      );

      if (!targetClientId) return;

      if (!map[targetClientId]) {
        const fallback = clients.find(c => c.id === targetClientId);
        map[targetClientId] = {
          id: targetClientId,
          name: fallback?.name || 'Unknown Client',
          revenue: 0,
          adSpend: 0,
          tax: 0,
          profit: 0,
          transactions: 0
        };
      }

      const row = map[targetClientId];
      row.transactions += 1;

      if (t.type === 'PAYMENT_RECEIVED') row.revenue += parseFloat(t.amountBDT || 0);
      if (t.type === 'AD_SPEND') {
        row.adSpend += parseFloat(t.amountUSD || 0);
        row.tax += parseFloat(t.taxUSD || 0);
      }
    });

    const rate = report.effectiveRate || 0;
    return Object.values(map)
      .map(row => ({
        ...row,
        costBDT: (row.adSpend + row.tax) * rate,
        profit: row.revenue - ((row.adSpend + row.tax) * rate)
      }))
      .filter(row => row.transactions > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [clients, filteredTransactions, report.effectiveRate]);

  const cardRows = useMemo(() => {
    const map = {};
    cards.forEach(c => {
      map[c.id] = {
        id: c.id,
        name: c.name || 'Unnamed Card',
        purchased: 0,
        adSpend: 0,
        tax: 0,
        fees: 0,
        current: parseFloat(c.initialBalance || 0)
      };
    });

    filteredTransactions.forEach(t => {
      if (!t.cardId || !map[t.cardId]) return;
      const row = map[t.cardId];

      if (t.type === 'USD_PURCHASE') row.purchased += parseFloat(t.amountUSD || 0);
      if (t.type === 'AD_SPEND') {
        row.adSpend += parseFloat(t.amountUSD || 0);
        row.tax += parseFloat(t.taxUSD || 0);
      }
      if (t.type === 'FEE') row.fees += parseFloat(t.amountUSD || 0);
    });

    return Object.values(map).map(row => ({
      ...row,
      current: row.current + row.purchased - row.adSpend - row.tax - row.fees
    }));
  }, [cards, filteredTransactions]);

  const dailyChart = useMemo(() => {
    const map = {};
    filteredTransactions.forEach(t => {
      const key = String(t.date || '').slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = { date: key, revenue: 0, adSpendUSD: 0, usdPurchased: 0 };

      if (t.type === 'PAYMENT_RECEIVED') map[key].revenue += parseFloat(t.amountBDT || 0);
      if (t.type === 'AD_SPEND') map[key].adSpendUSD += parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0);
      if (t.type === 'USD_PURCHASE') map[key].usdPurchased += parseFloat(t.amountUSD || 0);
    });

    const rate = report.effectiveRate || 0;
    return Object.values(map)
      .map(row => ({
        ...row,
        adCostBDT: row.adSpendUSD * rate
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, report.effectiveRate]);

  const expenseChart = [
    { name: 'Ad Spend', value: report.usdSpent },
    { name: 'Tax', value: report.taxUSD },
    { name: 'Fees', value: report.feesUSD }
  ];

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Client', 'Card', 'BDT In', 'BDT Out', 'USD In', 'USD Out'];
    const rows = filteredTransactions.map(t => {
      const client = clients.find(c => c.id === t.clientId)?.name || '';
      const card = cards.find(c => c.id === t.cardId)?.name || '';
      const bdtIn = t.type === 'PAYMENT_RECEIVED' ? parseFloat(t.amountBDT || 0) : 0;
      const bdtOut = t.type === 'USD_PURCHASE'
        ? parseFloat(t.amountBDT || 0) + parseFloat(t.cashOutCharge || 0)
        : 0;
      const usdIn = t.type === 'USD_PURCHASE' ? parseFloat(t.amountUSD || 0) : 0;
      const usdOut = t.type === 'AD_SPEND'
        ? parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0)
        : t.type === 'FEE' ? parseFloat(t.amountUSD || 0) : 0;

      return [
        t.date || '',
        t.type || '',
        t.description || t.source || '',
        client,
        card,
        bdtIn.toFixed(2),
        bdtOut.toFixed(2),
        usdIn.toFixed(2),
        usdOut.toFixed(2)
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adlytic-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setDatePreset('This Month');
    setCustomStart('');
    setCustomEnd('');
    setClientFilter('all');
    setCardFilter('all');
    setTypeFilter('all');
  };

  const selectedRangeLabel = datePreset === 'Custom'
    ? `${customStart || 'Start'} → ${customEnd || 'End'}`
    : datePreset;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial performance from your existing AdLytic data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={datePreset}
            onChange={e => setDatePreset(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option>Today</option>
            <option>Yesterday</option>
            <option>This Week</option>
            <option>Last Week</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>This Year</option>
            <option>Last Year</option>
            <option>Lifetime</option>
            <option>Custom</option>
          </select>

          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={cardFilter}
            onChange={e => setCardFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Cards</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Transactions</option>
            <option value="PAYMENT_RECEIVED">Client Payment</option>
            <option value="USD_PURCHASE">Buy USD</option>
            <option value="AD_SPEND">Meta Ads</option>
            <option value="FEE">Card Fee</option>
          </select>

          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Reset
          </button>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Download size={15} /> Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {datePreset === 'Custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 mt-5">{selectedRangeLabel}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <ReportMetric title="Total BDT Received" value={formatBDT(report.revenueBDT)} />
        <ReportMetric title="Total BDT Cost" value={formatBDT(report.totalBDTCost)} />
        <ReportMetric title="Net BDT" value={formatBDT(report.netBDT)} />
        <ReportMetric title="USD Purchased" value={formatUSD(report.usdPurchased)} />
        <ReportMetric title="Meta Ads Spend" value={formatUSD(report.usdSpent)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <ReportMetric title="C.O Charge" value={formatBDT(report.cashOutBDT)} />
        <ReportMetric title="Tax" value={formatUSD(report.taxUSD)} />
        <ReportMetric title="Fees" value={formatUSD(report.feesUSD)} />
        <ReportMetric title="Total USD Out" value={formatUSD(report.totalUSDOut)} />
        <ReportMetric title="Profit" value={formatBDT(report.profitBDT)} />
        <ReportMetric title="Profit Margin" value={`${report.margin.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Revenue vs Ad Cost</h3>
              <p className="text-xs text-slate-500">BDT revenue and USD ad cost over the selected period.</p>
            </div>
          </div>
          <div className="h-72">
            {dailyChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Revenue (BDT)" stroke="#16A34A" strokeWidth={2} />
                  <Line type="monotone" dataKey="adCostBDT" name="Ad Cost (BDT Equivalent)" stroke="#F59E0B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ReportEmptyState />
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-800 mb-1">USD Expense Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Meta Ads, tax and card fees.</p>
          <div className="h-72">
            {expenseChart.some(x => x.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={expenseChart} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={66} outerRadius={98} paddingAngle={5} cornerRadius={8} stroke="none">
                    {expenseChart.map((entry,index)=><Cell key={`report-expense-${index}`} fill={['#38bdf8','#f59e0b','#8b5cf6'][index % 3]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:14, border:'1px solid #d7ebf7', boxShadow:'0 12px 30px rgba(15,23,42,.10)', fontSize:12 }} formatter={(value)=>[formatUSD(value),'USD']} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize:11,color:'#315675'}} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <ReportEmptyState />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Client Performance</h3>
            <p className="text-xs text-slate-500 mt-1">Revenue, ad cost and estimated profit.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Client</th>
                  <th className="text-right px-4 py-3 font-medium">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium">Ad Cost</th>
                  <th className="text-right px-5 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.length ? clientRows.map(row => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                    <td className="px-4 py-3 text-right">{formatBDT(row.revenue)}</td>
                    <td className="px-4 py-3 text-right">{formatBDT(row.costBDT)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatBDT(row.profit)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400">No client data for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Card Performance</h3>
            <p className="text-xs text-slate-500 mt-1">Purchased, spent and calculated period-end balance.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Card</th>
                  <th className="text-right px-4 py-3 font-medium">Purchased</th>
                  <th className="text-right px-4 py-3 font-medium">Spent</th>
                  <th className="text-right px-5 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {cardRows.length ? cardRows.map(row => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                    <td className="px-4 py-3 text-right">{formatUSD(row.purchased)}</td>
                    <td className="px-4 py-3 text-right">{formatUSD(row.adSpend + row.tax + row.fees)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${row.current >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {formatUSD(row.current)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400">No card data for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Detailed Report</h3>
              <p className="text-xs text-slate-500 mt-1">{report.transactionCount} transaction(s) in the selected range.</p>
            </div>
            <span className="text-xs text-slate-500">{selectedRangeLabel}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Client / Card</th>
                <th className="text-right px-4 py-3 font-medium">BDT In</th>
                <th className="text-right px-4 py-3 font-medium">BDT Out</th>
                <th className="text-right px-4 py-3 font-medium">USD In</th>
                <th className="text-right px-5 py-3 font-medium">USD Out</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length ? filteredTransactions.map(t => {
                const client = clients.find(c => c.id === t.clientId)?.name;
                const card = cards.find(c => c.id === t.cardId)?.name;
                const bdtIn = t.type === 'PAYMENT_RECEIVED' ? parseFloat(t.amountBDT || 0) : 0;
                const bdtOut = t.type === 'USD_PURCHASE'
                  ? parseFloat(t.amountBDT || 0) + parseFloat(t.cashOutCharge || 0)
                  : 0;
                const usdIn = t.type === 'USD_PURCHASE' ? parseFloat(t.amountUSD || 0) : 0;
                const usdOut = t.type === 'AD_SPEND'
                  ? parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0)
                  : t.type === 'FEE' ? parseFloat(t.amountUSD || 0) : 0;

                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">{t.type}</td>
                    <td className="px-4 py-3">{client || card || t.source || t.description || '—'}</td>
                    <td className="px-4 py-3 text-right text-green-600">{bdtIn ? formatBDT(bdtIn) : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-600">{bdtOut ? formatBDT(bdtOut) : '—'}</td>
                    <td className="px-4 py-3 text-right text-green-600">{usdIn ? formatUSD(usdIn) : '—'}</td>
                    <td className="px-5 py-3 text-right text-red-600">{usdOut ? formatUSD(usdOut) : '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-400">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          aside, header, button, select, input { display: none !important; }
          main { overflow: visible !important; height: auto !important; }
          main > div { overflow: visible !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function ReportMetric({ title, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="text-xl font-bold text-slate-900 mt-2">{value}</p>
    </div>
  );
}

function ReportEmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      No report data for the selected period.
    </div>
  );
}

function DashboardView({ metrics, chartData, transactions, clients, cards }) {
  const dashboardData = useMemo(() => {
    let totalBDTSpentOnUSD = 0;
    let totalCashOutCharges = 0;

    transactions.forEach(t => {
      if (t.type === 'USD_PURCHASE') {
        totalBDTSpentOnUSD += parseFloat(t.amountBDT || 0);
        totalCashOutCharges += parseFloat(t.cashOutCharge || 0);
      }
    });

    const totalBDTCost = totalBDTSpentOnUSD + totalCashOutCharges;
    const netBDT = metrics.totalRevenueBDT - totalBDTCost;
    const totalUSDOut = metrics.totalAdSpendUSD + metrics.totalTaxUSD;

    const activeClients = clients.filter(c =>
      c.status === 'Active' || c.currentlyWorking
    );

    const clientMap = {};
    clients.forEach(client => {
      clientMap[client.id] = {
        id: client.id,
        name: client.name || 'Unnamed Client',
        revenue: 0,
        adSpendUSD: 0,
        adCostBDT: 0,
        profit: 0,
        status: client.status || (client.currentlyWorking ? 'Active' : 'Inactive')
      };
    });

    transactions.forEach(t => {
      let targetId = t.clientId;
      if (!targetId || !clientMap[targetId]) {
        const explicitName = String(
          t.clientName || t.client || t.sourceClient || t.clientNameSnapshot || ''
        ).trim().toLowerCase();
        if (explicitName) {
          const match = clients.find(c =>
            String(c.name || '').trim().toLowerCase() === explicitName
          );
          if (match) targetId = match.id;
        }
      }
      if ((!targetId || !clientMap[targetId]) && clients.length === 1) {
        targetId = clients[0].id;
      }
      if (!targetId || !clientMap[targetId]) return;

      const row = clientMap[targetId];
      if (t.type === 'PAYMENT_RECEIVED') {
        row.revenue += parseFloat(t.amountBDT || 0);
      }
      if (t.type === 'AD_SPEND') {
        row.adSpendUSD += parseFloat(t.amountUSD || 0);
        row.adCostBDT += (
          parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0)
        ) * (metrics.avgUSDEffectiveRate || 0);
      }
    });

    Object.values(clientMap).forEach(row => {
      row.profit = row.revenue - row.adCostBDT;
    });

    const clientRows = Object.values(clientMap)
      .filter(row => row.revenue || row.adSpendUSD || clients.length === 1)
      .sort((a, b) => b.revenue - a.revenue);

    const recentTransactions = [...transactions]
      .sort((a, b) => {
        const aTime = a.timestamp || new Date(a.date || 0).getTime();
        const bTime = b.timestamp || new Date(b.date || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);

    const flowData = chartData.map(row => ({
      ...row,
      adCostBDT: (parseFloat(row.spendUSD || 0) * (metrics.avgUSDEffectiveRate || 0))
    }));

    const expenseData = [
      { name: 'Meta Ads', value: metrics.totalAdSpendUSD },
      { name: 'Tax', value: metrics.totalTaxUSD },
      { name: 'Fees', value: Object.values(metrics.cardStats || {}).reduce((sum, item) => sum + (item.fees || 0), 0) }
    ];

    return {
      totalBDTCost,
      netBDT,
      totalUSDOut,
      activeClients,
      allCards: cards,
      clientRows,
      recentTransactions,
      flowData,
      expenseData
    };
  }, [metrics, chartData, transactions, clients, cards]);

  const getTransactionLabel = (tx) => {
    if (tx.type === 'PAYMENT_RECEIVED') return 'Payment Received';
    if (tx.type === 'USD_PURCHASE') return 'Buy USD';
    if (tx.type === 'AD_SPEND') return 'Meta Ads';
    if (tx.type === 'FEE') return 'Fee';
    return String(tx.type || 'Transaction').replace(/_/g, ' ');
  };

  const getTransactionEntity = (tx) => {
    const client = clients.find(c => c.id === tx.clientId);
    return client?.name || tx.clientName || tx.client || tx.sourceClient || tx.adAccount || '—';
  };

  const getStatusClasses = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('active')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (normalized.includes('complete')) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-orange-50 text-orange-700 border-orange-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-200"><Activity size={19}/></div>
            <div><h1 className="adlytic-page-title text-2xl font-bold text-slate-900">Financial Overview</h1>
            <p className="text-slate-500 text-sm">Your complete BDT, USD, client and card snapshot.</p></div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/70 border border-slate-700 rounded-full px-3 py-1.5 shadow-sm backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Live from your ledger
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatBDT(metrics.totalRevenueBDT)} subtitle="BDT received from clients" icon={<ArrowDownRight size={20} className="text-emerald-600" />} bgColor="bg-emerald-50" textColorClass="text-slate-900" />
        <MetricCard title="Total BDT Cost" value={formatBDT(dashboardData.totalBDTCost)} subtitle="USD purchase + C.O charges" icon={<Wallet size={20} className="text-orange-600" />} bgColor="bg-orange-50" textColorClass="text-slate-900" />
        <MetricCard title="Net BDT" value={formatBDT(dashboardData.netBDT)} subtitle="Revenue minus USD cost" icon={<TrendingUp size={20} className="text-blue-600" />} bgColor="bg-blue-50" textColorClass={dashboardData.netBDT < 0 ? 'text-red-600' : 'text-slate-900'} />
        <MetricCard title="Net Profit" value={formatBDT(metrics.netProfitBDT)} subtitle={`Margin: ${metrics.profitMargin.toFixed(1)}%`} icon={<TrendingUp size={20} className="text-indigo-600" />} bgColor="bg-indigo-50" textColorClass={metrics.netProfitBDT < 0 ? 'text-red-600' : 'text-slate-900'} />
        <MetricCard title="Meta Ads Spend" value={formatUSD(metrics.totalAdSpendUSD)} subtitle={`Tax ${formatUSD(metrics.totalTaxUSD)}`} icon={<Activity size={20} className="text-purple-600" />} bgColor="bg-purple-50" />
        <MetricCard title="Total USD Out" value={formatUSD(dashboardData.totalUSDOut)} subtitle="Ads + tax" icon={<ArrowUpRight size={20} className="text-red-600" />} bgColor="bg-red-50" />
        <MetricCard title="USD Purchased" value={formatUSD(metrics.totalUSDPurchased)} subtitle={`Rate ৳${metrics.avgUSDEffectiveRate.toFixed(2)}`} icon={<DollarSign size={20} className="text-sky-600" />} bgColor="bg-sky-50" />
        <MetricCard title="Card Balance" value={formatUSD(metrics.totalCardBalance)} subtitle="Available across all cards" icon={<CreditCard size={20} className="text-orange-600" />} bgColor="bg-orange-50" textColorClass={metrics.totalCardBalance < 0 ? 'text-red-600' : 'text-slate-900'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Money Flow</h3>
              <p className="text-xs text-slate-500 mt-1">Revenue versus ad cost, shown on the same BDT scale.</p>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Revenue</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" />Ad Cost</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.flowData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dashboardCostFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e8edf3" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `৳${Math.round(value / 1000)}k`} width={42} />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 12px 30px rgba(15,23,42,0.10)', fontSize: 12 }}
                  formatter={(value, name) => [formatBDT(value), name]}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue (BDT)" stroke="#10b981" strokeWidth={2.5} fill="url(#dashboardRevenueFill)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="adCostBDT" name="Ad Cost (BDT)" stroke="#f59e0b" strokeWidth={2.5} fill="url(#dashboardCostFill)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">USD Expense Breakdown</h3>
            <p className="text-xs text-slate-500 mt-1">Where your USD outflow is going.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={dashboardData.expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={5} cornerRadius={8} stroke="none">
                  {dashboardData.expenseData.map((entry,index)=><Cell key={`expense-${index}`} fill={['#38bdf8','#f59e0b','#8b5cf6'][index % 3]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius:14, border:'1px solid #d7ebf7', boxShadow:'0 12px 30px rgba(15,23,42,.10)', fontSize:12 }} formatter={(value)=>[formatUSD(value),'USD']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] text-slate-500">Ads</p><p className="text-xs font-semibold text-slate-800">{formatUSD(metrics.totalAdSpendUSD)}</p></div>
            <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] text-slate-500">Tax</p><p className="text-xs font-semibold text-slate-800">{formatUSD(metrics.totalTaxUSD)}</p></div>
            <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] text-slate-500">Total</p><p className="text-xs font-semibold text-slate-800">{formatUSD(dashboardData.totalUSDOut)}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Client Performance</h3>
              <p className="text-xs text-slate-500 mt-1">Revenue, ad cost and estimated profit by client.</p>
            </div>
            <span className="text-xs font-medium text-slate-400">{clients.length} client{clients.length === 1 ? '' : 's'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-3 font-medium text-right">Ad Cost</th>
                  <th className="pb-3 font-medium text-right">Profit</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.clientRows.length > 0 ? dashboardData.clientRows.slice(0, 6).map(row => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 font-medium text-slate-800">{row.name}</td>
                    <td className="py-3 text-right text-emerald-600">{formatBDT(row.revenue)}</td>
                    <td className="py-3 text-right text-slate-700">{formatBDT(row.adCostBDT)}</td>
                    <td className={`py-3 text-right font-semibold ${row.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatBDT(row.profit)}</td>
                    <td className="py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-medium ${getStatusClasses(row.status)}`}>{row.status}</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="py-10 text-center text-slate-400">No client data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">Quick Stats</h3>
            <p className="text-xs text-slate-500 mt-1">A compact snapshot of your operation.</p>
          </div>
          <div className="space-y-3">
            <StatRow label="Active Clients" value={dashboardData.activeClients.length} />
            <StatRow label="Total Clients" value={clients.length} />
            <StatRow label="Total Cards" value={Object.keys(metrics.cardBalances || {}).length} />
            <Divider />
            <StatRow label="Avg USD Effective Rate" value={`৳${metrics.avgUSDEffectiveRate.toFixed(2)}`} />
            <StatRow label="USD Purchased" value={formatUSD(metrics.totalUSDPurchased)} />
            <StatRow label="Total BDT Spent on USD" value={formatBDT(dashboardData.totalBDTCost)} />
            <StatRow label="Meta Tax" value={formatUSD(metrics.totalTaxUSD)} className="text-red-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Card Overview</h3>
              <p className="text-xs text-slate-500 mt-1">Purchased, spent and current balance.</p>
            </div>
            <CreditCard size={18} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {Object.keys(metrics.cardBalances || {}).length > 0 ? Object.keys(metrics.cardBalances).map(cardId => {
              const card = (metrics.cardStats && metrics.cardStats[cardId]) || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
              const foundCard = (dashboardData.allCards || []).find(c => c.id === cardId);
              const openingBalance = parseFloat(foundCard?.initialBalance || 0);
              const balance = openingBalance + card.purchased - card.adSpend - card.tax - card.fees;
              const cardName = (() => {
                const allCards = dashboardData.allCards || [];
                const found = allCards.find(c => c.id === cardId);
                return found?.name || `Card • ${String(cardId).slice(-4)}`;
              })();
              return (
                <div key={cardId} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{cardName}</p>
                      <p className="text-[11px] text-slate-500">Purchased {formatUSD(card.purchased)} · Spent {formatUSD(card.adSpend + card.tax + card.fees)}</p>
                    </div>
                    <p className={`font-bold ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatUSD(balance)}</p>
                  </div>
                </div>
              );
            }) : <div className="py-10 text-center text-slate-400 text-sm">No cards added yet.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
              <p className="text-xs text-slate-500 mt-1">Latest movement across your ledger.</p>
            </div>
            <Activity size={18} className="text-slate-400" />
          </div>
          <div className="space-y-2">
            {dashboardData.recentTransactions.length > 0 ? dashboardData.recentTransactions.map(tx => {
              const isIn = tx.type === 'PAYMENT_RECEIVED' || tx.type === 'USD_PURCHASE';
              const amount = tx.type === 'PAYMENT_RECEIVED'
                ? formatBDT(tx.amountBDT)
                : tx.type === 'USD_PURCHASE'
                  ? formatUSD(tx.amountUSD)
                  : formatUSD((parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)));
              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{getTransactionLabel(tx)}</p>
                    <p className="text-[11px] text-slate-500 truncate">{getTransactionEntity(tx)} · {tx.date || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>{isIn ? '+' : '-'}{amount.replace(/^-/, '')}</p>
                  </div>
                </div>
              );
            }) : <div className="py-10 text-center text-slate-400 text-sm">No transactions yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={17} /><span className="text-sm font-semibold">Healthy Revenue</span></div>
          <p className="text-xs text-emerald-700/80 mt-2">{formatBDT(metrics.totalRevenueBDT)} received from clients.</p>
        </div>
        <div className={`rounded-2xl border p-4 ${metrics.totalCardBalance < 0 ? 'border-red-100 bg-red-50/70' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`flex items-center gap-2 ${metrics.totalCardBalance < 0 ? 'text-red-700' : 'text-slate-700'}`}><AlertCircle size={17} /><span className="text-sm font-semibold">Card Balance</span></div>
          <p className={`text-xs mt-2 ${metrics.totalCardBalance < 0 ? 'text-red-700/80' : 'text-slate-600'}`}>{metrics.totalCardBalance < 0 ? `Total card balance is ${formatUSD(metrics.totalCardBalance)}.` : 'All card balances are currently non-negative.'}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-center gap-2 text-blue-700"><TrendingUp size={17} /><span className="text-sm font-semibold">Profit Snapshot</span></div>
          <p className="text-xs text-blue-700/80 mt-2">{formatBDT(metrics.netProfitBDT)} net profit · {metrics.profitMargin.toFixed(1)}% margin.</p>
        </div>
      </div>
    </div>
  );
}


function LedgerView({ transactions, clients, cards }) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...transactions]
      .filter(tx => {
        const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;

        const search = searchTerm.trim().toLowerCase();
        const client = clients.find(c => c.id === tx.clientId);
        const card = cards.find(c => c.id === tx.cardId);

        const searchableText = [
          tx.notes,
          tx.adAccount,
          tx.campaign,
          tx.type,
          client?.name,
          client?.company,
          card?.name
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch = !search || searchableText.includes(search);

        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0);

        let matchesDate = true;
        if (dateFilter === 'TODAY') {
          matchesDate = txDate.getTime() === today.getTime();
        } else if (dateFilter === 'THIS_WEEK') {
          const weekStart = new Date(today);
          const day = weekStart.getDay();
          const diff = day === 0 ? 6 : day - 1;
          weekStart.setDate(weekStart.getDate() - diff);
          matchesDate = txDate >= weekStart && txDate <= today;
        } else if (dateFilter === 'THIS_MONTH') {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          matchesDate = txDate >= monthStart && txDate <= today;
        }

        return matchesType && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date).getTime();
        const timeB = b.timestamp || new Date(b.date).getTime();
        return timeB - timeA;
      });
  }, [transactions, clients, cards, typeFilter, searchTerm, dateFilter]);

  const ledgerSummary = useMemo(() => {
    let bdtIn = 0;
    let bdtOut = 0;
    let usdIn = 0;
    let usdOut = 0;

    filtered.forEach(tx => {
      if (tx.type === 'PAYMENT_RECEIVED') {
        bdtIn += parseFloat(tx.amountBDT || 0);
      }

      if (tx.type === 'USD_PURCHASE') {
        bdtOut += parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0);
        usdIn += parseFloat(tx.amountUSD || 0);
      }

      if (tx.type === 'AD_SPEND') {
        usdOut += parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0);
      }

      if (tx.type === 'FEE') {
        usdOut += parseFloat(tx.amountUSD || 0);
      }
    });

    return {
      bdtIn,
      bdtOut,
      netBDT: bdtIn - bdtOut,
      usdIn,
      usdOut,
      netUSD: usdIn - usdOut,
      count: filtered.length
    };
  }, [filtered]);

  const clearFilters = () => {
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setSearchTerm('');
  };

  const hasFilters = typeFilter !== 'ALL' || dateFilter !== 'ALL' || searchTerm.trim() !== '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">A clear view of every BDT and USD movement.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Transactions</option>
            <option value="PAYMENT_RECEIVED">Payments Received</option>
            <option value="USD_PURCHASE">USD Purchases</option>
            <option value="AD_SPEND">Meta Ad Spend</option>
            <option value="FEE">Fees</option>
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client, card, campaign, source..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">BDT In</p>
          <p className="text-lg font-bold text-green-600 mt-1">{formatBDT(ledgerSummary.bdtIn)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">BDT Out</p>
          <p className="text-lg font-bold text-red-600 mt-1">{formatBDT(ledgerSummary.bdtOut)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Net BDT</p>
          <p className={`text-lg font-bold mt-1 ${ledgerSummary.netBDT < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {formatBDT(ledgerSummary.netBDT)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">USD In</p>
          <p className="text-lg font-bold text-green-600 mt-1">{formatUSD(ledgerSummary.usdIn)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">USD Out</p>
          <p className="text-lg font-bold text-red-600 mt-1">{formatUSD(ledgerSummary.usdOut)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{ledgerSummary.count}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">All Transactions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Buy USD = BDT out + USD in • Meta Ads = USD out
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Entity / Details</th>
                <th className="px-5 py-3 text-right">BDT In</th>
                <th className="px-5 py-3 text-right">BDT Out</th>
                <th className="px-5 py-3 text-right">USD In</th>
                <th className="px-5 py-3 text-right">USD Out</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              )}

              {filtered.map(tx => {
                const client = clients.find(c => c.id === tx.clientId);
                const card = cards.find(c => c.id === tx.cardId);

                const isPayment = tx.type === 'PAYMENT_RECEIVED';
                const isPurchase = tx.type === 'USD_PURCHASE';
                const isAdSpend = tx.type === 'AD_SPEND';
                const isFee = tx.type === 'FEE';

                const bdtIn = isPayment ? parseFloat(tx.amountBDT || 0) : 0;
                const bdtOut = isPurchase
                  ? parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)
                  : 0;
                const usdIn = isPurchase ? parseFloat(tx.amountUSD || 0) : 0;
                const usdOut = isAdSpend
                  ? parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)
                  : isFee
                    ? parseFloat(tx.amountUSD || 0)
                    : 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-600">{formatDate(tx.date)}</td>

                    <td className="px-5 py-4">
                      <TransactionTypeBadge type={tx.type} />
                    </td>

                    <td className="px-5 py-4 min-w-[260px]">
                      {client && (
                        <div className="font-semibold text-slate-800">{client.name}</div>
                      )}

                      {card && (
                        <div className="text-xs text-slate-500">Card: {card.name}</div>
                      )}

                      {tx.type === 'USD_PURCHASE' && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tx.notes || 'USD Purchase'} • Effective Rate: ৳
                          {usdIn > 0
                            ? ((parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)) / usdIn).toFixed(2)
                            : '0.00'}
                        </div>
                      )}

                      {tx.type === 'AD_SPEND' && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tx.adAccount || 'Ad Account'}{tx.campaign ? ` • ${tx.campaign}` : ''}
                        </div>
                      )}

                      {tx.type === 'PAYMENT_RECEIVED' && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tx.notes || 'Client payment received'}
                        </div>
                      )}

                      {tx.type === 'FEE' && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tx.notes || 'Card fee'}
                        </div>
                      )}

                      {!client && !card && !isPurchase && !isAdSpend && !isPayment && !isFee && (
                        <div className="text-xs text-slate-500">{tx.notes || '—'}</div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-green-600">
                      {bdtIn > 0 ? `+${formatBDT(bdtIn)}` : '—'}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-red-600">
                      {bdtOut > 0 ? `-${formatBDT(bdtOut)}` : '—'}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-green-600">
                      {usdIn > 0 ? `+${formatUSD(usdIn)}` : '—'}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-red-600">
                      {usdOut > 0 ? `-${formatUSD(usdOut)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClientsView({ clients, transactions, metrics, onAddClient, onEditClient, onDeleteClient, onViewDetails, onViewHistory, onReceivePayment, onAddAdSpend, onToggleStatus }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const clientStats = useMemo(() => {
    return clients.map(client => {
      const clientTx = transactions.filter(t => t.clientId === client.id);
      
      const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT||0), 0);
      const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD||0), 0);
      const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD||0), 0);
      
      const totalCostBDT = (adSpendUSD + taxUSD) * metrics.avgUSDEffectiveRate;
      const profitBDT = revenue - totalCostBDT;
      const profitMargin = revenue > 0 ? (profitBDT / revenue) * 100 : 0;
      
      return { ...client, revenue, adSpendUSD, taxUSD, totalCostBDT, profitBDT, profitMargin };
    });
  }, [clients, transactions, metrics.avgUSDEffectiveRate]);

  const filteredClients = useMemo(() => {
    return clientStats.filter(c => {
      const matchSearch = (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()));
      const displayStatus = getClientDisplayStatus(c);
      const matchStatus = statusFilter === 'All' || displayStatus.includes(statusFilter);
      return matchSearch && matchStatus;
    });
  }, [clientStats, searchTerm, statusFilter]);

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
          <option value="Active">Active / Currently Working</option>
          <option value="Completed">Completed / Ended</option>
          <option value="Paused">Paused</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-5 py-4">Client & Business</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Budget</th>
                <th className="px-5 py-4 text-right">Revenue (BDT)</th>
                <th className="px-5 py-4 text-right">Ad Spend (USD)</th>
                <th className="px-5 py-4 text-right">Profit (BDT)</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-slate-500">No clients yet.</td></tr>}
              {filteredClients.map(c => {
                const displayStatus = getClientDisplayStatus(c);
                const isWorking = displayStatus.includes('Active') || displayStatus.includes('Currently Working');
                return (
                <tr key={c.id} className="hover:bg-slate-50 group">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.company}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium 
                      ${isWorking ? 'bg-green-100 text-green-700' : 
                        displayStatus.includes('Completed') ? 'bg-blue-100 text-blue-700' : 
                        displayStatus === 'Inactive' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'}`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600 font-medium">
                    {getBudgetDisplay(c.budgetType, c.budgetAmount || c.budget)}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-green-600">{formatBDT(c.revenue)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">{formatUSD(c.adSpendUSD)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className={`font-bold ${c.profitBDT < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatBDT(c.profitBDT)}</div>
                    <div className={`text-[10px] font-medium ${c.profitMargin > 50 ? 'text-green-600' : c.profitMargin < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      Margin: {c.profitMargin.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <ClientActionsMenu
                      client={c}
                      onViewDetails={() => onViewDetails(c)}
                      onHistory={() => onViewHistory(c)}
                      onEdit={() => onEditClient(c)}
                      onReceivePayment={() => onReceivePayment(c)}
                                            onToggleStatus={(status) => onToggleStatus(c, status)}
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
          const lastTx = sortedTxs[0];
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
            {globalDateRange.label === 'Lifetime' ? 'History: Lifetime' : `History: ${globalDateRange.label}`}
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

      {/* NEW PERIOD SUMMARY */}
      <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 mb-4 shadow-sm">
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
              {filteredUSDPurchases.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-slate-500">No USD purchases yet.</td></tr>}
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
    const fullHistory = allCardTxsAsc.map(t => {
      let changeUSD = 0;
      if (t.type === 'USD_PURCHASE') {
        changeUSD = parseFloat(t.amountUSD || 0);
      }
      if (t.type === 'AD_SPEND') {
        const spend = parseFloat(t.amountUSD || 0);
        const tax = parseFloat(t.taxUSD || 0);
        changeUSD = -(spend + tax); // Deducts both from balance
      }
      if (t.type === 'FEE') {
        changeUSD = -parseFloat(t.amountUSD || 0);
      }
      currentRunningBal += changeUSD;
      return { ...t, changeUSD, runningBal: currentRunningBal };
    });

    // 3. Reverse for UI (Newest first)
    fullHistory.reverse();

    // 4. Apply history date filter solely for visual isolation
    let displayedHistory = fullHistory;
    if (filterRange.start && filterRange.end) {
      displayedHistory = fullHistory.filter(t => t.date >= filterRange.start && t.date <= filterRange.end);
    }

    // Diagnostics / Breakdown Verification
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
          <p className="text-base font-bold text-red-600">
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
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 shrink-0">
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
            <span className="font-medium text-red-600">-{formatUSD(stats.adSpend)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax</span>
            <span className="font-medium text-red-600">-{formatUSD(stats.tax)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Fees</span>
            <span className="font-medium text-red-600">-{formatUSD(stats.fees)}</span>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold">
            <span className="text-slate-800">Current Balance</span>
            <span className={currentBal < 0 ? 'text-red-600' : 'text-slate-900'}>{formatUSD(currentBal)}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200">
          {isMatch ? (
            <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
              <CheckCircle2 size={14} className="mr-1" /> Balance Verified
            </span>
          ) : (
            <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-100">
              <div className="font-bold flex items-center mb-1">
                <AlertCircle size={14} className="mr-1" /> Balance Mismatch
              </div>
              <div className="flex justify-between"><span>Expected Balance:</span> <span>{formatUSD(expectedBalance)}</span></div>
              <div className="flex justify-between"><span>Current Balance:</span> <span>{formatUSD(currentBal)}</span></div>
              <div className="flex justify-between font-medium border-t border-red-200 mt-1 pt-1"><span>Difference:</span> <span>{formatUSD(diff)}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mb-3 border-b pb-2 shrink-0">
        <h4 className="font-bold text-slate-800">Transaction History</h4>
        <div className="flex items-center gap-3">
          {filterRange.label !== 'Lifetime' && <button onClick={() => setFilterRange({label: 'Lifetime', start: null, end: null})} className="text-xs text-red-600 hover:underline font-medium">Clear Filter</button>}
          <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-1 rounded text-xs font-medium hover:bg-slate-50 shadow-2xs transition-colors">
            <CalendarDays size={14} className="text-blue-600" /> 
            {filterRange.label === 'Lifetime' ? 'Filter History' : `Showing: ${filterRange.label}`}
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
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">USD</th>
              <th className="px-4 py-2.5">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {historyWithBalance.length === 0 && (
              <tr><td colSpan="3" className="text-center py-6 text-slate-500">No transactions found for this period.</td></tr>
            )}
            {historyWithBalance.map(tx => {
              // Ensure we strictly format to negative/positive correctly
              const isAdSpend = tx.type === 'AD_SPEND';
              const displayAmount = isAdSpend ? -Math.abs(parseFloat(tx.amountUSD)) : parseFloat(tx.amountUSD);
              const displayTax = isAdSpend ? parseFloat(tx.taxUSD || 0) : 0;

              return (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  <div className="mb-0.5">{tx.type === 'USD_PURCHASE' ? 'USD Purchase' : tx.type === 'AD_SPEND' ? 'Meta Ads' : tx.type}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{formatDate(tx.date)} {tx.notes && `• ${tx.notes}`}</div>
                </td>
                <td className={`px-4 py-2.5 font-medium ${displayAmount > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                  {displayAmount > 0 ? '+' : ''}{formatUSD(displayAmount)}
                  {displayTax > 0 && <span className="block text-[10px] text-red-500 font-normal mt-0.5">+ tax {formatUSD(displayTax)}</span>}
                </td>
                <td className={`px-4 py-2.5 font-bold ${tx.runningBal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
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
          <div className="flex justify-between"><span>Base BDT Paid:</span><span className="font-medium text-slate-800">{formatBDT(bdtPaid)}</span></div>
          <div className="flex justify-between"><span>C.O Rate:</span><span className="font-medium text-red-600">{formatBDT(coRate)}</span></div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 text-sm"><span>Total BDT Cost:</span><span className="text-slate-900">{formatBDT(totalCost)}</span></div>
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


/* ==========================================================================
   SAAS MODULES
   Additive modules. Existing financial view component bodies remain untouched.
   ========================================================================== */

function CampaignsView({ campaigns, clients, transactions, metrics, onSave, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const rows = useMemo(() => campaigns.map(c => {
    const matching = transactions.filter(t =>
      String(t.campaign || '').trim().toLowerCase() === String(c.name || '').trim().toLowerCase()
    );
    const spendUSD = matching.reduce((sum, t) => sum + (t.type === 'AD_SPEND' ? parseFloat(t.amountUSD || 0) : 0), 0);
    const taxUSD = matching.reduce((sum, t) => sum + (t.type === 'AD_SPEND' ? parseFloat(t.taxUSD || 0) : 0), 0);
    const spendBDT = (spendUSD + taxUSD) * (metrics.avgUSDEffectiveRate || 0);
    const revenueBDT = parseFloat(c.revenueBDT || 0);
    const roas = spendBDT > 0 ? revenueBDT / spendBDT : 0;
    const client = clients.find(x => x.id === c.clientId);
    return { ...c, clientName: client?.name || 'Unassigned', spendUSD, taxUSD, spendBDT, revenueBDT, roas };
  }), [campaigns, clients, transactions, metrics.avgUSDEffectiveRate]);

  const filtered = rows.filter(c => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [c.name, c.clientName, c.platform, c.goal].some(v => String(v || '').toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Campaigns</h1><p className="text-sm text-slate-500 mt-1">Track budgets, ad spend, results and profitability by campaign.</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"><Plus size={17}/> Add Campaign</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi title="Campaigns" value={campaigns.length} icon={<Target size={16}/>} />
        <MiniKpi title="Active" value={campaigns.filter(c => c.status === 'Active').length} icon={<Activity size={16}/>} />
        <MiniKpi title="Tracked Spend" value={formatUSD(rows.reduce((s, c) => s + c.spendUSD, 0))} icon={<DollarSign size={16}/>} />
        <MiniKpi title="Tracked Revenue" value={formatBDT(rows.reduce((s, c) => s + c.revenueBDT, 0))} icon={<TrendingUp size={16}/>} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3"><Search size={17} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns, clients, platforms..." className="w-full bg-transparent border-none focus:outline-none px-2 py-2 text-sm"/></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"><option>All</option><option>Active</option><option>Paused</option><option>Completed</option></select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Campaign Performance</h3><p className="text-xs text-slate-500 mt-1">Spend is matched automatically from existing transaction entries using the campaign name.</p></div><BarChart3 size={19} className="text-slate-400"/></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-5 py-3 text-left font-medium">Campaign</th><th className="px-3 py-3 text-left font-medium">Client</th><th className="px-3 py-3 text-left font-medium">Platform</th><th className="px-3 py-3 text-right font-medium">Budget</th><th className="px-3 py-3 text-right font-medium">Spent</th><th className="px-3 py-3 text-right font-medium">Revenue</th><th className="px-3 py-3 text-right font-medium">ROAS</th><th className="px-5 py-3 text-right font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length ? filtered.map(c => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-4"><div className="font-medium text-slate-800">{c.name}</div><div className="text-[11px] text-slate-400">{c.goal || '—'}</div></td>
                  <td className="px-3 py-4 text-slate-600">{c.clientName}</td><td className="px-3 py-4"><span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">{c.platform || 'Meta'}</span></td>
                  <td className="px-3 py-4 text-right text-slate-700">{c.budget ? `${c.budgetType === 'USD' ? '$' : '৳'}${Number(c.budget).toLocaleString('en-US', {maximumFractionDigits:2})}` : '—'}</td>
                  <td className="px-3 py-4 text-right text-red-600">{formatUSD(c.spendUSD)}</td><td className="px-3 py-4 text-right text-emerald-600">{formatBDT(c.revenueBDT)}</td><td className="px-3 py-4 text-right font-semibold">{c.roas ? `${c.roas.toFixed(2)}x` : '—'}</td>
                  <td className="px-5 py-4 text-right"><span className={`px-2 py-1 rounded-full border text-[10px] font-medium ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'Completed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{c.status}</span></td>
                  <td className="px-5 py-4 text-right whitespace-nowrap"><button onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs font-medium text-blue-600 mr-3">Edit</button><button onClick={() => onDelete(c.id)} className="text-xs font-medium text-red-500">Delete</button></td>
                </tr>
              )) : <tr><td colSpan="9" className="py-14 text-center text-slate-400">No campaigns yet. Add your first campaign to start tracking performance.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <CampaignForm initialData={editing} clients={clients} onCancel={() => setShowForm(false)} onSubmit={data => { onSave(data); setShowForm(false); }}/>}
    </div>
  );
}

function CampaignForm({ initialData, clients, onCancel, onSubmit }) {
  const [data, setData] = useState(initialData || { name:'', clientId:clients[0]?.id || '', platform:'Meta', budget:'', budgetType:'USD', status:'Active', startDate:new Date().toISOString().slice(0,10), endDate:'', goal:'', resultValue:'', resultLabel:'Leads', revenueBDT:'', notes:'' });
  const set = (key, value) => setData(prev => ({...prev, [key]:value}));
  const input = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">{initialData ? 'Edit Campaign' : 'Add Campaign'}</h2><p className="text-xs text-slate-500 mt-1">Create a campaign record; ad spend will be linked from matching ledger entries.</p></div><button onClick={onCancel} className="text-slate-400"><X size={20}/></button></div>
        <form onSubmit={e => {e.preventDefault(); if(!data.name.trim()) return; onSubmit(data);}} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Campaign Name"><input required value={data.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Ramadan Lead Campaign" className={input}/></Field>
            <Field label="Client"><select value={data.clientId} onChange={e=>set('clientId',e.target.value)} className={input}><option value="">Unassigned</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Platform"><select value={data.platform} onChange={e=>set('platform',e.target.value)} className={input}><option>Meta</option><option>Google</option><option>TikTok</option><option>Other</option></select></Field>
            <Field label="Status"><select value={data.status} onChange={e=>set('status',e.target.value)} className={input}><option>Active</option><option>Paused</option><option>Completed</option></select></Field>
            <Field label="Budget"><input type="number" min="0" step="0.01" value={data.budget} onChange={e=>set('budget',e.target.value)} placeholder="Enter budget" className={input}/></Field>
            <Field label="Budget Currency"><select value={data.budgetType} onChange={e=>set('budgetType',e.target.value)} className={input}><option value="USD">USD</option><option value="BDT">BDT</option></select></Field>
            <Field label="Start Date"><input type="date" value={data.startDate} onChange={e=>set('startDate',e.target.value)} className={input}/></Field>
            <Field label="End Date"><input type="date" value={data.endDate} onChange={e=>set('endDate',e.target.value)} className={input}/></Field>
            <Field label="Campaign Goal"><input value={data.goal} onChange={e=>set('goal',e.target.value)} placeholder="Leads, Sales, Traffic..." className={input}/></Field>
            <Field label="Results"><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="1" value={data.resultValue} onChange={e=>set('resultValue',e.target.value)} placeholder="0" className={input}/><select value={data.resultLabel} onChange={e=>set('resultLabel',e.target.value)} className={input}><option>Leads</option><option>Sales</option><option>Messages</option><option>Clicks</option><option>Conversions</option></select></div></Field>
            <Field label="Revenue Attributed (BDT)"><input type="number" min="0" step="0.01" value={data.revenueBDT} onChange={e=>set('revenueBDT',e.target.value)} placeholder="Optional" className={input}/></Field>
          </div>
          <Field label="Notes"><textarea value={data.notes} onChange={e=>set('notes',e.target.value)} rows="3" placeholder="Campaign notes..." className={input}/></Field>
          <div className="flex gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium">Cancel</button><button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">Save Campaign</button></div>
        </form>
      </div>
    </div>
  );
}

function IntegrationsView() {
  const items = [
    ['Meta Ads','Sync ad accounts, campaigns and spend automatically.',<Globe2 size={22}/>],
    ['Google Ads','Bring Google campaign spend into the same ledger.',<BarChart3 size={22}/>],
    ['TikTok Ads','Track TikTok spend alongside Meta and Google.',<Target size={22}/>],
    ['Google Sheets','Export and sync operational reports.',<Database size={22}/>],
    ['Payments','Connect payment providers when automated verification is available.',<Link2 size={22}/>]
  ];
  return <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
    <div><h1 className="text-2xl font-bold text-slate-900">Integrations</h1><p className="text-sm text-slate-500 mt-1">Connect your marketing stack when automated sync is enabled.</p></div>
    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-sm flex gap-3"><ShieldCheck size={19}/><span>Integrations are marked <strong>Planned</strong> until a real API connection is available.</span></div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(([name,desc,icon])=><div key={name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-start justify-between"><div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">{icon}</div><span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">Planned</span></div><h3 className="mt-4 font-semibold">{name}</h3><p className="text-sm text-slate-500 mt-1 leading-6">{desc}</p><button disabled className="mt-4 w-full px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm">Connect later</button></div>)}</div>
  </div>;
}

function TeamView({ teamMembers, onAdd, onRemove }) {
  const [email,setEmail]=useState(''); const [role,setRole]=useState('Manager');
  return <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">Team</h1><p className="text-sm text-slate-500 mt-1">Prepare AdLytic for agencies and multi-user workspaces.</p></div><span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5">{teamMembers.length+1} member{teamMembers.length+1===1?'':'s'}</span></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5"><h3 className="font-semibold">Workspace Members</h3><div className="mt-4 space-y-2"><div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-medium">Workspace Owner</p><p className="text-xs text-slate-500">Owner · full access</p></div><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">Owner</span></div>{teamMembers.map(m=><div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-medium">{m.email}</p><p className="text-xs text-slate-500">{m.role}</p></div><button onClick={()=>onRemove(m.id)} className="text-xs text-red-500">Remove</button></div>)}</div></div>
      <form onSubmit={e=>{e.preventDefault();if(!email.trim())return;onAdd({email:email.trim(),role});setEmail('')}} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5"><h3 className="font-semibold">Invite Member</h3><p className="text-xs text-slate-500 mt-1">Local workspace placeholder until real email invitations are connected.</p><Field label="Email"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="teammate@email.com" className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"/></Field><Field label="Role"><select value={role} onChange={e=>setRole(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>Manager</option><option>Staff</option><option>Viewer</option></select></Field><button className="w-full mt-4 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold"><UserPlus size={16} className="inline mr-2"/>Add Member</button></form>
    </div>
  </div>;
}

function SettingsView({ settings, onSave, onExport, onImport, onReset }) {
  const [data,setData]=useState(settings); const fileRef=useRef(null);
  useEffect(()=>setData(settings),[settings]);
  return <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
    <div><h1 className="text-2xl font-bold text-slate-900">Settings</h1><p className="text-sm text-slate-500 mt-1">Workspace preferences, data safety and operational controls.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5"><div className="flex items-center gap-3"><SlidersHorizontal size={20} className="text-blue-600"/><div><h3 className="font-semibold">Workspace</h3><p className="text-xs text-slate-500">Basic preferences.</p></div></div><div className="mt-5 space-y-4">
        <Field label="Business / Workspace Name"><input value={data.businessName} onChange={e=>setData({...data,businessName:e.target.value})} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"/></Field>
        <Field label="Timezone"><select value={data.timezone} onChange={e=>setData({...data,timezone:e.target.value})} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>Asia/Dhaka</option><option>UTC</option><option>Asia/Kolkata</option></select></Field>
        <Field label="Default Report Range"><select value={data.defaultReportRange} onChange={e=>setData({...data,defaultReportRange:e.target.value})} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>This Month</option><option>Last 7 Days</option><option>Last 30 Days</option><option>Lifetime</option></select></Field>
        <Field label="Workspace Logo">
          <div className="mt-1 flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-sky-100 overflow-hidden flex items-center justify-center shrink-0">
              {data.logoData ? <img src={data.logoData} alt="Workspace logo preview" className="w-full h-full object-cover" /> : <span className="font-bold text-sky-600">A</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">Upload your brand logo</p>
              <p className="text-xs text-slate-500 mt-0.5">PNG, JPG or WebP. It will appear in the sidebar.</p>
              <div className="flex items-center gap-2 mt-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                  <Upload size={14}/> Choose logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0]; if(!file)return; if(file.size>2*1024*1024){window.alert('Please choose an image smaller than 2MB.'); return;} const reader=new FileReader(); reader.onload=ev=>setData(prev=>({...prev,logoData:ev.target.result})); reader.readAsDataURL(file); e.target.value='';}} />
                </label>
                {data.logoData && <button type="button" onClick={()=>setData(prev=>({...prev,logoData:''}))} className="text-xs font-medium text-red-600 hover:text-red-700">Remove</button>}
              </div>
            </div>
          </div>
        </Field>
        <label className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3"><span><span className="block text-sm font-medium">Financial alerts</span><span className="block text-xs text-slate-500 mt-0.5">Show negative card balance warnings.</span></span><input type="checkbox" checked={!!data.alerts} onChange={e=>setData({...data,alerts:e.target.checked})} className="w-4 h-4"/></label>
        <button onClick={()=>{onSave(data);window.alert('Settings saved.')}} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold"><Save size={16}/>Save Settings</button>
      </div></div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5"><div className="flex items-center gap-3"><Database size={20} className="text-emerald-600"/><div><h3 className="font-semibold">Data & Backup</h3><p className="text-xs text-slate-500">Protect your workspace before major changes.</p></div></div><div className="mt-5 space-y-3">
        <button onClick={onExport} className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50"><span className="flex items-center gap-3"><Download size={18} className="text-blue-600"/><span className="text-left"><strong className="block text-sm">Export Full Backup</strong><small className="text-xs text-slate-500">Clients, cards, transactions, campaigns and settings.</small></span></span><ArrowUpRight size={16}/></button>
        <button onClick={()=>fileRef.current?.click()} className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50"><span className="flex items-center gap-3"><Upload size={18} className="text-emerald-600"/><span className="text-left"><strong className="block text-sm">Restore Backup</strong><small className="text-xs text-slate-500">Import an AdLytic JSON backup.</small></span></span><ArrowUpRight size={16}/></button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>{onImport(e.target.files?.[0]);e.target.value=''}}/>
        <button onClick={onReset} className="w-full flex items-center justify-between rounded-xl border border-red-100 bg-red-50/60 p-4 hover:bg-red-50"><span className="flex items-center gap-3"><RotateCcw size={18} className="text-red-600"/><span className="text-left"><strong className="block text-sm text-red-700">Reset Workspace Data</strong><small className="text-xs text-red-600/70">Permanently clear locally stored data.</small></span></span><AlertCircle size={16}/></button>
      </div></div>
    </div>
  </div>;
}

function MiniKpi({ title, value, icon }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{title}</span><span className="text-slate-400">{icon}</span></div><div className="mt-2 text-lg font-bold text-slate-900">{value}</div></div>;
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-slate-600">{label}</label>{children}</div>;
}


function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`adlytic-nav-item ${isActive ? 'active' : ''}`}>
      {React.cloneElement(icon, { size: 17 })}
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ title, value, subtitle, icon, bgColor, textColorClass = 'text-slate-900' }) {
  return (
    <div className="adlytic-metric p-4 sm:p-5 flex flex-col relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <p className="text-[12px] font-semibold text-slate-500">{title}</p>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <h3 className={`text-[24px] leading-none font-extrabold tracking-tight ${textColorClass}`}>{value}</h3>
      <div className="mt-2 flex items-center text-[11px]">
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
  const styles = {
    PAYMENT_RECEIVED: 'bg-green-100 text-green-700 border-green-200',
    USD_PURCHASE: 'bg-blue-100 text-blue-700 border-blue-200',
    AD_SPEND: 'bg-purple-100 text-purple-700 border-purple-200',
    FEE: 'bg-orange-100 text-orange-700 border-orange-200'
  };
  const labels = {
    PAYMENT_RECEIVED: 'Payment In',
    USD_PURCHASE: 'Buy USD',
    AD_SPEND: 'Meta Ads',
    FEE: 'Card Fee'
  };
  return <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${styles[type] || 'bg-slate-100 text-slate-600'}`}>{labels[type] || type}</span>;
}

function Modal({ title, onClose, children, width = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-xl w-full ${width} overflow-hidden flex flex-col max-h-[95vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50 shrink-0">
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
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Start Date (DD / MM / YYYY)</label>
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
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">End Date (DD / MM / YYYY)</label>
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

function ClientActionsMenu({
  client,
  onViewDetails,
  onHistory,
  onEdit,
  onReceivePayment,
  onToggleStatus,
  onDelete
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = showStatusMenu ? 350 : 300;
    const gap = 8;
    const viewportPadding = 8;

    let left = rect.right - menuWidth;
    left = Math.max(
      viewportPadding,
      Math.min(left, window.innerWidth - menuWidth - viewportPadding)
    );

    let top = rect.bottom + gap;

    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = rect.top - menuHeight - gap;
    }

    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - menuHeight - viewportPadding)
    );

    setMenuPosition({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();

    const handleOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setShowStatusMenu(false);
      }
    };

    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, showStatusMenu]);

  const closeAndRun = (callback) => {
    setIsOpen(false);
    setShowStatusMenu(false);
    if (typeof callback === 'function') callback();
  };

  const openMenu = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (!next) setShowStatusMenu(false);
      return next;
    });
  };

  const menu = isOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-[99999] p-1.5"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: 240
          }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => closeAndRun(onViewDetails)}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600"
          >
            View Details
          </button>

          <button
            type="button"
            onClick={() => closeAndRun(onHistory)}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600"
          >
            Transaction History
          </button>

          <button
            type="button"
            onClick={() => closeAndRun(onEdit)}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600"
          >
            Edit Client
          </button>

          <button
            type="button"
            onClick={() => closeAndRun(onReceivePayment)}
            className="w-full text-left px-4 py-3 text-sm text-green-700 rounded-lg hover:bg-green-50"
          >
            Receive Payment
          </button>

          <div className="h-px bg-slate-100 my-1.5" />

          <button
            type="button"
            onClick={() => setShowStatusMenu(prev => !prev)}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 rounded-lg hover:bg-slate-50 flex items-center justify-between"
            aria-expanded={showStatusMenu}
          >
            <span>Change Status</span>
            <ChevronDown
              size={15}
              className={`transition-transform ${showStatusMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showStatusMenu && (
            <div className="mx-1 mb-1 mt-1 rounded-lg bg-slate-50 border border-slate-100 p-1">
              <button
                type="button"
                onClick={() => closeAndRun(() => onToggleStatus?.('active'))}
                className="w-full text-left px-3 py-2.5 text-sm text-green-700 rounded-md hover:bg-green-100"
              >
                Mark Active
              </button>

              <button
                type="button"
                onClick={() => closeAndRun(() => onToggleStatus?.('inactive'))}
                className="w-full text-left px-3 py-2.5 text-sm text-orange-700 rounded-md hover:bg-orange-100"
              >
                Mark Inactive
              </button>

              <button
                type="button"
                onClick={() => closeAndRun(() => onToggleStatus?.('completed'))}
                className="w-full text-left px-3 py-2.5 text-sm text-blue-700 rounded-md hover:bg-blue-100"
              >
                Mark Completed
              </button>
            </div>
          )}

          <div className="h-px bg-slate-100 my-1.5" />

          <button
            type="button"
            onClick={() => closeAndRun(onDelete)}
            className="w-full text-left px-4 py-3 text-sm text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-between"
          >
            <span>Delete Client</span>
            <Trash2 size={15} />
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openMenu}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
        aria-label={`Actions for ${client?.name || 'client'}`}
        aria-expanded={isOpen}
      >
        <MoreVertical size={20} />
      </button>
      {menu}
    </>
  );
}

function ClientTransactionHistoryModal({ client, transactions, metrics }) {
  const clientTx = useMemo(() => {
    return transactions
      .filter(t => t.clientId === client.id)
      .sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date).getTime();
        const timeB = b.timestamp || new Date(b.date).getTime();
        return timeB - timeA;
      });
  }, [transactions, client.id]);

  const totalReceived = clientTx
    .filter(t => t.type === 'PAYMENT_RECEIVED')
    .reduce((sum, t) => sum + parseFloat(t.amountBDT || 0), 0);

  const totalAdSpend = clientTx
    .filter(t => t.type === 'AD_SPEND')
    .reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);

  const totalTax = clientTx
    .filter(t => t.type === 'AD_SPEND')
    .reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-700">Payments Received</p>
          <p className="text-lg font-bold text-green-700 mt-1">{formatBDT(totalReceived)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <p className="text-xs text-purple-700">Ad Spend</p>
          <p className="text-lg font-bold text-purple-700 mt-1">{formatUSD(totalAdSpend)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs text-red-700">Tax</p>
          <p className="text-lg font-bold text-red-700 mt-1">{formatUSD(totalTax)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{clientTx.length}</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Client Transaction History</h3>
          <p className="text-xs text-slate-500 mt-1">All transactions linked to {client.name}</p>
        </div>

        <div className="overflow-x-auto max-h-[55vh]">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3 text-right">BDT</th>
                <th className="px-5 py-3 text-right">USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientTx.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-500">No transactions for this client yet.</td>
                </tr>
              )}

              {clientTx.map(tx => {
                const isPayment = tx.type === 'PAYMENT_RECEIVED';
                const isAdSpend = tx.type === 'AD_SPEND';
                const usdAmount = isAdSpend
                  ? parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)
                  : 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-600">{formatDate(tx.date)}</td>
                    <td className="px-5 py-4"><TransactionTypeBadge type={tx.type} /></td>
                    <td className="px-5 py-4 min-w-[260px]">
                      <div className="font-medium text-slate-800">
                        {tx.notes || tx.campaign || tx.adAccount || tx.type.replaceAll('_', ' ')}
                      </div>
                      {tx.adAccount && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tx.adAccount}{tx.campaign ? ` • ${tx.campaign}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {isPayment ? <span className="text-green-600">+{formatBDT(tx.amountBDT)}</span> : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {isAdSpend ? <span className="text-red-600">-{formatUSD(usdAmount)}</span> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-400">
        BDT conversion uses the app's current average USD effective rate of ৳{metrics.avgUSDEffectiveRate.toFixed(2)}.
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
            <option>Meta Ads</option><option>Facebook Marketing</option><option>Instagram Marketing</option><option>Google Ads</option><option>Social Media Management</option><option>Content Marketing</option><option>Other</option>
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
          <input type="number" min="0" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} disabled={!!initialData} placeholder="Enter USD amount" className={`${inputClass} ${initialData ? 'bg-slate-100' : ''}`} />
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
        <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional details..." rows="2" className={inputClass}></textarea>
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
      
      // Strict block for empty / zero meta ads spend
      if (payload.amountUSD <= 0 || !formData.cardId || !formData.clientId) {
        return; 
      }
      
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
