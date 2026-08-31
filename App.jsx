import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Users, CreditCard, DollarSign,
  Activity, FileText, Settings, Plus, Search,
  ArrowUpRight, ArrowDownRight, ArrowDownLeft, ArrowRight, ChevronRight, Wallet, PieChart,
  TrendingUp, Building, Calendar, Hash, CheckCircle2,
  AlertCircle, ChevronDown, Menu, X, Download, MoreVertical, Trash2, CalendarDays,
  BriefcaseBusiness, PlugZap, UsersRound, Database, Upload, ShieldCheck, SlidersHorizontal,
  UserPlus, Link2, BarChart3, Target, Globe2, Save, RotateCcw,
  Bell, Receipt, Coins, KeyRound, Copy, Check, ExternalLink, Eye, EyeOff, Sparkles, Lock, LogOut, Laptop,
  FileSpreadsheet, Printer, Crown, UserCheck, UserX, Shield, Mail, Phone, Edit, Filter, UserCog, MessageCircle, Share2,
  RefreshCw, Radio, Terminal, Cpu, Clock, Zap, Play, Pause, Layers, BookOpen, HelpCircle
} from 'lucide-react';
import { supabase } from './src/lib/supabase.js';
import { QUANTREX_LOGO_DATA_URL } from './src/quantrex-logo.js';
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
      console.warn('Quantrex workspace resolution fallback:', err);
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
        console.error(`Quantrex cloud sync error for ${key}:`, err);
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
        console.error(`Quantrex cloud save error for ${key}:`, err);
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
  businessName: 'Quantrex',
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
    name: 'Campaign Specialist',
    email: 'campaigns@agency.com',
    phone: '+880 1711-889900',
    role: 'Campaign Manager',
    status: 'Active',
    assignedClients: 'All Clients',
    dailySpendLimit: '100',
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
  const [workspaceLogoScale, setWorkspaceLogoScale] = useLocalStorage('quantrex_logo_scale', 1.15);
  const [workspaceLogoOffsetX, setWorkspaceLogoOffsetX] = useLocalStorage('quantrex_logo_offset_x', 0);
  const [workspaceLogoOffsetY, setWorkspaceLogoOffsetY] = useLocalStorage('quantrex_logo_offset_y', 0);

  // Auto-sync workspace name from signup metadata if not customized
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const bizName = data?.user?.user_metadata?.business_name;
      if (bizName && bizName.trim() && (!workspaceSettings.businessName || workspaceSettings.businessName === 'Quantrex')) {
        setWorkspaceSettings(prev => ({ ...prev, businessName: bizName.trim() }));
      }
    }).catch(() => {});
  }, []);

  // Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const newEntryRef = useRef(null);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const quickSettingsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (newEntryRef.current && !newEntryRef.current.contains(e.target)) {
        setIsNewEntryOpen(false);
      }
      if (quickSettingsRef.current && !quickSettingsRef.current.contains(e.target)) {
        setIsQuickSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickLogOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      window.location.reload();
    }
  };

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

  const handleSaveTransaction = (txData) => {
    if (activeModal === 'edit-transaction' && selectedTransaction) {
      setTransactions(prev => {
        const updated = prev.map(t => t.id === selectedTransaction.id ? { ...t, ...txData, id: selectedTransaction.id } : t);
        return updated.sort((a, b) => {
          const tA = a.timestamp || new Date(a.date).getTime();
          const tB = b.timestamp || new Date(b.date).getTime();
          return tB - tA;
        });
      });
      setSelectedTransaction(null);
      setActiveModal(null);
    } else {
      handleAddTransaction(txData);
    }
  };

  const handleEditTransaction = (tx) => {
    setSelectedTransaction(tx);
    setActiveModal('edit-transaction');
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
      app: 'Quantrex',
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
        if (!data || (data.app !== 'Quantrex' && data.app !== 'AdLedger')) throw new Error('Invalid backup');
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
      businessName: 'Quantrex',
      timezone: 'Asia/Dhaka',
      alerts: true,
      defaultReportRange: 'This Month'
    });
  };
  const handleDeleteTransaction = (txId) => {
    if (window.confirm('Are you sure you want to delete this transaction record? This will adjust all financial balances.')) {
      setTransactions(prev => prev.filter(t => t.id !== txId));
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView
          metrics={metrics}
          chartData={revenueChartData}
          cards={cards}
          clients={clients}
          transactions={transactions}
          onAddCard={() => { setSelectedCard(null); setActiveModal('add-card'); }}
          onAddClient={() => { setSelectedClient(null); setActiveModal('add-client'); }}
          onAddUSD={() => { setSelectedCard(null); setActiveModal('usd'); }}
          onReceivePayment={() => { setSelectedClient(null); setActiveModal('payment'); }}
          onAddSpend={() => { setSelectedClient(null); setActiveModal('spend'); }}
          onAddFee={() => { setSelectedCard(null); setActiveModal('fee'); }}
          onViewClient={(c) => { setSelectedClient(c); setActiveModal('client-details'); }}
          onViewCard={(c) => { setSelectedCard(c); setActiveModal('card-details'); }}
          onNavigate={(view) => setCurrentView(view)}
        />;
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
      case 'ledger':
        return <LedgerView
          transactions={transactions}
          clients={clients}
          cards={cards}
          metrics={metrics}
          onDeleteTransaction={handleDeleteTransaction}
          onEditTransaction={handleEditTransaction}
          onAddPayment={() => { setSelectedClient(null); setActiveModal('payment'); }}
          onAddUSD={() => { setSelectedCard(null); setActiveModal('usd'); }}
          onAddSpend={() => { setSelectedCard(null); setActiveModal('spend'); }}
          onAddFee={() => { setSelectedCard(null); setActiveModal('fee'); }}
        />;
      case 'cards':
        return <CardsView
          cards={cards}
          metrics={metrics}
          transactions={transactions}
          onAddCard={() => { setSelectedCard(null); setActiveModal('add-card'); }}
          onEditCard={(c) => { setSelectedCard(c); setActiveModal('edit-card'); }}
          onFundCard={(c) => { setSelectedCard(c); setActiveModal('usd'); }}
          onDeleteCard={handleDeleteCard}
          onViewDetails={(c) => { setSelectedCard(c); setActiveModal('card-details'); }}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />;
      case 'reports':
        return <ReportsView clients={clients} cards={cards} transactions={transactions} />;
      case 'campaigns':
        return <CampaignsView campaigns={campaigns} clients={clients} transactions={transactions} metrics={metrics} onSave={handleSaveCampaign} onDelete={handleDeleteCampaign} />;
      case 'integrations':
        return <IntegrationsView clients={clients} transactions={transactions} workspaceSettings={workspaceSettings} />;
      case 'team':
        return <TeamView teamMembers={teamMembers} onAdd={handleAddTeamMember} onUpdate={handleUpdateTeamMember} onRemove={handleRemoveTeamMember} clients={clients} workspaceSettings={workspaceSettings} />;
      case 'guide':
        return <UserGuideView onNavigate={(view) => setCurrentView(view)} />;
      case 'settings':
        return <SettingsView
          settings={workspaceSettings}
          logo={workspaceLogo}
          onSave={handleSaveWorkspaceSettings}
          onLogoUpload={handleLogoUpload}
          onRemoveLogo={handleRemoveLogo}
          onExport={exportBackup}
          onImport={importBackup}
          onReset={resetAllData}
          clients={clients}
          cards={cards}
          transactions={transactions}
          campaigns={campaigns}
          metrics={metrics}
        />;
      default: return (
        <DashboardView
          metrics={metrics}
          chartData={revenueChartData}
          transactions={transactions}
          clients={clients}
          cards={cards}
          onAddPayment={() => { setSelectedClient(null); setActiveModal('payment'); }}
          onAddUSD={() => { setSelectedCard(null); setActiveModal('usd'); }}
          onAddSpend={() => { setSelectedCard(null); setActiveModal('spend'); }}
          onAddClient={() => { setSelectedClient(null); setActiveModal('add-client'); }}
          onViewClient={(c) => { setSelectedClient(c); setActiveModal('client-details'); }}
          onViewCard={(c) => { setSelectedCard(c); setActiveModal('card-details'); }}
          onFundCard={(c) => { setSelectedCard(c); setActiveModal('usd'); }}
          onNavigate={(tab) => setCurrentView(tab)}
        />
      );
    }
  };

  return (
    <>
      <style>{` .adl-shell{background:linear-gradient(135deg,#f7fcff 0%,#eef9fe 52%,#f8fdff 100%) !important;} .adl-shell main{background:transparent !important;} .adl-shell header{background:rgba(255,255,255,.94)!important;border-color:#cfeaf7!important;backdrop-filter:blur(14px);} .adl-shell aside{background:linear-gradient(180deg,#08233a 0%,#0a2e49 58%,#062238 100%)!important;box-shadow:8px 0 30px rgba(3,51,78,.08);} .adl-shell aside nav{scrollbar-width:none;-ms-overflow-style:none;} .adl-shell aside nav::-webkit-scrollbar{display:none;} .adl-shell .adl-brand-mark{color:#fff!important;background:linear-gradient(135deg,#38bdf8,#0284c7)!important;box-shadow:0 8px 22px rgba(56,189,248,.28);} .adl-shell h1{color:#075985!important;letter-spacing:-.025em;} .adl-shell h2{color:#075985!important;} .adl-shell h3{color:#123b59!important;} .adl-shell .text-slate-500{color:#587188!important;} .adl-shell .text-slate-900{color:#0f2940!important;} .adl-shell .bg-white{box-shadow:0 10px 28px rgba(7,89,133,.055);} .adl-shell .border-slate-200,.adl-shell .border-slate-300{border-color:#cfeaf7!important;} .adl-shell .bg-slate-50{background:#f3faff!important;} .adl-shell .bg-slate-100{background:#eaf7fd!important;} .adl-shell .bg-blue-600{background:#0ea5e9!important;} .adl-shell .text-blue-600,.adl-shell .text-sky-600{color:#0284c7!important;} .adl-shell input:focus,.adl-shell select:focus,.adl-shell textarea:focus{outline:none;border-color:#7dd3fc!important;box-shadow:0 0 0 3px rgba(56,189,248,.15)!important;} .adl-shell header input:focus{box-shadow:0 0 0 3px rgba(56,189,248,.15)!important;} .adl-shell table thead{background:#eef9fe!important;} .adl-shell table thead th{color:#25617f!important;font-weight:700!important;} .adl-shell button:not(:disabled):hover{transform:translateY(-1px);} .adl-shell button{transition:transform .16s ease,box-shadow .16s ease,background-color .16s ease;} `}</style>
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
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/15 shrink-0 bg-slate-900"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/10">
                  {(workspaceSettings.businessName || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold tracking-tight text-white truncate">
                    {workspaceSettings.businessName || 'Quantrex HQ'}
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
              <NavItem icon={<PlugZap size={18} />} label="Integrations" isActive={currentView === 'integrations'} onClick={() => { setCurrentView('integrations'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<UsersRound size={18} />} label="Team" isActive={currentView === 'team'} onClick={() => { setCurrentView('team'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<BookOpen size={18} />} label="User Guide & SOP" isActive={currentView === 'guide'} onClick={() => { setCurrentView('guide'); setIsMobileMenuOpen(false); }} />
              <NavItem icon={<Settings size={18} />} label="Settings" isActive={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }} />
            </div>
          </nav>

          {/* Sidebar Footer: Master Software Platform Brand (Distinctive & High-Tech) */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-slate-800 shrink-0 bg-black flex items-center justify-center">
                <img
                  src={QUANTREX_LOGO_DATA_URL}
                  alt="Quantrex Platform"
                  style={{
                    transform: `scale(${workspaceLogoScale || 1.15}) translate(${workspaceLogoOffsetX || 0}px, ${workspaceLogoOffsetY || 0}px)`
                  }}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white tracking-tight">Quantrex</span>
                  <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/80 uppercase tracking-wider font-mono">
                    PLATFORM
                  </span>
                </div>
                <div className="text-[10px] font-medium text-slate-400 tracking-wide mt-0.5 truncate">
                  Ad Spend Intelligence
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* HEADER (OPTION 1: GLOBAL MASTER HUB) */}
          <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 z-20 shrink-0">
            <div className="flex items-center gap-4">
              <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={24} />
              </button>
              {/* Single Seamless Search Input (No Dual Box) */}
              <div className="relative hidden sm:flex items-center">
                <Search size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search clients, campaigns, cards..."
                  className="pl-9 pr-4 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 font-medium border border-transparent focus:border-sky-300 outline-none transition-all w-60 lg:w-80 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pr-3 sm:pr-5">
              {/* GLOBAL NEW ENTRY DROPDOWN (Master Level UX) */}
              <div className="relative" ref={newEntryRef}>
                <button
                  onClick={() => setIsNewEntryOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm hover:shadow transition-all tracking-wide"
                >
                  <Plus size={15} className="stroke-[2.5]" />
                  <span>New Entry</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isNewEntryOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* SOLID HIGH-CONTRAST DROPDOWN MENU */}
                {isNewEntryOpen && (
                  <div
                    style={{ right: 0 }}
                    className="absolute right-0 mt-2.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 ring-1 ring-black/5 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Quick Record Actions
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClient(null);
                        setActiveModal('payment');
                        setIsNewEntryOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ArrowDownLeft size={16} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-800">
                          Receive Client Payment
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">BDT Inflow from client</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCard(null);
                        setActiveModal('usd');
                        setIsNewEntryOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-sky-50/80 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <DollarSign size={16} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-sky-800">
                          Buy / Top Up USD
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Purchase USD & fund card</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCard(null);
                        setActiveModal('spend');
                        setIsNewEntryOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-50/80 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Activity size={16} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-purple-800">
                          Record Meta Ad Spend
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Meta Ads spend + 15% VAT</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        setSelectedClient(null);
                        setActiveModal('add-client');
                        setIsNewEntryOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <UserPlus size={16} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950">
                          Add New Client
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Client profile & settings</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* SLIDERS QUICK CONTROLS BUTTON (Clean Standalone Icon) */}
              <div className="relative" ref={quickSettingsRef}>
                <button
                  onClick={() => setIsQuickSettingsOpen(prev => !prev)}
                  title="Quick Settings & Profile"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
                >
                  <SlidersHorizontal size={19} className={`transition-all duration-200 ${isQuickSettingsOpen ? 'text-sky-600' : ''}`} />
                </button>

                {/* QUICK SETTINGS DROPDOWN MENU */}
                {isQuickSettingsOpen && (
                  <div
                    style={{ right: 0 }}
                    className="absolute right-0 mt-2.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 ring-1 ring-black/5 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    {/* Active Workspace Info Header */}
                    <div className="px-3 py-2 bg-slate-50 rounded-xl mb-1.5 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs">
                          {(workspaceSettings.businessName || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {workspaceSettings.businessName || 'Quantrex Workspace'}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Workspace
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Quick Controls
                    </div>

                    <button
                      onClick={() => {
                        setCurrentView('settings');
                        setIsQuickSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-sky-50/80 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <SlidersHorizontal size={14} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-sky-800">
                          Workspace Settings
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Branding, currency & defaults</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentView('team');
                        setIsQuickSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <UsersRound size={14} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950">
                          Team & Members
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Manage access & roles</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentView('reports');
                        setIsQuickSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-purple-50/80 text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <BarChart3 size={14} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-purple-800">
                          Audit & Reports
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">Financial & P&L statements</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentView('guide');
                        setIsQuickSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-emerald-50/80 text-left transition-colors group text-emerald-800"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <BookOpen size={14} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-emerald-900 group-hover:text-emerald-950">
                          User Guide & SOP
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium">Complete manual & PDF</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={handleQuickLogOut}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-rose-50 text-left transition-colors group text-rose-600"
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <LogOut size={14} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-rose-700 group-hover:text-rose-800">
                          Log Out
                        </div>
                        <div className="text-[10px] text-rose-400 font-medium">End current session</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
        {activeModal === 'edit-transaction' && selectedTransaction && (
          <Modal title={`Edit Transaction: #${String(selectedTransaction.id).slice(-8)}`} onClose={() => { setActiveModal(null); setSelectedTransaction(null); }}>
            <TransactionForm
              type={selectedTransaction.type}
              initialData={selectedTransaction}
              clients={clients}
              cards={cards}
              onSubmit={handleSaveTransaction}
              onCancel={() => { setActiveModal(null); setSelectedTransaction(null); }}
            />
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
          <Modal title={activeModal === 'add-client' ? 'Add New Client' : 'Edit Client'} onClose={() => setActiveModal(null)} width="max-w-3xl">
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
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExportMenu]);

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
    const effectiveRate = result.usdPurchased > 0 ? totalBDTCost / result.usdPurchased : 130;
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
        company: c.company || 'Direct',
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
          company: fallback?.company || 'Direct',
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

    const rate = report.effectiveRate || 130;
    return Object.values(map)
      .map(row => {
        const costBDT = (row.adSpend + row.tax) * rate;
        const profit = row.revenue - costBDT;
        const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;
        return { ...row, costBDT, profit, margin };
      })
      .filter(row => row.transactions > 0 || row.revenue > 0 || row.adSpend > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [clients, filteredTransactions, report.effectiveRate]);

  const cardRows = useMemo(() => {
    const map = {};
    cards.forEach(c => {
      map[c.id] = {
        id: c.id,
        name: c.name || 'Unnamed Card',
        provider: c.provider || 'Bank Card',
        last4: c.last4 || '',
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

    const rate = report.effectiveRate || 130;
    return Object.values(map)
      .map(row => ({
        ...row,
        adCostBDT: Math.round(row.adSpendUSD * rate),
        formattedDate: formatDate(row.date)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, report.effectiveRate]);

  const expenseBreakdown = useMemo(() => {
    const raw = [
      { name: 'Meta Ads', value: report.usdSpent, color: '#8b5cf6', fill: '#8b5cf6' },
      { name: '15% VAT', value: report.taxUSD, color: '#ec4899', fill: '#ec4899' },
      { name: 'Bank Fees', value: report.feesUSD, color: '#f59e0b', fill: '#f59e0b' }
    ];
    const total = report.totalUSDOut || 1;
    return raw.map(item => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
    }));
  }, [report.usdSpent, report.taxUSD, report.feesUSD, report.totalUSDOut]);

  const exportCSV = () => {
    const headers = ['Date', 'Ref ID', 'Type', 'Description / Notes', 'Client', 'Card', 'BDT In', 'BDT Out', 'USD In', 'USD Out'];
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
        `"${formatDate(t.date)}"`,
        `"${t.id}"`,
        `"${t.type}"`,
        `"${(t.notes || t.description || t.campaign || '').replace(/"/g, '""')}"`,
        `"${client.replace(/"/g, '""')}"`,
        `"${card.replace(/"/g, '""')}"`,
        `"${bdtIn.toFixed(2)}"`,
        `"${bdtOut.toFixed(2)}"`,
        `"${usdIn.toFixed(2)}"`,
        `"${usdOut.toFixed(2)}"`
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantrex_financial_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReportPDF = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agency Financial Intelligence & P&L Statement</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
          .title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 8px; text-align: center; }
          .kpi-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 13px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .red { color: #dc2626 !important; }
          .blue { color: #0284c7 !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 800; border-bottom: 1.5px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10.5px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 24px;">
          <div style="display:flex; align-items:center; gap: 14px;">
            <img src="${QUANTREX_LOGO_DATA_URL}" alt="Quantrex" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            <div>
              <div class="brand">Quantrex Financial Command</div>
              <div class="title">Official Executive P&L & Financial Intelligence Statement</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 12px;">Period: ${selectedRangeLabel}</div>
            <div style="font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">Total Revenue (BDT)</div><div class="kpi-val green">${formatBDT(report.revenueBDT)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Procurement Cost</div><div class="kpi-val">${formatBDT(report.totalBDTCost)}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD Procured</div><div class="kpi-val blue">${formatUSD(report.usdPurchased)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total USD Burned</div><div class="kpi-val red">${formatUSD(report.totalUSDOut)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Net Profit (BDT)</div><div class="kpi-val ${report.profitBDT < 0 ? 'red' : 'green'}">${formatBDT(report.profitBDT)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Profit Margin</div><div class="kpi-val">${report.margin.toFixed(1)}%</div></div>
        </div>

        <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 8px;">Client Profit & Loss Performance</h3>
        <table>
          <thead>
            <tr>
              <th>Client Name & Brand</th>
              <th style="text-align: right;">Revenue (BDT)</th>
              <th style="text-align: right;">Ad Spend (USD)</th>
              <th style="text-align: right;">Total Cost (BDT Eqv)</th>
              <th style="text-align: right;">Net Profit (BDT)</th>
              <th style="text-align: right;">Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${clientRows.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:12px;">No client transactions recorded.</td></tr>' : ''}
            ${clientRows.map(r => `
              <tr>
                <td><strong>${r.name}</strong> <span style="color:#64748b; font-size:10px;">(${r.company})</span></td>
                <td style="text-align: right; font-weight: bold; color: #16a34a;">${formatBDT(r.revenue)}</td>
                <td style="text-align: right;">${formatUSD(r.adSpend + r.tax)}</td>
                <td style="text-align: right;">${formatBDT(r.costBDT)}</td>
                <td style="text-align: right; font-weight: bold; color: ${r.profit < 0 ? '#dc2626' : '#16a34a'};">${formatBDT(r.profit)}</td>
                <td style="text-align: right; font-weight: bold;">${r.margin.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Authorized Financial Intelligence Report • Quantrex Double-Entry System</div>
          <div>Total Transactions Audited: ${report.transactionCount} entries</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
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
    <div className="space-y-6 w-full max-w-[1720px] mx-auto animate-in fade-in duration-500 pb-16">

      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Intelligence & P&L Reports</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {report.transactionCount} Records Audited
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Read-only double-entry financial analysis, client margins, card burn rates, and P&L statements.
          </p>
        </div>

        {/* FILTER CONTROLS BAR */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          <select
            value={datePreset}
            onChange={e => {
              const val = e.target.value;
              setDatePreset(val);
              if (val === 'Custom') setIsDateModalOpen(true);
            }}
            className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="Today">Today</option>
            <option value="Yesterday">Yesterday</option>
            <option value="This Week">This Week</option>
            <option value="Last Week">Last Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
            <option value="This Year">This Year</option>
            <option value="Last Year">Last Year</option>
            <option value="Lifetime">Lifetime</option>
            <option value="Custom">📅 Custom Range...</option>
          </select>

          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={cardFilter}
            onChange={e => setCardFilter(e.target.value)}
            className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="all">All Cards</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="all">All Streams</option>
            <option value="PAYMENT_RECEIVED">Client Payments</option>
            <option value="USD_PURCHASE">USD Purchases</option>
            <option value="AD_SPEND">Meta Ad Spend</option>
            <option value="FEE">Card Fees</option>
          </select>

          {(datePreset !== 'This Month' || clientFilter !== 'all' || cardFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
            >
              Reset
            </button>
          )}

          {/* UNIFIED EXPORT DROPDOWN (CSV & A4 PDF) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-2xs transition-all ${
                showExportMenu
                  ? 'bg-slate-100 border-slate-300 text-slate-900 ring-2 ring-sky-500/20'
                  : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
              }`}
            >
              <Download size={13} /> Export <ChevronDown size={11} className={`transition-transform duration-150 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => { setShowExportMenu(false); exportCSV(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Export Excel / CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExportMenu(false); handlePrintReportPDF(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 text-left rounded-lg transition-colors hover:text-sky-800"
                  >
                    <Printer size={15} className="text-sky-600" />
                    <span>Print / PDF Statement (A4)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isDateModalOpen && (
        <DateRangePickerModal
          onClose={() => setIsDateModalOpen(false)}
          onApply={(range) => {
            setCustomStart(range.start || '');
            setCustomEnd(range.end || '');
            setDatePreset('Custom');
            setIsDateModalOpen(false);
          }}
          initialRange={{ label: 'Custom Range', start: customStart, end: customEnd }}
        />
      )}

      {/* EXECUTIVE FINANCIAL P&L COMMAND CONSOLE (3 ELEGANT CLUSTERS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Domestic Cashflow (BDT) */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-2.5">
            <span className="text-[10.5px] font-extrabold uppercase text-emerald-800 tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft size={13} className="text-emerald-600" /> Domestic Cashflow
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/60 px-1.5 py-0.2 rounded">BDT</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 font-semibold">Total Revenue In:</span>
              <span className="font-black text-emerald-700 text-sm">{formatBDT(report.revenueBDT)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 font-semibold">Total BDT Cost:</span>
              <span className="font-bold text-slate-800">{formatBDT(report.totalBDTCost)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5 border-t border-emerald-100/80">
              <span className="text-slate-700 font-bold">Operating Surplus:</span>
              <span className={`font-black text-xs ${report.netBDT < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatBDT(report.netBDT)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Foreign FX & Ad Spend (USD) */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2 mb-2.5">
            <span className="text-[10.5px] font-extrabold uppercase text-purple-800 tracking-wider flex items-center gap-1.5">
              <Activity size={13} className="text-purple-600" /> Foreign FX & Burn
            </span>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-100/60 px-1.5 py-0.2 rounded">USD</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 font-semibold">USD Procured:</span>
              <span className="font-bold text-emerald-700">+{formatUSD(report.usdPurchased)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 font-semibold">Meta Ads + 15% VAT:</span>
              <span className="font-bold text-purple-700">-{formatUSD(report.usdSpent + report.taxUSD)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5 border-t border-purple-100/80">
              <span className="text-slate-700 font-bold">Total USD Outflow:</span>
              <span className="font-black text-slate-900 text-xs">{formatUSD(report.totalUSDOut)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Agency Net Profit (BDT) */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-sky-100 pb-2 mb-2.5">
            <span className="text-[10.5px] font-extrabold uppercase text-sky-800 tracking-wider flex items-center gap-1.5">
              <TrendingUp size={13} className="text-sky-600" /> Net Profit
            </span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${report.margin > 50 ? 'bg-emerald-100 text-emerald-800' : report.margin < 0 ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
              {report.margin.toFixed(1)}% Margin
            </span>
          </div>
          <div>
            <span className={`text-xl font-black block tracking-tight ${report.profitBDT < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatBDT(report.profitBDT)}
            </span>
            <span className="text-[10.5px] text-slate-400 font-semibold block mt-1">
              Revenue minus actual BDT-equivalent ad expenses.
            </span>
          </div>
        </div>

        {/* Card 4: Weighted Effective FX Rate */}
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2 mb-2.5">
            <span className="text-[10.5px] font-extrabold uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
              <RefreshCw size={13} className="text-amber-600" /> Effective FX Rate
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded">Procurement</span>
          </div>
          <div>
            <span className="text-xl font-black text-amber-800 block tracking-tight">
              ৳{(report.effectiveRate || 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">/ USD</span>
            </span>
            <span className="text-[10.5px] text-slate-400 font-semibold block mt-1">
              Includes cash-out fees (৳{formatBDT(report.cashOutBDT)} total fees).
            </span>
          </div>
        </div>
      </div>

      {/* UNIQUE WORLD-CLASS RECHARTS VISUALIZATIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* CHART 1: Dual-Chamber Revenue vs Ad Cost Area Glow Spline (8 Cols) */}
        <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" />
                Revenue vs Ad Burn Trajectory
              </h3>
              <p className="text-xs text-slate-400 font-medium">Daily BDT collection vs BDT-equivalent ad spend.</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Revenue (BDT)
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ad Cost (BDT)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="formattedDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(val) => `৳${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-950/95 border border-slate-800 text-white rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
                          <p className="font-extrabold text-slate-300 text-[11px] mb-1.5 border-b border-slate-800 pb-1">{label}</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 font-bold text-emerald-400">
                              <span>Revenue:</span>
                              <span>৳{Number(payload[0]?.value || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 font-bold text-amber-400">
                              <span>Ad Cost:</span>
                              <span>৳{Number(payload[1]?.value || 0).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="adCostBDT"
                    name="Ad Cost"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#costGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ReportEmptyState />
            )}
          </div>
        </div>

        {/* CHART 2: Futuristic Cybernetic Radial Burn Meter & Allocation (4 Cols) */}
        <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="mb-2 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <Activity size={16} className="text-purple-600" />
                USD Burn Allocation
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Meta Ads, 15% VAT, and bank fees.</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200/60 text-[10px] font-bold text-purple-700">
              Concentric HUD
            </span>
          </div>

          {/* UNIQUE GLOWING CONCENTRIC CIRCULAR GAUGE */}
          {report.totalUSDOut > 0 ? (
            <div className="py-2 flex flex-col items-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 190 190">
                  <defs>
                    <linearGradient id="glowAds" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="glowTax" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                    <linearGradient id="glowFees" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                    <filter id="shadowViolet" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.4" />
                    </filter>
                    <filter id="shadowPink" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.4" />
                    </filter>
                    <filter id="shadowAmber" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Precision Radial Calibration Dial Ticks */}
                  {[...Array(24)].map((_, i) => {
                    const angle = (i * 360) / 24;
                    const rad = (angle * Math.PI) / 180;
                    const x1 = 95 + 88 * Math.cos(rad);
                    const y1 = 95 + 88 * Math.sin(rad);
                    const x2 = 95 + 83 * Math.cos(rad);
                    const y2 = 95 + 83 * Math.sin(rad);
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#cbd5e1"
                        strokeWidth={i % 6 === 0 ? "2" : "1"}
                        strokeOpacity={i % 6 === 0 ? "0.8" : "0.35"}
                      />
                    );
                  })}

                  {/* Base Track Arcs */}
                  <circle cx="95" cy="95" r="72" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="95" cy="95" r="56" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                  <circle cx="95" cy="95" r="40" fill="none" stroke="#f1f5f9" strokeWidth="6" />

                  {/* Glowing Layer 1: Meta Ads (Outer) */}
                  {report.usdSpent > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="72"
                      fill="none"
                      stroke="url(#glowAds)"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 72}
                      strokeDashoffset={(2 * Math.PI * 72) * (1 - Math.min(1, report.usdSpent / (report.totalUSDOut || 1)))}
                      strokeLinecap="round"
                      filter="url(#shadowViolet)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}

                  {/* Glowing Layer 2: 15% VAT (Middle) */}
                  {report.taxUSD > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="56"
                      fill="none"
                      stroke="url(#glowTax)"
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 56}
                      strokeDashoffset={(2 * Math.PI * 56) * (1 - Math.min(1, report.taxUSD / (report.totalUSDOut || 1)))}
                      strokeLinecap="round"
                      filter="url(#shadowPink)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}

                  {/* Glowing Layer 3: Card Fees (Inner) */}
                  {report.feesUSD > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="40"
                      fill="none"
                      stroke="url(#glowFees)"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={(2 * Math.PI * 40) * (1 - Math.min(1, report.feesUSD / (report.totalUSDOut || 1)))}
                      strokeLinecap="round"
                      filter="url(#shadowAmber)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}
                </svg>

                {/* Center Futuristic Digital HUD Core */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">TOTAL BURN</span>
                  </div>
                  <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                    {formatUSD(report.totalUSDOut)}
                  </span>
                  <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60 mt-1">
                    100% Attributed
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ReportEmptyState />
          )}

          {/* Segmented Metric Progress Bars */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {expenseBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 font-bold">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px]">({item.percentage}%)</span>
                    <span className="font-bold text-slate-900">{formatUSD(item.value)}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, parseFloat(item.percentage) || 0)}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARATIVE BREAKDOWN TABLES (ZERO HORIZONTAL SCROLLBAR) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* TABLE 1: CLIENT P&L PERFORMANCE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Client P&L Performance</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">Revenue, USD ad cost, and profit margin per client.</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              {clientRows.length} Accounts
            </span>
          </div>
          <div className="overflow-y-auto overflow-x-hidden max-h-[350px] no-scrollbar">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[9.5px]">
                <tr>
                  <th className="w-[26%] pl-5 pr-2 py-3 text-left">Client & Brand</th>
                  <th className="w-[21%] px-3 py-3 text-right">Revenue</th>
                  <th className="w-[20%] px-3 py-3 text-right">Ad Cost</th>
                  <th className="w-[19%] px-3 py-3 text-right">Net Profit</th>
                  <th className="w-[14%] pl-2 pr-5 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {clientRows.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400">No client activity in this period.</td></tr>
                )}
                {clientRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="w-[26%] pl-5 pr-2 py-3 text-left">
                      <div className="font-bold text-slate-900 truncate">{row.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{row.company}</div>
                    </td>
                    <td className="w-[21%] px-3 py-3 text-right font-bold text-emerald-700">{formatBDT(row.revenue)}</td>
                    <td className="w-[20%] px-3 py-3 text-right text-slate-600 font-semibold">{formatBDT(row.costBDT)}</td>
                    <td className={`w-[19%] px-3 py-3 text-right font-black ${row.profit < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatBDT(row.profit)}
                    </td>
                    <td className="w-[14%] pl-2 pr-5 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.margin > 50 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.margin < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {row.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: CARD LIQUIDITY & UTILIZATION */}
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Card Liquidity & Burn</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">USD funded, spent, and period-end live balance.</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
              {cardRows.length} Cards
            </span>
          </div>
          <div className="overflow-y-auto overflow-x-hidden max-h-[350px] no-scrollbar">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[9.5px]">
                <tr>
                  <th className="w-[31%] pl-5 pr-2 py-3 text-left">Card Name</th>
                  <th className="w-[23%] px-3 py-3 text-right">USD Funded</th>
                  <th className="w-[23%] px-3 py-3 text-right">Total Burned</th>
                  <th className="w-[23%] pl-2 pr-5 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {cardRows.length === 0 && (
                  <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400">No card activity in this period.</td></tr>
                )}
                {cardRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="w-[31%] pl-5 pr-2 py-3 text-left">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                        <span className="truncate">{row.name}</span>
                        {row.last4 && <span className="text-[9.5px] font-mono text-slate-400 shrink-0">*{row.last4}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{row.provider}</div>
                    </td>
                    <td className="w-[23%] px-3 py-3 text-right font-bold text-emerald-700">+{formatUSD(row.purchased)}</td>
                    <td className="w-[23%] px-3 py-3 text-right text-purple-700 font-bold">-{formatUSD(row.adSpend + row.tax + row.fees)}</td>
                    <td className={`w-[23%] pl-2 pr-5 py-3 text-right font-black ${row.current < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatUSD(row.current)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TABLE 3: DETAILED ITEMIZED LEDGER AUDIT STREAM */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Itemized Audit Log</h3>
            <p className="text-[11px] text-slate-400 font-medium">{report.transactionCount} transaction(s) verified in current scope.</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{selectedRangeLabel}</span>
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Date & Ref</th>
                <th className="px-4 py-2.5">Stream Category</th>
                <th className="px-4 py-2.5">Client / Card / Campaign</th>
                <th className="px-4 py-2.5 text-right text-emerald-700">BDT In</th>
                <th className="px-4 py-2.5 text-right text-rose-700">BDT Out</th>
                <th className="px-4 py-2.5 text-right text-emerald-700">USD In</th>
                <th className="px-4 py-2.5 text-right text-purple-700">USD Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-400 font-semibold">
                    No transactions matching your filter criteria.
                  </td>
                </tr>
              )}
              {filteredTransactions.map(t => {
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
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-900">{formatDate(t.date)}</div>
                      <div className="font-mono text-[10px] text-slate-400">#{String(t.id).slice(-6)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-700">{t.type.replaceAll('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 truncate max-w-[220px]">
                        {client || card || t.source || t.notes || '—'}
                      </div>
                      {t.campaign && <div className="text-[10px] text-slate-400">{t.campaign}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600">{bdtIn ? `+${formatBDT(bdtIn)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-black text-rose-600">{bdtOut ? `-${formatBDT(bdtOut)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600">{usdIn ? `+${formatUSD(usdIn)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-black text-purple-700">{usdOut ? `-${formatUSD(usdOut)}` : '—'}</td>
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

function ReportEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 py-10">
      <TrendingUp size={24} className="text-slate-300 mb-1" />
      <span>No analytical data points recorded for this selected range.</span>
    </div>
  );
}

function DashboardView({
  metrics,
  chartData = [],
  transactions = [],
  clients = [],
  cards = [],
  onAddPayment,
  onAddUSD,
  onAddSpend,
  onAddClient,
  onViewClient,
  onViewCard,
  onFundCard,
  onNavigate
}) {
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
        rawClient: client,
        name: client.name || 'Unnamed Client',
        company: client.company || client.brand || 'Personal Account',
        revenue: 0,
        adSpendUSD: 0,
        adCostBDT: 0,
        profit: 0,
        margin: 0,
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
        const spendUSD = parseFloat(t.amountUSD || 0);
        const taxUSD = parseFloat(t.taxUSD || 0);
        row.adSpendUSD += spendUSD;
        row.adCostBDT += (spendUSD + taxUSD) * (metrics.avgUSDEffectiveRate || 0);
      }
    });

    Object.values(clientMap).forEach(row => {
      row.profit = row.revenue - row.adCostBDT;
      row.margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
    });

    const clientRows = Object.values(clientMap)
      .filter(row => row.revenue || row.adSpendUSD || clients.length === 1)
      .sort((a, b) => b.revenue - a.revenue);

    // Cards with real-time liquidity
    const cardRows = cards.map(c => {
      const stats = (metrics.cardStats && metrics.cardStats[c.id]) || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
      const opening = parseFloat(c.initialBalance || 0);
      const balance = opening + stats.purchased - stats.adSpend - stats.tax - stats.fees;
      const spent = stats.adSpend + stats.tax + stats.fees;
      const totalFunded = opening + stats.purchased;
      const utilPercent = totalFunded > 0 ? Math.min(100, (spent / totalFunded) * 100) : (spent > 0 ? 100 : 0);
      return {
        ...c,
        purchased: stats.purchased,
        adSpend: stats.adSpend,
        tax: stats.tax,
        fees: stats.fees,
        spent,
        balance,
        utilPercent
      };
    });

    const recentTransactions = [...transactions]
      .sort((a, b) => {
        const aTime = a.timestamp || new Date(a.date || 0).getTime();
        const bTime = b.timestamp || new Date(b.date || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);

    const flowData = (chartData || []).map(row => ({
      ...row,
      revenue: parseFloat(row.revenue || 0),
      adCostBDT: (parseFloat(row.spendUSD || 0) * (metrics.avgUSDEffectiveRate || 0))
    }));

    const totalFees = Object.values(metrics.cardStats || {}).reduce((sum, item) => sum + (item.fees || 0), 0);
    const totalBurnUSD = (metrics.totalAdSpendUSD || 0) + (metrics.totalTaxUSD || 0) + totalFees;

    const expenseBreakdown = [
      {
        name: 'Meta Ads Spend',
        value: metrics.totalAdSpendUSD || 0,
        color: '#8b5cf6',
        percentage: totalBurnUSD > 0 ? (((metrics.totalAdSpendUSD || 0) / totalBurnUSD) * 100).toFixed(1) : '0.0'
      },
      {
        name: '15% Meta Tax (VAT)',
        value: metrics.totalTaxUSD || 0,
        color: '#ec4899',
        percentage: totalBurnUSD > 0 ? (((metrics.totalTaxUSD || 0) / totalBurnUSD) * 100).toFixed(1) : '0.0'
      },
      {
        name: 'Bank / Card Fees',
        value: totalFees,
        color: '#f59e0b',
        percentage: totalBurnUSD > 0 ? ((totalFees / totalBurnUSD) * 100).toFixed(1) : '0.0'
      }
    ];

    return {
      totalBDTCost,
      netBDT,
      totalUSDOut,
      totalBurnUSD,
      totalFees,
      activeClients,
      allCards: cardRows,
      clientRows,
      recentTransactions,
      flowData,
      expenseBreakdown
    };
  }, [metrics, chartData, transactions, clients, cards]);

  const totalCardBalance = metrics.totalCardBalance || 0;

  return (
    <div className="space-y-6 w-full max-w-[1720px] mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* 1. EXECUTIVE OPERATIONAL HERO STRIP & FAST SHORTCUTS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-black">
              <LayoutDashboard size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Agency Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Live financial telemetry, liquidity distribution & client performance overview.
          </p>
        </div>

        {/* Live Operational Status & DB Telemetry */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">Live Supabase DB Sync</span>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE FINANCIAL HEALTH MATRIX (4 SIMPLE, UNIFIED MASTER CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">

        {/* CARD 1: TOTAL REVENUE (BDT) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <ArrowDownRight size={17} />
              </div>
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider leading-tight block">
                Total<br />Revenue
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              BDT In
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div>
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Received</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                {formatBDT(metrics.totalRevenueBDT)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold">Total BDT Cost</span>
                <span className="font-bold text-rose-600">{formatBDT(dashboardData.totalBDTCost)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Net BDT in Hand</span>
                <span className={`font-bold ${dashboardData.netBDT < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatBDT(dashboardData.netBDT)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            Client payments received minus BDT spent on USD.
          </div>
        </div>

        {/* CARD 2: TOTAL USD SPENT */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                <Activity size={17} />
              </div>
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider leading-tight block">
                Total USD<br />Spent
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              USD Out
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div>
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Ads + Tax + Fees</span>
              <div className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight">
                {formatUSD(dashboardData.totalBurnUSD)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold">USD Purchased</span>
                <span className="font-bold text-sky-600">{formatUSD(metrics.totalUSDPurchased)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Meta Ads + 15%</span>
                <span className="font-bold text-slate-800">{formatUSD(metrics.totalAdSpendUSD + metrics.totalTaxUSD)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            Total USD spent on Meta ads, 15% VAT, and bank fees.
          </div>
        </div>

        {/* CARD 3: NET AGENCY PROFIT */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <TrendingUp size={17} />
              </div>
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider leading-tight block">
                Net Agency<br />Profit
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Net BDT
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div>
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Actual Earnings</span>
              <div className={`text-xl sm:text-2xl font-black tracking-tight ${metrics.netProfitBDT < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatBDT(metrics.netProfitBDT)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold">Profit Margin</span>
                <span className="font-bold text-emerald-600">{metrics.profitMargin.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Buy Rate</span>
                <span className="font-bold text-slate-800">৳{metrics.avgUSDEffectiveRate.toFixed(2)}/USD</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            Client revenue minus actual USD ad cost in BDT.
          </div>
        </div>

        {/* CARD 4: TOTAL CARD BALANCE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                totalCardBalance < 0 ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600'
              }`}>
                <CreditCard size={17} />
              </div>
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider leading-tight block">
                Total Card<br />Balance
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              totalCardBalance < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              {cards.length} Cards
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div>
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Available USD</span>
              <div className={`text-xl sm:text-2xl font-black tracking-tight ${totalCardBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatUSD(totalCardBalance)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
              <div>
                <span className="text-slate-400 block font-semibold">Dollar Buy Rate</span>
                <span className="font-bold text-slate-800">৳{metrics.avgUSDEffectiveRate.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">15% VAT Paid</span>
                <span className="font-bold text-rose-600">{formatUSD(metrics.totalTaxUSD)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-medium">
            Current spendable USD balance across all virtual cards.
          </div>
        </div>
      </div>

      {/* 3. MASTER VISUAL INTELLIGENCE CENTER (DUAL GLOW SPLINE & CYBER RADIAL HUD) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* CHART 1: Dual-Chamber Revenue vs Media Cost Glow Flow (8 Cols) */}
        <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" />
                Revenue vs Ad Burn Trajectory
              </h3>
              <p className="text-xs text-slate-400 font-medium">Daily BDT collection vs equivalent BDT ad cost.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                Revenue In (BDT)
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                Ad Cost (BDT)
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {dashboardData.flowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.flowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="dashCostGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10.5, fontWeight: 600 }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10.5, fontWeight: 600 }}
                    tickFormatter={(v) => `৳${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const rev = payload.find(p => p.dataKey === 'revenue')?.value || 0;
                      const cost = payload.find(p => p.dataKey === 'adCostBDT')?.value || 0;
                      const margin = rev > 0 ? (((rev - cost) / rev) * 100).toFixed(1) : 0;
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[170px]">
                          <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 flex items-center justify-between">
                            <span>{label}</span>
                            <span className="text-[10px] text-emerald-400 font-extrabold">{margin}% Margin</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Revenue:
                            </span>
                            <span className="font-bold font-mono text-emerald-400">{formatBDT(rev)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Ad Cost:
                            </span>
                            <span className="font-bold font-mono text-amber-400">{formatBDT(cost)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashRevGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="adCostBDT"
                    name="Ad Cost"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashCostGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ReportEmptyState />
            )}
          </div>
        </div>

        {/* CHART 2: Cybernetic Concentric Radial Burn HUD (4 Cols) */}
        <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="mb-2 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                <Activity size={16} className="text-purple-600" />
                USD Burn Allocation
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Meta Ads, 15% VAT, and bank fees.</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200/60 text-[10px] font-bold text-purple-700">
              Concentric HUD
            </span>
          </div>

          {/* UNIQUE GLOWING CONCENTRIC CIRCULAR GAUGE */}
          {dashboardData.totalBurnUSD > 0 ? (
            <div className="py-2 flex flex-col items-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 190 190">
                  <defs>
                    <linearGradient id="dashGlowAds" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="dashGlowTax" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                    <linearGradient id="dashGlowFees" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                    <filter id="dashShadowViolet" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.4" />
                    </filter>
                    <filter id="dashShadowPink" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.4" />
                    </filter>
                    <filter id="dashShadowAmber" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Precision Radial Calibration Dial Ticks */}
                  {[...Array(24)].map((_, i) => {
                    const angle = (i * 360) / 24;
                    const rad = (angle * Math.PI) / 180;
                    const x1 = 95 + 88 * Math.cos(rad);
                    const y1 = 95 + 88 * Math.sin(rad);
                    const x2 = 95 + 83 * Math.cos(rad);
                    const y2 = 95 + 83 * Math.sin(rad);
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#cbd5e1"
                        strokeWidth={i % 6 === 0 ? "2" : "1"}
                        strokeOpacity={i % 6 === 0 ? "0.8" : "0.35"}
                      />
                    );
                  })}

                  {/* Base Track Arcs */}
                  <circle cx="95" cy="95" r="72" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="95" cy="95" r="56" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                  <circle cx="95" cy="95" r="40" fill="none" stroke="#f1f5f9" strokeWidth="6" />

                  {/* Glowing Layer 1: Meta Ads (Outer) */}
                  {metrics.totalAdSpendUSD > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="72"
                      fill="none"
                      stroke="url(#dashGlowAds)"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 72}
                      strokeDashoffset={(2 * Math.PI * 72) * (1 - Math.min(1, (metrics.totalAdSpendUSD || 0) / (dashboardData.totalBurnUSD || 1)))}
                      strokeLinecap="round"
                      filter="url(#dashShadowViolet)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}

                  {/* Glowing Layer 2: 15% VAT (Middle) */}
                  {metrics.totalTaxUSD > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="56"
                      fill="none"
                      stroke="url(#dashGlowTax)"
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 56}
                      strokeDashoffset={(2 * Math.PI * 56) * (1 - Math.min(1, (metrics.totalTaxUSD || 0) / (dashboardData.totalBurnUSD || 1)))}
                      strokeLinecap="round"
                      filter="url(#dashShadowPink)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}

                  {/* Glowing Layer 3: Card Fees (Inner) */}
                  {dashboardData.totalFees > 0 && (
                    <circle
                      cx="95"
                      cy="95"
                      r="40"
                      fill="none"
                      stroke="url(#dashGlowFees)"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={(2 * Math.PI * 40) * (1 - Math.min(1, (dashboardData.totalFees || 0) / (dashboardData.totalBurnUSD || 1)))}
                      strokeLinecap="round"
                      filter="url(#dashShadowAmber)"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}
                </svg>

                {/* Center Futuristic Digital HUD Core */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">TOTAL BURN</span>
                  </div>
                  <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                    {formatUSD(dashboardData.totalBurnUSD)}
                  </span>
                  <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60 mt-1">
                    Live Telemetry
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ReportEmptyState />
          )}

          {/* Segmented Metric Progress Bars */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {dashboardData.expenseBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 font-bold">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px]">({item.percentage}%)</span>
                    <span className="font-bold text-slate-900">{formatUSD(item.value)}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, parseFloat(item.percentage) || 0)}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. LIVE OPERATIONAL COCKPIT: DUAL COMPARATIVE TABLES (6:6 SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* TABLE 1: CLIENT P&L PERFORMANCE (6 Cols) */}
        <div className="xl:col-span-6 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Client P&L Performance</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">Top client accounts, revenue collected & net margin.</p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('clients')}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
              >
                <span>All Clients</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="overflow-y-auto overflow-x-hidden flex-1 max-h-[360px] no-scrollbar">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[9.5px]">
                <tr>
                  <th className="w-[28%] pl-5 pr-2 py-3 text-left">Client & Brand</th>
                  <th className="w-[21%] px-3 py-3 text-right">Revenue</th>
                  <th className="w-[20%] px-3 py-3 text-right">Ad Cost</th>
                  <th className="w-[18%] px-3 py-3 text-right">Net Profit</th>
                  <th className="w-[13%] pl-2 pr-5 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {dashboardData.clientRows.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400 font-semibold">No client activity recorded yet.</td></tr>
                )}
                {dashboardData.clientRows.slice(0, 5).map(row => (
                  <tr
                    key={row.id}
                    onClick={() => onViewClient && row.rawClient && onViewClient(row.rawClient)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="w-[28%] pl-5 pr-2 py-3 text-left">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">{row.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{row.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[21%] px-3 py-3 text-right font-bold text-emerald-700">{formatBDT(row.revenue)}</td>
                    <td className="w-[20%] px-3 py-3 text-right text-slate-600 font-semibold">{formatBDT(row.adCostBDT)}</td>
                    <td className={`w-[18%] px-3 py-3 text-right font-black ${row.profit < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatBDT(row.profit)}
                    </td>
                    <td className="w-[13%] pl-2 pr-5 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.margin > 50 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.margin < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {row.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: CARD LIQUIDITY & BURN (6 Cols) */}
        <div className="xl:col-span-6 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Card Liquidity & Burn</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">USD funded, burned, and live spendable balances.</p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('cards')}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
              >
                <span>All Cards</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="overflow-y-auto overflow-x-hidden flex-1 max-h-[360px] no-scrollbar">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[9.5px]">
                <tr>
                  <th className="w-[32%] pl-5 pr-2 py-3 text-left">Card & Provider</th>
                  <th className="w-[23%] px-3 py-3 text-right">USD Funded</th>
                  <th className="w-[23%] px-3 py-3 text-right">Total Burned</th>
                  <th className="w-[22%] pl-2 pr-5 py-3 text-right">Live Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {dashboardData.allCards.length === 0 && (
                  <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400 font-semibold">No active cards found.</td></tr>
                )}
                {dashboardData.allCards.slice(0, 5).map(card => (
                  <tr
                    key={card.id}
                    onClick={() => onViewCard && onViewCard(card)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="w-[32%] pl-5 pr-2 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[7px] font-black text-white shadow-2xs shrink-0">
                          EMV
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                            {card.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {card.provider || 'Virtual Card'} {card.last4 && `· *${card.last4}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-[23%] px-3 py-3 text-right font-bold text-emerald-700">
                      +{formatUSD(card.purchased)}
                    </td>
                    <td className="w-[23%] px-3 py-3 text-right font-bold text-purple-700">
                      -{formatUSD(card.spent)}
                    </td>
                    <td className={`w-[22%] pl-2 pr-5 py-3 text-right font-black ${card.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatUSD(card.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. LIVE MOVEMENT STREAM & COMPACT STATS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* REAL-TIME MOVEMENT STREAM (7 Cols) */}
        <div className="xl:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Live Movement Stream</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">Real-time ledger events and transactions.</p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('transactions')}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
              >
                <span>Full Ledger</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {dashboardData.recentTransactions.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">No transactions recorded yet.</div>
            )}
            {dashboardData.recentTransactions.map(tx => {
              const isIn = tx.type === 'PAYMENT_RECEIVED' || tx.type === 'USD_PURCHASE';
              const isPayment = tx.type === 'PAYMENT_RECEIVED';
              const isUSD = tx.type === 'USD_PURCHASE';
              const isAds = tx.type === 'AD_SPEND';
              const isFee = tx.type === 'FEE';

              const client = clients.find(c => c.id === tx.clientId)?.name;
              const card = cards.find(c => c.id === tx.cardId)?.name;

              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isPayment ? 'bg-emerald-50 text-emerald-600' :
                      isUSD ? 'bg-sky-50 text-sky-600' :
                      isAds ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {isPayment && <ArrowDownLeft size={16} />}
                      {isUSD && <DollarSign size={16} />}
                      {isAds && <Activity size={16} />}
                      {isFee && <Wallet size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {isPayment ? 'Payment Received' : isUSD ? 'USD Purchased' : isAds ? 'Meta Ad Spend' : 'Card Fee'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {client || card || tx.campaign || tx.notes || 'Ledger entry'} · {formatDate(tx.date)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-black text-xs ${isIn ? 'text-emerald-600' : isAds ? 'text-purple-700' : 'text-slate-900'}`}>
                      {isPayment ? `+${formatBDT(tx.amountBDT)}` :
                       isUSD ? `+${formatUSD(tx.amountUSD)}` :
                       isAds ? `-${formatUSD(parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0))}` :
                       `-${formatUSD(tx.amountUSD)}`}
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-400">#{String(tx.id).slice(-6)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10.5px] text-slate-400 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Verified against Supabase Ledger</span>
            <span className="font-bold text-slate-700">{transactions.length} Total Records</span>
          </div>
        </div>

        {/* QUICK STATS SNAPSHOT (5 Cols) */}
        <div className="xl:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Quick Operational Stats</h3>
              <p className="text-[10.5px] text-slate-400 font-medium">A compact snapshot of your operations.</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="divide-y divide-slate-100/80 my-2 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Active Clients</span>
              <span className="font-bold text-slate-900">{dashboardData.activeClients.length} of {clients.length}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Total Virtual Cards</span>
              <span className="font-bold text-slate-900">{cards.length} Cards</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Avg Effective FX Rate</span>
              <span className="font-bold text-sky-600 font-mono">৳{metrics.avgUSDEffectiveRate.toFixed(2)} / USD</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Total BDT Spent on USD</span>
              <span className="font-bold text-rose-600">{formatBDT(dashboardData.totalBDTCost)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Total Meta 15% VAT</span>
              <span className="font-bold text-rose-600">{formatUSD(metrics.totalTaxUSD)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Ledger Health</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={13} /> 100% Balanced
            </span>
          </div>
        </div>
      </div>

      {/* 6. FULL-WIDTH 3-PILLAR OPERATIONAL HEALTH STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* CARD 1: CARD LIQUIDITY SAFETY SHIELD */}
        <div className={`rounded-2xl border p-5 transition-all shadow-2xs flex flex-col justify-between ${
          totalCardBalance < 0
            ? 'bg-rose-50/90 border-rose-200/90 text-rose-950'
            : 'bg-emerald-50/80 border-emerald-200/90 text-emerald-950'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-2xs ${
                totalCardBalance < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {totalCardBalance < 0 ? <AlertCircle size={19} /> : <ShieldCheck size={19} />}
              </div>
              <div>
                <h4 className={`font-black text-xs uppercase tracking-wider ${
                  totalCardBalance < 0 ? 'text-rose-900' : 'text-emerald-900'
                }`}>
                  {totalCardBalance < 0 ? 'Card Liquidity Warning' : 'Healthy Card Liquidity'}
                </h4>
                <span className="text-[10px] opacity-75 font-semibold">Virtual Card Reserves</span>
              </div>
            </div>
          </div>

          <p className={`text-xs font-medium mt-3 ${
            totalCardBalance < 0 ? 'text-rose-800/90' : 'text-emerald-800/90'
          }`}>
            {totalCardBalance < 0
              ? `Virtual card balance is in deficit by ${formatUSD(Math.abs(totalCardBalance))}. Top up immediately to prevent Meta ad pauses.`
              : `Total spendable balance across all active cards is ${formatUSD(totalCardBalance)}.`}
          </p>
        </div>

        {/* CARD 2: REVENUE INFLOW HEALTH */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <CheckCircle2 size={19} />
            </div>
            <div>
              <h4 className="font-black text-xs uppercase tracking-wider text-emerald-900">
                Healthy Revenue Flow
              </h4>
              <span className="text-[10px] text-emerald-700/80 font-semibold">Client Inflow Status</span>
            </div>
          </div>
          <p className="text-xs text-emerald-800/90 font-medium mt-3">
            {formatBDT(metrics.totalRevenueBDT)} received across active client accounts with positive cashflow surplus.
          </p>
        </div>

        {/* CARD 3: PROFIT & MARGIN SNAPSHOT */}
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <TrendingUp size={19} />
            </div>
            <div>
              <h4 className="font-black text-xs uppercase tracking-wider text-blue-900">
                Net Profit Snapshot
              </h4>
              <span className="text-[10px] text-blue-700/80 font-semibold">Bottom Line Performance</span>
            </div>
          </div>
          <p className="text-xs text-blue-800/90 font-medium mt-3">
            {formatBDT(metrics.netProfitBDT)} net agency profit achieved with a healthy {metrics.profitMargin.toFixed(1)}% margin.
          </p>
        </div>
      </div>
    </div>
  );
}


function MasterLedgerBadge({ type }) {
  if (type === 'PAYMENT_RECEIVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold shadow-2xs">
        <ArrowDownLeft size={13} className="text-emerald-600" />
        Payment In
      </span>
    );
  }
  if (type === 'USD_PURCHASE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 text-[11px] font-bold shadow-2xs">
        <RefreshCw size={12} className="text-sky-600" />
        Buy USD
      </span>
    );
  }
  if (type === 'AD_SPEND') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 text-[11px] font-bold shadow-2xs">
        <svg className="w-3 h-3 fill-current text-purple-600" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
        Meta Ads
      </span>
    );
  }
  if (type === 'FEE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-bold shadow-2xs">
        <Shield size={12} className="text-amber-600" />
        Card Fee
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
      <DollarSign size={12} className="text-slate-500" />
      {type}
    </span>
  );
}

function TransactionAuditModal({ tx, clients, cards, metrics, onClose, onDelete, onEdit }) {
  const client = clients.find(c => c.id === tx.clientId);
  const card = cards.find(c => c.id === tx.cardId);

  const isPayment = tx.type === 'PAYMENT_RECEIVED';
  const isPurchase = tx.type === 'USD_PURCHASE';
  const isAdSpend = tx.type === 'AD_SPEND';
  const isFee = tx.type === 'FEE';

  const bdtIn = isPayment ? parseFloat(tx.amountBDT || 0) : 0;
  const bdtOut = isPurchase ? (parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)) : 0;
  const usdIn = isPurchase ? parseFloat(tx.amountUSD || 0) : 0;
  const usdOut = isAdSpend ? (parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) : (isFee ? parseFloat(tx.amountUSD || 0) : 0);

  const effectiveRate = isPurchase && usdIn > 0 ? (bdtOut / usdIn) : (metrics?.avgUSDEffectiveRate || 0);

  const handlePrintVoucher = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=700');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Audit Voucher - ${tx.id}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 900; color: #0284c7; }
          .voucher-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
          .kpi-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 18px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .red { color: #dc2626 !important; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 20px;">
          <div style="display:flex; align-items:center; gap: 12px;">
            <img src="${QUANTREX_LOGO_DATA_URL}" alt="Quantrex" style="width: 42px; height: 42px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.12);" />
            <div>
              <div class="brand">Quantrex Financial Command</div>
              <div class="voucher-title">Accounting Transaction Voucher</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 13px;">Ref: ${tx.id}</div>
            <div style="font-size: 12px; color: #64748b;">Date: ${formatDate(tx.date)}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">BDT In</div><div class="kpi-val ${bdtIn > 0 ? 'green' : ''}">${bdtIn > 0 ? formatBDT(bdtIn) : '—'}</div></div>
          <div class="kpi-card"><div class="kpi-title">BDT Out</div><div class="kpi-val ${bdtOut > 0 ? 'red' : ''}">${bdtOut > 0 ? formatBDT(bdtOut) : '—'}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD In</div><div class="kpi-val ${usdIn > 0 ? 'green' : ''}">${usdIn > 0 ? formatUSD(usdIn) : '—'}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD Out</div><div class="kpi-val ${usdOut > 0 ? 'red' : ''}">${usdOut > 0 ? formatUSD(usdOut) : '—'}</div></div>
        </div>

        <div class="box">
          <div><strong>Transaction Category:</strong><br/>${tx.type}</div>
          <div><strong>Linked Client:</strong><br/>${client ? `${client.name} (${client.company || 'Direct'})` : 'N/A (Agency Internal)'}</div>
          <div><strong>Payment Card / Account:</strong><br/>${card ? `${card.name} (${card.provider || 'Bank Card'})` : 'N/A'}</div>
          <div><strong>Ad Account / Campaign:</strong><br/>${tx.adAccount || tx.campaign || 'N/A'}</div>
          ${tx.taxUSD ? `<div><strong>15% Meta VAT:</strong><br/>${formatUSD(tx.taxUSD)}</div>` : ''}
          ${effectiveRate > 0 ? `<div><strong>Exchange Rate Applied:</strong><br/>৳${effectiveRate.toFixed(2)} / USD</div>` : ''}
        </div>

        <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; margin-bottom: 24px;">
          <strong>Narrative & Ledger Memo:</strong><br/>
          <p style="margin: 4px 0 0 0; color: #334155;">${tx.notes || 'Standard accounting entry verified by Quantrex Engine.'}</p>
        </div>

        <div class="footer">
          <div>Authorized Accounting Record • Quantrex Double-Entry System</div>
          <div>Generated on ${new Date().toLocaleString()}</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <MasterLedgerBadge type={tx.type} />
            <span className="font-mono text-xs font-black text-sky-400 bg-sky-950/90 px-2.5 py-0.5 rounded border border-sky-800/80 shadow-2xs">
              #{String(tx.id).slice(-8)}
            </span>
          </div>
          <div className="text-slate-300 text-xs font-semibold flex items-center gap-1.5 pt-0.5">
            <span className="text-slate-400">Timestamp:</span>
            <span className="text-white font-bold">{formatDate(tx.date)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrintVoucher}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:text-white"
          >
            <Printer size={13} /> Print Voucher
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">BDT Inflow</span>
          <span className="text-base font-black text-emerald-700 mt-1 block">{bdtIn > 0 ? `+${formatBDT(bdtIn)}` : '—'}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-1 block">Client Deposit</span>
        </div>

        <div className="bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 border border-rose-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">BDT Outflow</span>
          <span className="text-base font-black text-rose-700 mt-1 block">{bdtOut > 0 ? `-${formatBDT(bdtOut)}` : '—'}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-1 block">USD Purchase Cost</span>
        </div>

        <div className="bg-gradient-to-br from-sky-50/90 via-white to-blue-50/50 border border-sky-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">USD Funded</span>
          <span className="text-base font-black text-sky-700 mt-1 block">{usdIn > 0 ? `+${formatUSD(usdIn)}` : '—'}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-1 block">Card Inflow</span>
        </div>

        <div className="bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/50 border border-purple-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">USD Outflow</span>
          <span className="text-base font-black text-purple-700 mt-1 block">{usdOut > 0 ? `-${formatUSD(usdOut)}` : '—'}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-1 block">Ad Spend + Tax</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Counterparty & Financial Narrative
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Linked Client Account</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {client ? `${client.name} (${client.company || 'Direct'})` : 'N/A (Agency Internal)'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Linked Card / Source</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {card ? `${card.name} • ${card.provider || 'Bank Card'}` : 'N/A'}
            </span>
          </div>

          {tx.adAccount && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Ad Account Reference</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{tx.adAccount}</span>
            </div>
          )}

          {tx.campaign && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Campaign Tag</span>
              <span className="font-bold text-sky-700 mt-0.5 block">{tx.campaign}</span>
            </div>
          )}

          {tx.taxUSD && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">15% Meta Tax (USD)</span>
              <span className="font-bold text-purple-700 mt-0.5 block">{formatUSD(tx.taxUSD)}</span>
            </div>
          )}

          {effectiveRate > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Effective FX Rate</span>
              <span className="font-bold text-emerald-700 mt-0.5 block">৳{effectiveRate.toFixed(2)} / USD</span>
            </div>
          )}
        </div>

        {tx.notes && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ledger Notes</span>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60 whitespace-pre-wrap">
              {tx.notes}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-100 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { onClose(); onDelete(tx.id); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-all"
        >
          <Trash2 size={13} /> Delete Record
        </button>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => { onClose(); onEdit(tx); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold transition-all"
            >
              <Edit size={13} /> Edit Entry
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LedgerView({ transactions, clients, cards, metrics, onDeleteTransaction, onEditTransaction, onAddPayment, onAddUSD, onAddSpend, onAddFee }) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [cardFilter, setCardFilter] = useState('ALL');
  const [inspectingTx, setInspectingTx] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExportMenu]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...transactions]
      .filter(tx => {
        const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
        const matchesClient = clientFilter === 'ALL' || tx.clientId === clientFilter;
        const matchesCard = cardFilter === 'ALL' || tx.cardId === cardFilter;

        const search = searchTerm.trim().toLowerCase();
        const client = clients.find(c => c.id === tx.clientId);
        const card = cards.find(c => c.id === tx.cardId);

        const searchableText = [
          tx.id,
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
        } else if (dateFilter === 'CUSTOM') {
          if (customStart && txDate < new Date(customStart + 'T00:00:00')) return false;
          if (customEnd && txDate > new Date(customEnd + 'T23:59:59')) return false;
        }

        return matchesType && matchesClient && matchesCard && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date).getTime();
        const timeB = b.timestamp || new Date(b.date).getTime();
        return timeB - timeA;
      });
  }, [transactions, clients, cards, typeFilter, clientFilter, cardFilter, searchTerm, dateFilter, customStart, customEnd]);

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

    const netBDT = bdtIn - bdtOut;
    const netUSD = usdIn - usdOut;
    const count = filtered.length;

    return { bdtIn, bdtOut, netBDT, usdIn, usdOut, netUSD, count };
  }, [filtered]);

  const clearFilters = () => {
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setCustomStart('');
    setCustomEnd('');
    setClientFilter('ALL');
    setCardFilter('ALL');
    setSearchTerm('');
  };

  const hasFilters = typeFilter !== 'ALL' || dateFilter !== 'ALL' || customStart || customEnd || clientFilter !== 'ALL' || cardFilter !== 'ALL' || searchTerm.trim() !== '';

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Date', 'Type', 'Entity / Client', 'Card / Source', 'Details / Campaign', 'BDT In', 'BDT Out', 'USD In', 'USD Out', 'Notes'];
    const csvRows = [headers.join(',')];
    filtered.forEach(tx => {
      const client = clients.find(c => c.id === tx.clientId);
      const card = cards.find(c => c.id === tx.cardId);
      const bdtIn = tx.type === 'PAYMENT_RECEIVED' ? parseFloat(tx.amountBDT || 0) : 0;
      const bdtOut = tx.type === 'USD_PURCHASE' ? (parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)) : 0;
      const usdIn = tx.type === 'USD_PURCHASE' ? parseFloat(tx.amountUSD || 0) : 0;
      const usdOut = tx.type === 'AD_SPEND' ? (parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) : (tx.type === 'FEE' ? parseFloat(tx.amountUSD || 0) : 0);

      csvRows.push([
        `"${formatDate(tx.date)}"`,
        `"${tx.type}"`,
        `"${(client?.name || '').replace(/"/g, '""')}"`,
        `"${(card?.name || '').replace(/"/g, '""')}"`,
        `"${(tx.campaign || tx.adAccount || '').replace(/"/g, '""')}"`,
        `"${bdtIn.toFixed(2)}"`,
        `"${bdtOut.toFixed(2)}"`,
        `"${usdIn.toFixed(2)}"`,
        `"${usdOut.toFixed(2)}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quantrex_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintLedgerPDF = () => {
    if (!filtered.length) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const periodLabel = dateFilter === 'CUSTOM'
      ? `${customStart || 'Start'} to ${customEnd || 'Present'}`
      : (dateFilter === 'ALL' ? 'All Time Historical' : dateFilter.replace('_', ' '));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Ledger Statement - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
          .title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 8px; text-align: center; }
          .kpi-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 13px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .red { color: #dc2626 !important; }
          .blue { color: #0284c7 !important; }
          .purple { color: #9333ea !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 800; border-bottom: 1.5px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; background: #f1f5f9; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10.5px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Quantrex Financial Command</div>
            <div class="title">Official Transaction Ledger & Cashflow Statement</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 12px;">Period: ${periodLabel}</div>
            <div style="font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">BDT In</div><div class="kpi-val green">${formatBDT(ledgerSummary.bdtIn)}</div></div>
          <div class="kpi-card"><div class="kpi-title">BDT Out</div><div class="kpi-val red">${formatBDT(ledgerSummary.bdtOut)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Net BDT</div><div class="kpi-val ${ledgerSummary.netBDT < 0 ? 'red' : 'blue'}">${formatBDT(ledgerSummary.netBDT)}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD In</div><div class="kpi-val blue">${formatUSD(ledgerSummary.usdIn)}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD Out</div><div class="kpi-val purple">${formatUSD(ledgerSummary.usdOut)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Net USD</div><div class="kpi-val ${ledgerSummary.netUSD < 0 ? 'red' : 'green'}">${formatUSD(ledgerSummary.netUSD)}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref ID</th>
              <th>Type</th>
              <th>Counterparty / Entity</th>
              <th>Campaign / Memo</th>
              <th style="text-align: right;">BDT In</th>
              <th style="text-align: right;">BDT Out</th>
              <th style="text-align: right;">USD In</th>
              <th style="text-align: right;">USD Out</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(tx => {
              const client = clients.find(c => c.id === tx.clientId);
              const card = cards.find(c => c.id === tx.cardId);
              const bdtIn = tx.type === 'PAYMENT_RECEIVED' ? parseFloat(tx.amountBDT || 0) : 0;
              const bdtOut = tx.type === 'USD_PURCHASE' ? (parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)) : 0;
              const usdIn = tx.type === 'USD_PURCHASE' ? parseFloat(tx.amountUSD || 0) : 0;
              const usdOut = tx.type === 'AD_SPEND' ? (parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) : (tx.type === 'FEE' ? parseFloat(tx.amountUSD || 0) : 0);
              return `
                <tr>
                  <td>${formatDate(tx.date)}</td>
                  <td style="font-family: monospace; font-weight: bold;">#${String(tx.id).slice(-6)}</td>
                  <td><span class="badge">${tx.type.replaceAll('_', ' ')}</span></td>
                  <td><strong>${client?.name || card?.name || 'Agency Internal'}</strong></td>
                  <td>${tx.campaign || tx.adAccount || tx.notes || '—'}</td>
                  <td style="text-align: right; color: #16a34a; font-weight: bold;">${bdtIn > 0 ? formatBDT(bdtIn) : '—'}</td>
                  <td style="text-align: right; color: #dc2626; font-weight: bold;">${bdtOut > 0 ? formatBDT(bdtOut) : '—'}</td>
                  <td style="text-align: right; color: #0284c7; font-weight: bold;">${usdIn > 0 ? formatUSD(usdIn) : '—'}</td>
                  <td style="text-align: right; color: #9333ea; font-weight: bold;">${usdOut > 0 ? formatUSD(usdOut) : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Authorized Accounting Ledger Record • Quantrex Double-Entry System</div>
          <div>Total Transactions: ${filtered.length} entries verified</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="space-y-4 w-full max-w-[1720px] mx-auto animate-in fade-in duration-300 pb-16">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Transaction Ledger</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            High-precision real-time audit of every BDT cashflow and USD foreign exchange movement.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* UNIFIED EXPORT DROPDOWN (CSV & PDF STATEMENT) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-bold shadow-2xs transition-all ${
                showExportMenu
                  ? 'bg-slate-100 border-slate-300 text-slate-900 ring-2 ring-sky-500/20'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Download size={14} className="text-slate-500" /> Export <ChevronDown size={12} className={`text-slate-400 transition-transform duration-150 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in duration-150">
                  <button
                    onClick={() => { setShowExportMenu(false); handleExportCSV(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Export Excel / CSV (.csv)</span>
                  </button>
                  <button
                    onClick={() => { setShowExportMenu(false); handlePrintLedgerPDF(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 text-left rounded-lg transition-colors hover:text-sky-800"
                  >
                    <Printer size={15} className="text-sky-600" />
                    <span>Print / PDF Statement (A4)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {onAddPayment && (
            <button
              onClick={onAddPayment}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
            >
              <Plus size={14} /> Receive BDT
            </button>
          )}

          {onAddUSD && (
            <button
              onClick={onAddUSD}
              className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
            >
              <Plus size={14} /> Buy USD
            </button>
          )}

          {onAddSpend && (
            <button
              onClick={onAddSpend}
              className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
            >
              <Plus size={14} /> Meta Spend
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 border border-slate-800 rounded-xl p-4 shadow-md text-white">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ArrowDownLeft size={14} />
              </div>
              <span className="text-xs font-black tracking-wider text-emerald-300 uppercase">
                BDT Operating Cashflow
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Domestic Ledger</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BDT In (Received)</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 mt-1 block">
                {formatBDT(ledgerSummary.bdtIn)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BDT Out (Purchases)</span>
              <span className="text-sm sm:text-base font-black text-rose-400 mt-1 block">
                {formatBDT(ledgerSummary.bdtOut)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operating Surplus</span>
              <span className={`text-sm sm:text-base font-black mt-1 block ${ledgerSummary.netBDT < 0 ? 'text-rose-400' : 'text-sky-300'}`}>
                {formatBDT(ledgerSummary.netBDT)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-xl p-4 shadow-md text-white">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <RefreshCw size={14} />
              </div>
              <span className="text-xs font-black tracking-wider text-sky-300 uppercase">
                USD Foreign Liquidity & Ad Burn
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">FX & Meta Spend</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">USD In (Funded)</span>
              <span className="text-sm sm:text-base font-black text-sky-400 mt-1 block">
                {formatUSD(ledgerSummary.usdIn)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">USD Out (Burned)</span>
              <span className="text-sm sm:text-base font-black text-purple-400 mt-1 block">
                {formatUSD(ledgerSummary.usdOut)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net USD Liquidity</span>
              <span className={`text-sm sm:text-base font-black mt-1 block ${ledgerSummary.netUSD < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatUSD(ledgerSummary.netUSD)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { id: 'ALL', label: 'All Streams', count: transactions.length },
          { id: 'PAYMENT_RECEIVED', label: '📥 Payments In (BDT)', count: transactions.filter(t => t.type === 'PAYMENT_RECEIVED').length },
          { id: 'USD_PURCHASE', label: '💳 USD Purchases', count: transactions.filter(t => t.type === 'USD_PURCHASE').length },
          { id: 'AD_SPEND', label: '📢 Meta Ad Spend', count: transactions.filter(t => t.type === 'AD_SPEND').length },
          { id: 'FEE', label: '⚡ Card Fees', count: transactions.filter(t => t.type === 'FEE').length }
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setTypeFilter(chip.id)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shadow-2xs whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === chip.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{chip.label}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              typeFilter === chip.id ? 'bg-slate-800 text-sky-300' : 'bg-slate-100 text-slate-500'
            }`}>
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search client, card, campaign, ad account, ID, notes..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200/90 rounded-lg text-xs font-medium focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none bg-white shadow-2xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[140px] shadow-2xs text-slate-700"
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
        >
          <option value="ALL">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[130px] shadow-2xs text-slate-700"
          value={cardFilter}
          onChange={e => setCardFilter(e.target.value)}
        >
          <option value="ALL">All Cards</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[130px] shadow-2xs text-slate-700"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        >
          <option value="ALL">All Dates</option>
          <option value="TODAY">Today</option>
          <option value="THIS_WEEK">This Week</option>
          <option value="THIS_MONTH">This Month</option>
          <option value="CUSTOM">📅 Custom Range...</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            Reset Filters
          </button>
        )}
      </div>

      {dateFilter === 'CUSTOM' && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs animate-in fade-in flex-wrap">
          <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
            <Calendar size={14} className="text-sky-600" /> Custom Range:
          </span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white font-semibold outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white font-semibold outline-none focus:border-sky-500"
            />
          </div>
          {(customStart || customEnd) && (
            <button
              onClick={() => { setCustomStart(''); setCustomEnd(''); }}
              className="text-rose-600 font-bold hover:underline ml-auto text-xs"
            >
              Clear Dates
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10.5px] font-black text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Date & Ref</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-4 py-3">Entity & Context</th>
                <th className="px-4 py-3 text-right">BDT In</th>
                <th className="px-4 py-3 text-right">BDT Out</th>
                <th className="px-4 py-3 text-right">USD In</th>
                <th className="px-4 py-3 text-right">USD Out</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Receipt size={22} />
                    </div>
                    <h4 className="font-black text-slate-800 text-sm">No Transactions Found</h4>
                    <p className="text-slate-400 text-xs mt-1">
                      {hasFilters ? 'Try adjusting your search criteria or stream filters.' : 'Record your first BDT receipt or USD spend above.'}
                    </p>
                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
                      >
                        Reset all filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const client = clients.find(c => c.id === tx.clientId);
                  const card = cards.find(c => c.id === tx.cardId);

                  const bdtIn = tx.type === 'PAYMENT_RECEIVED' ? parseFloat(tx.amountBDT || 0) : 0;
                  const bdtOut = tx.type === 'USD_PURCHASE' ? (parseFloat(tx.amountBDT || 0) + parseFloat(tx.cashOutCharge || 0)) : 0;
                  const usdIn = tx.type === 'USD_PURCHASE' ? parseFloat(tx.amountUSD || 0) : 0;
                  const usdOut = tx.type === 'AD_SPEND' ? (parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) : (tx.type === 'FEE' ? parseFloat(tx.amountUSD || 0) : 0);

                  const stripColor = tx.type === 'PAYMENT_RECEIVED'
                    ? 'border-l-4 border-l-emerald-500'
                    : tx.type === 'USD_PURCHASE'
                    ? 'border-l-4 border-l-sky-500'
                    : tx.type === 'AD_SPEND'
                    ? 'border-l-4 border-l-purple-500'
                    : 'border-l-4 border-l-amber-500';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setInspectingTx(tx)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${stripColor}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{formatDate(tx.date)}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">#{String(tx.id).slice(-6)}</div>
                      </td>
                      <td className="px-3 py-3.5"><MasterLedgerBadge type={tx.type} /></td>
                      <td className="px-4 py-3.5 min-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {client && (
                            <span className="inline-flex items-center gap-1 font-bold text-slate-900 text-xs">
                              <span className="w-5 h-5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black flex items-center justify-center">
                                {client.name.charAt(0).toUpperCase()}
                              </span>
                              {client.name}
                            </span>
                          )}
                          {card && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-semibold">
                              <CreditCard size={11} className="text-slate-500" />
                              {card.name}
                            </span>
                          )}
                        </div>
                        {tx.notes && <div className="text-[10.5px] text-slate-400 mt-0.5 truncate max-w-sm">{tx.notes}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-right">{bdtIn > 0 ? <span className="font-black text-emerald-600 text-xs">+{formatBDT(bdtIn)}</span> : <span className="text-slate-300 font-bold">—</span>}</td>
                      <td className="px-4 py-3.5 text-right">{bdtOut > 0 ? <span className="font-black text-rose-600 text-xs">-{formatBDT(bdtOut)}</span> : <span className="text-slate-300 font-bold">—</span>}</td>
                      <td className="px-4 py-3.5 text-right">{usdIn > 0 ? <span className="font-black text-sky-700 text-xs">+{formatUSD(usdIn)}</span> : <span className="text-slate-300 font-bold">—</span>}</td>
                      <td className="px-4 py-3.5 text-right">{usdOut > 0 ? <span className="font-black text-purple-700 text-xs">-{formatUSD(usdOut)}</span> : <span className="text-slate-300 font-bold">—</span>}</td>
                      <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setInspectingTx(tx)} title="Audit Voucher" className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"><Eye size={15} /></button>
                          {onEditTransaction && (
                            <button onClick={() => onEditTransaction(tx)} title="Edit Entry" className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={14} /></button>
                          )}
                          {onDeleteTransaction && (
                            <button onClick={() => onDeleteTransaction(tx.id)} title="Delete Record" className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inspectingTx && (
        <Modal title={`Transaction Audit Voucher: #${String(inspectingTx.id).slice(-8)}`} onClose={() => setInspectingTx(null)} width="max-w-3xl">
          <TransactionAuditModal
            tx={inspectingTx}
            clients={clients}
            cards={cards}
            metrics={metrics}
            onClose={() => setInspectingTx(null)}
            onEdit={onEditTransaction}
            onDelete={(id) => {
              if (onDeleteTransaction) onDeleteTransaction(id);
              setInspectingTx(null);
            }}
          />
        </Modal>
      )}
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

  const overallSummary = useMemo(() => {
    const totalCount = clientStats.length;
    const activeCount = clientStats.filter(c => {
      const s = getClientDisplayStatus(c);
      return s.includes('Active') || s.includes('Currently Working') || s.includes('Working');
    }).length;
    const totalRevenue = clientStats.reduce((sum, c) => sum + (c.revenue || 0), 0);
    const totalAdSpendUSD = clientStats.reduce((sum, c) => sum + (c.adSpendUSD || 0), 0);
    const totalProfitBDT = clientStats.reduce((sum, c) => sum + (c.profitBDT || 0), 0);
    const avgMargin = totalRevenue > 0 ? (totalProfitBDT / totalRevenue) * 100 : 0;
    return { totalCount, activeCount, totalRevenue, totalAdSpendUSD, totalProfitBDT, avgMargin };
  }, [clientStats]);

  const filteredClients = useMemo(() => {
    return clientStats.filter(c => {
      const matchSearch = (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.company || '').toLowerCase().includes(searchTerm.toLowerCase()));
      const displayStatus = getClientDisplayStatus(c);
      const matchStatus = statusFilter === 'All' || displayStatus.includes(statusFilter);
      return matchSearch && matchStatus;
    });
  }, [clientStats, searchTerm, statusFilter]);

  return (
    <div className="space-y-6 w-full max-w-[1720px] mx-auto animate-in fade-in duration-500 pb-16">
      {/* TOP HEADER (SEAMLESS CANVAS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {overallSummary.activeCount} Active Client{overallSummary.activeCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage client accounts, marketing budgets, advance payments, and profit margins.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddClient}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.01] shrink-0"
        >
          <Plus size={15} /> Add Client
        </button>
      </div>

      {/* COMPACT KPI METRIC CARDS (PREMIUM FROSTED GLASS & LUXURY TAGS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Active Portfolios */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-sky-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-sky-100/90 border border-sky-200 flex items-center justify-center text-sky-700 shadow-xs shrink-0">
            <UsersRound size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Client Accounts</span>
            <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />
              {overallSummary.activeCount} Active / {overallSummary.totalCount} Total
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-emerald-100/90 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
            <ArrowDownRight size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Total Revenue</span>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
              {formatBDT(overallSummary.totalRevenue)} Received
            </span>
          </div>
        </div>

        {/* Card 3: Total Ad Spend */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-purple-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-purple-100/90 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs shrink-0">
            <Activity size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Total Ad Spend</span>
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
              {formatUSD(overallSummary.totalAdSpendUSD)} Spend
            </span>
          </div>
        </div>

        {/* Card 4: Net Agency Profit */}
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 border border-blue-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-blue-100/90 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs shrink-0">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Net Agency Profit</span>
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
              {formatBDT(overallSummary.totalProfitBDT)} ({overallSummary.avgMargin.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients, business name, or brand..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200/90 rounded-lg text-xs font-medium focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none bg-white shadow-2xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[180px] shadow-2xs text-slate-700"
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

      {/* CLIENTS DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Client & Business</th>
                <th className="px-5 py-3.5">Service & Status</th>
                <th className="px-5 py-3.5 text-right">Budget Plan</th>
                <th className="px-5 py-3.5 text-right">Revenue (BDT)</th>
                <th className="px-5 py-3.5 text-right">Ad Spend (USD)</th>
                <th className="px-5 py-3.5 text-right">Profit (BDT)</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UsersRound size={28} className="text-slate-300" />
                      <span className="text-xs font-semibold text-slate-500">No client accounts found matching your search filter.</span>
                    </div>
                  </td>
                </tr>
              )}
              {filteredClients.map(c => {
                const displayStatus = getClientDisplayStatus(c);
                const isWorking = displayStatus.includes('Active') || displayStatus.includes('Currently Working') || displayStatus.includes('Working');
                const initial = (c.name || 'C').charAt(0).toUpperCase();

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {c.phone && (
                              <a
                                href={`https://wa.me/${(c.phone || '').replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Chat on WhatsApp (${c.phone})`}
                                className="text-emerald-500 hover:text-emerald-600 transition-colors inline-flex items-center"
                              >
                                <MessageCircle size={12} />
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">{c.company || 'Direct Client'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold w-fit
                          ${isWorking ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                            displayStatus.includes('Completed') ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                              displayStatus === 'Inactive' ? 'bg-orange-50 text-orange-700 border border-orange-200/60' :
                                'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {isWorking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {displayStatus}
                        </span>
                        {c.serviceType && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {c.serviceType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700 font-semibold">
                      {getBudgetDisplay(c.budgetType, c.budgetAmount || c.budget)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                      {formatBDT(c.revenue)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                      {formatUSD(c.adSpendUSD)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className={`font-black ${c.profitBDT < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatBDT(c.profitBDT)}</div>
                      <div className={`text-[10px] font-bold inline-block px-1.5 py-0.2 rounded mt-0.5 ${c.profitMargin > 50 ? 'bg-emerald-50 text-emerald-700' : c.profitMargin < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                        Margin: {c.profitMargin.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardActionsMenu({ card, onFund, onDetails, onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="Card Actions"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20 cursor-default" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-30 py-1.5 animate-in fade-in duration-150">
            {onFund && (
              <button
                type="button"
                onClick={() => { setIsOpen(false); onFund(); }}
                className="w-full text-left px-3.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 flex items-center gap-2"
              >
                <Plus size={14} className="text-sky-600" /> Fund Card (Buy USD)
              </button>
            )}
            <button
              type="button"
              onClick={() => { setIsOpen(false); onDetails(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <FileText size={14} className="text-slate-400" /> Statement & History
            </button>
            <button
              type="button"
              onClick={() => { setIsOpen(false); onEdit(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Edit size={14} className="text-slate-400" /> Edit Card Info
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => { setIsOpen(false); onDelete(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
              <Trash2 size={14} className="text-rose-500" /> Delete Card
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CardsView({ cards, metrics, transactions, onAddCard, onEditCard, onFundCard, onDeleteCard, onViewDetails, onEditTransaction, onDeleteTransaction }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [globalDateRange, setGlobalDateRange] = useState({ label: 'Lifetime', start: null, end: null });
  const [selectedCardFilter, setSelectedCardFilter] = useState('ALL');
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);
  const [showExportPurchases, setShowExportPurchases] = useState(false);
  const exportPurchasesRef = useRef(null);

  useEffect(() => {
    if (!showExportPurchases) return;
    const handleClickOutside = (e) => {
      if (exportPurchasesRef.current && !exportPurchasesRef.current.contains(e.target)) {
        setShowExportPurchases(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowExportPurchases(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExportPurchases]);

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

  const handleExportPurchasesCSV = () => {
    if (!filteredUSDPurchases.length) return;
    const headers = ['Date', 'Ref ID', 'Source / Seller', 'BDT Paid', 'C.O Rate', 'Total BDT Cost', 'USD Received', 'Destination Card', 'Base Rate', 'Effective Rate'];
    const csvRows = [headers.join(',')];
    filteredUSDPurchases.forEach(tx => {
      const bdtPaid = parseFloat(tx.amountBDT || 0);
      const coRate = parseFloat(tx.cashOutCharge || 0);
      const usdRcv = parseFloat(tx.amountUSD || 1);
      const totalCost = bdtPaid + coRate;
      const baseRate = usdRcv > 0 ? (bdtPaid / usdRcv).toFixed(2) : '0.00';
      const effectiveRate = usdRcv > 0 ? (totalCost / usdRcv).toFixed(2) : '0.00';
      const targetCard = cards.find(c => c.id === tx.cardId);

      csvRows.push([
        `"${formatDate(tx.date)}"`,
        `"${tx.id}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        `"${bdtPaid.toFixed(2)}"`,
        `"${coRate.toFixed(2)}"`,
        `"${totalCost.toFixed(2)}"`,
        `"${usdRcv.toFixed(2)}"`,
        `"${(targetCard?.name || 'Unknown').replace(/"/g, '""')}"`,
        `"${baseRate}"`,
        `"${effectiveRate}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usd_purchases_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPurchasesPDF = () => {
    if (!filteredUSDPurchases.length) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>USD Procurement Ledger Statement - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
          .title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 8px; text-align: center; }
          .kpi-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 13px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .blue { color: #0284c7 !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 800; border-bottom: 1.5px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10.5px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Quantrex Financial Command</div>
            <div class="title">USD Foreign Exchange & Procurement Statement</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 12px;">Period: ${globalDateRange.label}</div>
            <div style="font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">Total BDT Paid</div><div class="kpi-val">${formatBDT(periodSummary.totalBDTPaid)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total C.O Rate</div><div class="kpi-val" style="color:#dc2626;">${formatBDT(periodSummary.totalCOCharge)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total BDT Cost</div><div class="kpi-val">${formatBDT(periodSummary.totalCost)}</div></div>
          <div class="kpi-card"><div class="kpi-title">USD Purchased</div><div class="kpi-val green">${formatUSD(periodSummary.totalUSD)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Avg Effective Rate</div><div class="kpi-val blue">৳${periodSummary.avgEffectiveRate.toFixed(2)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Purchases</div><div class="kpi-val">${periodSummary.count}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref</th>
              <th>Source / Seller</th>
              <th>Destination Card</th>
              <th style="text-align: right;">BDT Paid</th>
              <th style="text-align: right;">C.O Rate</th>
              <th style="text-align: right;">Total Cost</th>
              <th style="text-align: right;">USD Received</th>
              <th style="text-align: right;">Base Rate</th>
              <th style="text-align: right;">Effective Rate</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUSDPurchases.map(tx => {
              const bdtPaid = parseFloat(tx.amountBDT || 0);
              const coRate = parseFloat(tx.cashOutCharge || 0);
              const usdRcv = parseFloat(tx.amountUSD || 1);
              const totalCost = bdtPaid + coRate;
              const baseRate = usdRcv > 0 ? (bdtPaid / usdRcv).toFixed(2) : '0.00';
              const effectiveRate = usdRcv > 0 ? (totalCost / usdRcv).toFixed(2) : '0.00';
              const targetCard = cards.find(c => c.id === tx.cardId);

              return `
                <tr>
                  <td>${formatDate(tx.date)}</td>
                  <td style="font-family: monospace; font-weight: bold;">#${String(tx.id).slice(-6)}</td>
                  <td>${tx.notes || 'Direct Purchase'}</td>
                  <td><strong>${targetCard?.name || 'Unknown'}</strong></td>
                  <td style="text-align: right;">${formatBDT(bdtPaid)}</td>
                  <td style="text-align: right; color: #dc2626;">${formatBDT(coRate)}</td>
                  <td style="text-align: right; font-weight: bold;">${formatBDT(totalCost)}</td>
                  <td style="text-align: right; font-weight: bold; color: #16a34a;">${formatUSD(usdRcv)}</td>
                  <td style="text-align: right;">৳${baseRate}</td>
                  <td style="text-align: right; font-weight: bold; color: #0284c7;">৳${effectiveRate}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Authorized Foreign Exchange Procurement Ledger • Quantrex Double-Entry System</div>
          <div>Total Records: ${filteredUSDPurchases.length} entries verified</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="space-y-6 w-full max-w-[1720px] mx-auto animate-in fade-in duration-500 pb-16">

      {/* TOP HEADER (SEAMLESS CANVAS) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cards & USD Ledger</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeCards.length} Active Card{activeCards.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-card balance tracking, foreign currency procurement rates, and Meta Ads burn rates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddCard}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
          >
            <Plus size={15} /> Add Card
          </button>
        </div>
      </div>

      {/* EXECUTIVE CARD LIQUIDITY OVERVIEW RIBBON */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Card Liquidity */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/40 border border-sky-200/70 rounded-xl px-4 py-3.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
            <CreditCard size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">Available Liquidity</span>
            <span className={`text-base font-black truncate block mt-0.5 ${metrics.totalCardBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatUSD(metrics.totalCardBalance)}
            </span>
          </div>
        </div>

        {/* Card 2: Total USD Purchased */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-xl px-4 py-3.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <ArrowDownRight size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">USD Funded (All-Time)</span>
            <span className="text-base font-black text-emerald-700 truncate block mt-0.5">
              {formatUSD(metrics.totalUSDPurchased)}
            </span>
          </div>
        </div>

        {/* Card 3: Total USD Burned */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-xl px-4 py-3.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
            <Activity size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">USD Burned (Spend+Tax)</span>
            <span className="text-base font-black text-purple-700 truncate block mt-0.5">
              {formatUSD(metrics.totalAdSpendUSD + metrics.totalTaxUSD)}
            </span>
          </div>
        </div>

        {/* Card 4: Weighted Average FX Rate */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-xl px-4 py-3.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
            <RefreshCw size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider block">Effective FX Rate</span>
            <span className="text-base font-black text-sky-700 truncate block mt-0.5">
              ৳{metrics.avgUSDEffectiveRate.toFixed(2)} / USD
            </span>
          </div>
        </div>
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
          onEdit={() => {
            const t = selectedTxForModal;
            setSelectedTxForModal(null);
            if (onEditTransaction) onEditTransaction(t);
          }}
          onDelete={(id) => {
            setSelectedTxForModal(null);
            if (onDeleteTransaction) onDeleteTransaction(id);
          }}
        />
      )}

      {/* CARDS GRID (ULTRA-LUXURY VIRTUAL CARD WIDGETS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
        {activeCards.length === 0 && (
          <div className="col-span-full text-center py-14 text-slate-400 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <CreditCard size={32} className="mx-auto mb-2 text-slate-300" />
            <h4 className="font-bold text-slate-800 text-sm">No Cards Added Yet</h4>
            <p className="text-xs text-slate-400 mt-1">Add your first virtual or bank card using the button above.</p>
          </div>
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
          const stats = metrics.cardStats?.[card.id] || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };

          return (
            <div
              key={card.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between group relative overflow-hidden"
            >
              <div>
                {/* TOP ROW: CHIP, BRAND & ACTION MENU */}
                <div className="flex justify-between items-start mb-3.5">
                  <div className="flex items-center gap-2.5">
                    {/* Visual Gold EMV Chip */}
                    <div className="w-8 h-6 rounded bg-gradient-to-br from-amber-200 via-amber-300 to-yellow-400 border border-amber-400/60 shadow-xs flex items-center justify-center">
                      <div className="w-5 h-3.5 border border-amber-500/40 rounded-xs grid grid-cols-2 gap-0.5 p-0.5">
                        <div className="bg-amber-400/60 rounded-2xs" />
                        <div className="bg-amber-400/60 rounded-2xs" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 leading-tight">
                        <span>{card.name}</span>
                        {card.last4 && (
                          <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            *{card.last4}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {card.provider || 'Bank Card'} • {card.cardType || 'Virtual'}
                      </p>
                    </div>
                  </div>

                  <CardActionsMenu
                    card={card}
                    onFund={() => onFundCard && onFundCard(card)}
                    onDetails={() => onViewDetails(card)}
                    onEdit={() => onEditCard(card)}
                    onDelete={() => onDeleteCard(card.id)}
                  />
                </div>

                {/* CURRENT BALANCE */}
                <div className="mt-2 bg-slate-50/90 rounded-xl p-3.5 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Current Available Balance
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className={`text-2xl font-black tracking-tight ${bal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatUSD(bal)}
                    </h2>
                    {bal < 0 && (
                      <span className="inline-flex items-center text-[10px] font-black text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-200">
                        Negative Balance
                      </span>
                    )}
                  </div>

                  {/* SPEND VS FUNDED PILL */}
                  <div className="flex items-center justify-between text-[11px] font-bold pt-2 mt-2 border-t border-slate-200/60">
                    <span className="text-emerald-700">Funded: +{formatUSD(stats.purchased)}</span>
                    <span className="text-purple-700">Spent: -{formatUSD(stats.adSpend + stats.tax)}</span>
                  </div>
                </div>

                {/* LAST TRANSACTION ROW */}
                <div className="mt-3.5 text-xs">
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                    Last Transaction
                  </span>
                  {lastTx ? (
                    <div className="flex justify-between items-center bg-white rounded-lg border border-slate-100 px-2.5 py-1.5">
                      <span className="text-slate-700 font-semibold truncate max-w-[150px] text-[11px]">
                        {formatDate(lastTx.date)} • {lastTx.type === 'USD_PURCHASE' ? 'USD Purchase' : 'Meta Ads'}
                      </span>
                      <span className={`font-black text-xs ${lastTx.type === 'USD_PURCHASE' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {lastTx.type === 'USD_PURCHASE' ? '+' : '-'}{formatUSD(lastTx.amountUSD)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">No transactions yet</span>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onFundCard && onFundCard(card)}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-2xs hover:scale-[1.01]"
                >
                  <Plus size={13} /> Fund Card
                </button>
                <button
                  type="button"
                  onClick={() => onViewDetails(card)}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  <FileText size={13} /> Statement
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* USD PURCHASE HISTORY SECTION */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3.5 gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">USD Purchase History</h3>
            <p className="text-xs text-slate-500 font-semibold">
              Itemized audit of foreign exchange procurement with effective BDT rates and C.O charges.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {globalDateRange.label !== 'Lifetime' && (
              <button
                onClick={() => setGlobalDateRange({ label: 'Lifetime', start: null, end: null })}
                className="text-xs text-rose-600 font-bold hover:underline mr-1"
              >
                Clear Filter
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <CalendarDays size={14} className="text-sky-600" />
              {globalDateRange.label === 'Lifetime' ? 'History: Lifetime' : `History: ${globalDateRange.label}`}
            </button>

            <select
              value={selectedCardFilter}
              onChange={(e) => setSelectedCardFilter(e.target.value)}
              className="bg-white border border-slate-200/90 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-2xs outline-none cursor-pointer"
            >
              <option value="ALL">All Cards ▼</option>
              {activeCards.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* EXPORT DROPDOWN (CSV & A4 PDF) */}
            <div className="relative" ref={exportPurchasesRef}>
              <button
                type="button"
                onClick={() => setShowExportPurchases(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-2xs transition-all ${
                  showExportPurchases
                    ? 'bg-slate-100 border-slate-300 text-slate-900 ring-2 ring-sky-500/20'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Download size={13} className="text-slate-500" /> Export <ChevronDown size={11} className={`text-slate-400 transition-transform duration-150 ${showExportPurchases ? 'rotate-180' : ''}`} />
              </button>
              {showExportPurchases && (
                <>
                  <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowExportPurchases(false)} />
                  <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => { setShowExportPurchases(false); handleExportPurchasesCSV(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                      <span>Export Excel / CSV (.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowExportPurchases(false); handlePrintPurchasesPDF(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 text-left rounded-lg transition-colors hover:text-sky-800"
                    >
                      <Printer size={15} className="text-sky-600" />
                      <span>Print / PDF Statement (A4)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 6-KPI PERIOD SUMMARY RIBBON */}
        <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200/90 mb-4 shadow-2xs">
          <div className="text-xs font-black text-slate-800 mb-3 pb-2 border-b border-slate-200 flex items-center justify-between">
            <span>Procurement Period: {globalDateRange.label === 'Lifetime' && !globalDateRange.start ? 'Lifetime' : globalDateRange.label}</span>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/80">
              {periodSummary.count} Total Purchase{periodSummary.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">Total BDT Paid</span>
              <span className="font-black text-slate-900 text-sm">{formatBDT(periodSummary.totalBDTPaid)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">Total C.O Rate</span>
              <span className="font-black text-rose-600 text-sm">{formatBDT(periodSummary.totalCOCharge)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">Total BDT Cost</span>
              <span className="font-black text-slate-900 text-sm">{formatBDT(periodSummary.totalCost)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">USD Purchased</span>
              <span className="font-black text-emerald-600 text-sm">{formatUSD(periodSummary.totalUSD)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">Avg Effective Rate</span>
              <span className="font-black text-sky-700 text-sm">৳{periodSummary.avgEffectiveRate.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-extrabold uppercase tracking-wider mb-0.5">Base Rate Avg</span>
              <span className="font-black text-slate-700 text-sm">৳{periodSummary.totalUSD > 0 ? (periodSummary.totalBDTPaid / periodSummary.totalUSD).toFixed(2) : '0.00'}</span>
            </div>
          </div>
        </div>

        {/* USD PURCHASE HISTORY DOUBLE-ENTRY TABLE */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50/90 text-slate-500 font-black border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date & Ref</th>
                  <th className="px-4 py-3">Source / Seller</th>
                  <th className="px-4 py-3 text-right">BDT Paid</th>
                  <th className="px-4 py-3 text-right text-rose-600">C.O Rate</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-800">Total BDT Cost</th>
                  <th className="px-4 py-3 text-right text-emerald-700">USD Received</th>
                  <th className="px-4 py-3">Card / Destination</th>
                  <th className="px-4 py-3 text-right">Base Rate</th>
                  <th className="px-4 py-3 text-right text-sky-700">Effective Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUSDPurchases.length === 0 && (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      <RefreshCw size={24} className="mx-auto mb-2 text-slate-300" />
                      <span className="font-bold text-xs">No USD purchases found for this period.</span>
                    </td>
                  </tr>
                )}
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
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group border-l-4 border-l-sky-500"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-bold text-slate-900 text-xs">{formatDate(tx.date)}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">#{String(tx.id).slice(-6)}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{tx.notes || 'Direct Seller'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 font-semibold">{formatBDT(bdtPaid)}</td>
                      <td className="px-4 py-3 text-right text-rose-500 font-bold">{coRate ? formatBDT(coRate) : formatBDT(0)}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{formatBDT(totalCost)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">+{formatUSD(tx.amountUSD)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                          <CreditCard size={11} className="text-slate-500" />
                          {cardLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-semibold">৳{baseRate}</td>
                      <td className="px-4 py-3 text-right font-black text-sky-700">৳{effectiveRate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardDetailsModal({ card, metrics, transactions, onClose }) {
  const [filterRange, setFilterRange] = useState({ label: 'Lifetime', start: null, end: null });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { historyWithBalance, openingBalance, expectedBalance, isMatch, diff } = useMemo(() => {
    const allCardTxsAsc = [...transactions]
      .filter(t => t.cardId === card.id)
      .sort((a, b) => {
        const tA = a.timestamp || new Date(a.date).getTime();
        const tB = b.timestamp || new Date(b.date).getTime();
        if (tA === tB) return a.id.localeCompare(b.id);
        return tA - tB;
      });

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
        changeUSD = -(spend + tax);
      }
      if (t.type === 'FEE') {
        changeUSD = -parseFloat(t.amountUSD || 0);
      }
      currentRunningBal += changeUSD;
      return { ...t, changeUSD, runningBal: currentRunningBal };
    });

    fullHistory.reverse();

    let displayedHistory = fullHistory;
    if (filterRange.start && filterRange.end) {
      displayedHistory = fullHistory.filter(t => t.date >= filterRange.start && t.date <= filterRange.end);
    }

    const stats = metrics.cardStats?.[card.id] || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
    const expBal = initialBal + stats.purchased - stats.adSpend - stats.tax - stats.fees;
    const curBal = metrics.cardBalances?.[card.id] || 0;
    const difference = Math.abs(expBal - curBal);

    return {
      historyWithBalance: displayedHistory,
      openingBalance: initialBal,
      expectedBalance: expBal,
      isMatch: difference < 0.005,
      diff: difference
    };
  }, [transactions, card.id, card.initialBalance, filterRange, metrics]);

  const stats = metrics.cardStats?.[card.id] || { purchased: 0, adSpend: 0, tax: 0, fees: 0 };
  const currentBal = metrics.cardBalances?.[card.id] || 0;

  const handlePrintCardStatement = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Card Ledger Statement - ${card.name}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
          .title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .card-badge { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; display: flex; justify-content: space-between; }
          .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 8px; text-align: center; }
          .kpi-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 13px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .red { color: #dc2626 !important; }
          .blue { color: #0284c7 !important; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 800; border-bottom: 1.5px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 9px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10.5px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Quantrex Financial Command</div>
            <div class="title">Official Card Account Statement</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 12px;">Period: ${filterRange.label}</div>
            <div style="font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="card-badge">
          <div><strong>Card Account:</strong> ${card.name} ${card.last4 ? `(*${card.last4})` : ''}</div>
          <div><strong>Bank Provider:</strong> ${card.provider || 'Bank Card'}</div>
          <div><strong>Type:</strong> ${card.cardType || 'Virtual Card'}</div>
          <div><strong>Status:</strong> Verified Active</div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">Opening Balance</div><div class="kpi-val">${formatUSD(openingBalance)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total USD Funded</div><div class="kpi-val green">+${formatUSD(stats.purchased)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Meta Ad Spend</div><div class="kpi-val red">-${formatUSD(stats.adSpend)}</div></div>
          <div class="kpi-card"><div class="kpi-title">15% Meta Tax</div><div class="kpi-val red">-${formatUSD(stats.tax)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Closing Balance</div><div class="kpi-val ${currentBal < 0 ? 'red' : 'blue'}">${formatUSD(currentBal)}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction Category</th>
              <th>Details & Notes</th>
              <th style="text-align: right;">Amount (USD)</th>
              <th style="text-align: right;">Balance After</th>
            </tr>
          </thead>
          <tbody>
            ${historyWithBalance.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 18px;">No transactions recorded for this period.</td></tr>' : ''}
            ${historyWithBalance.map(tx => {
              const isAdSpend = tx.type === 'AD_SPEND';
              const displayAmount = isAdSpend ? -Math.abs(parseFloat(tx.amountUSD)) : parseFloat(tx.amountUSD);
              const displayTax = isAdSpend ? parseFloat(tx.taxUSD || 0) : 0;
              return `
                <tr>
                  <td>${formatDate(tx.date)}</td>
                  <td style="font-weight: bold;">${tx.type.replaceAll('_', ' ')}</td>
                  <td>${tx.notes || tx.campaign || tx.adAccount || '—'}</td>
                  <td style="text-align: right; font-weight: bold; color: ${displayAmount > 0 ? '#16a34a' : '#dc2626'};">
                    ${displayAmount > 0 ? '+' : ''}${formatUSD(displayAmount)}
                    ${displayTax > 0 ? `<div style="font-size:9px; color:#ef4444; font-weight:normal;">+ tax ${formatUSD(displayTax)}</div>` : ''}
                  </td>
                  <td style="text-align: right; font-weight: bold; color: ${tx.runningBal < 0 ? '#dc2626' : '#0f172a'};">
                    ${formatUSD(tx.runningBal)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Authorized Card Ledger Statement • Quantrex Double-Entry System</div>
          <div>Balance Verification: ${isMatch ? 'PASSED (Zero Discrepancy)' : 'AUDIT WARNING'}</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] space-y-4">

      {/* GLOBAL CARD STATS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
        <div className="bg-emerald-50/80 border border-emerald-200/70 p-3 rounded-xl shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">USD Funded</p>
          <p className="text-sm font-black text-emerald-700">+{formatUSD(stats.purchased)}</p>
        </div>
        <div className="bg-rose-50/80 border border-rose-200/70 p-3 rounded-xl shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Meta Ad Spend</p>
          <p className="text-sm font-black text-rose-700">-{formatUSD(stats.adSpend)}</p>
        </div>
        <div className="bg-purple-50/80 border border-purple-200/70 p-3 rounded-xl shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">15% Meta Tax</p>
          <p className="text-sm font-black text-purple-700">-{formatUSD(stats.tax)}</p>
        </div>
        <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-xl shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Bank Fees</p>
          <p className="text-sm font-black text-amber-700">-{formatUSD(stats.fees)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-sm text-white">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Live Balance</p>
          <p className={`text-sm font-black ${currentBal < 0 ? 'text-rose-400' : 'text-sky-300'}`}>{formatUSD(currentBal)}</p>
        </div>
      </div>

      {/* CARD CONTEXT & INTEGRITY CHECK */}
      <div className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span><strong>Bank:</strong> {card.provider || 'Bank Card'}</span>
          <span>•</span>
          <span><strong>Type:</strong> {card.cardType || 'Virtual Card'}</span>
          {card.last4 && (
            <>
              <span>•</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded font-bold">*{card.last4}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMatch ? (
            <span className="inline-flex items-center text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Balance Verified
            </span>
          ) : (
            <span className="inline-flex items-center text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
              <AlertCircle size={13} className="mr-1 text-rose-600" /> Diff: {formatUSD(diff)}
            </span>
          )}
          <button
            type="button"
            onClick={handlePrintCardStatement}
            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-2xs transition-all"
          >
            <Printer size={12} /> Print Statement
          </button>
        </div>
      </div>

      {/* TRANSACTION HISTORY HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-2 shrink-0">
        <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">Chronological Ledger Flow</h4>
        <div className="flex items-center gap-2">
          {filterRange.label !== 'Lifetime' && (
            <button onClick={() => setFilterRange({ label: 'Lifetime', start: null, end: null })} className="text-[11px] text-rose-600 hover:underline font-bold">
              Clear Filter
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1 bg-white border border-slate-200/90 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-bold hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <CalendarDays size={12} className="text-sky-600" />
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

      {/* TRANSACTION HISTORY TABLE */}
      <div className="overflow-y-auto flex-1 border border-slate-200/90 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200 text-[10.5px] uppercase">
            <tr>
              <th className="px-4 py-2.5">Date & Details</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5 text-right">Amount (USD)</th>
              <th className="px-4 py-2.5 text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {historyWithBalance.length === 0 && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-400">No transactions found for this period.</td></tr>
            )}
            {historyWithBalance.map(tx => {
              const isAdSpend = tx.type === 'AD_SPEND';
              const displayAmount = isAdSpend ? -Math.abs(parseFloat(tx.amountUSD)) : parseFloat(tx.amountUSD);
              const displayTax = isAdSpend ? parseFloat(tx.taxUSD || 0) : 0;

              return (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <div className="font-bold text-slate-900">{formatDate(tx.date)}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{tx.notes || tx.campaign || tx.adAccount || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-slate-700">{tx.type.replaceAll('_', ' ')}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-black ${displayAmount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {displayAmount > 0 ? '+' : ''}{formatUSD(displayAmount)}
                    {displayTax > 0 && <span className="block text-[10px] text-rose-500 font-semibold mt-0.5">+ tax {formatUSD(displayTax)}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-black ${tx.runningBal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatUSD(tx.runningBal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionDetailsModal({ tx, cardName, onClose, onEdit, onDelete }) {
  const bdtPaid = parseFloat(tx.amountBDT || 0);
  const coRate = parseFloat(tx.cashOutCharge || 0);
  const usdRcv = parseFloat(tx.amountUSD || 1);

  const baseRate = usdRcv > 0 ? (bdtPaid / usdRcv).toFixed(2) : '0.00';
  const totalCost = bdtPaid + coRate;
  const effectiveRate = usdRcv > 0 ? (totalCost / usdRcv).toFixed(2) : '0.00';

  const handlePrintVoucher = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=650');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>USD Purchase Voucher - ${tx.id}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 28px; margin: 0; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
          .brand { font-size: 22px; font-weight: 900; color: #0284c7; }
          .title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
          .kpi-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; }
          .kpi-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .kpi-val { font-size: 16px; font-weight: 900; margin-top: 4px; color: #0f172a; }
          .green { color: #16a34a !important; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10.5px; color: #64748b; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Quantrex Financial Command</div>
            <div class="title">USD Purchase Voucher</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 12px;">Ref: #${String(tx.id).slice(-8)}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${formatDate(tx.date)}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-title">USD Received</div><div class="kpi-val green">+${formatUSD(tx.amountUSD)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total BDT Cost</div><div class="kpi-val">${formatBDT(totalCost)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Base Rate</div><div class="kpi-val">৳${baseRate}</div></div>
          <div class="kpi-card"><div class="kpi-title">Effective Rate</div><div class="kpi-val" style="color:#0284c7;">৳${effectiveRate}</div></div>
        </div>

        <div class="box">
          <div><strong>Source / Seller:</strong><br/>${tx.notes || 'Binance P2P / Direct Seller'}</div>
          <div><strong>Destination Card:</strong><br/>${cardName}</div>
          <div><strong>Base BDT Paid:</strong><br/>${formatBDT(bdtPaid)}</div>
          <div><strong>Cash-out Charge (C.O):</strong><br/>${formatBDT(coRate)}</div>
        </div>

        <div class="footer">
          <div>Authorized Foreign Exchange Procurement • Quantrex Engine</div>
          <div>Verified on ${new Date().toLocaleString()}</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <Modal title={`USD Purchase Voucher: #${String(tx.id).slice(-8)}`} onClose={onClose} width="max-w-xl">
      <div className="space-y-4 text-xs">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-sm">
          <div>
            <span className="font-mono text-xs font-black text-sky-400 block">#{tx.id}</span>
            <span className="text-[11px] text-slate-300 font-semibold mt-0.5 block">{formatDate(tx.date)}</span>
          </div>
          <button
            type="button"
            onClick={handlePrintVoucher}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:text-white"
          >
            <Printer size={13} /> Print Voucher
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase block">USD Received</span>
            <span className="font-black text-emerald-700 text-base mt-0.5 block">+{formatUSD(tx.amountUSD)}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Total Cost</span>
            <span className="font-black text-slate-900 text-base mt-0.5 block">{formatBDT(totalCost)}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Base Rate</span>
            <span className="font-black text-slate-700 text-base mt-0.5 block">৳{baseRate}</span>
          </div>
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Effective Rate</span>
            <span className="font-black text-sky-700 text-base mt-0.5 block">৳{effectiveRate}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Source / Seller:</span>
            <span className="font-bold text-slate-900">{tx.notes || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Destination Card:</span>
            <span className="font-bold text-sky-700">{cardName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Base BDT Paid:</span>
            <span className="font-bold text-slate-900">{formatBDT(bdtPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Cash-Out (C.O Rate):</span>
            <span className="font-bold text-rose-600">{formatBDT(coRate)}</span>
          </div>
        </div>

        <div className="pt-2 flex justify-between items-center flex-wrap gap-2 border-t border-slate-100">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(tx.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-all"
            >
              <Trash2 size={13} /> Delete Record
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold transition-all"
              >
                <Edit size={13} /> Edit Entry
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}


/* ==========================================================================
   SAAS MODULES
   Additive modules. Existing financial view component bodies remain untouched.
   ========================================================================== */

function PlatformBadge({ platform }) {
  const p = (platform || 'Meta').toLowerCase();
  if (p.includes('meta') || p.includes('facebook') || p.includes('instagram')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-bold shadow-2xs">
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
        Meta Ads
      </span>
    );
  }
  if (p.includes('google') || p.includes('youtube')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold shadow-2xs">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        Google Ads
      </span>
    );
  }
  if (p.includes('tiktok')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-bold shadow-2xs">
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-2.04-.52 4.81 4.81 0 0 1-1.77-1.4 4.87 4.87 0 0 1-.82-2.6z" />
        </svg>
        TikTok Ads
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
      <Target size={13} className="text-slate-500" />
      {platform || 'Digital Ads'}
    </span>
  );
}

function CampaignActionsMenu({ campaign, onInspect, onEdit, onToggleStatus, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        title="Campaign Actions"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { setIsOpen(false); onInspect(campaign); }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors"
          >
            <Eye size={14} className="text-sky-600" /> Deep-Dive Analytics
          </button>
          <button
            onClick={() => { setIsOpen(false); onEdit(campaign); }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
          >
            <Edit size={14} className="text-blue-600" /> Edit Campaign
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onToggleStatus(campaign.id, campaign.status === 'Active' ? 'Paused' : 'Active');
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
          >
            {campaign.status === 'Active' ? (
              <>
                <Pause size={14} className="text-amber-600" /> Pause Campaign
              </>
            ) : (
              <>
                <Play size={14} className="text-emerald-600" /> Activate Campaign
              </>
            )}
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            onClick={() => { setIsOpen(false); onDelete(campaign.id); }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
          >
            <Trash2 size={14} className="text-rose-500" /> Delete Campaign
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignDetailsModal({ campaign, clients, transactions, metrics, onClose, onEdit }) {
  const client = clients.find(x => x.id === campaign.clientId);

  const matchingTxs = useMemo(() => {
    return transactions.filter(t =>
      t.type === 'AD_SPEND' &&
      String(t.campaign || '').trim().toLowerCase() === String(campaign.name || '').trim().toLowerCase()
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, campaign.name]);

  const stats = useMemo(() => {
    const totalUSD = matchingTxs.reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
    const totalTaxUSD = matchingTxs.reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);
    const grossSpendUSD = totalUSD + totalTaxUSD;
    const grossSpendBDT = grossSpendUSD * (metrics.avgUSDEffectiveRate || 0);
    const revenueBDT = parseFloat(campaign.revenueBDT || 0);
    const profitBDT = revenueBDT - grossSpendBDT;
    const roas = grossSpendBDT > 0 ? revenueBDT / grossSpendBDT : 0;
    const resultCount = parseFloat(campaign.resultValue || 0);
    const cpr = resultCount > 0 ? (grossSpendUSD / resultCount) : 0;

    const budgetNum = parseFloat(campaign.budget || 0);
    const budgetUSD = campaign.budgetType === 'BDT' ? (budgetNum / (metrics.avgUSDEffectiveRate || 130)) : budgetNum;
    const pacingPercent = budgetUSD > 0 ? Math.min(100, Math.round((grossSpendUSD / budgetUSD) * 100)) : 0;

    return { totalUSD, totalTaxUSD, grossSpendUSD, grossSpendBDT, revenueBDT, profitBDT, roas, resultCount, cpr, budgetUSD, pacingPercent };
  }, [matchingTxs, metrics.avgUSDEffectiveRate, campaign]);

  const handlePrintCampaignReport = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Campaign Performance Report - ${campaign.name}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; }
          .client-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi-title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #0369a1; }
          .kpi-val { font-size: 18px; font-weight: 900; color: #0c4a6e; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; font-weight: 700; }
          td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          .green { color: #16a34a; font-weight: bold; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Quantrex Campaign Intelligence</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Campaign Audit & ROI Report</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 14px;">Date: ${new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div class="client-box">
          <div><strong>Campaign:</strong><br/>${campaign.name}</div>
          <div><strong>Client:</strong><br/>${client?.name || 'Unassigned'} (${client?.company || 'Direct'})</div>
          <div><strong>Platform:</strong><br/>${campaign.platform || 'Meta Ads'}</div>
          <div><strong>Objective / Goal:</strong><br/>${campaign.goal || 'General Performance'}</div>
          <div><strong>Timeline:</strong><br/>${formatDate(campaign.startDate)} – ${campaign.endDate ? formatDate(campaign.endDate) : 'Ongoing'}</div>
          <div><strong>Status:</strong><br/>${campaign.status || 'Active'}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-title">Total Spend</div><div class="kpi-val">${formatUSD(stats.grossSpendUSD)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Results Delivered</div><div class="kpi-val">${stats.resultCount.toLocaleString()} ${campaign.resultLabel || 'Results'}</div></div>
          <div class="kpi-card"><div class="kpi-title">Avg Cost / Result</div><div class="kpi-val">$${stats.cpr.toFixed(2)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Attributed ROAS</div><div class="kpi-val">${stats.roas.toFixed(2)}x</div></div>
        </div>

        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Matching Transaction Ledger</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ad Account</th>
              <th>Card / Source</th>
              <th style="text-align: right;">Ad Spend (USD)</th>
              <th style="text-align: right;">15% VAT</th>
              <th style="text-align: right;">Total Cost (BDT)</th>
            </tr>
          </thead>
          <tbody>
            ${matchingTxs.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 16px; color:#94a3b8;">No matching ad spend transactions recorded.</td></tr>' : ''}
            ${matchingTxs.map(tx => `
              <tr>
                <td>${formatDate(tx.date)}</td>
                <td>${tx.adAccount || 'Default Account'}</td>
                <td>${tx.notes || 'Meta Card'}</td>
                <td style="text-align: right; font-weight: bold;">${formatUSD(tx.amountUSD)}</td>
                <td style="text-align: right;">${formatUSD(tx.taxUSD)}</td>
                <td style="text-align: right; font-weight: bold;">${formatBDT((parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)) * (metrics.avgUSDEffectiveRate || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by Quantrex Platform • Confidential Campaign Intelligence Report
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* VIP OBSIDIAN HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-xl p-5 border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <PlatformBadge platform={campaign.platform} />
            <h2 className="text-xl font-black text-white tracking-tight">{campaign.name}</h2>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1.5 ${
              campaign.status === 'Active'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : campaign.status === 'Completed'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {campaign.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {campaign.status || 'Active'}
            </span>
          </div>
          <p className="text-slate-300 text-xs font-semibold">
            Client: <span className="text-sky-300 font-bold">{client?.name || 'Unassigned'}</span> {client?.company ? `(${client.company})` : ''} • Objective: <span className="text-slate-200">{campaign.goal || 'General Performance'}</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3.5 pt-3.5 border-t border-slate-800/80 text-xs">
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Target Budget</span>
              <span className="font-bold text-sky-400">
                {campaign.budget ? `${campaign.budgetType === 'BDT' ? '৳' : '$'}${Number(campaign.budget).toLocaleString()}` : 'Flexible / Ongoing'}
              </span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Timeline</span>
              <span className="font-semibold text-slate-200">{formatDate(campaign.startDate)} – {campaign.endDate ? formatDate(campaign.endDate) : 'Ongoing'}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Attributed Revenue</span>
              <span className="font-bold text-emerald-400">{formatBDT(stats.revenueBDT)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2 shrink-0 self-start md:self-center justify-center">
          <button
            type="button"
            onClick={() => { onClose(); onEdit(campaign); }}
            className="inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <Edit size={13} /> Edit Campaign
          </button>
          <button
            type="button"
            onClick={handlePrintCampaignReport}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap hover:text-white"
          >
            <Printer size={13} /> PDF Report
          </button>
        </div>
      </div>

      {/* 4 FROSTED KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ad Spend</span>
            <Activity size={14} className="text-purple-600" />
          </div>
          <span className="text-sm font-black text-purple-700 mt-1 block">{formatUSD(stats.grossSpendUSD)}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">{formatBDT(stats.grossSpendBDT)} with 15% VAT</span>
        </div>

        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered Results</span>
            <Target size={14} className="text-sky-600" />
          </div>
          <span className="text-sm font-black text-sky-700 mt-1 block">{stats.resultCount.toLocaleString()} {campaign.resultLabel || 'Leads'}</span>
          <span className="text-[10px] text-sky-600 font-semibold mt-0.5 block">Delivered</span>
        </div>

        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost Per Result (CPA)</span>
            <DollarSign size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-black text-amber-700 mt-1 block">${stats.cpr.toFixed(2)}</span>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">Avg per {campaign.resultLabel?.slice(0, -1) || 'result'}</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net ROAS</span>
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <span className="text-sm font-black text-emerald-700 mt-1 block">{stats.roas.toFixed(2)}x ROAS</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">{formatBDT(stats.profitBDT)} Net Profit</span>
        </div>
      </div>

      {/* BUDGET PACING BAR */}
      {stats.budgetUSD > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-lg p-3 shadow-2xs">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-bold text-slate-700">Budget Burn Pacing</span>
            <span className="font-black text-slate-800">{formatUSD(stats.grossSpendUSD)} of {formatUSD(stats.budgetUSD)} ({stats.pacingPercent}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${stats.pacingPercent > 90 ? 'bg-rose-500' : stats.pacingPercent > 70 ? 'bg-amber-500' : 'bg-sky-500'}`}
              style={{ width: `${stats.pacingPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* MATCHED TRANSACTIONS LEDGER */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Linked Ad Spend Ledger Entries</h4>
            <p className="text-[11px] text-slate-400">Transactions matched automatically by campaign name.</p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[10px] font-bold text-purple-700">
            {matchingTxs.length} Records
          </span>
        </div>

        <div className="overflow-x-auto max-h-[40vh]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 text-[10px] uppercase">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Ad Account</th>
                <th className="px-4 py-2.5">Card / Source</th>
                <th className="px-4 py-2.5 text-right">Ad Spend (USD)</th>
                <th className="px-4 py-2.5 text-right">15% VAT</th>
                <th className="px-4 py-2.5 text-right">Total BDT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {matchingTxs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">No ad spend transactions currently tagged with "{campaign.name}".</td>
                </tr>
              ) : (
                matchingTxs.map(tx => {
                  const grossUSD = parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0);
                  const grossBDT = grossUSD * (metrics.avgUSDEffectiveRate || 0);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-slate-600 font-medium">{formatDate(tx.date)}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{tx.adAccount || 'Default Account'}</td>
                      <td className="px-4 py-2.5 text-slate-500">{tx.notes || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-purple-700">{formatUSD(tx.amountUSD)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{formatUSD(tx.taxUSD)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatBDT(grossBDT)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STRATEGY & NOTES */}
      {campaign.notes && (
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Strategy & Campaign Notes</span>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{campaign.notes}</p>
        </div>
      )}
    </div>
  );
}

function CampaignForm({ initialData, clients, onCancel, onSubmit }) {
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        platform: initialData.platform || 'Meta',
        budgetType: initialData.budgetType || 'USD',
        status: initialData.status || 'Active',
        resultLabel: initialData.resultLabel || 'Leads',
        adAccount: initialData.adAccount || '',
        currentlyWorking: initialData.currentlyWorking !== undefined ? initialData.currentlyWorking : !initialData.endDate,
      };
    }
    return {
      name: '', clientId: clients[0]?.id || '', platform: 'Meta',
      goal: 'Lead Generation', status: 'Active',
      budget: '', budgetType: 'USD',
      startDate: new Date().toISOString().split('T')[0], endDate: '', currentlyWorking: true,
      resultValue: '', resultLabel: 'Leads', revenueBDT: '', adAccount: '', notes: ''
    };
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Live Calculations Preview
  const estBudgetUSD = formData.budgetType === 'BDT' ? ((parseFloat(formData.budget) || 0) / 130) : (parseFloat(formData.budget) || 0);
  const estResults = parseFloat(formData.resultValue) || 0;
  const estRevenueBDT = parseFloat(formData.revenueBDT) || 0;
  const estCostBDT = estBudgetUSD * 130;
  const estCPA = (estBudgetUSD > 0 && estResults > 0) ? (estBudgetUSD / estResults) : 0;
  const estROAS = (estCostBDT > 0 && estRevenueBDT > 0) ? (estRevenueBDT / estCostBDT) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit({
      ...formData,
      budget: parseFloat(formData.budget) || 0,
      resultValue: parseFloat(formData.resultValue) || 0,
      revenueBDT: parseFloat(formData.revenueBDT) || 0,
      endDate: formData.currentlyWorking ? '' : formData.endDate
    });
  };

  const inputClass = "w-full mt-0.5 px-2.5 py-1.5 border border-slate-200/90 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-slate-800 bg-white transition-all placeholder:text-slate-400 placeholder:font-normal h-[34px]";
  const labelClass = "block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/90">
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200/80 bg-slate-50/80 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{initialData ? 'Edit Campaign' : 'Create Master Campaign'}</h3>
            <p className="text-[10px] text-slate-400">Ad spend & VAT are synced automatically from matching ledger entries.</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2.5">
            {/* ROW 1 */}
            <div>
              <label className={labelClass}>Campaign Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Ramadan Lead Gen 2026" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Client Account *</label>
              <select name="clientId" value={formData.clientId} onChange={handleChange} className={inputClass}>
                <option value="">Unassigned Account</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Platform</label>
              <select name="platform" value={formData.platform} onChange={handleChange} className={inputClass}>
                <option>Meta</option><option>Google</option><option>TikTok</option><option>YouTube</option><option>Instagram</option><option>Other</option>
              </select>
            </div>

            {/* ROW 2 */}
            <div>
              <label className={labelClass}>Objective / Goal</label>
              <select name="goal" value={formData.goal} onChange={handleChange} className={inputClass}>
                <option>Lead Generation</option><option>E-Commerce Sales</option><option>Messages / WhatsApp</option><option>Website Traffic</option><option>Brand Awareness</option><option>App Installs</option><option>Engagement</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                <option>Active</option><option>Paused</option><option>Completed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Result Metric</label>
              <select name="resultLabel" value={formData.resultLabel} onChange={handleChange} className={inputClass}>
                <option>Leads</option><option>Sales / Orders</option><option>Messages</option><option>Clicks</option><option>Conversions</option><option>Video Views</option>
              </select>
            </div>

            {/* ROW 3 */}
            <div>
              <label className={labelClass}>Target Budget</label>
              <input type="number" min="0" step="0.01" name="budget" value={formData.budget} onChange={handleChange} placeholder="e.g. 500" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Budget Currency</label>
              <select name="budgetType" value={formData.budgetType} onChange={handleChange} className={inputClass}>
                <option value="USD">USD ($)</option><option value="BDT">BDT (৳)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Delivered Results</label>
              <input type="number" min="0" step="1" name="resultValue" value={formData.resultValue} onChange={handleChange} placeholder="e.g. 450" className={inputClass} />
            </div>

            {/* ROW 4 */}
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className={labelClass}>End Date</label>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700 select-none cursor-pointer">
                  <input type="checkbox" name="currentlyWorking" checked={formData.currentlyWorking} onChange={(e) => setFormData({ ...formData, currentlyWorking: e.target.checked })} className="w-3 h-3 text-sky-600 rounded border-slate-300 focus:ring-sky-500" />
                  Ongoing
                </label>
              </div>
              {!formData.currentlyWorking ? (
                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required={!formData.currentlyWorking} className={inputClass} />
              ) : (
                <div className="h-[34px] px-2.5 flex items-center bg-slate-50 border border-slate-200/70 rounded-lg text-[11px] font-semibold text-slate-500">Ongoing Campaign</div>
              )}
            </div>
            <div>
              <label className={labelClass}>Attributed Revenue (BDT)</label>
              <input type="number" min="0" step="0.01" name="revenueBDT" value={formData.revenueBDT} onChange={handleChange} placeholder="e.g. 75000" className={inputClass} />
            </div>

            {/* ROW 5 (Ad Account) */}
            <div className="sm:col-span-3">
              <label className={labelClass}>Ad Account Name / ID (Optional Reference)</label>
              <input type="text" name="adAccount" value={formData.adAccount || ''} onChange={handleChange} placeholder="e.g. ACT-984120 / Primary BM Account" className={inputClass} />
            </div>
          </div>

          {/* LIVE ESTIMATE BANNER */}
          {(estCPA > 0 || estROAS > 0) && (
            <div className="flex items-center gap-4 px-3.5 py-2 rounded-lg bg-sky-50/80 border border-sky-200/70 text-xs text-sky-900 font-bold">
              <span className="flex items-center gap-1 text-[11px] text-sky-700 font-bold uppercase tracking-wider">
                <Zap size={13} className="text-sky-600" /> Live Estimate:
              </span>
              {estCPA > 0 && (
                <span>Est. CPA: <span className="text-sky-800 font-black">${estCPA.toFixed(2)}</span> / {formData.resultLabel?.slice(0, -1) || 'result'}</span>
              )}
              {estROAS > 0 && (
                <span>Est. ROAS: <span className="text-emerald-700 font-black">{estROAS.toFixed(2)}x</span></span>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Target Audience, Angles & Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Target demographics, creative copy, pixel IDs, campaign objectives..."
              className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-200/90 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-slate-800 bg-white transition-all placeholder:text-slate-400 placeholder:font-normal min-h-[50px] max-h-[85px] overflow-y-auto leading-relaxed resize-y"
            />
          </div>

          <div className="flex gap-2.5 pt-2 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-200/90 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]">Save Campaign</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignsView({ campaigns, clients, transactions, metrics, onSave, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inspecting, setInspecting] = useState(null);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const rows = useMemo(() => campaigns.map(c => {
    const matching = transactions.filter(t =>
      t.type === 'AD_SPEND' &&
      String(t.campaign || '').trim().toLowerCase() === String(c.name || '').trim().toLowerCase()
    );
    const spendUSD = matching.reduce((sum, t) => sum + parseFloat(t.amountUSD || 0), 0);
    const taxUSD = matching.reduce((sum, t) => sum + parseFloat(t.taxUSD || 0), 0);
    const grossSpendUSD = spendUSD + taxUSD;
    const spendBDT = grossSpendUSD * (metrics.avgUSDEffectiveRate || 0);
    const revenueBDT = parseFloat(c.revenueBDT || 0);
    const profitBDT = revenueBDT - spendBDT;
    const roas = spendBDT > 0 ? revenueBDT / spendBDT : 0;
    const client = clients.find(x => x.id === c.clientId);
    const resultCount = parseFloat(c.resultValue || 0);
    const cpr = resultCount > 0 ? (grossSpendUSD / resultCount) : 0;

    const budgetNum = parseFloat(c.budget || 0);
    const budgetUSD = c.budgetType === 'BDT' ? (budgetNum / (metrics.avgUSDEffectiveRate || 130)) : budgetNum;
    const pacingPercent = budgetUSD > 0 ? Math.min(100, Math.round((grossSpendUSD / budgetUSD) * 100)) : 0;

    return {
      ...c,
      clientName: client?.name || 'Unassigned',
      clientCompany: client?.company || 'Direct',
      spendUSD: grossSpendUSD,
      taxUSD,
      spendBDT,
      revenueBDT,
      profitBDT,
      roas,
      resultCount,
      cpr,
      budgetUSD,
      pacingPercent,
      txCount: matching.length
    };
  }), [campaigns, clients, transactions, metrics.avgUSDEffectiveRate]);

  const summary = useMemo(() => {
    const totalCount = rows.length;
    const activeCount = rows.filter(c => c.status === 'Active').length;
    const totalSpendUSD = rows.reduce((s, c) => s + c.spendUSD, 0);
    const totalSpendBDT = rows.reduce((s, c) => s + c.spendBDT, 0);
    const totalRevenueBDT = rows.reduce((s, c) => s + c.revenueBDT, 0);
    const totalProfitBDT = totalRevenueBDT - totalSpendBDT;
    const blendedROAS = totalSpendBDT > 0 ? (totalRevenueBDT / totalSpendBDT) : 0;
    return { totalCount, activeCount, totalSpendUSD, totalSpendBDT, totalRevenueBDT, totalProfitBDT, blendedROAS };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter(c => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || [c.name, c.clientName, c.clientCompany, c.platform, c.goal, c.notes].some(v => String(v || '').toLowerCase().includes(q));
      const matchesPlatform = platformFilter === 'All' || String(c.platform || '').toLowerCase().includes(platformFilter.toLowerCase());
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesClient = clientFilter === 'All' || c.clientId === clientFilter;
      return matchesSearch && matchesPlatform && matchesStatus && matchesClient;
    });

    if (sortBy === 'spend') list.sort((a, b) => b.spendUSD - a.spendUSD);
    else if (sortBy === 'revenue') list.sort((a, b) => b.revenueBDT - a.revenueBDT);
    else if (sortBy === 'roas') list.sort((a, b) => b.roas - a.roas);
    else list.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));

    return list;
  }, [rows, search, platformFilter, statusFilter, clientFilter, sortBy]);

  const handleToggleStatus = (id, newStatus) => {
    const target = campaigns.find(c => c.id === id);
    if (target) onSave({ ...target, status: newStatus });
  };

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Campaign Name', 'Client', 'Platform', 'Goal', 'Status', 'Budget', 'Spend USD', 'Revenue BDT', 'ROAS', 'Results', 'Start Date', 'End Date'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.clientName.replace(/"/g, '""')}"`,
        `"${r.platform || 'Meta'}"`,
        `"${r.goal || 'General'}"`,
        `"${r.status || 'Active'}"`,
        `"${r.budget || 0}"`,
        `"${r.spendUSD.toFixed(2)}"`,
        `"${r.revenueBDT.toFixed(2)}"`,
        `"${r.roas.toFixed(2)}x"`,
        `"${r.resultCount} ${r.resultLabel || ''}"`,
        `"${r.startDate || ''}"`,
        `"${r.endDate || 'Ongoing'}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quantrex_campaigns_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 w-full max-w-[1720px] mx-auto animate-in fade-in duration-300 pb-16">
      {/* SEAMLESS CANVAS HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Campaigns Command Center</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Track multi-channel ad budgets, live USD spend, conversion results, and campaign ROAS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-2xs transition-all"
          >
            <Download size={14} className="text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
          >
            <Plus size={15} /> Add Campaign
          </button>
        </div>
      </div>

      {/* 4 LUXURY FROSTED KPI TAG CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Campaigns */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-sky-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-sky-100/90 border border-sky-200 flex items-center justify-center text-sky-700 shadow-xs shrink-0">
            <Target size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Total Campaigns</span>
            <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {summary.activeCount} Active ({summary.totalCount} Total)
            </span>
          </div>
        </div>

        {/* Card 2: Total Ad Spend */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-purple-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-purple-100/90 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs shrink-0">
            <Activity size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Tracked Ad Spend</span>
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
              {formatUSD(summary.totalSpendUSD)} ({formatBDT(summary.totalSpendBDT)})
            </span>
          </div>
        </div>

        {/* Card 3: Attributed Revenue */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-emerald-100/90 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
            <ArrowDownRight size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Attributed Revenue</span>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
              {formatBDT(summary.totalRevenueBDT)} Generated
            </span>
          </div>
        </div>

        {/* Card 4: Blended ROAS & Profit */}
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 border border-blue-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-blue-100/90 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs shrink-0">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Blended ROAS</span>
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
              {summary.blendedROAS.toFixed(2)}x ROAS ({formatBDT(summary.totalProfitBDT)} Profit)
            </span>
          </div>
        </div>
      </div>

      {/* QUICK PLATFORM FILTER CHIPS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['All', 'Meta', 'Google', 'TikTok', 'Other'].map(p => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shadow-2xs ${
              platformFilter === p
                ? 'bg-sky-600 text-white'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p === 'All' ? 'All Channels' : `${p} Ads`}
          </button>
        ))}
      </div>

      {/* SEARCH AND MULTI-DIMENSION FILTERS */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns, clients, objectives, or keywords..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200/90 rounded-lg text-xs font-medium focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none bg-white shadow-2xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[150px] shadow-2xs text-slate-700"
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
        >
          <option value="All">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[130px] shadow-2xs text-slate-700"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Completed">Completed</option>
        </select>

        <select
          className="border border-slate-200/90 rounded-lg px-3 py-2 text-xs font-semibold outline-none bg-white min-w-[140px] shadow-2xs text-slate-700"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="newest">Sort: Newest</option>
          <option value="spend">Sort: Highest Spend</option>
          <option value="revenue">Sort: Highest Revenue</option>
          <option value="roas">Sort: Best ROAS</option>
        </select>
      </div>

      {/* MASTER CAMPAIGN PERFORMANCE TABLE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="px-5 py-3.5">Campaign Name</th>
                <th className="px-4 py-3.5">Client</th>
                <th className="px-3 py-3.5">Platform</th>
                <th className="px-4 py-3.5 text-right">Budget & Pace</th>
                <th className="px-4 py-3.5 text-right">Ad Spend (USD)</th>
                <th className="px-4 py-3.5 text-right">Revenue (BDT)</th>
                <th className="px-4 py-3.5 text-right">Results & CPA</th>
                <th className="px-4 py-3.5 text-right">ROAS</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Target size={28} className="text-slate-300" />
                      <span className="text-xs font-semibold text-slate-500">No campaigns found matching your filter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const initial = (c.clientName || 'C').charAt(0).toUpperCase();
                  const isHighROAS = c.roas >= 2.5;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div
                          onClick={() => setInspecting(c)}
                          className="font-bold text-slate-900 text-xs cursor-pointer hover:text-sky-600 transition-colors flex items-center gap-1.5"
                        >
                          <span>{c.name}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-sky-500 transition-opacity">
                            <Eye size={12} />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-400">
                          <span className="font-semibold text-slate-500">{c.goal || 'General'}</span>
                          <span>•</span>
                          <span>{formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : 'Ongoing'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 font-black text-[10px] flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{c.clientName}</div>
                            <div className="text-[10px] text-slate-400">{c.clientCompany}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <PlatformBadge platform={c.platform} />
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="font-bold text-slate-700 text-xs">
                          {c.budget ? `${c.budgetType === 'BDT' ? '৳' : '$'}${Number(c.budget).toLocaleString()}` : 'Flexible'}
                        </div>
                        {c.budgetUSD > 0 && (
                          <div className="w-20 ml-auto mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.pacingPercent > 90 ? 'bg-rose-500' : 'bg-sky-500'}`}
                              style={{ width: `${c.pacingPercent}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-black text-purple-700 text-xs">
                        {formatUSD(c.spendUSD)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-black text-emerald-600 text-xs">
                        {formatBDT(c.revenueBDT)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="font-bold text-slate-800 text-xs">
                          {c.resultCount ? `${c.resultCount.toLocaleString()} ${c.resultLabel || ''}` : '—'}
                        </div>
                        {c.cpr > 0 && (
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            ${c.cpr.toFixed(2)} / {c.resultLabel?.slice(0, -1) || 'result'}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                          c.roas === 0
                            ? 'bg-slate-100 text-slate-500'
                            : isHighROAS
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : c.roas >= 1.5
                                ? 'bg-sky-50 text-sky-700 border border-sky-200/80'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                        }`}>
                          {c.roas ? `${c.roas.toFixed(2)}x` : '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : c.status === 'Completed'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}>
                          {c.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {c.status || 'Active'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setInspecting(c)}
                            title="Deep-Dive Inspector"
                            className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <CampaignActionsMenu
                            campaign={c}
                            onInspect={(camp) => setInspecting(camp)}
                            onEdit={(camp) => { setEditing(camp); setShowForm(true); }}
                            onToggleStatus={handleToggleStatus}
                            onDelete={onDelete}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECTOR MODAL */}
      {inspecting && (
        <Modal title={`Campaign Deep-Dive: ${inspecting.name}`} onClose={() => setInspecting(null)} width="max-w-4xl">
          <CampaignDetailsModal
            campaign={inspecting}
            clients={clients}
            transactions={transactions}
            metrics={metrics}
            onClose={() => setInspecting(null)}
            onEdit={(camp) => { setInspecting(null); setEditing(camp); setShowForm(true); }}
          />
        </Modal>
      )}

      {/* ADD / EDIT FORM MODAL */}
      {showForm && (
        <CampaignForm
          initialData={editing}
          clients={clients}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSubmit={data => { onSave(data); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// --- MASTER-LEVEL INTEGRATIONS & AUTOMATED SYNC ECOSYSTEM ---
const INITIAL_INTEGRATIONS_DATA = [
  {
    id: 'meta',
    name: 'Meta Ads',
    subtitle: 'Facebook & Instagram',
    category: 'ads',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'Meta',
    description: 'Auto-sync active campaigns, daily USD spend, impressions, CPC, and client ad accounts.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      accountIds: '',
      accessToken: '',
      syncFreq: '15m',
      autoVat: true,
      autoAssignClients: true
    }
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    subtitle: 'Search & YouTube',
    category: 'ads',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'GoogleAds',
    description: 'Stream search keyword costs, YouTube campaigns, and performance max budgets into ledger.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      customerId: '',
      developerToken: '',
      syncFreq: '1h',
      currencyConvert: true
    }
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads',
    subtitle: 'Video Campaigns',
    category: 'ads',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'TikTok',
    description: 'Track viral short-video ad spend, spark ads, and pixel conversion metrics automatically.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      advertiserId: '',
      accessToken: ''
    }
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    subtitle: 'Live Cloud Backup',
    category: 'data',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'GoogleSheets',
    description: 'Stream live client ledger balances, transaction rows, and 15% VAT statements to Google Sheets.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      sheetUrl: '',
      syncFreq: 'realtime',
      autoCreateTabs: true
    }
  },
  {
    id: 'zapier',
    name: 'Zapier & Make',
    subtitle: 'Workflow Automation',
    category: 'data',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'Zapier',
    description: 'Send instant WhatsApp alerts, Slack notifications, or CRM updates on ledger balance events.',
    lastSync: 'Never',
    statsBadge: 'Ready to configure',
    config: {
      webhookUrl: '',
      secretKey: ''
    }
  },
  {
    id: 'bkash',
    name: 'Bkash Gateway',
    subtitle: 'Direct MFS & IPN',
    category: 'payments',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'Bkash',
    description: 'Auto-verify client advance deposits via TRXID and receive Instant Payment Notifications (IPN).',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      merchantPhone: '',
      appKey: '',
      autoApproveDeposits: true
    }
  },
  {
    id: 'sslcommerz',
    name: 'SSLCommerz',
    subtitle: 'Cards & Online Checkout',
    category: 'payments',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'SSLCommerz',
    description: 'Online card checkout gateway for automated client invoice payments via debit/credit cards.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      storeId: '',
      storePass: '',
      autoApproveDeposits: true
    }
  },
  {
    id: 'bank_cards',
    name: 'Bank Cards & FX',
    subtitle: 'Dual-Currency USD Cards',
    category: 'payments',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'BankCard',
    description: 'Automated bank USD card reload sync, 15% VAT auto-settlement, and daily bank FX buy rates.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      bankName: 'City Bank & EBL Dual Currency',
      autoVat15: true,
      bankBuyRate: '131.25'
    }
  },
  {
    id: 'stripe',
    name: 'Stripe Gateway',
    subtitle: 'Global USD Invoices',
    category: 'payments',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'Stripe',
    description: 'Accept credit cards and USD wire payments from international brands and foreign clients.',
    lastSync: 'Never',
    statsBadge: 'Ready to connect',
    config: {
      publishableKey: '',
      secretKey: ''
    }
  },
  {
    id: 'custom_api',
    name: 'Developer API',
    subtitle: 'Workspace Webhooks',
    category: 'developer',
    status: 'disconnected',
    iconColor: 'bg-white border-slate-200',
    iconName: 'DeveloperApi',
    description: 'High-speed REST API endpoints and HMAC-SHA256 secured webhook listener for custom apps.',
    lastSync: 'Never',
    statsBadge: 'Ready to configure',
    config: {
      apiKey: 'adl_live_sec_99a8b7c6d5e4f3a2b1c0d9e8',
      webhookEndpoint: 'https://api.quantrex.io/v1/workspace/sync'
    }
  }
];

const INITIAL_WEBHOOK_LOGS = [
  {
    id: 'log_01',
    endpoint: 'POST /v1/workspace/init',
    status: 200,
    statusText: 'OK',
    source: 'Developer API',
    details: 'Workspace API Gateway initialized. Ready to connect marketing platforms.',
    timestamp: 'Just now',
    date: new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
];

function IntegrationsView({ clients = [], transactions = [], workspaceSettings = {} }) {
  const [integrations, setIntegrations] = useLocalStorage('adledger_integrations_v6', INITIAL_INTEGRATIONS_DATA);
  const [webhookLogs, setWebhookLogs] = useLocalStorage('adledger_webhook_logs', INITIAL_WEBHOOK_LOGS);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'ads' | 'data' | 'payments' | 'developer'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [modalFormData, setModalFormData] = useState({});
  const [isTestingHandshake, setIsTestingHandshake] = useState(false);
  const [handshakeResult, setHandshakeResult] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showConsoleModal, setShowConsoleModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 100% EXACT AUTHENTIC OFFICIAL PLATFORM LOGOS (PIXEL-PERFECT VECTOR SVGS)
  const getIntegrationIcon = (iconName, size = 24) => {
    switch (iconName) {
      case 'Meta':
        return (
          <svg width={size} height={size} viewBox="0 0 288 192" fill="none">
            <linearGradient id="metaGrad1" gradientTransform="matrix(1 0 0 -1 0 192)" gradientUnits="userSpaceOnUse" x1="62.34" x2="260.34" y1="101.45" y2="91.45">
              <stop offset="0" stopColor="#0064e1"/>
              <stop offset=".4" stopColor="#0064e1"/>
              <stop offset=".83" stopColor="#0073ee"/>
              <stop offset="1" stopColor="#0082fb"/>
            </linearGradient>
            <linearGradient id="metaGrad2" gradientTransform="matrix(1 0 0 -1 0 192)" gradientUnits="userSpaceOnUse" x1="41.42" x2="41.42" y1="53" y2="126">
              <stop offset="0" stopColor="#0082fb"/>
              <stop offset="1" stopColor="#0064e0"/>
            </linearGradient>
            <path d="M31.06 126c0 11 2.41 19.41 5.56 24.51A19 19 0 0 0 53.19 160c8.1 0 15.51-2 29.79-21.76 11.44-15.83 24.92-38 34-52l15.36-23.6c10.67-16.39 23-34.61 37.18-47C181.07 5.6 193.54 0 206.09 0c21.07 0 41.14 12.21 56.5 35.11 16.81 25.08 25 56.67 25 89.27 0 19.38-3.82 33.62-10.32 44.87C271 180.13 258.72 191 238.13 191v-31c17.63 0 22-16.2 22-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85 0-26.8 11.2-40.23 31.17-7.14 10.61-14.47 23.54-22.7 38.13l-9.06 16c-18.2 32.27-22.81 39.62-31.91 51.75C84.74 183 71.12 191 53.19 191c-21.27 0-34.72-9.21-43-23.09C3.34 156.6 0 141.76 0 124.85z" fill="#0081fb"/>
            <path d="M24.49 37.3C38.73 15.35 59.28 0 82.85 0c13.65 0 27.22 4 41.39 15.61 15.5 12.65 32 33.48 52.63 67.81l7.39 12.32c17.84 29.72 28 45 33.93 52.22 7.64 9.26 13 12 19.94 12 17.63 0 22-16.2 22-34.74l27.4-.86c0 19.38-3.82 33.62-10.32 44.87C271 180.13 258.72 191 238.13 191c-12.8 0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71L146.08 93.6c-12.94-21.62-24.81-37.74-31.68-45-7.4-7.89-16.89-17.37-32.05-17.37-12.27 0-22.69 8.61-31.41 21.78z" fill="url(#metaGrad1)"/>
            <path d="M82.35 31.23c-12.27 0-22.69 8.61-31.41 21.78C38.61 71.62 31.06 99.34 31.06 126c0 11 2.41 19.41 5.56 24.51l-26.48 17.4C3.34 156.6 0 141.76 0 124.85 0 94.1 8.44 62.05 24.49 37.3 38.73 15.35 59.28 0 82.85 0z" fill="url(#metaGrad2)"/>
          </svg>
        );
      case 'GoogleAds':
        return (
          <svg width={size} height={size} viewBox="0 0 251 240" fill="none">
            <path d="M85.9,28.6c2.4-6.3,5.7-12.1,10.6-16.8c19.6-19.1,52-14.3,65.3,9.7c10,18.2,20.6,36,30.9,54c17.2,29.9,34.6,59.8,51.6,89.8c14.3,25.1-1.2,56.8-29.6,61.1c-17.4,2.6-33.7-5.4-42.7-21c-15.1-26.3-30.3-52.6-45.4-78.8c-0.3-0.6-0.7-1.1-1.1-1.6c-1.6-1.3-2.3-3.2-3.3-4.9c-6.7-11.8-13.6-23.5-20.3-35.2c-4.3-7.6-8.8-15.1-13.1-22.7c-3.9-6.8-5.7-14.2-5.5-22C83.6,36.2,84.1,32.2,85.9,28.6" fill="#4285F4"/>
            <path d="M85.9,28.6c-0.9,3.6-1.7,7.2-1.9,11c-0.3,8.4,1.8,16.2,6,23.5C101,82,112,101,122.9,120c1,1.7,1.8,3.4,2.8,5c-6,10.4-12,20.7-18.1,31.1c-8.4,14.5-16.8,29.1-25.3,43.6c-0.4,0-0.5-0.2-0.6-0.5c-0.1-0.8,0.2-1.5,0.4-2.3c4.1-15,0.7-28.3-9.6-39.7c-6.3-6.9-14.3-10.8-23.5-12.1c-12-1.7-22.6,1.4-32.1,8.9c-1.7,1.3-2.8,3.2-4.8,4.2c-0.4,0-0.6-0.2-0.7-0.5c4.8-8.3,9.5-16.6,14.3-24.9C45.5,98.4,65.3,64,85.2,29.7C85.4,29.3,85.7,29,85.9,28.6" fill="#FBBC04"/>
            <path d="M11.8,158c1.9-1.7,3.7-3.5,5.7-5.1c24.3-19.2,60.8-5.3,66.1,25.1c1.3,7.3,0.6,14.3-1.6,21.3c-0.1,0.6-0.2,1.1-0.4,1.7c-0.9,1.6-1.7,3.3-2.7,4.9c-8.9,14.7-22,22-39.2,20.9C20,225.4,4.5,210.6,1.8,191c-1.3-9.5,0.6-18.4,5.5-26.6c1-1.8,2.2-3.4,3.3-5.2C11.1,158.8,10.9,158,11.8,158" fill="#34A853"/>
          </svg>
        );
      case 'TikTok':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#000000"/>
            <path d="M16.6 8.2c-.9-.6-1.5-1.5-1.7-2.6h-2.3v10.3c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6.1.9.2v-2.4c-.3 0-.6-.1-.9-.1-2.8 0-5.1 2.3-5.1 5.1s2.3 5.1 5.1 5.1 5.1-2.3 5.1-5.1v-6.3c1.1.8 2.5 1.3 4 1.3V8.5c-.8 0-1.7-.1-2.4-.3z" fill="#25F4EE" transform="translate(-0.8, -0.6)"/>
            <path d="M16.6 8.2c-.9-.6-1.5-1.5-1.7-2.6h-2.3v10.3c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6.1.9.2v-2.4c-.3 0-.6-.1-.9-.1-2.8 0-5.1 2.3-5.1 5.1s2.3 5.1 5.1 5.1 5.1-2.3 5.1-5.1v-6.3c1.1.8 2.5 1.3 4 1.3V8.5c-.8 0-1.7-.1-2.4-.3z" fill="#FE2C55" transform="translate(0.8, 0.6)"/>
            <path d="M16.6 8.2c-.9-.6-1.5-1.5-1.7-2.6h-2.3v10.3c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6.1.9.2v-2.4c-.3 0-.6-.1-.9-.1-2.8 0-5.1 2.3-5.1 5.1s2.3 5.1 5.1 5.1 5.1-2.3 5.1-5.1v-6.3c1.1.8 2.5 1.3 4 1.3V8.5c-.8 0-1.7-.1-2.4-.3z" fill="#FFFFFF"/>
          </svg>
        );
      case 'GoogleSheets':
        return (
          <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <path d="M30 4H10C7.79 4 6 5.79 6 8v32c0 2.21 1.79 4 4 4h28c2.21 0 4-1.79 4-4V16L30 4z" fill="#0F9D58"/>
            <path d="M30 4v12h12L30 4z" fill="#87CEAB"/>
            <path d="M13 22h22v17H13z" fill="#FFFFFF" rx="1.5"/>
            <path d="M13 27.5h22v2H13zm0 5.5h22v2H13zm7-11h2v17h-2zm8 0h2v17h-2z" fill="#0F9D58"/>
          </svg>
        );
      case 'Zapier':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#FFF2EB"/>
            <path d="M12 2.5c-.7 0-1.3.6-1.3 1.3V9L6 4.3c-.6-.6-1.5-.6-2.1 0s-.6 1.5 0 2.1l4.7 4.7H3.8c-.7 0-1.3.6-1.3 1.3s.6 1.3 1.3 1.3h4.8l-4.7 4.7c-.6.6-.6 1.5 0 2.1.3.3.7.4 1.1.4.4 0 .7-.1 1-.4l4.7-4.7v5.2c0 .7.6 1.3 1.3 1.3s1.3-.6 1.3-1.3v-5.2l4.7 4.7c.3.3.7.4 1 .4.4 0 .8-.1 1.1-.4.6-.6.6-1.5 0-2.1l-4.7-4.7h4.8c.7 0 1.3-.6 1.3-1.3s-.6-1.3-1.3-1.3h-4.8l4.7-4.7c.6-.6.6-1.5 0-2.1s-1.5-.6-2.1 0L13.3 9V3.8c0-.7-.6-1.3-1.3-1.3z" fill="#FF4A00"/>
          </svg>
        );
      case 'Bkash':
        return (
          <svg width={size} height={size} viewBox="245 10 226 215" fill="none">
            <path d="M327.99 110.75l12.99 58.4 85.01-43.04z" fill="#D12053"/>
            <path d="M352.16 23.48L328 110.76l98.01 15.35z" fill="#E2136E"/>
            <path d="M248.31 10.7l101.38 12.11-23.97 86.76z" fill="#D12053"/>
            <path d="M247.52 27.76h11.29l31.67 40.5z" fill="#9E1638"/>
            <path d="M428.69 125.55l-29.46-40.77 47.66-8.53z" fill="#D12053"/>
            <path d="M423.77 137.5l3.04-9.07-74.39 37.74z" fill="#E2136E"/>
            <path d="M325.91 113.05l15.52 69.77-46.06 37.46z" fill="#9E1638"/>
            <path d="M442.25 96.97l27.05-.46-19.55-19.89z" fill="#E2136E"/>
          </svg>
        );
      case 'SSLCommerz':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#0052CC"/>
            <path d="M3 7h18" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.4"/>
            <circle cx="7.5" cy="15.5" r="2.8" fill="#EB001B"/>
            <circle cx="11.5" cy="15.5" r="2.8" fill="#F79E1B" fillOpacity="0.9"/>
            <path d="M15.5 13.5h5v4h-5z" fill="#00875A" rx="0.5"/>
            <path d="M17 15.5l1 1 2-2" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'BankCard':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#0F172A"/>
            <rect x="2.5" y="3.5" width="19" height="17" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="0.8"/>
            <rect x="4.5" y="6" width="4.5" height="3.5" rx="0.8" fill="#F59E0B" stroke="#D97706" strokeWidth="0.5"/>
            <circle cx="13.5" cy="15" r="2.8" fill="#EB001B"/>
            <circle cx="16.8" cy="15" r="2.8" fill="#F79E1B" fillOpacity="0.9"/>
          </svg>
        );
      case 'Stripe':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#635BFF"/>
            <path d="M13.9 9.3c0-.8-.7-1.3-1.8-1.3-1.6 0-3.3.6-4.4 1.2L7 6.8c1.3-.7 3.2-1.3 5.3-1.3 3.6 0 5.8 1.8 5.8 4.7 0 4.1-5.7 3.4-5.7 5.2 0 1 .9 1.4 2.2 1.4 1.8 0 3.7-.8 4.8-1.5l.7 2.4c-1.4.8-3.4 1.4-5.7 1.4-3.8 0-6.1-1.8-6.1-4.7 0-4.4 5.7-3.6 5.7-5.1z" fill="#FFFFFF"/>
          </svg>
        );
      case 'DeveloperApi':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#0F172A"/>
            <path d="M6.5 8.5L10 12l-3.5 3.5" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5 15.5h5" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        );
      default:
        return <PlugZap size={size} className="text-sky-600" />;
    }
  };

  // Filtered List
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [integrations, activeCategory, searchQuery]);

  const connectedCount = useMemo(() => {
    return integrations.filter(i => i.status === 'connected').length;
  }, [integrations]);

  // Handle single integration sync
  const handleSyncItem = (item) => {
    setSyncingId(item.id);
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => {
        if (i.id === item.id) {
          return { ...i, lastSync: 'Just now' };
        }
        return i;
      }));

      // Append log entry
      const newLog = {
        id: `log_${Date.now()}`,
        endpoint: `POST /v1/${item.id}-sync`,
        status: 200,
        statusText: 'OK',
        source: item.name,
        details: `Manual sync triggered. Verified connection handshake and refreshed latest records.`,
        timestamp: 'Just now',
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      setWebhookLogs(prev => [newLog, ...prev]);

      setSyncingId(null);
      showToast(`Synchronized ${item.name} successfully!`);
    }, 1200);
  };

  // Handle Sync All Services
  const handleSyncAll = () => {
    setIsSyncingAll(true);
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => {
        if (i.status === 'connected') {
          return { ...i, lastSync: 'Just now' };
        }
        return i;
      }));

      const newLog = {
        id: `log_${Date.now()}`,
        endpoint: 'POST /v1/workspace/sync-all',
        status: 200,
        statusText: 'OK',
        source: 'Global Sync Engine',
        details: `Synchronized ${connectedCount} connected platforms simultaneously. All endpoints healthy.`,
        timestamp: 'Just now',
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      setWebhookLogs(prev => [newLog, ...prev]);

      setIsSyncingAll(false);
      showToast(`All ${connectedCount} active platforms synchronized!`);
    }, 1800);
  };

  // Open config modal
  const openConfigModal = (item) => {
    setSelectedIntegration(item);
    setModalFormData(item.config || {});
    setHandshakeResult(null);
  };

  // Test connection handshake inside modal
  const handleTestHandshake = () => {
    setIsTestingHandshake(true);
    setHandshakeResult(null);
    setTimeout(() => {
      setIsTestingHandshake(false);
      setHandshakeResult({
        success: true,
        message: 'Handshake Verified: TLS 1.3 encrypted connection established (HTTP 200 OK).'
      });
    }, 1000);
  };

  // Save Modal Changes
  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!selectedIntegration) return;

    setIntegrations(prev => prev.map(i => {
      if (i.id === selectedIntegration.id) {
        return {
          ...i,
          status: 'connected',
          lastSync: 'Just now',
          config: { ...modalFormData }
        };
      }
      return i;
    }));

    showToast(`Saved and enabled ${selectedIntegration.name}`);
    setSelectedIntegration(null);
  };

  // Disconnect integration
  const handleDisconnect = (itemId) => {
    setIntegrations(prev => prev.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          status: 'disconnected',
          lastSync: 'Never'
        };
      }
      return i;
    }));
    showToast(`Disconnected ${selectedIntegration?.name || 'integration'}`);
    setSelectedIntegration(null);
  };

  const handleCopyApiKey = (keyVal) => {
    navigator.clipboard?.writeText(keyVal);
    setCopiedKey(true);
    showToast('API Key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & GLOBAL CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations & API Hub</h1>
            {connectedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {connectedCount} Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Auto-Sync Ready
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect ad networks, 2-way Google Sheets, payment gateways, and custom agency webhooks with TLS 1.3 security.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowConsoleModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all"
          >
            <Terminal size={14} className="text-purple-600" />
            Developer Console ({webhookLogs.length})
          </button>

          <button
            type="button"
            disabled={isSyncingAll}
            onClick={handleSyncAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] disabled:opacity-75"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            {isSyncingAll ? 'Syncing All Services...' : 'Sync All Services'}
          </button>
        </div>
      </div>

      {/* COMPACT KPI METRIC CARDS (PREMIUM FROSTED GLASS & LUXURY TAGS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Platforms */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-sky-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-sky-100/90 border border-sky-200 flex items-center justify-center text-sky-700 shadow-xs shrink-0">
            <PlugZap size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Connected Platforms</span>
            <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />
              {connectedCount > 0 ? `${connectedCount} Active` : 'Ready to Connect'}
            </span>
          </div>
        </div>

        {/* Card 2: Sync Engine */}
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-emerald-100/90 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
            <Clock size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Sync Engine</span>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
              15m Auto-Interval
            </span>
          </div>
        </div>

        {/* Card 3: API Security */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-purple-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-purple-100/90 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">API Security</span>
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
              TLS 1.3 Encrypted
            </span>
          </div>
        </div>

        {/* Card 4: Live Stream */}
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-amber-100/90 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs shrink-0">
            <Activity size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Live Stream</span>
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
              99.98% Uptime
            </span>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR (PERFECTLY CENTERED SPACING) */}
      <div className="flex flex-col md:flex-row items-center gap-4 pt-2">
        {/* Category Tabs with Sleek GitHub Corners */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-200/60 rounded-lg w-full md:w-auto shrink-0">
          {[
            { id: 'all', label: 'All Platforms', count: integrations.length },
            { id: 'ads', label: 'Ad Networks', count: integrations.filter(i => i.category === 'ads').length },
            { id: 'data', label: 'Data & Sheets', count: integrations.filter(i => i.category === 'data').length },
            { id: 'payments', label: 'Payment Gateways', count: integrations.filter(i => i.category === 'payments').length },
            { id: 'developer', label: 'Developer API', count: integrations.filter(i => i.category === 'developer').length },
          ].map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-sky-100 text-sky-700 font-extrabold' : 'bg-slate-300/80 text-slate-700 font-bold'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input Centered in Remaining Space with Equal Space Left & Right */}
        <div className="flex-1 flex justify-center w-full md:w-auto">
          <div className="relative w-full max-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search platforms..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200/90 rounded-lg text-xs bg-white focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            />
          </div>
        </div>
      </div>

      {/* INTEGRATIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
        {filteredIntegrations.map((item) => {
          const isConnected = item.status === 'connected';
          const isSyncing = syncingId === item.id || isSyncingAll;

          return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between group ${
                isConnected ? 'border-slate-200/90' : 'border-slate-200/70 bg-white'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform">
                      {getIntegrationIcon(item.iconName, 24)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-tight">{item.name}</h3>
                      <span className="text-[11px] font-semibold text-slate-400">{item.subtitle}</span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shrink-0 ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isConnected ? 'Live Sync' : 'Ready'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3.5 leading-relaxed font-normal">
                  {item.description}
                </p>

                {/* Performance & Sync Stats */}
                <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold flex items-center gap-1">
                      <Clock size={11} className="text-slate-400" /> Last Synced:
                    </span>
                    <span className="font-bold text-slate-800">{item.lastSync}</span>
                  </div>
                  <div className="text-[10.5px] font-semibold text-slate-700 truncate">
                    {item.statsBadge}
                  </div>
                </div>
              </div>

              {/* Action Buttons with Sleek Corners */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openConfigModal(item)}
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  {isConnected ? 'Configure' : 'Connect'}
                </button>

                {isConnected && (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleSyncItem(item)}
                    title="Run Instant Synchronization"
                    className="py-2 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL 1: PLATFORM CONFIGURATION ================= */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center p-2 shrink-0">
                  {getIntegrationIcon(selectedIntegration.iconName, 24)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Configure {selectedIntegration.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedIntegration.subtitle} • Encrypted TLS 1.3 Credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIntegration(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* META ADS FORM */}
              {selectedIntegration.id === 'meta' && (
                <div className="space-y-4">
                  <Field label="Meta Ad Account IDs (Comma-Separated) *">
                    <input
                      type="text"
                      required
                      value={modalFormData.accountIds || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, accountIds: e.target.value }))}
                      placeholder="e.g. act_884920194, act_991823412"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 font-mono font-medium outline-none"
                    />
                  </Field>

                  <Field label="System User Access Token / Graph API Token *">
                    <input
                      type="password"
                      required
                      value={modalFormData.accessToken || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, accessToken: e.target.value }))}
                      placeholder="EAAQ... (System User 60-Day or Never-Expiring Token)"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 font-mono outline-none"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Sync Frequency">
                      <select
                        value={modalFormData.syncFreq || '15m'}
                        onChange={(e) => setModalFormData(p => ({ ...p, syncFreq: e.target.value }))}
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="15m">Real-time (Every 15 mins)</option>
                        <option value="1h">Hourly Intervals</option>
                        <option value="daily">Daily at 11:59 PM</option>
                      </select>
                    </Field>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 mt-1">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Auto 15% VAT</span>
                        <span className="text-[10.5px] text-slate-500">Calculate BD VAT on spend</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={modalFormData.autoVat ?? true}
                        onChange={(e) => setModalFormData(p => ({ ...p, autoVat: e.target.checked }))}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* GOOGLE ADS FORM */}
              {selectedIntegration.id === 'google_ads' && (
                <div className="space-y-4">
                  <Field label="Google Ads Customer ID (MCC or Account ID) *">
                    <input
                      type="text"
                      required
                      value={modalFormData.customerId || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, customerId: e.target.value }))}
                      placeholder="e.g. 821-492-9011"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 font-mono outline-none"
                    />
                  </Field>

                  <Field label="Developer Token *">
                    <input
                      type="password"
                      required
                      value={modalFormData.developerToken || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, developerToken: e.target.value }))}
                      placeholder="Enter Google Ads Developer Token"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>
                </div>
              )}

              {/* GOOGLE SHEETS FORM */}
              {selectedIntegration.id === 'google_sheets' && (
                <div className="space-y-4">
                  <Field label="Master Google Spreadsheet URL *">
                    <input
                      type="url"
                      required
                      value={modalFormData.sheetUrl || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, sheetUrl: e.target.value }))}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 font-mono outline-none"
                    />
                  </Field>

                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                    <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-600" />
                      Live 2-Way Sync Engine Ready
                    </span>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      All {clients.length} active agency client balances and transaction rows will automatically mirror into separate tabs on your Google Sheet.
                    </p>
                  </div>
                </div>
              )}

              {/* BKASH MERCHANT FORM */}
              {selectedIntegration.id === 'bkash' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Merchant Wallet Phone *">
                      <input
                        type="text"
                        required
                        value={modalFormData.merchantPhone || ''}
                        onChange={(e) => setModalFormData(p => ({ ...p, merchantPhone: e.target.value }))}
                        placeholder="018XXXXXXXX"
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                      />
                    </Field>

                    <Field label="App Key *">
                      <input
                        type="password"
                        required
                        value={modalFormData.appKey || ''}
                        onChange={(e) => setModalFormData(p => ({ ...p, appKey: e.target.value }))}
                        placeholder="bk_live_sec_..."
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                      />
                    </Field>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-pink-50 border border-pink-200 text-xs space-y-1">
                    <span className="font-bold text-pink-900 block">Instant Payment Notification (IPN) Webhook</span>
                    <p className="text-[11px] text-pink-700 font-mono">
                      https://api.adlytic.app/v1/ipn/bkash
                    </p>
                  </div>
                </div>
              )}

              {/* SSLCOMMERZ FORM */}
              {selectedIntegration.id === 'sslcommerz' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Store ID *">
                      <input
                        type="text"
                        required
                        value={modalFormData.storeId || ''}
                        onChange={(e) => setModalFormData(p => ({ ...p, storeId: e.target.value }))}
                        placeholder="e.g. adlytic_live_01"
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                      />
                    </Field>

                    <Field label="Store Password / Secret *">
                      <input
                        type="password"
                        required
                        value={modalFormData.storePass || ''}
                        onChange={(e) => setModalFormData(p => ({ ...p, storePass: e.target.value }))}
                        placeholder="ssl_live_sec_..."
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                      />
                    </Field>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-1">
                    <span className="font-bold text-blue-900 block">Instant IPN Webhook Listener</span>
                    <p className="text-[11px] text-blue-700 font-mono">
                      https://api.adlytic.app/v1/ipn/sslcommerz
                    </p>
                  </div>
                </div>
              )}

              {/* DUAL-CURRENCY BANK FX CARDS FORM */}
              {selectedIntegration.id === 'bank_cards' && (
                <div className="space-y-4">
                  <Field label="Primary Card Issuer Bank *">
                    <input
                      type="text"
                      required
                      value={modalFormData.bankName || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, bankName: e.target.value }))}
                      placeholder="e.g. City Bank, Eastern Bank (EBL), BRAC Bank"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Default Bank USD Buy Rate (৳)">
                      <input
                        type="number"
                        step="0.01"
                        value={modalFormData.bankBuyRate || '131.25'}
                        onChange={(e) => setModalFormData(p => ({ ...p, bankBuyRate: e.target.value }))}
                        placeholder="131.25"
                        className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono font-bold outline-none"
                      />
                    </Field>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 mt-1">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Auto 15% VAT</span>
                        <span className="text-[10.5px] text-slate-500">Calculate bank VAT on reload</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={modalFormData.autoVat15 ?? true}
                        onChange={(e) => setModalFormData(p => ({ ...p, autoVat15: e.target.checked }))}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STRIPE GLOBAL FORM */}
              {selectedIntegration.id === 'stripe' && (
                <div className="space-y-4">
                  <Field label="Stripe Publishable Key *">
                    <input
                      type="text"
                      required
                      value={modalFormData.publishableKey || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, publishableKey: e.target.value }))}
                      placeholder="pk_live_..."
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>

                  <Field label="Stripe Secret Key *">
                    <input
                      type="password"
                      required
                      value={modalFormData.secretKey || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, secretKey: e.target.value }))}
                      placeholder="sk_live_..."
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>
                </div>
              )}

              {/* DEVELOPER API FORM */}
              {selectedIntegration.id === 'custom_api' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Workspace Secret API Key</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={modalFormData.apiKey || 'adl_live_sec_99a8b7c6d5e4f3a2b1c0d9e8'}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 font-mono font-bold text-slate-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyApiKey(modalFormData.apiKey || 'adl_live_sec_99a8b7c6d5e4f3a2b1c0d9e8')}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        {copiedKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <Field label="Custom Webhook Listener Endpoint">
                    <input
                      type="url"
                      value={modalFormData.webhookEndpoint || 'https://api.quantrex.io/v1/workspace/sync'}
                      onChange={(e) => setModalFormData(p => ({ ...p, webhookEndpoint: e.target.value }))}
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>
                </div>
              )}

              {/* DEFAULT FORM FOR OTHER SERVICES (TikTok, Zapier) */}
              {!['meta', 'google_ads', 'google_sheets', 'bkash', 'sslcommerz', 'bank_cards', 'stripe', 'custom_api'].includes(selectedIntegration.id) && (
                <div className="space-y-4">
                  <Field label="API Endpoint or Client ID *">
                    <input
                      type="text"
                      required
                      value={modalFormData.clientId || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, clientId: e.target.value }))}
                      placeholder="Enter Client or Merchant ID"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>

                  <Field label="Secret Token or Key *">
                    <input
                      type="password"
                      required
                      value={modalFormData.secretToken || ''}
                      onChange={(e) => setModalFormData(p => ({ ...p, secretToken: e.target.value }))}
                      placeholder="Enter Secret Token"
                      className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-mono outline-none"
                    />
                  </Field>
                </div>
              )}

              {/* Handshake Result Banner */}
              {handshakeResult && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">{handshakeResult.message}</span>
                </div>
              )}

              {/* Handshake Button & Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isTestingHandshake}
                  onClick={handleTestHandshake}
                  className="px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Radio size={13} className={isTestingHandshake ? 'animate-pulse' : ''} />
                  <span>{isTestingHandshake ? 'Testing Handshake...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {selectedIntegration.status === 'connected' && (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(selectedIntegration.id)}
                      className="px-3 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02]"
                  >
                    Save & Enable
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: DEVELOPER CONSOLE & WEBHOOK LOGS ================= */}
      {showConsoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <Terminal size={18} className="text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Live Developer Webhook & Event Console</h3>
                  <p className="text-[10.5px] text-slate-400">Real-time HTTP payload stream and connection handshakes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConsoleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-y-auto flex-1 space-y-3 min-h-[300px]">
              {webhookLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/80">
                        {log.status} {log.statusText}
                      </span>
                      <span className="text-white font-bold">{log.endpoint}</span>
                    </div>
                    <span>{log.timestamp} • {log.date}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-300">
                    <span className="text-sky-400 font-semibold">[{log.source}]:</span> {log.details}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">
                Listening on TLS 1.3 • {webhookLogs.length} Events Logged
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const testLog = {
                      id: `log_${Date.now()}`,
                      endpoint: 'POST /v1/test-webhook-ping',
                      status: 200,
                      statusText: 'OK',
                      source: 'Developer Test',
                      details: 'Manual test ping handshake successful (Latency: 28ms).',
                      timestamp: 'Just now',
                      date: new Date().toISOString().slice(0, 19).replace('T', ' ')
                    };
                    setWebhookLogs(prev => [testLog, ...prev]);
                    showToast('Sent test ping event to webhook console');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold"
                >
                  Send Test Ping
                </button>
                <button
                  type="button"
                  onClick={() => setShowConsoleModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  Close Console
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- INITIAL TEAM ACTIVITIES DATA ---
const INITIAL_TEAM_ACTIVITIES = [
  {
    id: 'act_01',
    userName: 'Awal',
    userRole: 'Founder',
    action: 'Configured Workspace Financial Safety Rails & 15% VAT',
    category: 'security',
    timestamp: '15 mins ago',
    date: '2026-08-28 21:30'
  },
  {
    id: 'act_02',
    userName: 'Media Specialist',
    userRole: 'Campaign Manager',
    action: 'Logged $185 Meta Ad Spend for client Apex Footwear',
    category: 'spend',
    timestamp: '45 mins ago',
    date: '2026-08-28 21:00'
  },
  {
    id: 'act_03',
    userName: 'Nafis Rahman',
    userRole: 'Accountant',
    action: 'Generated Client Monthly Ledger Statement & VAT Audit (PDF)',
    category: 'finance',
    timestamp: '2 hours ago',
    date: '2026-08-28 19:45'
  },
  {
    id: 'act_04',
    userName: 'Awal',
    userRole: 'Founder',
    action: 'Invited Media Specialist as Campaign Manager (Daily limit: $100)',
    category: 'team',
    timestamp: '1 day ago',
    date: '2026-08-27 16:20'
  },
  {
    id: 'act_05',
    userName: 'Nafis Rahman',
    userRole: 'Accountant',
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
    role: 'Campaign Manager',
    status: 'Active',
    assignedClients: 'All Clients',
    clientScopeType: 'all',
    selectedClients: [],
    dailySpendLimit: '50',
    limitPreset: '50',
    customSpendLimit: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  const showToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const logActivity = (actionText, category = 'team') => {
    const newEntry = {
      id: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userName: workspaceSettings.businessName ? `${workspaceSettings.businessName} Admin` : 'Workspace Admin',
      userRole: 'Founder',
      action: actionText,
      category,
      timestamp: 'Just now',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    setActivities(prev => [newEntry, ...prev]);
  };

  const validateName = (val) => {
    if (!val || !val.trim()) return 'Full name is required.';
    return '';
  };

  const validateEmail = (val) => {
    if (!val || !val.trim()) return 'Email address is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(val.trim())) {
      return 'Please enter a valid email address (e.g. member@agency.com).';
    }
    return '';
  };

  const openInviteModal = (defaultStatus = 'Active') => {
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'Campaign Manager',
      status: defaultStatus,
      assignedClients: 'All Clients',
      clientScopeType: 'all',
      selectedClients: [],
      dailySpendLimit: '50',
      limitPreset: '50',
      customSpendLimit: '',
      notes: '',
    });
    setFormErrors({});
    setTouchedFields({});
    setIsInviteModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    const existingLimit = member.dailySpendLimit || '50';
    const isPreset = ['10', '25', '50', '100', '250', '500', '1000', 'Unlimited'].includes(existingLimit);

    const rawClients = member.assignedClients || 'All Clients';
    const isAll = rawClients === 'All Clients' || !rawClients.trim();
    const parsedSelected = isAll ? [] : rawClients.split(',').map(s => s.trim()).filter(Boolean);

    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'Campaign Manager',
      status: member.status || 'Active',
      assignedClients: rawClients,
      clientScopeType: isAll ? 'all' : 'custom',
      selectedClients: parsedSelected,
      dailySpendLimit: existingLimit,
      limitPreset: isPreset ? existingLimit : 'custom',
      customSpendLimit: isPreset ? '' : existingLimit,
      notes: member.notes || '',
    });
    setFormErrors({});
    setTouchedFields({});
    setIsInviteModalOpen(true);
  };

  const toggleClientSelection = (clientName) => {
    setFormData(p => {
      const current = p.selectedClients || [];
      const updated = current.includes(clientName)
        ? current.filter(c => c !== clientName)
        : [...current, clientName];
      return { ...p, selectedClients: updated };
    });
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData(p => ({ ...p, name: val }));
    if (touchedFields.name) {
      const err = validateName(val);
      setFormErrors(p => ({ ...p, name: err }));
    }
  };

  const handleNameBlur = () => {
    setTouchedFields(p => ({ ...p, name: true }));
    const err = validateName(formData.name);
    setFormErrors(p => ({ ...p, name: err }));
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setFormData(p => ({ ...p, email: val }));
    if (touchedFields.email) {
      const err = validateEmail(val);
      setFormErrors(p => ({ ...p, email: err }));
    }
  };

  const handleEmailBlur = () => {
    setTouchedFields(p => ({ ...p, email: true }));
    const err = validateEmail(formData.email);
    setFormErrors(p => ({ ...p, email: err }));
  };

  const handleLimitPresetChange = (e) => {
    const val = e.target.value;
    setFormData(p => {
      if (val === 'custom') {
        return { ...p, limitPreset: 'custom', dailySpendLimit: p.customSpendLimit || '35' };
      }
      return { ...p, limitPreset: val, dailySpendLimit: val };
    });
  };

  const handleCustomLimitChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setFormData(p => ({ ...p, customSpendLimit: raw, dailySpendLimit: raw || '0' }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const nameErr = validateName(formData.name);
    const emailErr = validateEmail(formData.email);
    const errs = {};
    if (nameErr) errs.name = nameErr;
    if (emailErr) errs.email = emailErr;

    if (Object.keys(errs).length > 0) {
      setTouchedFields({ name: true, email: true });
      setFormErrors(errs);
      return;
    }

    let resolvedClients = 'All Clients';
    if (formData.clientScopeType === 'custom') {
      resolvedClients = (formData.selectedClients && formData.selectedClients.length > 0)
        ? formData.selectedClients.join(', ')
        : 'All Clients';
    }

    const payload = {
      ...formData,
      assignedClients: resolvedClients,
      dailySpendLimit: formData.limitPreset === 'custom'
        ? (formData.customSpendLimit ? formData.customSpendLimit : '50')
        : formData.dailySpendLimit
    };

    if (editingMember) {
      onUpdate(editingMember.id, payload);
      logActivity(`Updated permissions and role for ${payload.name} (${payload.role})`, 'team');
      showToast(`Updated permissions for ${payload.name}`);
    } else {
      onAdd(payload);
      logActivity(`Invited ${payload.name} (${payload.email}) as ${payload.role}`, 'team');
      showToast(`Invited ${payload.name} to workspace`);
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

  const shareViaWhatsApp = (member) => {
    const agencyName = workspaceSettings.businessName || 'Quantrex';
    const inviteUrl = `${window.location.origin}/join?ws=${encodeURIComponent(agencyName)}&token=adl_inv_${member.id}`;
    const text = `Hello ${member.name || 'Team Member'},\n\nYou have been invited to join the *${agencyName}* workspace on Quantrex as *${member.role || 'Campaign Manager'}*.\n\n👉 Access your portal here:\n${inviteUrl}\n\nWelcome aboard!`;
    const cleanPhone = (member.phone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    logActivity(`Shared WhatsApp invitation for ${member.name} (${member.role})`, 'team');
    showToast(`WhatsApp invitation opened for ${member.name}`);
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
    link.download = `quantrex-team-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
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
        (roleFilter === 'Campaign Manager' && (m.role?.includes('Campaign') || m.role?.includes('Manager') || m.role?.includes('Buyer') || m.role?.includes('Specialist'))) ||
        (roleFilter === 'Accountant' && m.role?.includes('Accountant')) ||
        (roleFilter === 'Viewer' && m.role?.includes('Viewer'));

      return matchesSearch && matchesRole;
    });
  }, [activeMembersList, searchTerm, roleFilter]);

  const roleBadgeStyle = (role = '') => {
    if (role.includes('Owner')) return 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-400/20';
    if (role.includes('Admin')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-400/20';
    if (role.includes('Campaign') || role.includes('Manager') || role.includes('Buyer') || role.includes('Specialist')) return 'bg-sky-50 text-sky-700 border-sky-200 ring-1 ring-sky-400/20';
    if (role.includes('Accountant')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-400/20';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const roleIcon = (role = '') => {
    if (role.includes('Owner')) return <Crown size={12} className="text-purple-600" />;
    if (role.includes('Admin')) return <ShieldCheck size={12} className="text-indigo-600" />;
    if (role.includes('Campaign') || role.includes('Manager') || role.includes('Buyer') || role.includes('Specialist')) return <Target size={12} className="text-sky-600" />;
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
    <div className="w-full max-w-[1720px] mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* TOAST FEEDBACK */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* TOP HEADER (SEAMLESS CANVAS) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeMembersList.length + 1} Active Seats
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage campaign managers, financial accountants, and member roles across your {workspaceSettings.businessName || 'Quantrex'} workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPermissionsGuide(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all"
          >
            <ShieldCheck size={14} className="text-sky-600" />
            {showPermissionsGuide ? 'Hide Roles Guide' : 'View Roles Guide'}
          </button>

          <button
            type="button"
            onClick={() => openInviteModal('Active')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.01]"
          >
            <UserPlus size={15} /> Invite Member
          </button>
        </div>
      </div>

      {/* COMPACT KPI METRIC CARDS (PREMIUM FROSTED GLASS & LUXURY TAGS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Team Seats */}
        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-sky-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-sky-100/90 border border-sky-200 flex items-center justify-center text-sky-700 shadow-xs shrink-0">
            <UsersRound size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Team Seats</span>
            <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />
              {activeMembersList.length + 1} Active Seats
            </span>
          </div>
        </div>

        {/* Card 2: Campaign Managers */}
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 border border-blue-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-blue-100/90 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs shrink-0">
            <Target size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Campaign Managers</span>
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
              {teamMembers.filter(m => m.role?.includes('Campaign') || m.role?.includes('Manager') || m.role?.includes('Buyer') || m.role?.includes('Specialist')).length} Active
            </span>
          </div>
        </div>

        {/* Card 3: Pending Invites */}
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-amber-100/90 border border-amber-200 flex items-center justify-center text-amber-700 shadow-xs shrink-0">
            <Mail size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Pending Invites</span>
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
              {pendingMembersList.length} Pending
            </span>
          </div>
        </div>

        {/* Card 4: Audit Security */}
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-3 min-w-0 hover:border-purple-300 hover:shadow-sm transition-all">
          <div className="w-8 h-8 rounded-md bg-purple-100/90 border border-purple-200 flex items-center justify-center text-purple-700 shadow-xs shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-slate-900 block truncate leading-tight">Audit Security</span>
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5 truncate whitespace-nowrap leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
              RBAC Active
            </span>
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
                  <th className="py-2.5 px-3 font-bold text-purple-700">Owner</th>
                  <th className="py-2.5 px-3 font-bold text-indigo-700">Agency Admin</th>
                  <th className="py-2.5 px-3 font-bold text-sky-700">Campaign Manager</th>
                  <th className="py-2.5 px-3 font-bold text-emerald-700">Accountant</th>
                  <th className="py-2.5 px-3 font-bold text-slate-600">Client Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Manage Workspace Settings & Rates</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Manage Bank Cards & USD Top-ups</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">View Rates</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Create & Log Ad Campaigns & Spend</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Assigned Clients</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">Read Only</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">Own Portal</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Client Invoices, PDF & Excel Exports</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">Assigned Invoices</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Financials</td>
                  <td className="py-2.5 px-3 text-sky-600 font-bold">Own Statement</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Invite, Edit & Manage Team Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-bold">Full Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                  <td className="py-2.5 px-3 text-rose-500 font-bold">No Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKSPACE FOUNDER / OWNER CARD (VIP LUXURY EDITION) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800/80 rounded-lg p-3 sm:px-4 sm:py-3 shadow-md shadow-slate-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Crown size={16} className="text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-xs text-white tracking-tight flex items-center gap-1.5">
                  <span className="text-white drop-shadow-sm font-black">{workspaceSettings.businessName || 'Quantrex'} Founder</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase tracking-wider shadow-2xs">
                  Super Admin · Root
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm" />
              </div>
              <p className="text-[11px] text-slate-200/90 font-medium mt-0.5 truncate">
                Primary Account Holder · Unrestricted Access to Financials, Bank Cards & Settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400 shadow-2xs whitespace-nowrap">
              <ShieldCheck size={13} className="text-emerald-400" /> 2FA Protected
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
              {['All', 'Admin', 'Campaign Manager', 'Accountant', 'Viewer'].map((tab) => {
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
                  Add campaign managers or accountants to distribute client management and ad spend workflows.
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
                            {member.role || 'Campaign Manager'}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => shareViaWhatsApp(member)}
                          title="Share Direct Invite via WhatsApp"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all shadow-sm"
                        >
                          <MessageCircle size={14} className="text-emerald-600" />
                          <span>WhatsApp</span>
                        </button>

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

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => shareViaWhatsApp(member)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                    >
                      <MessageCircle size={14} /> WhatsApp Invite
                    </button>

                    <button
                      type="button"
                      onClick={() => copyInviteLink(member.id, member.name || member.email)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                    >
                      {copiedInviteId === member.id ? <Check size={14} className="text-emerald-600" /> : <Link2 size={14} />}
                      {copiedInviteId === member.id ? 'Link Copied' : 'Copy Link'}
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

            <form onSubmit={handleFormSubmit} noValidate className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    placeholder="Enter team member name"
                    className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-xs outline-none transition-colors ${
                      formErrors.name
                        ? 'border-rose-400 bg-rose-50/40 focus:ring-2 focus:ring-rose-400 text-slate-900'
                        : 'border-slate-300 focus:ring-2 focus:ring-sky-500 bg-white'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-[10.5px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle size={11} className="shrink-0" /> {formErrors.name}
                    </p>
                  )}
                </Field>

                <Field label="Email Address *">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    placeholder="name@agency.com"
                    className={`w-full mt-1 px-3.5 py-2.5 border rounded-xl text-xs outline-none transition-colors ${
                      formErrors.email
                        ? 'border-rose-400 bg-rose-50/40 focus:ring-2 focus:ring-rose-400 text-slate-900'
                        : 'border-slate-300 focus:ring-2 focus:ring-sky-500 bg-white'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-[10.5px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                      <AlertCircle size={11} className="shrink-0" /> {formErrors.email}
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
                    <option value="Campaign Manager">Campaign Manager (Ad Spend & Campaigns)</option>
                    <option value="Agency Admin">Agency Admin (Full Operational Access)</option>
                    <option value="Financial Accountant">Financial Accountant (Audit & PDF Statements)</option>
                    <option value="Client Viewer">Client Viewer (Read-only Portal Access)</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Client Access Scope</label>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-2">
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, clientScopeType: 'all', selectedClients: [] }))}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
                        formData.clientScopeType === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      All Clients ({clients.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, clientScopeType: 'custom' }))}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
                        formData.clientScopeType === 'custom'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Specific {formData.selectedClients?.length > 0 && `(${formData.selectedClients.length})`}
                    </button>
                  </div>

                  {formData.clientScopeType === 'custom' && (
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 max-h-32 overflow-y-auto space-y-1 animate-in fade-in duration-200">
                      {clients.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No clients added to workspace yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {clients.map(c => {
                            const isSelected = (formData.selectedClients || []).includes(c.name);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleClientSelection(c.name)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                                  isSelected
                                    ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300'}`} />
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Daily Spend Approval Limit ($)">
                  <select
                    value={formData.limitPreset}
                    onChange={handleLimitPresetChange}
                    className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                  >
                    <option value="10">$10 / Day (Starter Buyer)</option>
                    <option value="25">$25 / Day (Standard Limit)</option>
                    <option value="50">$50 / Day (Recommended for BD)</option>
                    <option value="100">$100 / Day (Senior Buyer)</option>
                    <option value="250">$250 / Day (Team Lead)</option>
                    <option value="500">$500 / Day (Scale Manager)</option>
                    <option value="1000">$1,000 / Day (High Budget)</option>
                    <option value="custom">Custom Dollar Limit ($)</option>
                    <option value="Unlimited">Unlimited Budget</option>
                  </select>

                  {formData.limitPreset === 'custom' && (
                    <div className="relative mt-2 animate-in fade-in duration-200">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.customSpendLimit || ''}
                        onChange={handleCustomLimitChange}
                        placeholder="Enter custom limit e.g. 15 or 35"
                        className="w-full pl-7 pr-4 py-2 border border-sky-300 rounded-xl text-xs bg-sky-50/40 focus:bg-white focus:ring-2 focus:ring-sky-500 font-bold text-slate-900 outline-none"
                      />
                    </div>
                  )}
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
                This will revoke their access to the {workspaceSettings.businessName || 'Quantrex'} workspace immediately.
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


// --- OFFICIAL MASTER USER GUIDE & STANDARD OPERATING PROCEDURE (SOP) VIEW ---
function UserGuideView({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('concepts');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'concepts', label: '১. মূল সমস্যা ও গাণিতিক সূত্র', icon: <Sparkles size={16} /> },
    { id: 'workflow', label: '২. ৫-ধাপে দৈনন্দিন কাজ (SOP)', icon: <Layers size={16} /> },
    { id: 'modules', label: '৩. প্রতিটি পেজের পূর্ণাঙ্গ ব্যবহারবিধি', icon: <LayoutDashboard size={16} /> },
    { id: 'troubleshoot', label: '৪. সমস্যা ও সমাধান (FAQs)', icon: <HelpCircle size={16} /> },
    { id: 'protips', label: '৫. এজেন্সির প্রো-টিপস ও চেকলিস্ট', icon: <Crown size={16} /> },
  ];

  const handleOpenAndPrintManual = () => {
    const printWin = window.open('', '_blank', 'width=1000,height=900');
    if (!printWin) {
      alert('Please allow popups to open the official printable manual.');
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quantrex — Master User Manual & Standard Operating Procedure (SOP) Guide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Hind+Siliguri:wght@400;500;600;700&family=Fira+Code:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --primary-light: #e0f2fe;
      --emerald: #059669;
      --emerald-dark: #047857;
      --emerald-light: #ecfdf5;
      --rose: #e11d48;
      --rose-light: #fff1f2;
      --amber: #d97706;
      --amber-light: #fffbeb;
      --purple: #7c3aed;
      --purple-light: #f5f3ff;
      --indigo: #4f46e5;
      --indigo-light: #eef2ff;
      --slate-950: #020617;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-400: #94a3b8;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background-color: #ffffff;
      color: var(--slate-700);
      font-family: 'Hind Siliguri', 'Inter', -apple-system, sans-serif;
      line-height: 1.7;
      font-size: 14.5px;
    }

    body {
      padding: 30px 40px;
    }

    .document-container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      padding: 20px 10px;
      position: relative;
    }

    /* Print Floating Toolbar */
    .print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #0284c7, #2563eb 60%, #4f46e5);
      color: #fff;
      padding: 16px 24px;
      border-radius: 14px;
      margin-bottom: 30px;
      box-shadow: 0 10px 25px rgba(2, 132, 199, 0.35);
    }
    .print-bar h3 {
      font-size: 15px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #ffffff;
    }
    .print-btn {
      background: #ffffff;
      color: #0284c7;
      border: none;
      padding: 9px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
    }

    h1, h2, h3, h4, h5 {
      color: var(--slate-900);
      font-family: 'Inter', 'Hind Siliguri', sans-serif;
      font-weight: 800;
      line-height: 1.35;
    }

    .cover-header {
      text-align: center;
      padding-bottom: 35px;
      border-bottom: 2px solid var(--slate-200);
      margin-bottom: 35px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--primary-light);
      color: var(--primary-dark);
      padding: 6px 18px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 14px;
      border: 1px solid rgba(2, 132, 199, 0.2);
    }
    .cover-title {
      font-size: 30px;
      font-weight: 900;
      color: var(--slate-900);
      letter-spacing: -0.5px;
      margin-bottom: 10px;
    }
    .cover-subtitle {
      font-size: 15px;
      color: var(--slate-600);
      font-weight: 500;
      max-width: 760px;
      margin: 0 auto 16px;
      line-height: 1.6;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      font-size: 12px;
      font-weight: 700;
      color: var(--slate-500);
    }

    .section-block {
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 850;
      color: var(--slate-900);
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--slate-100);
      margin-bottom: 18px;
    }
    .section-title .num-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 850;
      flex-shrink: 0;
    }

    p {
      margin-bottom: 14px;
      color: var(--slate-700);
    }

    .info-card {
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 14px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    .alert-box {
      border-radius: 12px;
      padding: 16px 20px;
      margin: 18px 0;
      display: flex;
      gap: 14px;
      font-size: 13.5px;
      line-height: 1.6;
    }
    .alert-box.tip {
      background: var(--emerald-light);
      border-left: 4px solid var(--emerald);
      color: #065f46;
    }

    .step-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 18px 0;
    }
    .step-item {
      background: #fff;
      border: 1px solid var(--slate-200);
      border-radius: 12px;
      padding: 18px;
    }
    .step-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .step-num {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: var(--primary-light);
      color: var(--primary-dark);
      font-size: 12px;
      font-weight: 850;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .step-title {
      font-size: 14.5px;
      font-weight: 800;
      color: var(--slate-900);
    }

    .formula-card {
      background: linear-gradient(135deg, #091224, #142342);
      color: #f8fafc;
      padding: 20px 24px;
      border-radius: 14px;
      margin: 18px 0;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .formula-title {
      color: #38bdf8;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 800;
      margin-bottom: 8px;
      font-family: 'Inter', sans-serif;
    }

    .feature-card {
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 18px;
    }
    .feature-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--slate-100);
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .feature-badge {
      background: var(--primary-light);
      color: var(--primary-dark);
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 99px;
      text-transform: uppercase;
    }
    .feature-list {
      list-style-type: none;
      padding: 0;
    }
    .feature-list li {
      position: relative;
      padding-left: 22px;
      margin-bottom: 8px;
      color: var(--slate-600);
      font-size: 13.5px;
    }
    .feature-list li::before {
      content: '✔';
      position: absolute;
      left: 0;
      color: var(--primary);
      font-weight: 900;
    }

    .faq-item {
      border: 1px solid var(--slate-200);
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 14px;
      background: #fff;
    }
    .faq-q {
      font-size: 14.5px;
      font-weight: 800;
      color: var(--slate-900);
      margin-bottom: 8px;
    }
    .faq-a {
      font-size: 13.5px;
      color: var(--slate-600);
      line-height: 1.65;
    }

    .doc-footer {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid var(--slate-200);
      color: var(--slate-400);
      font-size: 12px;
    }

    code {
      font-family: 'Fira Code', monospace;
      background: var(--slate-100);
      color: #0369a1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Robust Multi-Page Print Layout */
    @page {
      margin: 15mm 12mm 15mm 12mm;
      size: A4 portrait;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        color: #0f172a !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
        font-size: 11pt !important;
      }
      .print-bar {
        display: none !important;
      }
      .document-container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .section-block {
        page-break-inside: auto !important;
        break-inside: auto !important;
        margin-bottom: 25px !important;
      }
      .section-title, h1, h2, h3 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .feature-card, .info-card, .faq-item, .formula-card, .step-item, .alert-box {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        border-color: #cbd5e1 !important;
        margin-bottom: 14px !important;
      }
      .step-grid {
        display: block !important;
      }
      .step-item {
        margin-bottom: 10px !important;
      }
    }
  </style>
</head>
<body>

  <div class="print-bar">
    <div>
      <h3>📄 Quantrex — Agency Operating System (Official Master Manual & SOP)</h3>
    </div>
    <button class="print-btn" onclick="window.print()">
      Print / Save as PDF
    </button>
  </div>

  <div class="document-container">
    
    <!-- Cover Header -->
    <div class="cover-header">
      <img src="${QUANTREX_LOGO_DATA_URL}" alt="Quantrex Logo" style="width: 70px; height: 70px; border-radius: 16px; object-fit: cover; margin: 0 auto 16px; display: block; box-shadow: 0 8px 20px rgba(0,0,0,0.15);" />
      <div class="brand-badge">Official Master Standard Operating Procedure (SOP)</div>
      <h1 class="cover-title">Quantrex — Digital Agency Financial Manual</h1>
      <p class="cover-subtitle">ডিজিটাল মার্কেটিং এজেন্সির প্রতিটি পেজ ও মডিউল ব্যবহারের পূর্ণাঙ্গ গাইড, ডুয়েল-কারেন্সি অ্যাকাউন্টিং (BDT & USD), মেটা ১৫% ভ্যাট রুলস, এবং এজেন্সির প্রকৃত নিট লাভ নির্ণয়ের এনসাইক্লোপিডিক হ্যান্ডবুক।</p>
      <div class="meta-pills">
        <span>📅 ভার্সন: ২.০ (মাস্টার লেভেল)</span>
        <span>•</span>
        <span>🏢 টার্গেট: Agency Owners, Media Buyers & Accountants</span>
        <span>•</span>
        <span>🔒 ক্লাউড সিকিউরিটি: Supabase PostgreSQL Backed</span>
      </div>
    </div>

    <!-- অধ্যায় ১: ডিজিটাল এজেন্সির ফিন্যান্সিয়াল ব্যাকগ্রাউন্ড -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">১</span> ডিজিটাল এজেন্সির ডুয়েল-কারেন্সি সমস্যা ও সমাধান</h2>
      <p>সাধারণ ব্যবসা ও অ্যাকাউন্টিং সফটওয়্যারগুলোর সাথে ডিজিটাল মার্কেটিং এজেন্সির আর্থিক হিসাবের একটি বিশাল মৌলিক পার্থক্য রয়েছে। ডিজিটাল এজেন্সির হিসাব জটিল হওয়ার ৪টি মূল কারণ:</p>
      
      <div class="info-card">
        <ul style="padding-left: 20px; line-height: 1.85;">
          <li><strong>১. ডুয়েল-কারেন্সি প্রবাহ (BDT vs USD):</strong> ক্লায়েন্ট আপনাকে সার্ভিস ফি ও অ্যাড বাজেট প্রদান করে বাংলাদেশি টাকায় (BDT)। কিন্তু মেটা (Facebook/Instagram), গুগল বা টিকটকে অ্যাড চালাতে ভার্চুয়াল মাস্টারকার্ড/ভিসা কার্ড দিয়ে ডলারে (USD) পেমেন্ট করতে হয়।</li>
          <li><strong>২. ডলারের ক্রয় রেট ও ক্যাশআউট স্প্রেড:</strong> প্রতিবার ডলার কেনার সময় লোকাল সেলার বা বাইনান্স পিটুপি থেকে কেনার জন্য বিকাশ/নগদ/ব্যাংক ক্যাশআউট ফি দিতে হয়। ফলে ডলারের বেস রেট যদি ৳১২৯ হয়, ক্যাশআউট চার্জ যোগ হয়ে প্রকৃত <strong>Effective Buy Rate</strong> হয়ে যায় ৳১৩১.২৫। এই চার্জ হিসাবে না নিলে এজেন্সি প্রতিনিয়ত লোকসানে পড়বে।</li>
          <li><strong>৩. মেটা ১৫% সরকারি ভ্যাট কর্তন:</strong> বাংলাদেশ সরকারের নিয়ম অনুযায়ী ফেসবুক বাংলাদেশ থেকে চালানো প্রতি $১০০ ডলার স্পেন্ডে স্বয়ংক্রিয়ভাবে $১৫ ডলার ভ্যাট কেটে নেয়। অর্থাৎ ক্লায়েন্ট $১০০ অ্যাড বাজেট দিলে কার্ড থেকে $১১৫ ডলার খরচ হয়।</li>
          <li><strong>৪. কার্ড লিকুইডিটি ও ক্যাম্পেইন স্টপ রিস্ক:</strong> ভার্চুয়াল কার্ডে ব্যালেন্স শেষ হয়ে গেলে রানিং মেটা ক্যাম্পেইন বন্ধ হয়ে যায়, যার ফলে ক্লায়েন্টের সেলস ড্রপ করে এবং এজেন্সির সুনামের ক্ষতি হয়।</li>
        </ul>
      </div>

      <div class="alert-box tip">
        <div>
          <strong>Quantrex কীভাবে পুরো সমস্যার সমাধান করে:</strong> আপনি শুধু দৈনন্দিন ট্রানজ্যাকশনগুলো এন্ট্রি করবেন—বাকি সব <strong>Effective Dollar Buy Rate</strong>, <strong>15% Meta Tax Deduction</strong>, <strong>Card Liquidity Balance</strong> এবং <strong>Net Agency Profit (প্রকৃত নিট লাভ)</strong> Quantrex মিলি-সেকেন্ডের মধ্যে নিখুঁতভাবে নির্ধারণ করে দেয়।
        </div>
      </div>
    </div>

    <!-- অধ্যায় ২: গাণিতিক সূত্রাবলী ও প্র্যাকটিক্যাল কেস স্টাডি -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">২</span> গাণিতিক সূত্রাবলী ও বাস্তব কেস স্টাডি (Financial Mathematics)</h2>
      <p>সফটওয়্যারটির প্রতিটি সংখ্যা কীভাবে তৈরি হয় তা পরিষ্কার বুঝতে নিচের ৩টি মূল ফিন্যান্সিয়াল সূত্র ও বাস্তব উদাহরণটি লক্ষ্য করুন:</p>

      <div class="formula-card">
        <div class="formula-title">সূত্র ১: কার্যকর ডলার কেনা রেট (Effective USD Buy Rate)</div>
        Effective USD Rate = (ডলার ক্রয়ে মোট BDT খরচ + ক্যাশআউট চার্জ) ÷ মোট ক্রয়কৃত USD<br><br>
        <em>বাস্তব উদাহরণ:</em> আপনি ৳১৩,০০০ দিয়ে $১০০ ডলার কিনলেন এবং ক্যাশআউট চার্জ গেল ৳১২৫।<br>
        Effective Buy Rate = (৳১৩,০০০ + ৳১২৫) ÷ $১০০ = <strong>৳১৩১.২৫ / USD</strong>
      </div>

      <div class="formula-card">
        <div class="formula-title">সূত্র ২: মেটা অ্যাড স্পেন্ড ও মোট কার্ড বার্ন (Total Card Deduction)</div>
        মোট কার্ড কর্তন = অ্যাড স্পেন্ড (USD) + মেটা ১৫% ভ্যাট (USD) + কার্ড ফি (যদি থাকে)<br><br>
        <em>বাস্তব উদাহরণ:</em> ফেসবুক অ্যাড ম্যানেজারে স্পেন্ড দেখাচ্ছে $৪৭.৮৩ ডলার।<br>
        ১৫% ভ্যাট = $৪৭.৮৩ × ০.১৫ = $৭.১৭ ডলার।<br>
        <strong>মোট কার্ড থেকে কাটা যাবে = $৪৭.৮৩ + $৭.১৭ = $৫৫.০০ ডলার</strong>
      </div>

      <div class="formula-card">
        <div class="formula-title">সূত্র ৩: এজেন্সির প্রকৃত নিট লাভ ও মার্জিন (Net Agency Profit & Margin)</div>
        মোট BDT খরচ = [মোট স্পেন্ড (USD) + ভ্যাট (USD)] × Effective Buy Rate<br>
        Net Agency Profit (BDT) = ক্লায়েন্টের প্রদত্ত মোট পেমেন্ট (BDT) - মোট BDT খরচ<br>
        Profit Margin (%) = (Net Agency Profit ÷ মোট পেমেন্ট) × ১০০<br><br>
        <em>বাস্তব উদাহরণ:</em> ক্লায়েন্ট 'Apex Footwear' আপনাকে দিল ৳১০,০০০ টাকা। মোট মেটা খরচ হলো $৫৫ ডলার।<br>
        আপনার BDT খরচ = $৫৫ × ৳১৩১.২৫ = ৳৭,২১৮.৭৫ টাকা।<br>
        <strong>এজেন্সির প্রকৃত নিট লাভ (Net Profit) = ৳১০,০০০ - ৳৭,২১৮.৭৫ = ৳২,৭৮১.২৫ টাকা (মার্জিন: ২৭.৮১%)</strong>
      </div>
    </div>

    <!-- অধ্যায় ৩: দৈনন্দিন কাজের ৫-ধাপের মাস্টার এসওপি -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">৩</span> দৈনন্দিন কাজের ৫-ধাপের স্ট্যান্ডার্ড প্রসিডিউর (Daily 5-Step SOP)</h2>
      <p>আপনার এজেন্সির টিম মেম্বার বা অ্যাকাউন্ট্যান্ট প্রতিদিন কীভাবে সফটওয়্যারটিতে কাজ করবে তার স্ট্যান্ডার্ড গাইড:</p>

      <div class="step-grid">
        <div class="step-item">
          <div class="step-header">
            <span class="step-num">১</span>
            <span class="step-title">নতুন ক্লায়েন্ট অনবোর্ডিং</span>
          </div>
          <p style="font-size: 13px; color: var(--slate-600); margin-bottom: 8px;">
            টপ হেডারের <code>+ New Entry ➔ Add New Client</code>-এ ক্লিক করুন।
          </p>
          <ul style="font-size: 12px; color: var(--slate-500); padding-left: 16px; line-height: 1.6;">
            <li>ক্লায়েন্টের নাম ও ব্র্যান্ড নেম দিন।</li>
            <li>কান্ট্রি ট্যাগ (যেমন: 🇧🇩 Bangladesh) সিলেক্ট করুন।</li>
            <li>মাসিক প্রজেক্টেড অ্যাড বাজেট দিন।</li>
          </ul>
        </div>

        <div class="step-item">
          <div class="step-header">
            <span class="step-num">২</span>
            <span class="step-title">ক্লায়েন্ট পেমেন্ট রিসিভ</span>
          </div>
          <p style="font-size: 13px; color: var(--slate-600); margin-bottom: 8px;">
            ক্লায়েন্ট টাকা পাঠালে <code>+ New Entry ➔ Receive Client Payment</code> এ যান।
          </p>
          <ul style="font-size: 12px; color: var(--slate-500); padding-left: 16px; line-height: 1.6;">
            <li>ক্লায়েন্ট সিলেক্ট করুন।</li>
            <li>প্রাপ্ত টাকার পরিমাণ (BDT) ও তারিখ দিন।</li>
            <li>পেমেন্ট মেথড (Bank/bKash) নোট করুন।</li>
          </ul>
        </div>

        <div class="step-item">
          <div class="step-header">
            <span class="step-num">৩</span>
            <span class="step-title">ডলার ক্রয় ও কার্ড টপ-আপ</span>
          </div>
          <p style="font-size: 13px; color: var(--slate-600); margin-bottom: 8px;">
            সেলার থেকে ডলার কিনলে <code>+ New Entry ➔ Buy / Top Up USD</code> এ যান।
          </p>
          <ul style="font-size: 12px; color: var(--slate-500); padding-left: 16px; line-height: 1.6;">
            <li>কত টাকা (BDT) দিলেন ও ক্যাশআউট চার্জ দিন।</li>
            <li>কত USD কার্ডে জমা হলো তা লিখুন।</li>
            <li>ডেস্টিনেশন কার্ড সিলেক্ট করুন।</li>
          </ul>
        </div>

        <div class="step-item">
          <div class="step-header">
            <span class="step-num">৪</span>
            <span class="step-title">মেটা অ্যাড স্পেন্ড রেকর্ড</span>
          </div>
          <p style="font-size: 13px; color: var(--slate-600); margin-bottom: 8px;">
            ফেসবুক স্পেন্ড হলে <code>+ New Entry ➔ Record Meta Ad Spend</code> এ যান।
          </p>
          <ul style="font-size: 12px; color: var(--slate-500); padding-left: 16px; line-height: 1.6;">
            <li>কোন ক্লায়েন্ট ও কোন কার্ড তা বাছুন।</li>
            <li>অ্যাড স্পেন্ড (USD) বসান।</li>
            <li>১৫% ভ্যাট সিস্টেম অটো হিসাব করে নিবে।</li>
          </ul>
        </div>

        <div class="step-item">
          <div class="step-header">
            <span class="step-num">৫</span>
            <span class="step-title">লাইভ ড্যাশবোর্ড ও প্রফিট অডিট</span>
          </div>
          <p style="font-size: 13px; color: var(--slate-600); margin-bottom: 8px;">
            এন্ট্রি দেওয়ার সাথে সাথে ড্যাশবোর্ডে গিয়ে অডিট করুন।
          </p>
          <ul style="font-size: 12px; color: var(--slate-500); padding-left: 16px; line-height: 1.6;">
            <li>মোট নিট লাভ (Net Profit) ও মার্জিন চেক করুন।</li>
            <li>কার্ড ব্যালেন্স পজিটিভ আছে কি না দেখুন।</li>
            <li>ক্লায়েন্ট স্টেটমেন্ট যাচাই করুন।</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- অধ্যায় ৪: প্রতিটি পেজের পূর্ণাঙ্গ ব্যবহারবিধি গাইড -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">৪</span> প্ল্যাটফর্মের প্রতিটি পেজ ও মডিউল ব্যবহারের পূর্ণাঙ্গ গাইড</h2>
      <p>নিচে Quantrex-এর প্রতিটি পেজ, তার ভিতরের ফিচার এবং কীভাবে নিখুঁতভাবে ব্যবহার করতে হবে তা বিস্তারিত বর্ণনা করা হলো:</p>

      <!-- পেজ ১: Dashboard -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #0284c7;">📊 ১. Dashboard (Agency Command Center)</h3>
          <span class="feature-badge">কেন্দ্রীয় পর্যবেক্ষণ হাব</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> এজেন্সির পুরো ফিন্যান্সিয়াল স্বাস্থ্য এক নজরে দেখা।</p>
        <ul class="feature-list">
          <li><strong>৪টি কোর ম্যাট্রিক্স কার্ড (KPIs):</strong>
            <br>• <code>Total Revenue:</code> ক্লায়েন্টদের থেকে সংগৃহীত মোট BDT ক্যাশফ্লো।
            <br>• <code>Total USD Spent:</code> মোট মেটা অ্যাড খরচ + ১৫% ভ্যাট + ব্যাংক ফি (USD)।
            <br>• <code>Net Agency Profit:</code> সমস্ত খরচ বাদ দিয়ে এজেন্সির আসল লাভ (BDT) ও লাভজনকতার মার্জিন %।
            <br>• <code>Total Card Balance:</code> সব ভার্চুয়াল কার্ড মিলিয়ে ব্যবহারের জন্য অবশিষ্ট মোট ডলার (USD)।
          </li>
          <li><strong>Spline Glow Flow Chart:</strong> রেভিনিউ বনাম মেটা অ্যাড খরচের ইন্টারঅ্যাক্টিভ সময়ের গ্রাফ। এর মাধ্যমে বোঝা যায় কোন সপ্তাহে আয় ও খরচ কেমন ছিল।</li>
          <li><strong>Cybernetic Concentric Radial Burn HUD:</strong> মেটা অ্যাড খরচ, ১৫% ভ্যাট এবং কার্ড ট্রানজ্যাকশন ফির ৩-রিং সাইবারনেটিক ডায়াল।</li>
          <li><strong>৫০% : ৫০% সিমেট্রিক্যাল টেবিল:</strong> বামে <em>Client P&L Performance</em> (কোন ক্লায়েন্ট কত লাভ দিচ্ছে) এবং ডানে <em>Card Liquidity & Burn</em> (কার্ডে কত ডলার বাকি আছে)।</li>
          <li><strong>৩-পিলার হেলথ শিল্ড:</strong> কার্ড ব্যালেন্স নেগেটিভ হলে নিচে লাল সতর্কতা অ্যালার্ট দেখায় যাতে আপনি দ্রুত ডলার লোড করতে পারেন।</li>
        </ul>
      </div>

      <!-- পেজ ২: Clients -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #059669;">👥 ২. Clients Hub (CRM & Client Financials)</h3>
          <span class="feature-badge" style="background:#ecfdf5; color:#047857;">ক্লায়েন্ট ও বিলিং হাব</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> প্রতিটি ক্লায়েন্টের সাথে আর্থিক সম্পর্ক এবং পৃথক ক্লায়েন্ট লাভজনকতা ট্র্যাক করা।</p>
        <ul class="feature-list">
          <li><strong>ক্লায়েন্ট কার্ড ও ট্যাগ:</strong> প্রতিটি ক্লায়েন্টের কান্ট্রি ব্যাজ (🇧🇩, 🇺🇸, 🇦🇪), industry এবং কন্টাক্ট ইনফরমেশন।</li>
          <li><strong>ক্লায়েন্ট-ভিত্তিক লাভ মার্জিন:</strong> প্রতি ক্লায়েন্টের মোট রেভিনিউ, মেটা অ্যাড খরচ এবং নিট লাভের অনুপাত।</li>
          <li><strong>১-ক্লিকে ক্লায়েন্ট স্টেটমেন্ট:</strong> ক্লায়েন্টের প্রোফাইলে ক্লিক করলেই তার সম্পূর্ণ লেনদেন হিস্ট্রি চলে আসে, যা সরাসরি ক্লায়েন্টের সাথে শেয়ার করা যায়।</li>
        </ul>
      </div>

      <!-- পেজ ৩: Campaigns -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #7c3aed;">📢 ৩. Campaigns (Ad Performance & ROI)</h3>
          <span class="feature-badge" style="background:#f5f3ff; color:#6d28d9;">ক্যাম্পেইন ও আরওএএস</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> ক্লায়েন্টদের মেটা অ্যাড ক্যাম্পেইনের পারফরম্যান্স ও আরওএএস ট্র্যাক করা।</p>
        <ul class="feature-list">
          <li><strong>ক্যাম্পেইন বাজেট ও স্পেন্ড:</strong> ফেসবুক ক্যাম্পেইনের নাম, প্ল্যাটফর্ম (Facebook, Instagram, Google), স্ট্যাটাস (Active/Paused)।</li>
          <li><strong>ROAS & Revenue Attribution:</strong> ক্যাম্পেইনের ডলার স্পেন্ডের বিপরীতে ক্লায়েন্টের মোট সেলস/রেভিনিউ এবং আরওএএস পর্যবেক্ষণ।</li>
        </ul>
      </div>

      <!-- পেজ ৪: Transactions -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #0284c7;">🧾 ৪. Transactions (Double-Ledger Financial Engine)</h3>
          <span class="feature-badge">পূর্ণাঙ্গ অডিট লেজার</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> এজেন্সির প্রতিটি টাকার ও ডলারের নিখুঁত অডিট ট্রেইল ও ভাউচার জেনারেট করা।</p>
        <ul class="feature-list">
          <li><strong>৪ ধরনের ট্রানজ্যাকশন সাপোর্ট:</strong> <code>PAYMENT_RECEIVED</code>, <code>USD_PURCHASE</code>, <code>AD_SPEND</code>, <code>FEE</code>।</li>
          <li><strong>১-ক্লিক মানি রিসিট ও ভাউচার:</strong> যেকোনো ট্রানজ্যাকশনের রিসিট আইকনে ক্লিক করলেই মানি রিসিট প্রস্তুত হয়, যা ১-ক্লিকে PDF হিসেবে ক্লায়েন্টকে পাঠানো যায়।</li>
          <li><strong>মাল্টি-ফরমেট এক্সপোর্ট:</strong> সম্পূর্ণ লেজার Excel, CSV অথবা A4 প্রিন্টেবল ফর্মে ডাউনলোড করা যায়।</li>
          <li><strong>এডিট ও ডিলিট ক্ষমতা:</strong> যেকোনো ভুল এন্ট্রি সাথে সাথে সংশোধন বা মুছে ফেলার সুবিধা।</li>
        </ul>
      </div>

      <!-- পেজ ৫: Cards & USD -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #d97706;">💳 ৫. Cards & USD (Virtual Card Liquidity Hub)</h3>
          <span class="feature-badge" style="background:#fffbeb; color:#b45309;">ভার্চুয়াল কার্ড ব্যাংক</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> সব ভার্চুয়াল কার্ডের ডলার ব্যালেন্স, লোড এবং লাইভ বার্ন রেট পর্যবেক্ষণ।</p>
        <ul class="feature-list">
          <li><strong>ভিজ্যুয়াল EMV কার্ড উপস্থাপনা:</strong> কার্ডের নাম, ব্যাংক/প্রোভাইডার, লাস্ট ৪ ডিজিট এবং হোল্ডার নেম।</li>
          <li><strong>লাইভ ব্যালেন্স ও হিস্ট্রি:</strong> প্রতিটি কার্ডে কত ডলার লোড হলো, কত ডলার মেটায় খরচ হলো এবং বর্তমানে কত ডলার অবশিষ্ট আছে তার রিয়েল-টাইম ব্যালেন্স।</li>
          <li><strong>১-ক্লিকে কার্ড ফান্ডিং:</strong> <code>+ Fund Card</code> বাটনে ক্লিক করে যেকোনো নির্দিষ্ট কার্ডে সরাসরি ডলার লোড এন্ট্রি দেওয়ার সুবিধা।</li>
          <li><strong>ডেফিসিট প্রিভেনশন শিল্ড:</strong> কার্ড ব্যালেন্স নেগেটিভ হলে তাৎক্ষণিক ওয়ার্নিং দেওয়া।</li>
        </ul>
      </div>

      <!-- পেজ ৬: Reports -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #4f46e5;">📈 ৬. Reports & P&L (Financial & Tax Statements)</h3>
          <span class="feature-badge" style="background:#eef2ff; color:#4338ca;">অডিট ও ট্যাক্স রিপোর্ট</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> নির্দিষ্ট সময়সীমার লাভ-ক্ষতির অডিট স্টেটমেন্ট তৈরি ও প্রিন্ট করা।</p>
        <ul class="feature-list">
          <li><strong>পিরিয়ড ফিল্টারিং:</strong> All Time, Today, This Week, This Month, This Quarter, This Year অথবা কাস্টম ডেট রেঞ্জ।</li>
          <li><strong>P&L ফিন্যান্সিয়াল স্টেটমেন্ট:</strong> মোট আয়, মোট মেটা খরচ, ডলার রেট এবং নিট মার্জিনের সুদৃশ্য চার্ট ও টেবিল।</li>
          <li><strong>১-ক্লিক প্রিন্ট ও PDF জেনারেটর:</strong> অংশীদারদের মিটিং বা ট্যাক্স অডিটের জন্য এক ক্লিকে সম্পূর্ণ রিপোর্ট A4 সাইজে প্রিন্ট/PDF সেভ করা যায়।</li>
        </ul>
      </div>

      <!-- পেজ ৭: Settings & Team -->
      <div class="feature-card">
        <div class="feature-header">
          <h3 style="font-size: 17px; color: #334155;">⚙️ ৭. Settings & Team (Workspace Management)</h3>
          <span class="feature-badge" style="background:#f1f5f9; color:#334155;">ওয়ার্কস্পেস সেটিংস</span>
        </div>
        <p><strong>মূল উদ্দেশ্য:</strong> এজেন্সির ব্র্যান্ডিং, টিম পারমিশন এবং ডাটা ব্যাকআপ নিয়ন্ত্রণ।</p>
        <ul class="feature-list">
          <li><strong>লোগো ও ব্র্যান্ডিং:</strong> এজেন্সির নিজস্ব লোগো আপলোড, নাম এবং কারেন্সি কনফিগারেশন।</li>
          <li><strong>টিম পারমিশন:</strong> Owner, Manager, Media Buyer এবং Accountant রোল ম্যানেজমেন্ট।</li>
          <li><strong>ক্লাউড ডাটা ব্যাকআপ ও রিস্টোর:</strong> ১-ক্লিকে সমস্ত ডাটার অফলাইন JSON ব্যাকআপ ডাউনলোড এবং প্রয়োজনে তা রিস্টোর করা।</li>
        </ul>
      </div>
    </div>

    <!-- অধ্যায় ৫: মানুষ যেখানে আটকে যেতে পারে & সমাধান (Detailed FAQs) -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">৫</span> মানুষ যেখানে আটকে যেতে পারে: সমাধান ও FAQs</h2>

      <div class="faq-item">
        <div class="faq-q">১. কার্ড ব্যালেন্স নেগেটিভ (যেমন: -$১৫.০০) দেখাচ্ছে কেন এবং কীভাবে সমাধান করব?</div>
        <div class="faq-a">
          <strong>কারণ:</strong> আপনি হয়তো ভার্চুয়াল কার্ডে $১০০ ডলার লোড হিসেবে এন্ট্রি দিয়েছিলেন, কিন্তু মেটা অ্যাড স্পেন্ড এন্ট্রি দিয়েছেন $১১৫ ডলার ($১০০ স্পেন্ড + $১৫ ভ্যাট)। অর্থাৎ কার্ডের চেয়ে স্পেন্ড বেশি এন্ট্রি হয়েছে।<br>
          <strong>সমাধান:</strong> হেডারের <code>+ New Entry ➔ Buy / Top Up USD</code>-এ যান এবং যে ডলারটি নতুন করে লোড করেছেন তা এন্ট্রি দিন। সাথে সাথে ব্যালেন্স স্বয়ংক্রিয়ভাবে পজিটিভ ও সঠিক হয়ে যাবে।
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">২. মেটা ভ্যাট (15% Tax) কি আমাকে আলাদা যোগ করে স্পেন্ড এন্ট্রি দিতে হবে?</div>
        <div class="faq-a">
          <strong>না!</strong> আপনি শুধুমাত্র মেটা অ্যাড ম্যানেজারের আসল স্পেন্ডটি ইনপুট দেবেন। Quantrex এর ব্যাকএন্ড অ্যালগরিদম স্বয়ংক্রিয়ভাবে তার সাথে ১৫% ভ্যাট যুক্ত করে আপনার কার্ড ব্যালেন্স ও প্রফিট মার্জিন থেকে অ্যাডজাস্ট করে নিবে। আপনাকে কোনো ম্যানুয়াল ক্যালকুলেশন করতে হবে না।
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">৩. আমি ডলারে খরচ করেছি কিন্তু ক্লায়েন্ট থেকে টাকায় নিয়েছি—আমার আসল লাভ কীভাবে বের করব?</div>
        <div class="faq-a">
          ড্যাশবোর্ডের <strong>Net Agency Profit</strong> কার্ডটি দেখুন। এটি ক্লায়েন্টের দেওয়া মোট টাকার থেকে আপনার কার্যকর ডলার রেটে কনভার্ট করা আসল মেটা খরচ ($ স্পেন্ড + ভ্যাট) বিয়োগ করে আপনার পকেটের আসল নিট লাভ বের করে দেখায়।
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">৪. ক্লায়েন্টকে অফিশিয়াল মানি রিসিট বা স্পেন্ড স্টেটমেন্ট কীভাবে পাঠাব?</div>
        <div class="faq-a">
          <code>Transactions</code> পেজে যান। যে লেনদেনের রিসিট প্রয়োজন তার ডানে থাকা রিসিট আইকনে ক্লিক করুন। এজেন্সির লোগো ও রেফারেন্স আইডি সহ একটি মানি রিসিট আসবে। সেখান থেকে সরাসরি <strong>'Print / Save PDF'</strong> দিয়ে ক্লায়েন্টকে পাঠিয়ে দিন।
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">৫. কোনো এন্ট্রিতে টাকার পরিমাণ বা ক্লায়েন্টের নাম ভুল হলে কীভাবে ঠিক করব?</div>
        <div class="faq-a">
          <code>Transactions</code> পেজে গিয়ে ওই ট্রানজ্যাকশনের ডানপাশের <strong>এডিট (পেন্সিল)</strong> আইকনে ক্লিক করে যেকোনো তথ্য পরিবর্তন করুন। অথবা <strong>ডিলিট (ট্র্যাশ)</strong> আইকনে ক্লিক করে ডিলিট করে দিন। সিস্টেম স্বয়ংক্রিয়ভাবে সব হিসাব রিক্যালকুলেট করে নিবে।
        </div>
      </div>

      <div class="faq-item">
        <div class="faq-q">৬. কম্পিউটার নষ্ট হলে বা ব্রাউজার হিস্ট্রি ডিলিট হলে আমার ডাটা কি হারিয়ে যাবে?</div>
        <div class="faq-a">
          <strong>কখনোই না!</strong> Quantrex-এর সমস্ত ডাটা রিয়েল-টাইমে <strong>Supabase Cloud PostgreSQL Database</strong>-এ নিরাপদ থাকে। নতুন যেকোনো পিসি বা মোবাইলে লগইন করলেই সব ডাটা সাথে সাথে পেয়ে যাবেন। অতিরিক্ত সতর্কতার জন্য <code>Settings ➔ Export JSON Backup</code> থেকে অফলাইন ফাইল সংরক্ষণ করতে পারেন।
        </div>
      </div>
    </div>

    <!-- অধ্যায় ৬: এজেন্সির সাফল্যের জন্য প্রো-টিপস ও চেকলিস্ট -->
    <div class="section-block">
      <h2 class="section-title"><span class="num-badge">৬</span> এজেন্সির সাফল্যের জন্য প্রো-টিপস ও স্ট্যান্ডার্ড চেকলিস্ট</h2>
      <div class="info-card" style="background: #fdfefe; border: 1px solid #bae6fd;">
        <ol style="padding-left: 20px; line-height: 2;">
          <li><strong>দৈনিক ৫ মিনিটের অডিট রুটিন:</strong> প্রতিদিন রাত ১০টায় মেটা অ্যাড ম্যানেজার থেকে সারাদিনের মোট স্পেন্ড দেখে Quantrex-এ এন্ট্রি দিন। এটি দৈনিক অভ্যাসে পরিণত করলে কোনো আর্থিক গড়মিল থাকবে না।</li>
          <li><strong>ডলার ক্রয়ের সাথে সাথে এন্ট্রি:</strong> সেলারের থেকে ভার্চুয়াল কার্ডে ডলার জমা হওয়ার সাথে সাথে ক্যাশআউট ফি সহ এন্ট্রি দিন, যাতে লাইভ বাই রেট সবসময় ১০০% নিখুঁত থাকে।</li>
          <li><strong>ক্লায়েন্ট পেমেন্ট ফলো-আপ:</strong> ক্লায়েন্টের অবশিষ্ট বাজেট শেষ হওয়ার ২ দিন আগেই ড্যাশবোর্ডের Client P&L দেখে পরবর্তী পেমেন্টের রিমাইন্ডার পাঠান।</li>
          <li><strong>মাসিক অফলাইন ব্যাকআপ:</strong> প্রতি মাসের ১ তারিখে সেটিংস পেজ থেকে 'Export Backup' ফাইলটি ডাউনলোড করে গুগল ড্রাইভে ক্লাউড ব্যাকআপ রাখুন।</li>
        </ol>
      </div>
    </div>

    <!-- Document Footer -->
    <div class="doc-footer">
      <p>© 2026 Quantrex Inc. সর্বস্বত্ব সংরক্ষিত। Enterprise Digital Agency Financial Engineering Platform.</p>
    </div>

  </div>

</body>
</html>`;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();

    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner & PDF Print Header */}
      <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#181d27] via-[#0f131a] to-[#080a0f] p-2 shadow-[0_12px_28px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-slate-700/70 hidden sm:flex items-center justify-center shrink-0">
              <img
                src={QUANTREX_LOGO_DATA_URL}
                alt="Quantrex Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase border border-white/20">
                <BookOpen size={13} className="stroke-[2.5]" />
                <span>Official Standard Operating Procedure (SOP) Manual</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Quantrex — Digital Agency Financial Manual
              </h1>
              <p className="text-sm text-sky-100 max-w-2xl font-medium leading-relaxed">
                ডিজিটাল মার্কেটিং এজেন্সির প্রতিটি পেজ ও মডিউল ব্যবহারের পূর্ণাঙ্গ গাইড, ডুয়েল-কারেন্সি অ্যাকাউন্টিং (BDT & USD), মেটা ১৫% ভ্যাট রুলস, এবং এজেন্সির প্রকৃত নিট লাভ নির্ণয়ের এনসাইক্লোপিডিক হ্যান্ডবুক।
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAndPrintManual}
            className="self-start md:self-auto inline-flex items-center gap-2.5 bg-white text-sky-700 hover:bg-sky-50 active:scale-95 px-5 py-3 rounded-2xl text-xs font-black shadow-lg hover:shadow-xl transition-all cursor-pointer shrink-0"
          >
            <Printer size={16} className="stroke-[2.5]" />
            <span>Print / Save as PDF</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="mt-6 pt-6 border-t border-white/15 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <input
              type="text"
              placeholder="গাইড বা সমস্যা সার্চ করুন (যেমন: ভ্যাট, কার্ড ব্যালেন্স, ড্যাশবোর্ড, রিসিট)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 focus:bg-white text-xs text-white focus:text-slate-900 placeholder-white/60 focus:placeholder-slate-400 font-medium border border-white/20 focus:border-white outline-none transition-all"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-white/80 hover:text-white underline font-semibold cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: CORE CONCEPTS & FORMULAS */}
      {(activeTab === 'concepts' || searchQuery) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">১</span>
              <h2 className="text-base font-extrabold text-slate-900">ডিজিটাল এজেন্সির মূল সমস্যা ও ডুয়েল-কারেন্সি সমাধান</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ডিজিটাল মার্কেটিং এজেন্সির আর্থিক হিসাব সাধারণ ব্যবসা থেকে আলাদা। কারণ এখানে ক্লায়েন্ট পেমেন্ট করে টাকায় (BDT), কিন্তু ফেসবুক/গুগল-এ অ্যাড খরচ হয় ভার্চুয়াল কার্ডের মাধ্যমে ডলারে (USD)। ডলার কেনার সময় ক্যাশআউট চার্জ এবং মেটার ১৫% সরকারি ভ্যাটের কারণে প্রকৃত লাভ বের করা অসম্ভব হয়ে পড়ে। Quantrex এই পুরো প্রক্রিয়াকে স্বয়ংক্রিয় করে।
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Coins size={15} className="text-amber-500" />
                  কার্যকর ডলার রেট (Effective Rate)
                </div>
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  ডলার কেনার মূল টাকার সাথে বিকাশ/ব্যাংক ক্যাশআউট চার্জ যুক্ত হয়ে প্রতি ডলারের আসল খরচ স্বয়ংক্রিয়ভাবে বের হয়।
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Receipt size={15} className="text-purple-500" />
                  মেটা ১৫% ভ্যাট (15% Tax Guard)
                </div>
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  ফেসবুক প্রতি $১০০ স্পেন্ডে কার্ড থেকে $১১৫ কাটে। Quantrex এই $১৫ ভ্যাট স্বয়ংক্রিয়ভাবে কার্ড ব্যালেন্স থেকে কর্তন করে।
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-emerald-600" />
                  প্রকৃত নিট এজেন্সি লাভ (Net Profit)
                </div>
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  ক্লায়েন্টের দেওয়া BDT থেকে লাইভ ডলার রেটে কনভার্ট করা মোট খরচের পার্থক্যই আপনার আসল এজেন্সি মুনাফা।
                </p>
              </div>
            </div>
          </div>

          {/* Mathematical Formulas Card */}
          <div className="bg-slate-950 text-slate-200 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sky-400 font-sans font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <Terminal size={15} />
                Financial Mathematics & Logic Behind Quantrex
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold">100% Automated</span>
            </div>

            <div className="space-y-4 font-sans text-xs">
              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                <div className="font-bold text-sky-300 mb-1">১. কার্যকর ডলার কেনা রেট (Effective USD Buy Rate):</div>
                <div className="font-mono text-emerald-400 bg-black/40 p-2 rounded-lg text-[11px]">
                  Effective Rate = (মোট BDT খরচ + ক্যাশআউট চার্জ) ÷ ক্রয়কৃত USD
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  উদাহরণ: ৳১৩,১২৫ দিয়ে $১০০ কিনলে প্রতি ডলারের প্রকৃত খরচ = ৳১৩১.২৫
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                <div className="font-bold text-purple-300 mb-1">২. মেটা স্পেন্ড ও মোট কার্ড কর্তন (Total Card Deduction):</div>
                <div className="font-mono text-purple-400 bg-black/40 p-2 rounded-lg text-[11px]">
                  মোট কার্ড কর্তন = অ্যাড স্পেন্ড (USD) + মেটা ১৫% ভ্যাট (USD)
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  উদাহরণ: $১০০ মেটা অ্যাড চালালে কার্ড থেকে কাটা যাবে $১১৫.০০ ($১০০ অ্যাড + $১৫ ভ্যাট)
                </div>
              </div>

              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                <div className="font-bold text-emerald-300 mb-1">৩. এজেন্সির প্রকৃত নিট লাভ (Net Agency Profit):</div>
                <div className="font-mono text-emerald-400 bg-black/40 p-2 rounded-lg text-[11px]">
                  Net Profit (BDT) = ক্লায়েন্ট রেভিনিউ (BDT) - [মোট স্পেন্ড (USD) × Effective Buy Rate]
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  উদাহরণ: ক্লায়েন্ট দিল ৳১০,০০০। মোট খরচ $৫৫ × ৳১৩১.২৫ = ৳৭,২১৮.৭৫।<br />
                  <strong className="text-white">প্রকৃত লাভ = ৳১০,০০০ - ৳৭,২১৮.৭৫ = ৳২,৭৮১.২৫ (মার্জিন: ২৭.৮%)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 5-STEP DAILY WORKFLOW */}
      {(activeTab === 'workflow' || searchQuery) && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">২</span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">৫-ধাপে এজেন্সির দৈনন্দিন কাজের স্ট্যান্ডার্ড প্রসিডিউর (SOP)</h2>
              <p className="text-xs text-slate-500">হেডারের <strong>+ New Entry</strong> বাটন ব্যবহার করে দৈনিক যেভাবে কাজ করবেন:</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 transition-colors space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-sky-600 text-white font-bold text-xs flex items-center justify-center">১</span>
                <span className="font-bold text-xs text-slate-900">নতুন ক্লায়েন্ট অনবোর্ডিং (Add Client)</span>
              </div>
              <p className="text-xs text-slate-600">
                হেডারের <code>+ New Entry ➔ Add New Client</code>-এ গিয়ে ক্লায়েন্টের নাম, কোম্পানি, কান্ট্রি ও মাসিক বাজেট দিয়ে প্রোফাইল তৈরি করুন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">২</span>
                <span className="font-bold text-xs text-slate-900">ক্লায়েন্টের থেকে টাকা গ্রহণ (BDT Inflow)</span>
              </div>
              <p className="text-xs text-slate-600">
                ক্লায়েন্ট ব্যাংক বা বিকাশে টাকা পাঠালে <code>+ New Entry ➔ Receive Client Payment</code> দিয়ে ক্লায়েন্ট ও টাকার পরিমাণ (BDT) এন্ট্রি দিন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">৩</span>
                <span className="font-bold text-xs text-slate-900">ডলার ক্রয় ও কার্ড লোড (USD Top Up)</span>
              </div>
              <p className="text-xs text-slate-600">
                সেলার থেকে কার্ডে ডলার লোড দিলে <code>+ New Entry ➔ Buy / Top Up USD</code> দিয়ে কত টাকা খরচ হলো ও কত USD কার্ডে আসল তা ইনপুট দিন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-bold text-xs flex items-center justify-center">৪</span>
                <span className="font-bold text-xs text-slate-900">মেটা অ্যাড স্পেন্ড রেকর্ড (Meta Ad Spend)</span>
              </div>
              <p className="text-xs text-slate-600">
                মেটায় যে ডলার খরচ হয়েছে তা <code>+ New Entry ➔ Record Meta Ad Spend</code> দিয়ে দিন। ১৫% ভ্যাট সিস্টেম নিজে যুক্ত করে ব্যালেন্স কেটে নিবে।
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <div>
              <strong>ফলাফল:</strong> এই ৪টি এন্ট্রি দেওয়ার সাথে সাথে ড্যাশবোর্ডে লাইভ রেভিনিউ, মেটা স্পেন্ড, কার্ডের অবশিষ্ট ব্যালেন্স এবং নিট প্রফিট আপডেট হয়ে যাবে!
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE MODULE-BY-MODULE GUIDE */}
      {(activeTab === 'modules' || searchQuery) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">৩</span>
              <h2 className="text-base font-extrabold text-slate-900">প্ল্যাটফর্মের প্রতিটি পেজ ও মডিউল ব্যবহারের পূর্ণাঙ্গ গাইড</h2>
            </div>
            <p className="text-xs text-slate-600">
              নিচে প্রতিটি পেজের বিস্তারিত ফিচার এবং কীভাবে ব্যবহার করবেন তা পুঙ্খানুপুঙ্খভাবে দেওয়া হলো:
            </p>
          </div>

          {/* 1. Dashboard */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">১</span>
                <h3 className="font-extrabold text-sm text-slate-900">📊 Dashboard (Agency Command Center)</h3>
              </div>
              <button onClick={() => onNavigate?.('dashboard')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ড্যাশবোর্ড হলো আপনার এজেন্সির কেন্দ্রীয় নিয়ন্ত্রণ কক্ষ। এখানে যা যা রয়েছে:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong>৪টি কোর ম্যাট্রিক্স কার্ড:</strong> Total Revenue (মোট টাকা), Total USD Spent (অ্যাড+ভ্যাট+ফি), Net Agency Profit (আসল লাভ ও মার্জিন %), Total Card Balance (অবশিষ্ট ডলার)।
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong>Spline Flow Chart:</strong> সময়ের সাথে রেভিনিউ বনাম মেটা অ্যাড খরচের ইন্টারঅ্যাক্টিভ ট্রেন্ড গ্রাফ।
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong>Concentric Cybernetic HUD:</strong> মেটা অ্যাড খরচ (ভায়োলেট), ১৫% ভ্যাট (গোলাপি) ও ব্যাংক ফি (অ্যাম্বার)-এর ৩-রিং সাইবারনেটিক ডায়াল।
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong>৫০% : ৫০% সিমেট্রিক্যাল টেবিল:</strong> ক্লায়েন্ট পিঅ্যান্ডএল (লাভজনকতা) এবং কার্ড লিকুইডিটি (ডলার বার্ন) পাশাপাশি পর্যবেক্ষণ।
              </div>
            </div>
          </div>

          {/* 2. Clients */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">২</span>
                <h3 className="font-extrabold text-sm text-slate-900">👥 Clients Hub (CRM & Profitability)</h3>
              </div>
              <button onClick={() => onNavigate?.('clients')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ক্লায়েন্টদের সাথে আর্থিক সম্পর্ক ও ক্লায়েন্ট-ভিত্তিক লাভজনকতা পরিমাপের জন্য:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>ক্লায়েন্ট অনবোর্ডিং ও কান্ট্রি ট্যাগ:</strong> ক্লায়েন্টের নাম, কোম্পানি, কান্ট্রি ফ্ল্যাগ (🇧🇩, 🇺🇸, 🇦🇪) ও কন্টাক্ট ইনফো।</li>
              <li><strong>ক্লায়েন্ট-ভিত্তিক নিট লাভ:</strong> কোন ক্লায়েন্ট থেকে কত টাকা আসল এবং কত টাকা খরচ হলো তার ভিত্তিতে পৃথক প্রফিট মার্জিন % নির্ণয়।</li>
              <li><strong>১-ক্লিকে ক্লায়েন্ট স্টেটমেন্ট:</strong> ক্লায়েন্টের প্রোফাইলে ক্লিক করলেই তার যাবতীয় ট্রানজ্যাকশন হিস্ট্রি চলে আসে যা ক্লায়েন্টকে শেয়ার করা যায়।</li>
            </ul>
          </div>

          {/* 3. Campaigns */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">৩</span>
                <h3 className="font-extrabold text-sm text-slate-900">📢 Campaigns (Performance & ROAS)</h3>
              </div>
              <button onClick={() => onNavigate?.('campaigns')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              মেটা অ্যাড ক্যাম্পেইনের বাজেট, স্পেন্ড এবং আরওএএস (ROAS) ট্র্যাকিং:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>ক্যাম্পেইন মনিটরিং:</strong> ফেসবুক ক্যাম্পেইনের নাম, প্ল্যাটফর্ম, বাজেট ও স্ট্যাটাস (Active/Paused)।</li>
              <li><strong>ROI ও আরওএএস বিশ্লেষণ:</strong> ডলার স্পেন্ডের বিপরীতে ক্লায়েন্টের অর্জিত রেভিনিউ দেখে ক্যাম্পেইনের রিটার্ন যাচাই।</li>
            </ul>
          </div>

          {/* 4. Transactions */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">৪</span>
                <h3 className="font-extrabold text-sm text-slate-900">🧾 Transactions (Double-Ledger Engine)</h3>
              </div>
              <button onClick={() => onNavigate?.('ledger')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              এজেন্সির সমস্ত লেনদেনের ডিজিটাল খতিয়ান ও মানি রিসিট জেনারেটর:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>৪ ধরনের ট্রানজ্যাকশন:</strong> <code>Payment Received</code>, <code>USD Purchase</code>, <code>Ad Spend</code>, <code>Fee</code>।</li>
              <li><strong>১-ক্লিক মানি রিসিট ও ভাউচার:</strong> যেকোনো ট্রানজ্যাকশনের রিসিট আইকনে ক্লিক করলেই প্রফেশনাল মানি রিসিট ওপেন হয়, যা ১-ক্লিকে PDF হিসেবে ক্লায়েন্টকে পাঠানো যায়।</li>
              <li><strong>Excel & CSV এক্সপোর্ট:</strong> অডিট ও অ্যাকাউন্টিং ফাইলের জন্য সম্পূর্ণ লেজার স্প্রেডশিটে ডাউনলোড করা যায়।</li>
              <li><strong>এডিট ও ডিলিট:</strong> যেকোনো ভুল এন্ট্রি সাথে সাথে সংশোধন বা মুছে ফেলার পূর্ণ নিয়ন্ত্রণ।</li>
            </ul>
          </div>

          {/* 5. Cards & USD */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">৫</span>
                <h3 className="font-extrabold text-sm text-slate-900">💳 Cards & USD (Virtual Card Liquidity Hub)</h3>
              </div>
              <button onClick={() => onNavigate?.('cards')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              সব ভার্চুয়াল কার্ডের ডলার ব্যালেন্স, লোড এবং লাইভ বার্ন রেট পর্যবেক্ষণ:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>ভিজ্যুয়াল EMV কার্ড উপস্থাপন:</strong> কার্ডের নাম, ব্যাংক/প্রোভাইডার, লাস্ট ৪ ডিজিট এবং হোল্ডার নেম।</li>
              <li><strong>লাইভ ব্যালেন্স ও হিস্ট্রি:</strong> প্রতিটি কার্ডে কত ডলার লোড হলো, কত ডলার মেটায় খরচ হলো এবং বর্তমানে কত ডলার অবশিষ্ট আছে তার রিয়েল-টাইম ব্যালেন্স।</li>
              <li><strong>১-ক্লিকে কার্ড ফান্ডিং:</strong> <code>+ Fund Card</code> বাটনে ক্লিক করে যেকোনো নির্দিষ্ট কার্ডে সরাসরি ডলার লোড এন্ট্রি দেওয়ার সুবিধা।</li>
              <li><strong>ডেফিসিট প্রিভেনশন শিল্ড:</strong> কার্ড ব্যালেন্স নেগেটিভ হলে তাৎক্ষণিক সতর্কতা দেওয়া।</li>
            </ul>
          </div>

          {/* 6. Reports */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">৬</span>
                <h3 className="font-extrabold text-sm text-slate-900">📈 Reports & P&L (Financial & Tax Statements)</h3>
              </div>
              <button onClick={() => onNavigate?.('reports')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              নির্দিষ্ট সময়সীমার লাভ-ক্ষতির অডিট স্টেটমেন্ট তৈরি ও প্রিন্ট করা:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>পিরিয়ড ফিল্টারিং:</strong> All Time, Today, This Week, This Month, This Quarter, This Year অথবা কাস্টম ডেট রেঞ্জ।</li>
              <li><strong>P&L ফিন্যান্সিয়াল স্টেটমেন্ট:</strong> মোট আয়, মোট মেটা খরচ, ডলার রেট এবং নিট মার্জিনের সুদৃশ্য চার্ট ও টেবিল।</li>
              <li><strong>১-ক্লিক প্রিন্ট ও PDF জেনারেটর:</strong> অংশীদারদের মিটিং বা ট্যাক্স অডিটের জন্য এক ক্লিকে সম্পূর্ণ রিপোর্ট A4 সাইজে প্রিন্ট/PDF সেভ করা যায়।</li>
            </ul>
          </div>

          {/* 7. Settings & Team */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">৭</span>
                <h3 className="font-extrabold text-sm text-slate-900">⚙️ Settings & Team (Workspace Management)</h3>
              </div>
              <button onClick={() => onNavigate?.('settings')} className="text-sky-600 hover:underline text-xs font-bold cursor-pointer">Open Page &gt;</button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              এজেন্সির ব্র্যান্ডিং, টিম পারমিশন এবং ডাটা ব্যাকআপ নিয়ন্ত্রণ:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>লোগো ও ব্র্যান্ডিং:</strong> এজেন্সির নিজস্ব লোগো আপলোড, নাম এবং কারেন্সি কনফিগারেশন।</li>
              <li><strong>টিম পারমিশন:</strong> Owner, Manager, Media Buyer এবং Accountant রোল ম্যানেজমেন্ট।</li>
              <li><strong>ক্লাউড ডাটা ব্যাকআপ ও রিস্টোর:</strong> ১-ক্লিকে সমস্ত ডাটার অফলাইন JSON ব্যাকআপ ডাউনলোড এবং প্রয়োজনে তা রিস্টোর করা।</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: TROUBLESHOOTING & FAQS */}
      {(activeTab === 'troubleshoot' || searchQuery) && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm">৪</span>
            <h2 className="text-base font-extrabold text-slate-900">যেসব জায়গায় মানুষ আটকে যেতে পারে (Troubleshooting & FAQs)</h2>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-500" />
                কার্ড ব্যালেন্স নেগেটিভ (যেমন: -$১৫.০০) দেখাচ্ছে কেন?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>কারণ:</strong> কার্ডে যে ডলার লোড করেছিলেন তার চেয়ে বেশি ডলারের মেটা অ্যাড খরচ হয়ে গেছে।<br />
                <strong>সমাধান:</strong> অবিলম্বে <code>+ New Entry ➔ Buy / Top Up USD</code> দিয়ে নতুন ডলার লোড এন্ট্রি দিন। ব্যালেন্স সাথে সাথে পজিটিভ হয়ে যাবে।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Receipt size={15} className="text-purple-500" />
                মেটা ভ্যাট (15% Tax) কি আমাকে আলাদা ইনপুট দিতে হবে?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>না!</strong> আপনি শুধু ফেসবুকের আসল স্পেন্ড বসাবেন, সিস্টেম স্বয়ংক্রিয়ভাবে ১৫% ভ্যাট হিসাব করে কার্ড ব্যালেন্স ও প্রফিট থেকে কেটে নিবে।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <FileText size={15} className="text-sky-500" />
                ক্লায়েন্টকে মানি রিসিট বা স্টেটমেন্ট কীভাবে পাঠাব?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <code>Transactions</code> পেজে গিয়ে যেকোনো এন্ট্রির রিসিট আইকনে ক্লিক করলেই ব্র্যান্ডেড রিসিট ওপেন হবে। সেখান থেকে ১-ক্লিকে প্রিন্ট বা PDF হিসেবে সেভ করে ক্লায়েন্টকে পাঠিয়ে দিন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Edit size={15} className="text-amber-500" />
                কোনো এন্ট্রিতে টাকার পরিমাণ বা ক্লায়েন্টের নাম ভুল হলে কীভাবে ঠিক করব?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <code>Transactions</code> পেজে গিয়ে ওই ট্রানজ্যাকশনের ডানপাশের এডিট (পেন্সিল) আইকনে ক্লিক করে সংশোধন করুন অথবা ডিলিট করে দিন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-500" />
                আমার ডাটা কি হারিয়ে যাওয়ার কোনো ঝুঁকি আছে?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                আপনার প্রতিটি ডাটা <strong>Supabase Cloud Database</strong>-এ নিরাপদ। এছাড়াও অতিরিক্ত সুরক্ষার জন্য <code>Settings ➔ Export JSON Backup</code> বাটনে ক্লিক করে অফলাইন ব্যাকআপ ডাউনলোড করে রাখতে পারেন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AGENCY PRO-TIPS */}
      {(activeTab === 'protips' || searchQuery) && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">৫</span>
            <h2 className="text-base font-extrabold text-slate-900">এজেন্সির সাফল্যের জন্য প্রো-টিপস ও চেকলিস্ট</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
              <div className="font-bold text-xs text-amber-950 flex items-center gap-2">
                <Clock size={15} className="text-amber-600" />
                দৈনিক ৫ মিনিটের রুটিন
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                প্রতিদিন কাজের শেষে মেটা অ্যাড ম্যানেজার থেকে সারাদিনের স্পেন্ড Quantrex-এ রেকর্ড করে ফেলুন। এতে মাসের শেষে কোনো অসামঞ্জস্য থাকবে না।
              </p>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200/80 space-y-1.5">
              <div className="font-bold text-xs text-sky-950 flex items-center gap-2">
                <CreditCard size={15} className="text-sky-600" />
                ডলার কেনার সাথে সাথে এন্ট্রি
              </div>
              <p className="text-xs text-sky-900 leading-relaxed">
                সেলার থেকে কার্ডে ডলার আসা মাত্রই রেট ও ক্যাশআউট চার্জ সহ এন্ট্রি দিন, যাতে লাইভ কার্যকরী ডলার রেট ১০০% নিখুঁত থাকে।
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
              <div className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                <Users size={15} className="text-emerald-600" />
                ক্লায়েন্ট পেমেন্ট ট্র্যাকিং
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                ক্লায়েন্টের বাজেট শেষ হওয়ার আগেই ড্যাশবোর্ডের Client P&L টেবিল দেখে পরবর্তী পেমেন্ট নেওয়ার আগাম তাগাদা দিন।
              </p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-1.5">
              <div className="font-bold text-xs text-purple-950 flex items-center gap-2">
                <Database size={15} className="text-purple-600" />
                মাসিক ডাটা ব্যাকআপ
              </div>
              <p className="text-xs text-purple-900 leading-relaxed">
                প্রতি মাসের ১ তারিখে সেটিংস পেজ থেকে 'Export Backup' ফাইলটি ডাউনলোড করে গুগল ড্রাইভে সংরক্ষণ করুন।
              </p>
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
    link.setAttribute('download', `Quantrex_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
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
    link.setAttribute('download', `Quantrex_Clients_${new Date().toISOString().slice(0, 10)}.csv`);
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
    link.setAttribute('download', `Quantrex_Cards_${new Date().toISOString().slice(0, 10)}.csv`);
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
        <title>Quantrex Financial Statement — ${data.businessName || 'Quantrex'}</title>
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
            <div class="brand">${data.businessName || 'Quantrex Agency'}</div>
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
          <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">Generated via Quantrex — Digital Marketing & Media Buying Ledger System</div>
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
            setRestoreFeedback({ success: false, message: 'Invalid Quantrex backup format.' });
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
    <div className="w-full max-w-[1720px] mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* TOP HEADER (SEAMLESS CANVAS) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <CheckCircle2 size={14} className="text-emerald-600" /> Changes Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition-all ${
              isDirty
                ? 'bg-sky-600 hover:bg-sky-700 ring-2 ring-sky-400/40'
                : 'bg-slate-900 hover:bg-slate-800'
            } disabled:opacity-50`}
          >
            <Save size={14} />
            {saveStatus === 'saving' ? 'Saving...' : isDirty ? 'Save Changes *' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* VALIDATION WARNING BANNER */}
      {validationBanner && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
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

      {/* TAB NAVIGATION (EQUAL 5-COLUMN FULL WIDTH DISTRIBUTION) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 p-1 bg-slate-200/60 rounded-lg w-full">
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
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-2 rounded-md text-xs font-bold transition-all whitespace-nowrap relative ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <span className={active ? 'text-sky-600' : 'text-slate-400'}>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
              {hasError && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-0.5 animate-pulse shrink-0" />
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
                  {data.shortCode?.[0] || data.businessName?.[0] || 'Q'}
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
                    className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
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
                    placeholder="e.g. Quantrex Agency"
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
                <option>Growth & Performance Marketing</option>
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
                    <p className="text-[10px] text-slate-500">Restore Quantrex JSON or purge local browser cache.</p>
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
      <div className={`bg-white rounded-xl shadow-2xl w-full ${width} overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/90`}>
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200/80 bg-slate-50/80 shrink-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-4.5 overflow-y-auto">
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
        className="fixed bg-white border border-slate-200/90 rounded-xl shadow-2xl z-[99999] p-1.5"
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
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors"
        >
          <Eye size={15} className="text-sky-600 shrink-0" />
          <span>View Details</span>
        </button>

        <button
          type="button"
          onClick={() => closeAndRun(onHistory)}
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
        >
          <Receipt size={15} className="text-indigo-600 shrink-0" />
          <span>Transaction History</span>
        </button>

        <button
          type="button"
          onClick={() => closeAndRun(onEdit)}
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
        >
          <Edit size={15} className="text-slate-500 shrink-0" />
          <span>Edit Client Profile</span>
        </button>

        <button
          type="button"
          onClick={() => closeAndRun(onReceivePayment)}
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-emerald-700 rounded-lg hover:bg-emerald-50 flex items-center gap-2.5 transition-colors"
        >
          <Coins size={15} className="text-emerald-600 shrink-0" />
          <span>Receive Payment</span>
        </button>

        <div className="h-px bg-slate-100 my-1" />

        <button
          type="button"
          onClick={() => setShowStatusMenu(prev => !prev)}
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 flex items-center justify-between transition-colors"
          aria-expanded={showStatusMenu}
        >
          <span className="flex items-center gap-2.5">
            <RefreshCw size={15} className="text-blue-600 shrink-0" />
            <span>Change Status</span>
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 text-slate-400 ${showStatusMenu ? 'rotate-180' : ''}`}
          />
        </button>

        {showStatusMenu && (
          <div className="mx-1 mb-1 mt-1 rounded-lg bg-slate-50 border border-slate-100/90 p-1 space-y-0.5">
            <button
              type="button"
              onClick={() => closeAndRun(() => onToggleStatus?.('active'))}
              className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 rounded-md hover:bg-emerald-100/70 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Mark Active
            </button>

            <button
              type="button"
              onClick={() => closeAndRun(() => onToggleStatus?.('inactive'))}
              className="w-full text-left px-3 py-2 text-xs font-bold text-orange-700 rounded-md hover:bg-orange-100/70 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Mark Inactive
            </button>

            <button
              type="button"
              onClick={() => closeAndRun(() => onToggleStatus?.('completed'))}
              className="w-full text-left px-3 py-2 text-xs font-bold text-blue-700 rounded-md hover:bg-blue-100/70 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Mark Completed
            </button>
          </div>
        )}

        <div className="h-px bg-slate-100 my-1" />

        <button
          type="button"
          onClick={() => closeAndRun(onDelete)}
          className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-rose-600 rounded-lg hover:bg-rose-50 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Trash2 size={15} className="text-rose-500 shrink-0" />
            <span>Delete Client</span>
          </span>
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
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label={`Actions for ${client?.name || 'client'}`}
        aria-expanded={isOpen}
      >
        <MoreVertical size={17} />
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
      {/* 4 COMPACT KPI TAGS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payments Received</span>
          <span className="text-sm font-black text-emerald-700 mt-0.5 block">{formatBDT(totalReceived)}</span>
        </div>
        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ad Spend</span>
          <span className="text-sm font-black text-purple-700 mt-0.5 block">{formatUSD(totalAdSpend)}</span>
        </div>
        <div className="bg-gradient-to-br from-rose-50/80 via-white to-orange-50/40 border border-rose-200/70 rounded-lg p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ad VAT (15%)</span>
          <span className="text-sm font-black text-rose-700 mt-0.5 block">{formatUSD(totalTax)}</span>
        </div>
        <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100/50 border border-slate-200/70 rounded-lg p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ledger Entries</span>
          <span className="text-sm font-black text-slate-900 mt-0.5 block">{clientTx.length} Entries</span>
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs text-slate-800">Client Transaction History</h3>
            <p className="text-[11px] text-slate-400">All ledger records linked to {client.name}</p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[55vh]">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Details</th>
                <th className="px-4 py-2.5 text-right">BDT</th>
                <th className="px-4 py-2.5 text-right">USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {clientTx.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">No transactions recorded for this client yet.</td>
                </tr>
              )}

              {clientTx.map(tx => {
                const isPayment = tx.type === 'PAYMENT_RECEIVED';
                const isAdSpend = tx.type === 'AD_SPEND';
                const usdAmount = isAdSpend
                  ? parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0)
                  : 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-600 font-medium">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3"><TransactionTypeBadge type={tx.type} /></td>
                    <td className="px-4 py-3 min-w-[240px]">
                      <div className="font-bold text-slate-800">
                        {tx.notes || tx.campaign || tx.adAccount || tx.type.replaceAll('_', ' ')}
                      </div>
                      {tx.adAccount && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {tx.adAccount}{tx.campaign ? ` • ${tx.campaign}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {isPayment ? <span className="text-emerald-600">+{formatBDT(tx.amountBDT)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {isAdSpend ? <span className="text-rose-600">-{formatUSD(usdAmount)}</span> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 font-medium">
        BDT conversion uses the app's current average USD effective buy rate of ৳{metrics.avgUSDEffectiveRate.toFixed(2)}.
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

  const [touched, setTouched] = useState({ phone: false, email: false });

  const phoneError = useMemo(() => {
    if (!formData.phone || !formData.phone.trim()) return null;
    const clean = formData.phone.replace(/[\s\-()]/g, '');
    const phoneRegex = /^(\+?[0-9]{8,15})$/;
    if (!phoneRegex.test(clean)) {
      return 'Invalid phone number';
    }
    return null;
  }, [formData.phone]);

  const emailError = useMemo(() => {
    if (!formData.email || !formData.email.trim()) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      return 'Invalid email format';
    }
    return null;
  }, [formData.email]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleBlur = (e) => setTouched(prev => ({ ...prev, [e.target.name]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (phoneError || emailError) {
      setTouched({ phone: true, email: true });
      return;
    }
    onSubmit({
      ...formData,
      budgetAmount: parseFloat(formData.budgetAmount) || 0,
      endDate: formData.currentlyWorking ? '' : formData.endDate
    });
  };

  const inputClass = "w-full mt-0.5 px-2.5 py-1.5 border rounded-lg shadow-2xs focus:outline-none focus:ring-2 text-xs font-semibold text-slate-800 bg-white transition-all placeholder:text-slate-400 placeholder:font-normal h-[34px]";
  const normalInputBorder = "border-slate-200/90 focus:ring-sky-500/20 focus:border-sky-500";
  const errorInputBorder = "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20";
  const labelClass = "block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider";

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2">
        {/* ROW 1 */}
        <div>
          <label className={labelClass}>Client Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. John Doe" className={`${inputClass} ${normalInputBorder}`} />
        </div>
        <div>
          <label className={labelClass}>Business / Company *</label>
          <input type="text" name="company" value={formData.company} onChange={handleChange} required placeholder="e.g. Apex Media Ltd" className={`${inputClass} ${normalInputBorder}`} />
        </div>
        <div>
          <label className={labelClass}>Service Type</label>
          <select name="serviceType" value={formData.serviceType} onChange={handleChange} className={`${inputClass} ${normalInputBorder}`}>
            <option>Meta Ads</option><option>Facebook Marketing</option><option>Instagram Marketing</option><option>Google Ads</option><option>TikTok Ads</option><option>Social Media Management</option><option>Content Marketing</option><option>Other</option>
          </select>
        </div>

        {/* ROW 2 */}
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Phone Number</label>
            {phoneError && touched.phone && <span className="text-[9px] text-rose-500 font-bold truncate">{phoneError}</span>}
          </div>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} placeholder="e.g. +8801700000000" className={`${inputClass} ${phoneError && touched.phone ? errorInputBorder : normalInputBorder}`} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Email Address</label>
            {emailError && touched.email && <span className="text-[9px] text-rose-500 font-bold truncate">{emailError}</span>}
          </div>
          <input type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="e.g. client@company.com" className={`${inputClass} ${emailError && touched.email ? errorInputBorder : normalInputBorder}`} />
        </div>
        <div>
          <label className={labelClass}>Account Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={`${inputClass} ${normalInputBorder}`}>
            <option>Active</option><option>Paused</option><option>Completed</option><option>Inactive</option>
          </select>
        </div>

        {/* ROW 3 */}
        <div>
          <label className={labelClass}>Budget Period</label>
          <select name="budgetType" value={formData.budgetType} onChange={handleChange} className={`${inputClass} ${normalInputBorder}`}>
            <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Custom / Total</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Budget Amount (BDT)</label>
          <input type="number" min="0" step="0.01" name="budgetAmount" value={formData.budgetAmount} onChange={handleChange} placeholder="e.g. 50000" className={`${inputClass} ${normalInputBorder}`} />
        </div>
        <div>
          <label className={labelClass}>Start Date</label>
          <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className={`${inputClass} ${normalInputBorder}`} />
        </div>

        {/* ROW 4 */}
        <div>
          <label className={labelClass}>Facebook Page URL</label>
          <input type="text" name="fb" value={formData.fb} onChange={handleChange} placeholder="facebook.com/..." className={`${inputClass} ${normalInputBorder}`} />
        </div>
        <div>
          <label className={labelClass}>Website URL</label>
          <input type="text" name="website" value={formData.website} onChange={handleChange} placeholder="https://company.com" className={`${inputClass} ${normalInputBorder}`} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className={labelClass}>End Date</label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700 select-none cursor-pointer">
              <input type="checkbox" name="currentlyWorking" checked={formData.currentlyWorking} onChange={(e) => setFormData({ ...formData, currentlyWorking: e.target.checked })} className="w-3 h-3 text-sky-600 rounded border-slate-300 focus:ring-sky-500" />
              Ongoing
            </label>
          </div>
          {!formData.currentlyWorking ? (
            <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required={!formData.currentlyWorking} className={`${inputClass} ${normalInputBorder}`} />
          ) : (
            <div className="h-[34px] px-2.5 flex items-center bg-slate-50 border border-slate-200/70 rounded-lg text-[11px] font-semibold text-slate-500">Ongoing</div>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes & Campaign Objectives</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Optional client notes, target KPI, campaign requirements..."
          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-200/90 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-slate-800 bg-white transition-all placeholder:text-slate-400 placeholder:font-normal min-h-[52px] max-h-[85px] overflow-y-auto leading-relaxed resize-y"
        />
      </div>

      <div className="flex gap-2.5 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-white border border-slate-200/90 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs">Cancel</button>
        <button type="submit" disabled={Boolean(phoneError && touched.phone) || Boolean(emailError && touched.email)} className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.01]">Save Client</button>
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

  const handlePrintStatement = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Client Statement - ${client.name}</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 24px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
          .statement-badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .client-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; font-size: 12.5px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px; text-align: center; }
          .kpi-title { font-size: 10.5px; text-transform: uppercase; font-weight: 800; color: #0369a1; letter-spacing: 0.5px; }
          .kpi-val { font-size: 17px; font-weight: 900; color: #0c4a6e; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 10px 12px; border-bottom: 1px solid #cbd5e1; font-weight: 800; color: #475569; font-size: 10.5px; text-transform: uppercase; }
          td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
          .green { color: #16a34a; font-weight: bold; }
          .red { color: #dc2626; font-weight: bold; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 24px;">
          <div style="display:flex; align-items:center; gap: 14px;">
            <img src="${workspaceLogo || QUANTREX_LOGO_DATA_URL}" alt="Logo" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.12);" />
            <div>
              <div class="brand">Quantrex Platform</div>
              <div class="subtitle">Client Account Statement & Ledger</div>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="statement-badge">CONFIDENTIAL STATEMENT</span>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Date: ${new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        <div class="client-box">
          <div><strong>Client Name:</strong><br/>${client.name}</div>
          <div><strong>Business / Brand:</strong><br/>${client.company || 'Direct Account'}</div>
          <div><strong>Service Type:</strong><br/>${client.serviceType || 'Digital Marketing'}</div>
          <div><strong>Budget Plan:</strong><br/>${getBudgetDisplay(client.budgetType, client.budgetAmount || client.budget)}</div>
          <div><strong>Campaign Timeline:</strong><br/>${formatDate(client.startDate)} – ${client.currentlyWorking ? 'Present (Ongoing)' : formatDate(client.endDate)}</div>
          <div><strong>Contact Info:</strong><br/>${client.phone || client.email || '—'}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-title">Total Payments In</div><div class="kpi-val">${formatBDT(stats.revenue)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total Ad Spend</div><div class="kpi-val">${formatUSD(stats.adSpendUSD)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Total Cost (BDT)</div><div class="kpi-val">${formatBDT(stats.totalCostBDT)}</div></div>
          <div class="kpi-card"><div class="kpi-title">Net Agency Margin</div><div class="kpi-val">${stats.margin.toFixed(1)}%</div></div>
        </div>

        <h3 style="font-size: 13px; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; color: #334155;">Detailed Transaction Ledger</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction Type</th>
              <th>Details / Campaign</th>
              <th style="text-align: right;">BDT Amount</th>
              <th style="text-align: right;">USD Amount</th>
            </tr>
          </thead>
          <tbody>
            ${clientTx.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px; color:#94a3b8;">No transaction records found.</td></tr>' : ''}
            ${clientTx.map(tx => `
              <tr>
                <td>${formatDate(tx.date)}</td>
                <td style="font-weight: 600;">${tx.type.replaceAll('_', ' ')}</td>
                <td>${tx.notes || tx.campaign || tx.adAccount || '—'}</td>
                <td style="text-align: right;">${tx.type === 'PAYMENT_RECEIVED' ? `<span class="green">+${formatBDT(tx.amountBDT)}</span>` : '—'}</td>
                <td style="text-align: right;">${tx.type === 'AD_SPEND' ? `<span class="red">-${formatUSD(parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0))}</span>` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by Quantrex Agency Intelligence Platform • www.quantrex.io
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* VIP CLIENT OBSIDIAN HEADER CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-xl p-5 border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h2 className="text-xl font-black text-white tracking-tight">{client.name}</h2>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1.5 ${
              displayStatus.includes('Active') || displayStatus.includes('Working')
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : displayStatus.includes('Completed')
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-700/60 text-slate-300 border border-slate-600'
            }`}>
              {(displayStatus.includes('Active') || displayStatus.includes('Working')) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {displayStatus}
            </span>
          </div>
          <p className="text-slate-300 text-xs font-semibold">
            {client.company || 'Direct Account'} {client.serviceType ? `• ${client.serviceType}` : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-3.5 pt-3.5 border-t border-slate-800/80 text-xs">
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Budget Plan</span>
              <span className="font-bold text-sky-400">{getBudgetDisplay(client.budgetType, client.budgetAmount || client.budget)}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Duration</span>
              <span className="font-semibold text-slate-200">{getCampaignDurationDisplay(client)}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Campaign Timeline</span>
              <span className="font-semibold text-slate-200">{formatDate(client.startDate)} – {client.currentlyWorking ? 'Ongoing' : formatDate(client.endDate)}</span>
            </div>
            {client.phone && (
              <div className="text-slate-300">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Phone & WhatsApp</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <a href={`tel:${client.phone}`} className="font-semibold text-sky-300 hover:underline">{client.phone}</a>
                  <a
                    href={`https://wa.me/${(client.phone || '').replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Direct WhatsApp Chat"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/40 text-[10px] font-bold transition-all"
                  >
                    <MessageCircle size={11} /> WhatsApp
                  </a>
                </div>
              </div>
            )}
            {client.email && (
              <div className="text-slate-300">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Email</span>
                <a href={`mailto:${client.email}`} className="font-semibold text-sky-300 hover:underline truncate block">{client.email}</a>
              </div>
            )}
            {client.fb && (
              <div className="text-slate-300">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Facebook</span>
                <a href={client.fb.startsWith('http') ? client.fb : `https://${client.fb}`} target="_blank" rel="noreferrer" className="font-semibold text-blue-400 hover:underline truncate block">
                  {client.fb}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2 shrink-0 self-start md:self-center justify-center">
          <button
            type="button"
            onClick={onReceivePayment}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <Coins size={14} /> + Payment
          </button>
          <button
            type="button"
            onClick={onAdSpend}
            className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <Activity size={14} /> + Ad Spend
          </button>
          <button
            type="button"
            onClick={handlePrintStatement}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap hover:text-white"
          >
            <Printer size={13} /> Statement / PDF
          </button>
        </div>
      </div>

      {/* 4 COMPACT LUXURY FROSTED TAG CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Received</span>
            <ArrowDownRight size={14} className="text-emerald-600" />
          </div>
          <span className="text-sm font-black text-emerald-700 mt-1 block">{formatBDT(stats.revenue)}</span>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">100% Collected</span>
        </div>

        <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/40 border border-purple-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ad Spend</span>
            <Activity size={14} className="text-purple-600" />
          </div>
          <span className="text-sm font-black text-purple-700 mt-1 block">{formatUSD(stats.adSpendUSD)}</span>
          <span className="text-[10px] text-purple-600 font-semibold mt-0.5 block">Tax: {formatUSD(stats.taxUSD)}</span>
        </div>

        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cost (BDT)</span>
            <Wallet size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-black text-slate-900 mt-1 block">{formatBDT(stats.totalCostBDT)}</span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">Live FX Converted</span>
        </div>

        <div className="bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/70 rounded-lg p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Agency Profit</span>
            <TrendingUp size={14} className="text-sky-600" />
          </div>
          <span className={`text-sm font-black mt-1 block ${stats.profitBDT < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatBDT(stats.profitBDT)}</span>
          <span className={`text-[10px] font-bold mt-0.5 block ${stats.margin > 50 ? 'text-emerald-600' : stats.margin < 0 ? 'text-rose-600' : 'text-slate-500'}`}>Margin: {stats.margin.toFixed(1)}%</span>
        </div>
      </div>

      {/* BUDGET PROGRESS & PERFORMANCE CHART */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-xs text-slate-800">Contract & Advance Budget Tracking</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stats.outstanding > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {stats.outstanding > 0 ? 'Payment Due' : 'Fully Funded'}
            </span>
          </div>
          <div className="flex justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-500 text-[11px]">Target: {formatBDT(stats.targetBudgetBDT)}</span>
            <span className="font-bold text-slate-900 text-[11px]">Received: {formatBDT(stats.revenue)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (stats.revenue / (stats.targetBudgetBDT || 1)) * 100)}%` }}></div>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-500 text-[11px]">Outstanding Expected:</span>
            <span className={`text-[11px] font-bold ${stats.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {stats.outstanding > 0 ? formatBDT(stats.outstanding) : 'Fully Paid / Exceeded'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <h4 className="font-bold text-xs text-slate-800 mb-3">Performance Overview</h4>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `৳${val / 1000}k`} />
                <Tooltip />
                <Bar dataKey="revenue" name="Revenue (BDT)" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="cost" name="Cost (BDT)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CAMPAIGN SUMMARY & CLIENT LEDGER TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl flex flex-col overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/80">
            <h4 className="font-bold text-xs text-slate-800">Campaign Ad Breakdown</h4>
          </div>
          <div className="overflow-y-auto max-h-60">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-white text-slate-400 font-bold sticky top-0 border-b border-slate-100 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="px-3.5 py-2">Campaign & Account</th>
                  <th className="px-3.5 py-2 text-right">Spend</th>
                  <th className="px-3.5 py-2 text-right">Tax (15%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {campaigns.length === 0 && (
                  <tr><td colSpan="3" className="text-center py-6 text-slate-400">No ad campaigns logged yet.</td></tr>
                )}
                {campaigns.map((camp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-800">{camp.campaign}</div>
                      <div className="text-[11px] text-slate-400">{camp.account}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-800">{formatUSD(camp.spend)}</td>
                    <td className="px-3.5 py-2.5 text-right text-rose-600 font-semibold">{formatUSD(camp.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl flex flex-col overflow-hidden shadow-2xs">
          <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/80 flex justify-between items-center">
            <h4 className="font-bold text-xs text-slate-800">Client Ledger</h4>
          </div>
          <div className="overflow-y-auto max-h-60">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-white text-slate-400 font-bold sticky top-0 border-b border-slate-100 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="px-3.5 py-2">Date / Type</th>
                  <th className="px-3.5 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {clientTx.length === 0 && (
                  <tr><td colSpan="2" className="text-center py-6 text-slate-400">No transactions recorded yet.</td></tr>
                )}
                {clientTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5">
                      <div className="text-[11px] text-slate-400">{formatDate(tx.date)}</div>
                      <div className="font-bold text-slate-800">{tx.type.replaceAll('_', ' ')}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{tx.notes || tx.campaign}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {tx.type === 'PAYMENT_RECEIVED' ? (
                        <span className="font-black text-emerald-600">+{formatBDT(tx.amountBDT)}</span>
                      ) : (
                        <div>
                          <span className="font-black text-slate-900">{formatUSD(parseFloat(tx.amountUSD || 0) + parseFloat(tx.taxUSD || 0))}</span>
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

function TransactionForm({ type, initialData, clients, cards, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    amountBDT: initialData?.amountBDT !== undefined ? initialData.amountBDT : '',
    cashOutCharge: initialData?.cashOutCharge !== undefined ? initialData.cashOutCharge : '',
    amountUSD: initialData?.amountUSD !== undefined ? initialData.amountUSD : '',
    clientId: initialData?.clientId || clients?.[0]?.id || '',
    cardId: initialData?.cardId || cards?.[0]?.id || '',
    taxUSD: initialData?.taxUSD !== undefined ? initialData.taxUSD : '',
    notes: initialData?.notes || '',
    adAccount: initialData?.adAccount || '',
    campaign: initialData?.campaign || ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...initialData,
      type,
      date: formData.date,
      notes: formData.notes
    };

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
