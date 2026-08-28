import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Users, CreditCard, DollarSign,
  Activity, FileText, Settings, Plus, Search,
  ArrowUpRight, ArrowDownRight, Wallet, PieChart,
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, Trash2, CalendarDays,
  BriefcaseBusiness, PlugZap, UsersRound, Database, Upload, ShieldCheck, SlidersHorizontal,
  UserPlus, Link2, BarChart3, Target, Globe2, Save, RotateCcw,
  Bell, Receipt, Coins, KeyRound, Copy, Check, ExternalLink, Eye, EyeOff, Sparkles, Lock, LogOut, Laptop,
  FileSpreadsheet, Printer, Crown, UserCheck, UserX, Shield, Mail, Phone, Edit, Filter, UserCog
} from 'lucide-react';
import { supabase } from './src/lib/supabase.js';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, PieChart as RePieChart, Pie, Cell
} from 'recharts';

// --- WORKSPACE RESOLVER & CLOUD PERSISTENCE ---
let resolvedWorkspaceId = null;
let resolvedWorkspacePromise = null;
let resolvedUserId = null;

export async function getAdLedgerWorkspaceId() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError || new Error('No authenticated user.');

  if (resolvedWorkspaceId && resolvedUserId === user.id) {
    return resolvedWorkspaceId;
  }

  if (resolvedWorkspacePromise && resolvedUserId === user.id) {
    return resolvedWorkspacePromise;
  }

  resolvedUserId = user.id;
  resolvedWorkspacePromise = (async () => {
    try {
      // 1. Check cached workspace in localStorage first
      if (typeof window !== 'undefined') {
        const cachedWsId = window.localStorage.getItem('adlytic_active_workspace_id');
        if (cachedWsId) {
          const { data: testRows } = await supabase
            .from('workspace_app_data')
            .select('data_key, data')
            .eq('workspace_id', cachedWsId)
            .limit(3);
          if (Array.isArray(testRows) && testRows.length > 0) {
            resolvedWorkspaceId = cachedWsId;
            return cachedWsId;
          }
        }
      }

      // 2. Fetch all workspaces the user owns
      const { data: ownedWorkspaces } = await supabase
        .from('workspaces')
        .select('id, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      // 3. Fetch all workspaces where user is a member
      const { data: memberWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspace_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const allWorkspaceIds = [
        ...(ownedWorkspaces || []).map(w => w.id),
        ...(memberWorkspaces || []).map(m => m.workspace_id)
      ];

      const uniqueIds = Array.from(new Set(allWorkspaceIds.filter(Boolean)));

      if (uniqueIds.length === 0) {
        const { data: created } = await supabase
          .from('workspaces')
          .insert([{ owner_id: user.id }])
          .select('id')
          .single();

        const newId = created?.id || user.id;
        resolvedWorkspaceId = newId;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('adlytic_active_workspace_id', newId);
        }
        return newId;
      }

      if (uniqueIds.length === 1) {
        const onlyId = uniqueIds[0];
        resolvedWorkspaceId = onlyId;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('adlytic_active_workspace_id', onlyId);
        }
        return onlyId;
      }

      // Multiple workspaces exist: find the one that has the user's ledger data!
      let bestWsId = uniqueIds[0];
      let maxDataScore = -1;

      for (const wsId of uniqueIds) {
        const { data: rows } = await supabase
          .from('workspace_app_data')
          .select('data_key, data')
          .eq('workspace_id', wsId);

        if (Array.isArray(rows) && rows.length > 0) {
          const score = rows.reduce((acc, r) => {
            if (Array.isArray(r.data)) return acc + r.data.length;
            if (r.data && typeof r.data === 'object') return acc + Object.keys(r.data).length;
            return acc;
          }, 0);

          if (score > maxDataScore) {
            maxDataScore = score;
            bestWsId = wsId;
          }
        }
      }

      resolvedWorkspaceId = bestWsId;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('adlytic_active_workspace_id', bestWsId);
      }
      return bestWsId;
    } catch (err) {
      console.warn('AdLytic workspace resolution fallback:', err);
      const fallbackId = user.id;
      resolvedWorkspaceId = fallbackId;
      return fallbackId;
    }
  })();

  return resolvedWorkspacePromise;
}

// Helper to inspect all local cache variations on frame 1
function getInitialLocalValue(key, initialValue) {
  if (typeof window === 'undefined') return initialValue;
  try {
    const k1 = window.localStorage.getItem(`adlytic_${key}`);
    if (k1 !== null) {
      const p1 = JSON.parse(k1);
      if (Array.isArray(p1) ? p1.length > 0 : !!p1) return p1;
    }

    const k2 = window.localStorage.getItem(key);
    if (k2 !== null) {
      const p2 = JSON.parse(k2);
      if (Array.isArray(p2) ? p2.length > 0 : !!p2) return p2;
    }

    // Check workspace-scoped keys in localStorage
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (storageKey && storageKey.startsWith(key) && storageKey.includes('workspace')) {
        const val = window.localStorage.getItem(storageKey);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) ? parsed.length > 0 : !!parsed) return parsed;
        }
      }
    }

    if (k1 !== null) return JSON.parse(k1);
    if (k2 !== null) return JSON.parse(k2);

    return initialValue;
  } catch (e) {
    return initialValue;
  }
}

// --- BULLETPROOF LOCAL CACHE & CLOUD SYNC HOOK ---
function useLocalStorage(key, initialValue) {
  // Read local cache immediately so the UI renders instantaneously on frame 1
  const [storedValue, setStoredValue] = useState(() => getInitialLocalValue(key, initialValue));

  const [hydrated, setHydrated] = useState(false);
  const saveTimeoutRef = useRef(null);
  const isUserEditRef = useRef(false);

  // 1. Hydrate from Cloud on Mount (Read-Only; NEVER overwrites on load)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const workspaceId = await getAdLedgerWorkspaceId();
        if (cancelled) return;

        const { data: row, error } = await supabase
          .from('workspace_app_data')
          .select('data')
          .eq('workspace_id', workspaceId)
          .eq('data_key', key)
          .maybeSingle();

        if (cancelled) return;

        const cloudHasData = row && row.data !== null && row.data !== undefined;

        if (cloudHasData) {
          setStoredValue(row.data);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`adlytic_${key}`, JSON.stringify(row.data));
            window.localStorage.setItem(key, JSON.stringify(row.data));
            window.localStorage.setItem(`${key}__workspace_${workspaceId}`, JSON.stringify(row.data));
          }
        } else {
          // If cloud is empty for this workspace, check if local cache has existing data to migrate safely
          const localVal = getInitialLocalValue(key, null);
          if (localVal) {
            const hasData = Array.isArray(localVal) ? localVal.length > 0 : (localVal && typeof localVal === 'object' && Object.keys(localVal).length > 0);
            if (hasData) {
              setStoredValue(localVal);
              await supabase.from('workspace_app_data').upsert({
                workspace_id: workspaceId,
                data_key: key,
                data: localVal,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id,data_key' });
            }
          }
        }
      } catch (err) {
        console.error(`AdLytic cloud sync error for ${key}:`, err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  }, [key]);

  // 2. Persist to Cloud ONLY when user makes an edit
  useEffect(() => {
    if (!hydrated || !isUserEditRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const workspaceId = await getAdLedgerWorkspaceId();
        const { error } = await supabase.from('workspace_app_data').upsert({
          workspace_id: workspaceId,
          data_key: key,
          data: storedValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'workspace_id,data_key' });

        if (error) throw error;

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`adlytic_${key}`, JSON.stringify(storedValue));
          window.localStorage.setItem(key, JSON.stringify(storedValue));
          window.localStorage.setItem(`${key}__workspace_${workspaceId}`, JSON.stringify(storedValue));
        }
      } catch (err) {
        console.error(`AdLytic cloud save error for ${key}:`, err);
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [storedValue, hydrated, key]);

  const setValue = (value) => {
    isUserEditRef.current = true;
    setStoredValue(prev => {
      const next = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`adlytic_${key}`, JSON.stringify(next));
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (e) { }
      }
      return next;
    });
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
  today.setHours(0, 0, 0, 0);
  const end = new Date(client.endDate);
  end.setHours(0, 0, 0, 0);

  if (today > end) return 'Completed / Ended';
  return client.status || 'Active';
};

const getDurationDays = (client) => {
  if (!client.startDate) return 0;
  const start = new Date(client.startDate);
  start.setHours(0, 0, 0, 0);

  let end;
  if (client.currentlyWorking) {
    end = new Date();
  } else {
    if (!client.endDate) return 0;
    end = new Date(client.endDate);
  }
  end.setHours(0, 0, 0, 0);

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
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const start = new Date(today);

  const formatDateString = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  switch (preset) {
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

// --- DEFAULT WORKSPACE SETTINGS ---
const DEFAULT_SETTINGS = {
  businessName: 'AdLytic',
  shortCode: 'ADL',
  workspaceType: 'Agency',
  industry: 'Digital Marketing',
  country: 'BD',
  currency: 'BDT',
  language: 'English',
  timezone: 'Asia/Dhaka',
  defaultReportRange: 'This Month',
  website: '',
  contactEmail: '',
  phone: '',
  address: '',
  taxId: '',
  invoiceNotes: 'Thank you for choosing our digital advertising services.',
  alerts: true,
  cardLowBalanceAlert: true,
  cardLowBalanceThreshold: '10',
  financialAlertThreshold: '80',
  audioAlerts: false,
  financialEmailAlerts: false,
  defaultUSDRate: '131.25',
  defaultAdTaxRate: '15',
  defaultCashoutChargeRate: '1.5',
  defaultAgencyMarginRate: '10',
};

const INITIAL_TEAM = [
  {
    id: 'team_01',
    name: 'Tanvir Ahmed',
    email: 'tanvir.media@agency.com',
    phone: '+880 1711-889900',
    role: 'Senior Media Buyer',
    status: 'Active',
    assignedClients: 'All Clients',
    dailySpendLimit: '1000',
    createdAt: '2026-08-15',
  },
  {
    id: 'team_02',
    name: 'Nafis Rahman',
    email: 'nafis.finance@agency.com',
    phone: '+880 1822-445566',
    role: 'Financial Accountant',
    status: 'Active',
    assignedClients: 'All Clients',
    dailySpendLimit: 'Unlimited',
    createdAt: '2026-08-18',
  }
];

// --- MAIN APPLICATION ---
export default function AdLedgerApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State Data (Cloud + Local Cached)
  const [clients, setClients] = useLocalStorage('adledger_clients', INITIAL_CLIENTS);
  const [cards, setCards] = useLocalStorage('adledger_cards', INITIAL_CARDS);
  const [transactions, setTransactions] = useLocalStorage('adledger_transactions', INITIAL_TRANSACTIONS);
  const [campaigns, setCampaigns] = useLocalStorage('adledger_campaigns', []);
  const [workspaceSettings, setWorkspaceSettings] = useLocalStorage('adledger_settings', DEFAULT_SETTINGS);
  const [teamMembers, setTeamMembers] = useLocalStorage('adledger_team', INITIAL_TEAM);
  const [workspaceLogo, setWorkspaceLogo] = useLocalStorage('adlytic_workspace_logo', '');

  // Auto-sync workspace name from signup metadata if not customized
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const bizName = data?.user?.user_metadata?.business_name;
      if (bizName && bizName.trim() && (!workspaceSettings.businessName || workspaceSettings.businessName === 'AdLytic')) {
        setWorkspaceSettings(prev => ({ ...prev, businessName: bizName.trim() }));
      }
    }).catch(() => {});
  }, []);

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
      id: `t_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
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

  const handleLogoUpload = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { window.alert('Please choose an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { window.alert('Please choose a logo under 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') setWorkspaceLogo(result);
    };
    reader.readAsDataURL(file);
  };
  const handleRemoveLogo = () => setWorkspaceLogo('');

  const handleAddTeamMember = (member) => {
    setTeamMembers(prev => [...prev, {
      ...member,
      id: `team_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: member.createdAt || new Date().toISOString().slice(0, 10),
      status: member.status || 'Active'
    }]);
  };

  const handleUpdateTeamMember = (id, updatedFields) => {
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updatedFields } : m));
  };

  const handleRemoveTeamMember = (memberId) => {
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const exportBackup = () => {
    const payload = {
      app: 'AdLytic',
      version: 1,
      exportedAt: new Date().toISOString(),
      clients, cards, transactions, campaigns, workspaceSettings, teamMembers, workspaceLogo
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || (data.app !== 'AdLytic' && data.app !== 'AdLedger')) throw new Error('Invalid backup');
        if (Array.isArray(data.clients)) setClients(data.clients);
        if (Array.isArray(data.cards)) setCards(data.cards);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
        if (data.workspaceSettings) setWorkspaceSettings(data.workspaceSettings);
        if (Array.isArray(data.teamMembers)) setTeamMembers(data.teamMembers);
        if (typeof data.workspaceLogo === 'string') setWorkspaceLogo(data.workspaceLogo);
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
    setWorkspaceLogo('');
    setWorkspaceSettings({
      businessName: 'AdLytic',
      timezone: 'Asia/Dhaka',
      alerts: true,
      defaultReportRange: 'This Month'
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
        return <TeamView teamMembers={teamMembers} onAdd={handleAddTeamMember} onUpdate={handleUpdateTeamMember} onRemove={handleRemoveTeamMember} clients={clients} workspaceSettings={workspaceSettings} />;
      case 'settings':
        return <SettingsView settings={workspaceSettings} logo={workspaceLogo} onSave={handleSaveWorkspaceSettings} onLogoUpload={handleLogoUpload} onRemoveLogo={handleRemoveLogo} onExport={exportBackup} onImport={importBackup} onReset={resetAllData} clients={clients} cards={cards} transactions={transactions} campaigns={campaigns} metrics={metrics} />;
      default: return <DashboardView metrics={metrics} chartData={revenueChartData} transactions={transactions} clients={clients} cards={cards} />;
    }
  };

  return (
    <>
      <style>{` .adl-shell{background:linear-gradient(135deg,#f7fcff 0%,#eef9fe 52%,#f8fdff 100%) !important;} .adl-shell main{background:transparent !important;} .adl-shell header{background:rgba(255,255,255,.94)!important;border-color:#cfeaf7!important;backdrop-filter:blur(14px);} .adl-shell aside{background:linear-gradient(180deg,#08233a 0%,#0a2e49 58%,#062238 100%)!important;box-shadow:8px 0 30px rgba(3,51,78,.08);} .adl-shell aside nav{scrollbar-width:none;-ms-overflow-style:none;} .adl-shell aside nav::-webkit-scrollbar{display:none;} .adl-shell .adl-brand-mark{color:#fff!important;background:linear-gradient(135deg,#38bdf8,#0284c7)!important;box-shadow:0 8px 22px rgba(56,189,248,.28);} .adl-shell h1{color:#075985!important;letter-spacing:-.025em;} .adl-shell h2{color:#075985!important;} .adl-shell h3{color:#123b59!important;} .adl-shell .text-slate-500{color:#587188!important;} .adl-shell .text-slate-900{color:#0f2940!important;} .adl-shell .bg-white{box-shadow:0 10px 28px rgba(7,89,133,.055);} .adl-shell .border-slate-200,.adl-shell .border-slate-300{border-color:#cfeaf7!important;} .adl-shell .bg-slate-50{background:#f3faff!important;} .adl-shell .bg-slate-100{background:#eaf7fd!important;} .adl-shell .bg-blue-600{background:#0ea5e9!important;} .adl-shell .text-blue-600,.adl-shell .text-sky-600{color:#0284c7!important;} .adl-shell input:focus,.adl-shell select:focus,.adl-shell textarea:focus{outline:none;border-color:#7dd3fc!important;box-shadow:0 0 0 3px rgba(56,189,248,.15)!important;} .adl-shell table thead{background:#eef9fe!important;} .adl-shell table thead th{color:#25617f!important;font-weight:700!important;} .adl-shell button:not(:disabled):hover{transform:translateY(-1px);} .adl-shell button{transition:transform .16s ease,box-shadow .16s ease,background-color .16s ease;} `}</style>
      <div className="adl-shell flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">

        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:flex flex-col`}>
          {/* Top: Active Agency Workspace Switcher Card */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/30">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
              {workspaceLogo ? (
                <img
                  src={workspaceLogo}
                  alt="Workspace logo"
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/15 shrink-0 bg-white"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-sky-400 flex items-center justify-center font-bold text-xs shadow-sm shrink-0 border border-slate-700">
                  {(workspaceSettings.businessName || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold tracking-tight text-white truncate">
                    {workspaceSettings.businessName || 'My Workspace'}
                  </span>
                  <ChevronDown size={13} className="text-slate-400 shrink-0 ml-1 opacity-70" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    Active Agency
                  </span>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
            <NavItem icon={<LayoutDashboard />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} />
            <NavItem icon={<Users />} label="Clients" isActive={currentView === 'clients'} onClick={() => { setCurrentView('clients'); setIsMobileMenuOpen(false); }} />
            <NavItem icon={<BriefcaseBusiness />} label="Campaigns" isActive={currentView === 'campaigns'} onClick={() => { setCurrentView('campaigns'); setIsMobileMenuOpen(false); }} />
            <NavItem icon={<Activity />} label="Transactions" isActive={currentView === 'ledger'} onClick={() => { setCurrentView('ledger'); setIsMobileMenuOpen(false); }} />
            <NavItem icon={<CreditCard />} label="Cards & USD" isActive={currentView === 'cards'} onClick={() => { setCurrentView('cards'); setIsMobileMenuOpen(false); }} />
            <NavItem icon={<PieChart />} label="Reports" isActive={currentView === 'reports'} onClick={() => { setCurrentView('reports'); setIsMobileMenuOpen(false); }} />

            <div className="pt-3 mt-3 border-t border-slate-800/70 space-y-1">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Workspace</p>
              <NavItem icon={<PlugZap />} label="Integrations" isActive={currentView === 'integrations'} onClick={() => { setCurrentView('integrations'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<UsersRound />} label="Team" isActive={currentView === 'team'} onClick={() => { setCurrentView('team'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<Settings />} label="Settings" isActive={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }} />
            </div>
          </nav>

          {/* Sidebar Footer: Master Software Platform Brand (Distinctive & High-Tech) */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 flex items-center justify-center font-black text-lg text-white shadow-[0_0_20px_rgba(56,189,248,0.35)] ring-2 ring-sky-400/40 shrink-0">
                A
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white tracking-tight">AdLytic</span>
                  <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                    PLATFORM
                  </span>
                </div>
                <div className="text-[10px] font-medium text-sky-400 tracking-wide mt-1 truncate">
                  Ad Spend Intelligence
                </div>
              </div>
            </div>
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
                <ArrowDownRight size={16} className="text-green-600" /> Receive BDT
              </button>
              <button onClick={() => setActiveModal('usd')} className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <DollarSign size={16} className="text-blue-600" /> Buy USD
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
    </>
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
    a.download = `adledger-report-${new Date().toISOString().slice(0, 10)}.csv`;
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
                  <CartesianGrid strokeDasharray="5 7" vertical={false} stroke="#d9edf8" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#52708a', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52708a', fontSize: 11 }} />
                  <Tooltip cursor={{ stroke: '#9edcf5', strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 16, border: '1px solid #cfeaf7', boxShadow: '0 14px 36px rgba(14,116,144,0.12)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue (BDT)" stroke="#10b981" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="adCostBDT" name="Ad Cost (BDT Equivalent)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
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
                <BarChart data={expenseChart}>
                  <CartesianGrid strokeDasharray="5 7" vertical={false} stroke="#d9edf8" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#52708a', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52708a', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#eefaff' }} contentStyle={{ borderRadius: 16, border: '1px solid #cfeaf7', boxShadow: '0 14px 36px rgba(14,116,144,0.12)', fontSize: 12 }} />
                  <Bar dataKey="value" name="USD" fill="#38bdf8" radius={[10, 10, 4, 4]} barSize={42} />
                </BarChart>
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
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 text-sm">Your complete BDT, USD, client and card snapshot.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
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
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={dashboardData.expenseData.filter(item => item.value > 0)} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4} cornerRadius={8} stroke="#fff" strokeWidth={4}>
                  {dashboardData.expenseData.map((entry, index) => <Cell key={`expense-cell-${entry.name}`} fill={['#38bdf8', '#f59e0b', '#fb7185'][index % 3]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #cfeaf7', boxShadow: '0 14px 36px rgba(14,116,144,0.12)', fontSize: 12 }} formatter={(value) => [formatUSD(value), 'USD']} />
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Out</p><p className="text-lg font-bold text-slate-900">{formatUSD(dashboardData.totalUSDOut)}</p></div></div>
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

      const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT || 0), 0);
      const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
      const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);

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
                )
              })}
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
            .sort((a, b) => {
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
            <button onClick={() => setGlobalDateRange({ label: 'Lifetime', start: null, end: null })} className="text-xs text-red-600 font-medium hover:underline mr-1">
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
                const bdtPaid = parseFloat(tx.amountBDT || 0);
                const coRate = parseFloat(tx.cashOutCharge || 0);
                const usdRcv = parseFloat(tx.amountUSD || 1);
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
                )
              })}
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
          {filterRange.label !== 'Lifetime' && <button onClick={() => setFilterRange({ label: 'Lifetime', start: null, end: null })} className="text-xs text-red-600 hover:underline font-medium">Clear Filter</button>}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionDetailsModal({ tx, cardName, onClose }) {
  const bdtPaid = parseFloat(tx.amountBDT || 0);
  const coRate = parseFloat(tx.cashOutCharge || 0);
  const usdRcv = parseFloat(tx.amountUSD || 1);

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
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"><Plus size={17} /> Add Campaign</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi title="Campaigns" value={campaigns.length} icon={<Target size={16} />} />
        <MiniKpi title="Active" value={campaigns.filter(c => c.status === 'Active').length} icon={<Activity size={16} />} />
        <MiniKpi title="Tracked Spend" value={formatUSD(rows.reduce((s, c) => s + c.spendUSD, 0))} icon={<DollarSign size={16} />} />
        <MiniKpi title="Tracked Revenue" value={formatBDT(rows.reduce((s, c) => s + c.revenueBDT, 0))} icon={<TrendingUp size={16} />} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3"><Search size={17} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns, clients, platforms..." className="w-full bg-transparent border-none focus:outline-none px-2 py-2 text-sm" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"><option>All</option><option>Active</option><option>Paused</option><option>Completed</option></select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Campaign Performance</h3><p className="text-xs text-slate-500 mt-1">Spend is matched automatically from existing transaction entries using the campaign name.</p></div><BarChart3 size={19} className="text-slate-400" /></div>
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
                  <td className="px-3 py-4 text-right text-slate-700">{c.budget ? `${c.budgetType === 'USD' ? '$' : '৳'}${Number(c.budget).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
                  <td className="px-3 py-4 text-right text-red-600">{formatUSD(c.spendUSD)}</td><td className="px-3 py-4 text-right text-emerald-600">{formatBDT(c.revenueBDT)}</td><td className="px-3 py-4 text-right font-semibold">{c.roas ? `${c.roas.toFixed(2)}x` : '—'}</td>
                  <td className="px-5 py-4 text-right"><span className={`px-2 py-1 rounded-full border text-[10px] font-medium ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'Completed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{c.status}</span></td>
                  <td className="px-5 py-4 text-right whitespace-nowrap"><button onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs font-medium text-blue-600 mr-3">Edit</button><button onClick={() => onDelete(c.id)} className="text-xs font-medium text-red-500">Delete</button></td>
                </tr>
              )) : <tr><td colSpan="9" className="py-14 text-center text-slate-400">No campaigns yet. Add your first campaign to start tracking performance.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <CampaignForm initialData={editing} clients={clients} onCancel={() => setShowForm(false)} onSubmit={data => { onSave(data); setShowForm(false); }} />}
    </div>
  );
}

function CampaignForm({ initialData, clients, onCancel, onSubmit }) {
  const [data, setData] = useState(initialData || { name: '', clientId: clients[0]?.id || '', platform: 'Meta', budget: '', budgetType: 'USD', status: 'Active', startDate: new Date().toISOString().slice(0, 10), endDate: '', goal: '', resultValue: '', resultLabel: 'Leads', revenueBDT: '', notes: '' });
  const set = (key, value) => setData(prev => ({ ...prev, [key]: value }));
  const input = "w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">{initialData ? 'Edit Campaign' : 'Add Campaign'}</h2><p className="text-xs text-slate-500 mt-1">Create a campaign record; ad spend will be linked from matching ledger entries.</p></div><button onClick={onCancel} className="text-slate-400"><X size={20} /></button></div>
        <form onSubmit={e => { e.preventDefault(); if (!data.name.trim()) return; onSubmit(data); }} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Campaign Name"><input required value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ramadan Lead Campaign" className={input} /></Field>
            <Field label="Client"><select value={data.clientId} onChange={e => set('clientId', e.target.value)} className={input}><option value="">Unassigned</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Platform"><select value={data.platform} onChange={e => set('platform', e.target.value)} className={input}><option>Meta</option><option>Google</option><option>TikTok</option><option>Other</option></select></Field>
            <Field label="Status"><select value={data.status} onChange={e => set('status', e.target.value)} className={input}><option>Active</option><option>Paused</option><option>Completed</option></select></Field>
            <Field label="Budget"><input type="number" min="0" step="0.01" value={data.budget} onChange={e => set('budget', e.target.value)} placeholder="Enter budget" className={input} /></Field>
            <Field label="Budget Currency"><select value={data.budgetType} onChange={e => set('budgetType', e.target.value)} className={input}><option value="USD">USD</option><option value="BDT">BDT</option></select></Field>
            <Field label="Start Date"><input type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)} className={input} /></Field>
            <Field label="End Date"><input type="date" value={data.endDate} onChange={e => set('endDate', e.target.value)} className={input} /></Field>
            <Field label="Campaign Goal"><input value={data.goal} onChange={e => set('goal', e.target.value)} placeholder="Leads, Sales, Traffic..." className={input} /></Field>
            <Field label="Results"><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="1" value={data.resultValue} onChange={e => set('resultValue', e.target.value)} placeholder="0" className={input} /><select value={data.resultLabel} onChange={e => set('resultLabel', e.target.value)} className={input}><option>Leads</option><option>Sales</option><option>Messages</option><option>Clicks</option><option>Conversions</option></select></div></Field>
            <Field label="Revenue Attributed (BDT)"><input type="number" min="0" step="0.01" value={data.revenueBDT} onChange={e => set('revenueBDT', e.target.value)} placeholder="Optional" className={input} /></Field>
          </div>
          <Field label="Notes"><textarea value={data.notes} onChange={e => set('notes', e.target.value)} rows="3" placeholder="Campaign notes..." className={input} /></Field>
          <div className="flex gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium">Cancel</button><button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">Save Campaign</button></div>
        </form>
      </div>
    </div>
  );
}

function IntegrationsView() {
  const items = [
    ['Meta Ads', 'Sync ad accounts, campaigns and spend automatically.', <Globe2 size={22} />],
    ['Google Ads', 'Bring Google campaign spend into the same ledger.', <BarChart3 size={22} />],
    ['TikTok Ads', 'Track TikTok spend alongside Meta and Google.', <Target size={22} />],
    ['Google Sheets', 'Export and sync operational reports.', <Database size={22} />],
    ['Payments', 'Connect payment providers when automated verification is available.', <Link2 size={22} />]
  ];
  return <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
    <div><h1 className="text-2xl font-bold text-slate-900">Integrations</h1><p className="text-sm text-slate-500 mt-1">Connect your marketing stack when automated sync is enabled.</p></div>
    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-sm flex gap-3"><ShieldCheck size={19} /><span>Integrations are marked <strong>Planned</strong> until a real API connection is available.</span></div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(([name, desc, icon]) => <div key={name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-start justify-between"><div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">{icon}</div><span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">Planned</span></div><h3 className="mt-4 font-semibold">{name}</h3><p className="text-sm text-slate-500 mt-1 leading-6">{desc}</p><button disabled className="mt-4 w-full px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm">Connect later</button></div>)}</div>
  </div>;
}

// --- INITIAL TEAM ACTIVITIES DATA ---
const INITIAL_TEAM_ACTIVITIES = [
  {
    id: 'act_01',
    userName: 'Awal',
    userRole: '👑 Founder',
    action: 'Configured Workspace Financial Safety Rails & 15% VAT',
    category: 'security',
    timestamp: '15 mins ago',
    date: '2026-08-28 21:30'
  },
  {
    id: 'act_02',
    userName: 'Tanvir Ahmed',
    userRole: '🎯 Senior Media Buyer',
    action: 'Logged $185 Meta Ad Spend for client Apex Footwear',
    category: 'spend',
    timestamp: '45 mins ago',
    date: '2026-08-28 21:00'
  },
  {
    id: 'act_03',
    userName: 'Nafis Rahman',
    userRole: '📊 Accountant',
    action: 'Generated Client Monthly Ledger Statement & VAT Audit (PDF)',
    category: 'finance',
    timestamp: '2 hours ago',
    date: '2026-08-28 19:45'
  },
  {
    id: 'act_04',
    userName: 'Awal',
    userRole: '👑 Founder',
    action: 'Invited Tanvir Ahmed as Senior Media Buyer (Daily limit: $1,000)',
    category: 'team',
    timestamp: '1 day ago',
    date: '2026-08-27 16:20'
  },
  {
    id: 'act_05',
    userName: 'Nafis Rahman',
    userRole: '📊 Accountant',
    action: 'Audited Bank USD Buy Rate spread (৳131.25 → ৳140.00)',
    category: 'finance',
    timestamp: '2 days ago',
    date: '2026-08-26 14:10'
  }
];

// --- ENTERPRISE AGENCY TEAM & ROLE GOVERNANCE SUITE ---
function TeamView({ teamMembers = [], onAdd, onUpdate, onRemove, clients = [], workspaceSettings = {} }) {
  const [activeSubTab, setActiveSubTab] = useState('members'); // 'members' | 'pending' | 'activities'
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState(null);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Team Activities Audit Log State (persisted locally)
  const [activities, setActivities] = useLocalStorage('adledger_team_activities', INITIAL_TEAM_ACTIVITIES);

  // Form State for Add / Edit Modal
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Senior Media Buyer',
    status: 'Active',
    assignedClients: 'All Clients',
    dailySpendLimit: '1000',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const showToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const logActivity = (actionText, category = 'team') => {
    const newEntry = {
      id: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userName: workspaceSettings.businessName ? `${workspaceSettings.businessName} Admin` : 'Workspace Admin',
      userRole: '👑 Founder',
      action: actionText,
      category,
      timestamp: 'Just now',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    setActivities(prev => [newEntry, ...prev]);
  };

  const openInviteModal = (defaultStatus = 'Active') => {
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Senior Media Buyer',
      status: defaultStatus,
      assignedClients: 'All Clients',
      dailySpendLimit: '1000',
      notes: '',
    });
    setFormErrors({});
    setIsInviteModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'Senior Media Buyer',
      status: member.status || 'Active',
      assignedClients: member.assignedClients || 'All Clients',
      dailySpendLimit: member.dailySpendLimit || 'Unlimited',
      notes: member.notes || '',
    });
    setFormErrors({});
    setIsInviteModalOpen(true);
  };

  const validateMemberForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Full name is required.';
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errs.email = 'Please enter a valid email address.';
      }
    }
    return errs;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const errs = validateMemberForm();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    if (editingMember) {
      onUpdate(editingMember.id, formData);
      logActivity(`Updated permissions and role for ${formData.name} (${formData.role})`, 'team');
      showToast(`Updated permissions for ${formData.name}`);
    } else {
      onAdd(formData);
      logActivity(`Invited ${formData.name} (${formData.email}) as ${formData.role}`, 'team');
      showToast(`Invited ${formData.name} to workspace`);
    }

    setIsInviteModalOpen(false);
    setEditingMember(null);
  };

  const copyInviteLink = (memberId, memberName) => {
    const fakeInviteUrl = `${window.location.origin}/join?ws=${encodeURIComponent(workspaceSettings.businessName || 'adlytic')}&token=adl_inv_${memberId}`;
    navigator.clipboard?.writeText(fakeInviteUrl);
    setCopiedInviteId(memberId);
    showToast(`Invite link copied for ${memberName}`);
    setTimeout(() => setCopiedInviteId(null), 2500);
  };

  const toggleMemberStatus = (member) => {
    const nextStatus = member.status === 'Suspended' ? 'Active' : 'Suspended';
    onUpdate(member.id, { status: nextStatus });
    logActivity(`Changed status of ${member.name} to ${nextStatus}`, 'security');
    showToast(`${member.name} is now ${nextStatus}`);
  };

  const handleAcceptInvite = (member) => {
    onUpdate(member.id, { status: 'Active' });
    logActivity(`${member.name} accepted workspace invitation and joined as ${member.role}`, 'team');
    showToast(`${member.name} is now Active in workspace!`);
  };

  const exportAuditCSV = () => {
    const headers = ['ID', 'User', 'Role', 'Action', 'Category', 'Timestamp'];
    const rows = activities.map(a => [
      a.id,
      `"${a.userName || ''}"`,
      `"${a.userRole || ''}"`,
      `"${a.action || ''}"`,
      `"${a.category || ''}"`,
      `"${a.date || a.timestamp || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `adlytic-team-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exported Team Audit Log CSV');
  };

  // Segregate Active and Pending members
  const activeMembersList = useMemo(() => {
    return teamMembers.filter(m => m.status !== 'Pending Invite');
  }, [teamMembers]);

  const pendingMembersList = useMemo(() => {
    return teamMembers.filter(m => m.status === 'Pending Invite');
  }, [teamMembers]);

  // Filtered active members list
  const filteredActiveMembers = useMemo(() => {
    return activeMembersList.filter((m) => {
      const matchesSearch =
        (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.role || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === 'All' ||
        (roleFilter === 'Admin' && m.role?.includes('Admin')) ||
        (roleFilter === 'Media Buyer' && (m.role?.includes('Buyer') || m.role?.includes('Specialist'))) ||
        (roleFilter === 'Accountant' && m.role?.includes('Accountant')) ||
        (roleFilter === 'Viewer' && m.role?.includes('Viewer'));

      return matchesSearch && matchesRole;
    });
  }, [activeMembersList, searchTerm, roleFilter]);

  const roleBadgeStyle = (role = '') => {
    if (role.includes('Owner')) return 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-400/20';
    if (role.includes('Admin')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-400/20';
    if (role.includes('Buyer') || role.includes('Specialist')) return 'bg-sky-50 text-sky-700 border-sky-200 ring-1 ring-sky-400/20';
    if (role.includes('Accountant')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-400/20';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const roleIcon = (role = '') => {
    if (role.includes('Owner')) return <Crown size={12} className="text-purple-600" />;
    if (role.includes('Admin')) return <ShieldCheck size={12} className="text-indigo-600" />;
    if (role.includes('Buyer') || role.includes('Specialist')) return <Target size={12} className="text-sky-600" />;
    if (role.includes('Accountant')) return <Coins size={12} className="text-emerald-600" />;
    return <Eye size={12} className="text-slate-500" />;
  };

  const activityCategoryBadge = (cat = '') => {
    if (cat === 'security') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (cat === 'spend' || cat === 'campaign') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (cat === 'finance') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* TOAST FEEDBACK */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team & Role Governance</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeMembersList.length + 1} Active Seats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage media buyers, financial accountants, and permissions across your {workspaceSettings.businessName || 'AdLytic'} workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPermissionsGuide(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all"
          >
            <ShieldCheck size={14} className="text-sky-600" />
            {showPermissionsGuide ? 'Hide RBAC Matrix' : 'View Role Matrix'}
          </button>

          <button
            type="button"
            onClick={() => openInviteModal('Active')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02]"
          >
            <UserPlus size={15} /> Invite Member
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <UsersRound size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Team Seats</span>
            <span className="text-lg font-black text-slate-900">{activeMembersList.length + 1} Members</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Target size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Media Buyers</span>
            <span className="text-lg font-black text-slate-900">
              {teamMembers.filter(m => m.role?.includes('Buyer') || m.role?.includes('Specialist')).length} Active
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Mail size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pending Invites</span>
            <span className="text-lg font-black text-amber-700">{pendingMembersList.length} Pending</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Audit Security</span>
            <span className="text-lg font-black text-purple-700">RBAC Active</span>
          </div>
        </div>
      </div>

      {/* OPTIONAL ROLE PERMISSIONS MATRIX GUIDE */}
      {showPermissionsGuide && (
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-sky-600" />
              <h3 className="font-bold text-slate-900 text-sm">Role-Based Access Control (RBAC) Matrix</h3>
            </div>
            <span className="text-[11px] text-slate-400">Enterprise Security Rules</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700">
                  <th className="py-2.5 px-3 font-bold">Permissions & Capability</th>
                  <th className="py-2.5 px-3 font-bold text-purple-700">👑 Owner</th>
                  <th className="py-2.5 px-3 font-bold text-indigo-700">👔 Agency Admin</th>
                  <th className="py-2.5 px-3 font-bold text-sky-700">🎯 Media Buyer</th>
                  <th className="py-2.5 px-3 font-bold text-emerald-700">📊 Accountant</th>
                  <th className="py-2.5 px-3 font-bold text-slate-600">👁️ Client Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Manage Workspace Settings & Rates</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Manage Bank Cards & USD Top-ups</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">👁️ View Rates</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Create & Log Ad Campaigns & Spend</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Assigned Clients</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">👁️ Read Only</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">👁️ Own Portal</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Client Invoices, PDF & Excel Exports</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">✓ Assigned Invoices</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full Financials</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">✓ Own Statement</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Invite, Edit & Manage Team Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Full</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">✕ No</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSPACE FOUNDER / OWNER CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-indigo-600 to-sky-400 flex items-center justify-center font-black text-xl text-white shadow-md ring-2 ring-purple-400/30 shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  {workspaceSettings.businessName || 'AdLytic Agency'} Founder
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-extrabold uppercase">
                  Super Admin · Root
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Primary Account Holder · Unrestricted Access to Financials, Bank Cards & API Keys
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-semibold text-slate-300">
              <ShieldCheck size={14} className="text-emerald-400" /> 2FA Protected
            </span>
          </div>
        </div>
      </div>

      {/* TEAM SECTION TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'members'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <UsersRound size={15} className={activeSubTab === 'members' ? 'text-sky-600' : 'text-slate-400'} />
          Active Workspace Members
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold">
            {activeMembersList.length + 1}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'pending'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Mail size={15} className={activeSubTab === 'pending' ? 'text-amber-600' : 'text-slate-400'} />
          Pending Invitations
          {pendingMembersList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
              {pendingMembersList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('activities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'activities'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Activity size={15} className={activeSubTab === 'activities' ? 'text-emerald-600' : 'text-slate-400'} />
          Live Audit & Activity Trail
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold">
            {activities.length}
          </span>
        </button>
      </div>

      {/* ================= SUBTAB 1: ACTIVE WORKSPACE MEMBERS ================= */}
      {activeSubTab === 'members' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Controls: Search & Role Filters */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email or role..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
              {['All', 'Admin', 'Media Buyer', 'Accountant', 'Viewer'].map((tab) => {
                const active = roleFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRoleFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            {filteredActiveMembers.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 mx-auto">
                  <UsersRound size={24} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">No active members match your search</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Add media buyers or accountants to distribute client management and ad spend workflows.
                </p>
                <button
                  type="button"
                  onClick={() => openInviteModal('Active')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm mt-2 transition-colors"
                >
                  <UserPlus size={14} /> Invite Teammate
                </button>
              </div>
            ) : (
              filteredActiveMembers.map((member) => {
                const isSuspended = member.status === 'Suspended';

                return (
                  <div
                    key={member.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSuspended
                        ? 'border-slate-200 bg-slate-50/60 opacity-75'
                        : 'border-slate-200/90 hover:border-sky-300 hover:shadow-md'
                    }`}
                  >
                    {/* Member Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            isSuspended ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {member.name || 'Workspace Member'}
                          </h4>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${roleBadgeStyle(member.role)}`}>
                            {roleIcon(member.role)}
                            {member.role || 'Media Buyer'}
                          </span>
                          {isSuspended && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                              Suspended
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-slate-400" /> {member.email}
                          </span>
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} className="text-slate-400" /> {member.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar size={12} /> Joined {member.createdAt || 'Recent'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scope & Limits */}
                    <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap md:justify-end">
                      <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                        <span className="text-[10px] text-slate-400 block font-semibold">Client Scope</span>
                        <span className="font-bold text-slate-800">{member.assignedClients || 'All Clients'}</span>
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                        <span className="text-[10px] text-slate-400 block font-semibold">Daily Limit</span>
                        <span className="font-bold text-slate-800">
                          {member.dailySpendLimit && member.dailySpendLimit !== 'Unlimited' ? `$${member.dailySpendLimit}/day` : 'Unlimited'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyInviteLink(member.id, member.name || member.email)}
                          title="Copy Direct Join Link"
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-sky-600 transition-colors"
                        >
                          {copiedInviteId === member.id ? <Check size={15} className="text-emerald-600" /> : <Link2 size={15} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          title="Edit Permissions"
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-sky-600 transition-colors"
                        >
                          <Edit size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleMemberStatus(member)}
                          title={isSuspended ? 'Activate Member' : 'Suspend Member'}
                          className={`p-2 rounded-xl border transition-colors ${
                            isSuspended
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          {isSuspended ? <UserCheck size={15} /> : <UserX size={15} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmMember(member)}
                          title="Remove Member"
                          className="p-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 2: PENDING INVITATIONS ================= */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-amber-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Pending Invitation Links</h4>
                <p className="text-[11px] text-amber-700">
                  These teammates have been invited but have not completed setup yet. Copy their link or approve instantly.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openInviteModal('Pending Invite')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors self-start sm:self-auto"
            >
              <UserPlus size={14} /> Create Pending Invite
            </button>
          </div>

          <div className="space-y-3">
            {pendingMembersList.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto">
                  <Mail size={24} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">No pending invitations</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All invited team members have joined and are actively collaborating in your workspace.
                </p>
                <button
                  type="button"
                  onClick={() => openInviteModal('Pending Invite')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm mt-2 transition-colors"
                >
                  <UserPlus size={14} /> Send An Invitation
                </button>
              </div>
            ) : (
              pendingMembersList.map((member) => (
                <div
                  key={member.id}
                  className="bg-white border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                      {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{member.name || 'Invitee'}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          Pending Acceptance
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{member.email}</span>
                        <span>·</span>
                        <span className="font-medium text-slate-700">{member.role}</span>
                        <span>·</span>
                        <span className="text-[11px] text-slate-400">Invited {member.createdAt || 'Recently'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyInviteLink(member.id, member.name || member.email)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                    >
                      {copiedInviteId === member.id ? <Check size={14} className="text-emerald-600" /> : <Link2 size={14} />}
                      {copiedInviteId === member.id ? 'Link Copied' : 'Copy Join Link'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(member)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <UserCheck size={14} /> Force Activate
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmMember(member)}
                      title="Revoke Invite"
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 3: LIVE AUDIT & ACTIVITY TRAIL ================= */}
      {activeSubTab === 'activities' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Activity size={18} className="text-emerald-600" />
                Team Activity & Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time chronological log of ad spends, campaign changes, financial audits, and member updates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportAuditCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all"
              >
                <Download size={14} className="text-sky-600" />
                Export Audit (CSV)
              </button>
            </div>
          </div>

          <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Dot */}
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-sky-500 group-hover:scale-125 transition-transform" />

                <div className="bg-slate-50 hover:bg-sky-50/40 border border-slate-200/70 hover:border-sky-200 rounded-2xl p-4 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900">{act.userName}</span>
                      <span className="text-[11px] font-semibold text-slate-500">({act.userRole})</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${activityCategoryBadge(act.category)}`}>
                        {act.category || 'team'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar size={11} /> {act.timestamp || act.date}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                    {act.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL 1: INVITE / EDIT MEMBER ================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingMember ? 'Edit Member Permissions' : 'Invite Team Member'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Set role, client assignments, and daily ad spend safety limits.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Tanvir Ahmed"
                    className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-xs outline-none transition-colors ${
                      formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-[10.5px] font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={11} /> {formErrors.name}
                    </p>
                  )}
                </Field>

                <Field label="Email Address *">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="e.g. tanvir@agency.com"
                    className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-xs outline-none transition-colors ${
                      formErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-[10.5px] font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={11} /> {formErrors.email}
                    </p>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone / WhatsApp (Optional)">
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+880 1XXXXXXXXX"
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </Field>

                <Field label="Role & Permissions Level *">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Senior Media Buyer">Senior Media Buyer (Ad Spend & Campaigns)</option>
                    <option value="Agency Admin">Agency Admin (Full Operational Access)</option>
                    <option value="Financial Accountant">Financial Accountant (Audit & PDF Statements)</option>
                    <option value="Client Viewer">Client Viewer (Read-only Portal Access)</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Client Access Scope">
                  <select
                    value={formData.assignedClients}
                    onChange={(e) => setFormData(p => ({ ...p, assignedClients: e.target.value }))}
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="All Clients">All Agency Clients ({clients.length} Active)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>Only: {c.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Daily Spend Approval Limit ($)">
                  <select
                    value={formData.dailySpendLimit}
                    onChange={(e) => setFormData(p => ({ ...p, dailySpendLimit: e.target.value }))}
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                  >
                    <option value="250">$250 / Day</option>
                    <option value="500">$500 / Day</option>
                    <option value="1000">$1,000 / Day</option>
                    <option value="2500">$2,500 / Day</option>
                    <option value="Unlimited">Unlimited Budget</option>
                  </select>
                </Field>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs space-y-1">
                <span className="font-bold text-sky-900 block flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-sky-600" />
                  Instant Workspace Invitation
                </span>
                <p className="text-[11px] text-sky-700 leading-relaxed">
                  Saving will generate a secure one-click join link that you can send directly to your team member via WhatsApp, Email, or Slack.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02]"
                >
                  {editingMember ? 'Save Permissions' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CONFIRM DELETE MEMBER ================= */}
      {deleteConfirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">Remove {deleteConfirmMember.name || deleteConfirmMember.email}?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will revoke their access to the {workspaceSettings.businessName || 'AdLytic'} workspace immediately.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(deleteConfirmMember.id);
                  logActivity(`Revoked workspace access for ${deleteConfirmMember.name || deleteConfirmMember.email}`, 'security');
                  showToast(`Removed ${deleteConfirmMember.name || deleteConfirmMember.email}`);
                  setDeleteConfirmMember(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-colors"
              >
                Yes, Remove Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// --- PROFESSIONAL SETTINGS CENTER ---
function SettingsView({ settings, logo, onSave, onLogoUpload, onRemoveLogo, onExport, onImport, onReset, clients = [], cards = [], transactions = [], campaigns = [], metrics = {} }) {
  const [activeTab, setActiveTab] = useState('branding');
  const [data, setData] = useState(() => ({ ...DEFAULT_SETTINGS, ...settings }));
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved'
  const [copiedId, setCopiedId] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [restoreFeedback, setRestoreFeedback] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [validationBanner, setValidationBanner] = useState('');

  // Auth state for Security tab
  const [session, setSession] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [signOutOthersBusy, setSignOutOthersBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState({ error: '', message: '' });

  const fileRef = useRef(null);

  useEffect(() => {
    setData(prev => ({ ...DEFAULT_SETTINGS, ...prev, ...settings }));
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setSession(data?.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => mounted && setSession(nextSession || null));
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const validateSettings = (formData = data) => {
    const errors = {};
    // Tab 1: Identity & Localization
    if (!formData.businessName || !formData.businessName.trim()) {
      errors.businessName = 'Workspace / Business name is required.';
    }

    // Tab 2: Agency Profile
    if (formData.contactEmail && formData.contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contactEmail.trim())) {
        errors.contactEmail = 'Please enter a valid email address (e.g. contact@youragency.com).';
      }
    }

    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^(\+?[0-9\s\-()]{7,20})$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        errors.phone = 'Please enter a valid contact phone number (e.g. +880 1XXXXXXXXX).';
      }
    }

    if (formData.website && formData.website.trim()) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
      if (!urlRegex.test(formData.website.trim())) {
        errors.website = 'Please enter a valid website URL (e.g. https://youragency.com).';
      }
    }

    // Tab 3: Financial Safety & Rates
    const buyRate = parseFloat(formData.defaultUSDRate ?? '131.25');
    if (isNaN(buyRate) || buyRate <= 0) {
      errors.defaultUSDRate = 'Bank USD Buy Rate must be greater than 0.';
    }

    const sellRate = parseFloat(formData.defaultClientUSDRate ?? '140.00');
    if (isNaN(sellRate) || sellRate <= 0) {
      errors.defaultClientUSDRate = 'Client USD Sell Rate must be greater than 0.';
    }

    const tax = parseFloat(formData.defaultAdTaxRate ?? '15');
    if (isNaN(tax) || tax < 0 || tax > 100) {
      errors.defaultAdTaxRate = 'Tax rate must be between 0% and 100%.';
    }

    const cashout = parseFloat(formData.defaultCashoutChargeRate ?? '1.5');
    if (isNaN(cashout) || cashout < 0 || cashout > 100) {
      errors.defaultCashoutChargeRate = 'Cashout fee must be between 0% and 100%.';
    }

    const margin = parseFloat(formData.defaultAgencyMarginRate ?? '10');
    if (isNaN(margin) || margin < 0 || margin > 100) {
      errors.defaultAgencyMarginRate = 'Agency margin must be between 0% and 100%.';
    }

    return errors;
  };

  const handleChange = (key, value) => {
    const next = { ...data, [key]: value };
    setData(next);
    setIsDirty(true);
    // Live validation update
    const errs = validateSettings(next);
    setValidationErrors(errs);
    if (Object.keys(errs).length === 0) {
      setValidationBanner('');
    }
  };

  const handleSave = () => {
    const errors = validateSettings(data);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setValidationBanner('Please fix the highlighted errors before saving changes.');
      if (errors.businessName) setActiveTab('branding');
      else if (errors.contactEmail || errors.phone || errors.website) setActiveTab('agency');
      else if (errors.defaultUSDRate || errors.defaultClientUSDRate || errors.defaultAdTaxRate || errors.defaultCashoutChargeRate || errors.defaultAgencyMarginRate) setActiveTab('financial');
      return;
    }
    setValidationErrors({});
    setValidationBanner('');
    setSaveStatus('saving');
    onSave(data);
    setTimeout(() => {
      setSaveStatus('saved');
      setIsDirty(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }, 400);
  };

  const copyUserId = () => {
    if (session?.user?.id) {
      navigator.clipboard?.writeText(session.user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSecurityFeedback({ error: '', message: '' });
    const email = session?.user?.email || '';
    if (!email) return setSecurityFeedback({ error: 'Your authenticated email could not be found.', message: '' });
    if (!currentPassword) return setSecurityFeedback({ error: 'Enter your current password.', message: '' });
    if (newPassword.length < 8) return setSecurityFeedback({ error: 'New password must be at least 8 characters.', message: '' });
    if (newPassword !== confirmPassword) return setSecurityFeedback({ error: 'New passwords do not match.', message: '' });
    if (currentPassword === newPassword) return setSecurityFeedback({ error: 'Your new password must be different.', message: '' });

    setPasswordBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyError) {
        return setSecurityFeedback({ error: 'Current password is incorrect.', message: '' });
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        return setSecurityFeedback({ error: updateError.message || 'Failed to update password.', message: '' });
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityFeedback({ error: '', message: 'Password updated successfully!' });
    } catch (err) {
      setSecurityFeedback({ error: err?.message || 'Password update failed.', message: '' });
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSendResetEmail = async () => {
    setSecurityFeedback({ error: '', message: '' });
    const email = session?.user?.email || '';
    if (!email) return setSecurityFeedback({ error: 'Authenticated email not found.', message: '' });

    setResetBusy(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) {
        setSecurityFeedback({ error: error.message || 'Unable to send reset email.', message: '' });
      } else {
        setSecurityFeedback({ error: '', message: `Reset link sent to ${email}` });
      }
    } catch (err) {
      setSecurityFeedback({ error: err?.message || 'Failed to send reset email.', message: '' });
    } finally {
      setResetBusy(false);
    }
  };

  const handleSignOutOthers = async () => {
    setSignOutOthersBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) setSecurityFeedback({ error: error.message, message: '' });
      else setSecurityFeedback({ error: '', message: 'All other sessions have been signed out.' });
    } catch (err) {
      setSecurityFeedback({ error: err?.message || 'Failed to sign out other devices.', message: '' });
    } finally {
      setSignOutOthersBusy(false);
    }
  };

  const handleLogOut = async () => {
    setLogoutBusy(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setLogoutBusy(false);
      setSession(null);
    }
  };

  // --- EXCEL / CSV EXPORTERS ---
  const exportTransactionsCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert('No transactions to export.');
      return;
    }
    const headers = ['ID', 'Date', 'Type', 'Client', 'Card', 'Amount BDT', 'Amount USD', 'Rate', 'Notes'];
    const rows = transactions.map(t => [
      t.id || '',
      t.date || '',
      t.type || '',
      `"${(t.clientName || t.client || '').replace(/"/g, '""')}"`,
      `"${(t.cardName || t.card || '').replace(/"/g, '""')}"`,
      t.amountBDT || t.bdt || 0,
      t.amountUSD || t.usd || 0,
      t.rate || '',
      `"${(t.notes || t.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AdLytic_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportClientsCSV = () => {
    if (!clients || clients.length === 0) {
      alert('No clients to export.');
      return;
    }
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Monthly Budget', 'Total Spend', 'Status', 'Notes'];
    const rows = clients.map(c => [
      c.id || '',
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.phone || '',
      c.email || '',
      c.monthlyBudget || c.budget || 0,
      c.totalSpend || 0,
      c.status || 'Active',
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AdLytic_Clients_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCardsCSV = () => {
    if (!cards || cards.length === 0) {
      alert('No cards to export.');
      return;
    }
    const headers = ['ID', 'Card Name', 'Bank', 'Last 4 Digits', 'Currency', 'Balance', 'Status', 'Cardholder'];
    const rows = cards.map(c => [
      c.id || '',
      `"${(c.name || c.cardName || '').replace(/"/g, '""')}"`,
      `"${(c.bank || c.bankName || '').replace(/"/g, '""')}"`,
      c.last4 || c.cardNumber?.slice(-4) || '****',
      c.currency || 'USD',
      c.balance || c.currentBalance || 0,
      c.status || 'Active',
      `"${(c.holder || c.cardHolder || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AdLytic_Cards_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- PRINTABLE / PDF FINANCIAL AUDIT STATEMENT ---
  const exportPrintablePDF = () => {
    const printWin = window.open('', '_blank', 'width=950,height=800');
    if (!printWin) {
      alert('Please allow popups to open the printable statement.');
      return;
    }
    const txRows = (transactions || []).slice(0, 60).map(t => `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">${t.date || ''}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#0f172a;">${t.type || ''}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${t.clientName || t.client || '—'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${t.cardName || t.card || '—'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:800;color:#0369a1;">৳${Number(t.amountBDT || t.bdt || 0).toLocaleString()}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:800;color:#059669;">$${Number(t.amountUSD || t.usd || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>AdLytic Financial Statement — ${data.businessName || 'AdLytic'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 36px; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 18px; margin-bottom: 24px; }
          .brand { font-size: 26px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; }
          .contact { font-size: 11px; color: #64748b; margin-top: 4px; }
          .meta-title { font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .meta-date { font-size: 11px; color: #64748b; margin-top: 3px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
          .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
          .kpi-title { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px; }
          .kpi-val { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 800; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 18px; }
          .print-btn { background: #0284c7; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 8px rgba(2,132,199,0.3); }
          @media print { body { margin: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="brand">${data.businessName || 'AdLytic Agency'}</div>
            <div class="contact">
              ${data.contactEmail ? data.contactEmail + ' · ' : ''}
              ${data.phone ? data.phone + ' · ' : ''}
              ${data.address || 'Bangladesh'}
            </div>
            ${data.taxId ? '<div class="contact" style="margin-top:2px;"><strong>Tax/Trade ID:</strong> ' + data.taxId + '</div>' : ''}
          </div>
          <div style="text-align: right;">
            <div class="meta-title">Financial Audit Statement</div>
            <div class="meta-date">Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div class="meta-date">Ledger: ${data.shortCode || 'ADL'} · Official Summary</div>
          </div>
        </div>

        <div class="grid">
          <div class="kpi">
            <div class="kpi-title">Total Client Received</div>
            <div class="kpi-val">৳${Number(metrics?.totalClientReceived || 0).toLocaleString()}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Total Ad Spend USD</div>
            <div class="kpi-val">$${Number(metrics?.totalAdSpendUSD || 0).toFixed(2)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Total Clients</div>
            <div class="kpi-val">${clients?.length || 0}</div>
          </div>
          <div class="kpi">
            <div class="kpi-title">Active Payment Cards</div>
            <div class="kpi-val">${cards?.length || 0}</div>
          </div>
        </div>

        <h3 style="font-size: 15px; font-weight: 800; margin: 0 0 8px 0; color: #0f172a;">Ledger Transactions Record</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction Type</th>
              <th>Client</th>
              <th>Card / Source</th>
              <th style="text-align:right;">Amount BDT</th>
              <th style="text-align:right;">Amount USD</th>
            </tr>
          </thead>
          <tbody>
            ${txRows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">No ledger entries found.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          ${data.invoiceNotes || 'Thank you for choosing our digital advertising services.'}
          <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">Generated via AdLytic — Digital Marketing & Media Buying Ledger System</div>
        </div>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
  };

  const handleFileRestore = (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed && (parsed.clients || parsed.transactions || parsed.cards || Array.isArray(parsed))) {
            onImport(file);
            setRestoreFeedback({ success: true, message: 'Backup imported successfully!' });
          } else {
            setRestoreFeedback({ success: false, message: 'Invalid AdLytic backup format.' });
          }
        } catch (err) {
          setRestoreFeedback({ success: false, message: 'JSON parsing failed. Please upload a valid JSON file.' });
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setRestoreFeedback({ success: false, message: 'Error reading file.' });
    }
  };

  const timezoneList = [
    ['Asia/Dhaka', 'Asia/Dhaka (GMT+6 · Bangladesh Standard Time)'],
    ['UTC', 'UTC (GMT+0 · Universal Coordinated Time)'],
    ['Asia/Kolkata', 'Asia/Kolkata (GMT+5:30 · India Standard Time)'],
    ['Asia/Dubai', 'Asia/Dubai (GMT+4 · Gulf Standard Time)'],
    ['Asia/Singapore', 'Asia/Singapore (GMT+8 · Singapore Time)'],
    ['Asia/Tokyo', 'Asia/Tokyo (GMT+9 · Japan Standard Time)'],
    ['Asia/Bangkok', 'Asia/Bangkok (GMT+7 · Indochina Time)'],
    ['Europe/London', 'Europe/London (GMT+0 / BST · UK Time)'],
    ['Europe/Berlin', 'Europe/Berlin (GMT+1 · Central European Time)'],
    ['Europe/Paris', 'Europe/Paris (GMT+1 · Western European Time)'],
    ['America/New_York', 'America/New_York (EST / EDT · Eastern Time)'],
    ['America/Chicago', 'America/Chicago (CST / CDT · Central Time)'],
    ['America/Denver', 'America/Denver (MST / MDT · Mountain Time)'],
    ['America/Los_Angeles', 'America/Los_Angeles (PST / PDT · Pacific Time)'],
    ['America/Toronto', 'America/Toronto (EST / EDT · Canada)'],
    ['Australia/Sydney', 'Australia/Sydney (AEST · Sydney Time)']
  ];

  const countryList = [
    ['BD', 'Bangladesh (🇧🇩)'],
    ['US', 'United States (🇺🇸)'],
    ['GB', 'United Kingdom (🇬🇧)'],
    ['CA', 'Canada (🇨🇦)'],
    ['AU', 'Australia (🇦🇺)'],
    ['IN', 'India (🇮🇳)'],
    ['PK', 'Pakistan (🇵🇰)'],
    ['AE', 'United Arab Emirates (🇦🇪)'],
    ['SA', 'Saudi Arabia (🇸🇦)'],
    ['SG', 'Singapore (🇸🇬)'],
    ['MY', 'Malaysia (🇲🇾)'],
    ['DE', 'Germany (🇩🇪)'],
    ['FR', 'France (🇫🇷)'],
    ['IT', 'Italy (🇮🇹)'],
    ['JP', 'Japan (🇯🇵)'],
    ['OTHER', 'Other Region']
  ];

  const currencyList = [
    ['BDT', '৳ BDT — Bangladeshi Taka', '৳'],
    ['USD', '$ USD — US Dollar', '$'],
    ['EUR', '€ EUR — Euro', '€'],
    ['GBP', '£ GBP — British Pound', '£'],
    ['INR', '₹ INR — Indian Rupee', '₹'],
    ['AED', 'AED — UAE Dirham', 'AED '],
    ['SAR', 'SAR — Saudi Riyal', 'SAR '],
    ['SGD', 'S$ SGD — Singapore Dollar', 'S$'],
    ['AUD', 'A$ AUD — Australian Dollar', 'A$'],
    ['CAD', 'C$ CAD — Canadian Dollar', 'C$'],
    ['MYR', 'RM MYR — Malaysian Ringgit', 'RM '],
    ['PKR', 'Rs PKR — Pakistani Rupee', 'Rs ']
  ];

  const navTabs = [
    { id: 'branding', label: 'General & Branding', icon: <SlidersHorizontal size={17} /> },
    { id: 'agency', label: 'Agency Profile', icon: <Building size={17} /> },
    { id: 'financial', label: 'Financial Safety & Rates', icon: <Coins size={17} /> },
    { id: 'security', label: 'Account & Security', icon: <Lock size={17} /> },
    { id: 'backups', label: 'Data & Cloud Sync', icon: <Database size={17} /> },
  ];

  const selectedCurrencySymbol = currencyList.find(c => c[0] === data.currency)?.[2] || '৳';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* TOP HEADER */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings Center</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              {data.shortCode || 'ADL'} · Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your agency branding, currencies, safety rails, credentials, Excel/PDF exports and cloud backups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-600" /> Changes Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all ${isDirty
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 ring-2 ring-blue-400/40'
                : 'bg-slate-900 hover:bg-slate-800'
              } disabled:opacity-50`}
          >
            <Save size={16} />
            {saveStatus === 'saving' ? 'Saving...' : isDirty ? 'Save Changes *' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* VALIDATION WARNING BANNER */}
      {validationBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{validationBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationBanner('')}
            className="text-rose-500 hover:text-rose-700 font-bold p-1"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200 rounded-2xl overflow-x-auto">
        {navTabs.map((tab) => {
          const active = activeTab === tab.id;
          const hasError =
            (tab.id === 'branding' && validationErrors.businessName) ||
            (tab.id === 'agency' && (validationErrors.contactEmail || validationErrors.phone || validationErrors.website)) ||
            (tab.id === 'financial' && (validationErrors.defaultUSDRate || validationErrors.defaultClientUSDRate || validationErrors.defaultAdTaxRate || validationErrors.defaultCashoutChargeRate || validationErrors.defaultAgencyMarginRate));

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
                active
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-[1.01]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
              }`}
            >
              <span className={active ? 'text-sky-600' : 'text-slate-400'}>{tab.icon}</span>
              {tab.label}
              {hasError && (
                <span className="w-2 h-2 rounded-full bg-rose-500 ml-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: GENERAL & BRANDING ================= */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
          {/* Logo Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Sparkles size={18} className="text-sky-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Workspace Brand Logo</h3>
                <p className="text-[11px] text-slate-500">Appears on headers and PDF reports.</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-sky-200 rounded-2xl bg-sky-50/40 text-center relative group">
              {logo ? (
                <div className="relative">
                  <img
                    src={logo}
                    alt="Workspace Logo"
                    className="w-24 h-24 rounded-2xl object-cover bg-white border border-sky-200 shadow-md transition-transform group-hover:scale-105"
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold uppercase">
                    Active Logo
                  </div>
                </div>
              ) : (
                <div className="adl-brand-mark w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-md">
                  {data.shortCode?.[0] || data.businessName?.[0] || 'A'}
                </div>
              )}

              <p className="text-xs font-semibold text-slate-700 mt-4">
                {logo ? 'Custom Brandmark Attached' : 'Default Brand Symbol'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, SVG or WebP · Max 2MB</p>

              <div className="flex items-center gap-2 mt-4">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all">
                  <Upload size={13} /> {logo ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      onLogoUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>

                {logo && (
                  <button
                    type="button"
                    onClick={onRemoveLogo}
                    className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Currency Live Preview Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Display Preview</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-600">Sample Metric:</span>
                <span className="text-sm font-black text-slate-900">
                  {selectedCurrencySymbol}15,450.00
                </span>
              </div>
            </div>
          </div>

          {/* General Inputs */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <SlidersHorizontal size={18} className="text-sky-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Identity & Localization</h3>
                <p className="text-[11px] text-slate-500">Default currencies, timezones and reporting language.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="Workspace / Business Name *">
                  <input
                    type="text"
                    required
                    value={data.businessName || ''}
                    onChange={(e) => handleChange('businessName', e.target.value)}
                    placeholder="e.g. AdLytic Agency"
                    className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-colors ${
                      validationErrors.businessName
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                  {validationErrors.businessName && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle size={12} className="shrink-0" /> {validationErrors.businessName}
                    </p>
                  )}
                </Field>
              </div>

              <div>
                <Field label="Short Code / Slug">
                  <input
                    type="text"
                    maxLength={6}
                    value={data.shortCode || ''}
                    onChange={(e) => handleChange('shortCode', e.target.value.toUpperCase())}
                    placeholder="ADL"
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none uppercase font-mono font-bold"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Primary Currency">
                <select
                  value={data.currency || 'BDT'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                >
                  {currencyList.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Default Report Date Preset">
                <select
                  value={data.defaultReportRange || 'This Month'}
                  onChange={(e) => handleChange('defaultReportRange', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {DATE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>{preset}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Workspace Timezone">
                <select
                  value={data.timezone || 'Asia/Dhaka'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {timezoneList.map(([tz, label]) => (
                    <option key={tz} value={tz}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Interface Language">
                <select
                  value={data.language || 'English'}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="English">English (US / Global)</option>
                  <option value="Bangla">বাংলা (Bangla)</option>
                </select>
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: AGENCY PROFILE ================= */}
      {activeTab === 'agency' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Building size={18} className="text-sky-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Agency & Business Information</h3>
              <p className="text-[11px] text-slate-500">Official business profile for client communication and statements.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Organization Type">
              <select
                value={data.workspaceType || 'Agency'}
                onChange={(e) => handleChange('workspaceType', e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              >
                <option>Digital Marketing Agency</option>
                <option>Freelance Media Buyer</option>
                <option>E-commerce Brand</option>
                <option>Corporate In-House</option>
                <option>Tech Startup</option>
                <option>Other Organization</option>
              </select>
            </Field>

            <Field label="Industry Sector">
              <select
                value={data.industry || 'Digital Marketing'}
                onChange={(e) => handleChange('industry', e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              >
                <option>Digital Marketing & Ads</option>
                <option>E-commerce & Retail</option>
                <option>Information Technology</option>
                <option>Real Estate & Construction</option>
                <option>Education & EdTech</option>
                <option>Healthcare & Pharma</option>
                <option>Finance & Banking</option>
                <option>Other</option>
              </select>
            </Field>

            <Field label="Country / Base Region">
              <select
                value={data.country || 'BD'}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              >
                {countryList.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Official Support Email">
              <input
                type="email"
                value={data.contactEmail || ''}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="contact@youragency.com"
                className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-colors ${
                  validationErrors.contactEmail
                    ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                }`}
              />
              {validationErrors.contactEmail && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle size={12} className="shrink-0" /> {validationErrors.contactEmail}
                </p>
              )}
            </Field>

            <Field label="Contact Phone">
              <input
                type="tel"
                value={data.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+880 1XXXXXXXXX"
                className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-colors ${
                  validationErrors.phone
                    ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                }`}
              />
              {validationErrors.phone && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle size={12} className="shrink-0" /> {validationErrors.phone}
                </p>
              )}
            </Field>

            <Field label="Business Website">
              <input
                type="url"
                value={data.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://youragency.com"
                className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-sm outline-none transition-colors ${
                  validationErrors.website
                    ? 'border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                }`}
              />
              {validationErrors.website && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle size={12} className="shrink-0" /> {validationErrors.website}
                </p>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Physical Address / Headquarters">
              <input
                type="text"
                value={data.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Level 4, Road 12, Banani, Dhaka"
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              />
            </Field>

            <Field label="Trade License / Tax ID (Optional)">
              <input
                type="text"
                value={data.taxId || ''}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder="TRAD/DNCC/123456/2026"
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
              />
            </Field>
          </div>

          <Field label="Client Statement / Report Footer Note">
            <textarea
              rows={2}
              value={data.invoiceNotes || ''}
              onChange={(e) => handleChange('invoiceNotes', e.target.value)}
              placeholder="Custom footer message on generated client summaries and invoices..."
              className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500"
            />
          </Field>
        </div>
      )}

      {/* ================= TAB 3: FINANCIAL SAFETY & RATES ================= */}
      {activeTab === 'financial' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in fade-in duration-300">
          {/* Safety Rails */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <AlertCircle size={18} className="text-orange-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Financial Safety Rails</h3>
                <p className="text-[11px] text-slate-500">Live warnings for negative balances & overspending.</p>
              </div>
            </div>

            {/* Master Toggle */}
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer hover:bg-slate-100/70 transition-colors">
              <div>
                <span className="block text-sm font-bold text-slate-900">Master Financial Alerts</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Display high-visibility visual warning badges on cards and ledger.
                </span>
              </div>
              <input
                type="checkbox"
                checked={!!data.alerts}
                onChange={(e) => handleChange('alerts', e.target.checked)}
                className="w-5 h-5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {/* Card Low Balance Alert */}
            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer hover:bg-slate-100/70 transition-colors">
              <div>
                <span className="block text-sm font-bold text-slate-900">Low Card Balance Alert</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Warn when a card available balance drops below ${data.cardLowBalanceThreshold || '10'}.
                </span>
              </div>
              <input
                type="checkbox"
                checked={!!data.cardLowBalanceAlert}
                onChange={(e) => handleChange('cardLowBalanceAlert', e.target.checked)}
                className="w-5 h-5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Card Low Balance Limit ($)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={data.cardLowBalanceThreshold || '10'}
                  onChange={(e) => handleChange('cardLowBalanceThreshold', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                />
              </Field>

              <Field label="Client Budget Threshold Alert">
                <select
                  value={String(data.financialAlertThreshold || '80')}
                  onChange={(e) => handleChange('financialAlertThreshold', e.target.value)}
                  className="w-full mt-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="70">Warn at 70% budget spend</option>
                  <option value="80">Warn at 80% budget spend</option>
                  <option value="90">Warn at 90% budget spend</option>
                  <option value="100">Warn at 100% budget spend</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Agency Pricing & Commission Model */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Coins size={18} className="text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Agency Pricing & Commission Model</h3>
                <p className="text-[11px] text-slate-500">Configure how you charge clients and calculate net profits.</p>
              </div>
            </div>

            {/* Primary Pricing Model */}
            <Field label="Default Client Billing Model">
              <select
                value={data.defaultPricingModel || 'margin'}
                onChange={(e) => handleChange('defaultPricingModel', e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white font-medium text-slate-800"
              >
                <option value="margin">Percentage Commission on Spend (e.g. 10% Service Fee)</option>
                <option value="rate_markup">USD Rate Markup (Buy from Bank ৳131 → Sell to Client ৳140)</option>
                <option value="retainer">Fixed Monthly Retainer + Actual Ad Cost</option>
              </select>
            </Field>

            {/* Exchange Rate Spread (Bank Buy Rate vs Client Sell Rate) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <Field label="Bank USD Buy Rate (Your Cost) *">
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-2 text-sm font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={data.defaultUSDRate || '131.25'}
                    onChange={(e) => handleChange('defaultUSDRate', e.target.value)}
                    placeholder="131.25"
                    className={`w-full pl-8 pr-3.5 py-2 border rounded-xl text-sm font-bold text-slate-900 outline-none transition-colors ${
                      validationErrors.defaultUSDRate
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                </div>
                {validationErrors.defaultUSDRate ? (
                  <span className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {validationErrors.defaultUSDRate}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">What your dual-currency bank charges you per $1.</span>
                )}
              </Field>

              <Field label="Client USD Sell Rate (Your Bill) *">
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-2 text-sm font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={data.defaultClientUSDRate || '140.00'}
                    onChange={(e) => handleChange('defaultClientUSDRate', e.target.value)}
                    placeholder="140.00"
                    className={`w-full pl-8 pr-3.5 py-2 border rounded-xl text-sm font-bold text-slate-900 outline-none transition-colors ${
                      validationErrors.defaultClientUSDRate
                        ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-400'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                </div>
                {validationErrors.defaultClientUSDRate ? (
                  <span className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> {validationErrors.defaultClientUSDRate}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                    Spread Margin: +৳{(Math.max(0, parseFloat(data.defaultClientUSDRate || '140') - parseFloat(data.defaultUSDRate || '131.25'))).toFixed(2)} profit / $1 USD
                  </span>
                )}
              </Field>
            </div>

            {/* Additional Cost Rates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Default Ad Tax (%)">
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.1"
                    value={data.defaultAdTaxRate || '15'}
                    onChange={(e) => handleChange('defaultAdTaxRate', e.target.value)}
                    className="w-full pr-7 pl-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">15% Govt AIT/VAT</span>
              </Field>

              <Field label="Cashout Charge (%)">
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.05"
                    value={data.defaultCashoutChargeRate || '1.5'}
                    onChange={(e) => handleChange('defaultCashoutChargeRate', e.target.value)}
                    className="w-full pr-7 pl-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">bKash/Nagad fee</span>
              </Field>

              <Field label="Agency Margin (%)">
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.5"
                    value={data.defaultAgencyMarginRate || '10'}
                    onChange={(e) => handleChange('defaultAgencyMarginRate', e.target.value)}
                    className="w-full pr-7 pl-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Service fee %</span>
              </Field>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <span>
                These rates auto-fill across all ledger entries, client invoices, and live profit calculators, ensuring 100% accurate financial accounting.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: ACCOUNT & SECURITY ================= */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {securityFeedback.error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={17} className="text-red-600" /> {securityFeedback.error}
            </div>
          )}

          {securityFeedback.message && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={17} className="text-emerald-600" /> {securityFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Identity Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <ShieldCheck size={18} className="text-sky-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Account Identity</h3>
                  <p className="text-[11px] text-slate-500">Your authenticated credentials.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Email</label>
                  <div className="mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                    {session?.user?.email || 'Authenticated User'}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">User ID</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      readOnly
                      value={session?.user?.id || '—'}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 select-all"
                    />
                    <button
                      type="button"
                      onClick={copyUserId}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {copiedId ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Password Recovery</div>
                    <div className="text-[11px] text-slate-500">Send an instant reset link to your email.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={resetBusy}
                    className="px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {resetBusy ? 'Sending Link...' : 'Send Reset Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <KeyRound size={18} className="text-sky-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Update Password</h3>
                  <p className="text-[11px] text-slate-500">Change your login password securely.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Current Password</label>
                <div className="relative mt-1">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">New Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars"
                      className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Confirm Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordBusy}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {passwordBusy ? 'Updating Password...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Sessions & Access Control Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Laptop size={18} className="text-sky-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Session & Access Control</h3>
                  <p className="text-[11px] text-slate-500">Manage account access on this browser and other devices.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active (This Browser)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Standard Log Out */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <LogOut size={15} className="text-slate-600" /> Current Session
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Safely log out from this browser session.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogOut}
                  disabled={logoutBusy}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <LogOut size={13} /> {logoutBusy ? 'Logging Out...' : 'Log Out'}
                </button>
              </div>

              {/* Option 2: Sign Out Other Devices */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <ShieldCheck size={15} className="text-sky-600" /> Revoke Other Devices
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Terminate sessions on any other phones or computers while staying logged in here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOutOthers}
                  disabled={signOutOthersBusy}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <ShieldCheck size={13} /> {signOutOthersBusy ? 'Revoking...' : 'Sign Out Other Devices'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: DATA, EXPORTS & CLOUD SYNC ================= */}
      {activeTab === 'backups' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {restoreFeedback && (
            <div
              className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${restoreFeedback.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
                }`}
            >
              {restoreFeedback.success ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
              {restoreFeedback.message}
            </div>
          )}

          {/* Cloud Health Card */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Database size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Supabase Cloud Database</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase">
                    Connected · Free Tier
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  All ledger mutations are encrypted and mirrored in real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-sm whitespace-nowrap"
            >
              <Download size={15} /> 1-Click JSON Backup
            </button>
          </div>

          {/* SPREADSHEET (EXCEL/CSV) & PRINTABLE PDF EXPORTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Excel / CSV Exports */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <FileSpreadsheet size={18} className="text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Spreadsheet (Excel / CSV) Exports</h3>
                  <p className="text-[11px] text-slate-500">Open in Microsoft Excel, Google Sheets, or Apple Numbers.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={exportTransactionsCSV}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">Export Transactions (.csv)</strong>
                      <span className="text-[10px] text-slate-500">Full ledger history with BDT, USD, exchange rates and notes.</span>
                    </div>
                  </div>
                  <Download size={15} className="text-slate-400 group-hover:text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={exportClientsCSV}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Users size={16} />
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">Export Clients Directory (.csv)</strong>
                      <span className="text-[10px] text-slate-500">Client list with monthly budgets, total spend and contact info.</span>
                    </div>
                  </div>
                  <Download size={15} className="text-slate-400 group-hover:text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={exportCardsCSV}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">Export Cards & Balances (.csv)</strong>
                      <span className="text-[10px] text-slate-500">Card details, banks, last 4 digits and current balances.</span>
                    </div>
                  </div>
                  <Download size={15} className="text-slate-400 group-hover:text-emerald-600" />
                </button>
              </div>
            </div>

            {/* Printable PDF Statement & JSON Restore */}
            <div className="space-y-5">
              {/* PDF Financial Statement */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <Printer size={18} className="text-sky-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Printable Audit Statement / PDF</h3>
                    <p className="text-[11px] text-slate-500">Formatted agency statement with logo and KPIs.</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 flex flex-col justify-between gap-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Generate an official, branded financial statement suitable for sharing with clients, accounting, or archiving as a PDF document.
                  </p>
                  <button
                    type="button"
                    onClick={exportPrintablePDF}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Printer size={14} /> Open Printable PDF Statement
                  </button>
                </div>
              </div>

              {/* JSON Backup & Danger Zone */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Restore & Danger Zone</h4>
                    <p className="text-[10px] text-slate-500">Restore AdLytic JSON or purge local browser cache.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
                  >
                    <Upload size={13} className="text-emerald-600" /> Restore JSON
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      handleFileRestore(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition-colors"
                  >
                    <RotateCcw size={13} /> Reset Cache
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Confirmation Modal */}
          {showResetModal && (
            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>

                <div>
                  <h4 className="text-lg font-bold text-slate-900">Confirm Cache Purge?</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    This action will clear your browser's local cache and reload freshly from Supabase cloud. Type{' '}
                    <strong className="text-slate-900 font-mono">RESET</strong> below to confirm.
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Type RESET"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-red-500"
                />

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetConfirmText('');
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={resetConfirmText.trim() !== 'RESET'}
                    onClick={() => {
                      onReset();
                      setShowResetModal(false);
                      setResetConfirmText('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniKpi({ title, value, icon }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{title}</span><span className="text-slate-400">{icon}</span></div><div className="mt-2 text-lg font-bold text-slate-900">{value}</div></div>;
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-slate-600">{label}</label>{children}</div>;
}


function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] font-semibold ${
        isActive
          ? 'bg-blue-600 text-white shadow-sm ring-1 ring-white/10'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
      }`}
    >
      {React.cloneElement(icon, { size: 17, className: isActive ? 'text-white' : 'text-slate-400' })}
      <span>{label}</span>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
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
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CalendarDays size={20} className="text-blue-600" /> Select Date Range</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
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
          <button onClick={() => { onEdit(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Edit Card</button>
          <button onClick={() => { onDetails(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">View Details</button>
          <div className="h-px w-full bg-slate-100 my-1"></div>
          <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between">Delete Card <Trash2 size={14} /></button>
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
              <input type="checkbox" name="currentlyWorking" checked={formData.currentlyWorking} onChange={(e) => setFormData({ ...formData, currentlyWorking: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
              Currently Working
            </label>
            {!formData.currentlyWorking && (
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required={!formData.currentlyWorking} className={inputClass} style={{ marginTop: 0 }} />
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
  const clientTx = useMemo(() => transactions.filter(t => t.clientId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions, client.id]);

  const stats = useMemo(() => {
    const revenue = clientTx.filter(t => t.type === 'PAYMENT_RECEIVED').reduce((sum, t) => sum + parseFloat(t.amountBDT || 0), 0);
    const adSpendUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
    const taxUSD = clientTx.filter(t => t.type === 'AD_SPEND').reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);
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
      if (!map[key]) map[key] = { account: t.adAccount || 'Unknown', campaign: t.campaign || 'Unknown', spend: 0, tax: 0 };
      map[key].spend += parseFloat(t.amountUSD || 0);
      map[key].tax += parseFloat(t.taxUSD || 0);
    });
    return Object.values(map);
  }, [clientTx]);

  const chartData = useMemo(() => {
    const data = [...clientTx].reverse().reduce((acc, t) => {
      const d = t.date.substring(5);
      if (!acc[d]) acc[d] = { date: d, revenue: 0, cost: 0 };
      if (t.type === 'PAYMENT_RECEIVED') acc[d].revenue += parseFloat(t.amountBDT || 0);
      if (t.type === 'AD_SPEND') acc[d].cost += ((parseFloat(t.amountUSD || 0) + parseFloat(t.taxUSD || 0)) * metrics.avgUSDEffectiveRate);
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
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `৳${val / 1000}k`} />
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
                          <span className="font-bold text-slate-800">{formatUSD(parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0))}</span>
                          <span className="block text-[10px] text-slate-400">({formatBDT((parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) * metrics.avgUSDEffectiveRate)})</span>
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
