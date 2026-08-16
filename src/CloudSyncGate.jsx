import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const STORAGE_TABLES = {
  adledger_clients: 'clients',
  adledger_cards: 'cards',
  adledger_transactions: 'transactions',
  adledger_campaigns: 'campaigns',
};
const STORAGE_KEYS = Object.keys(STORAGE_TABLES);
const SETTINGS_KEY = 'adledger_settings';
const TEAM_KEY = 'adledger_team';
const LOGO_KEY = 'adlytic_workspace_logo';
const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;

const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
const toNumberOrNull = value => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const readLocal = (key, fallback) => {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const localCollections = () => ({
  clients: readLocal('adledger_clients', []),
  cards: readLocal('adledger_cards', []),
  transactions: readLocal('adledger_transactions', []),
  campaigns: readLocal('adledger_campaigns', []),
  settings: readLocal(SETTINGS_KEY, null),
  team: readLocal(TEAM_KEY, []),
  logo: readLocal(LOGO_KEY, ''),
});

const mapClientToDb = (c, workspaceId) => ({
  id: c.id, workspace_id: workspaceId, name: c.name || '', company: c.company || '', status: c.status || 'Active',
  budget_type: c.budgetType || 'Monthly', budget_amount: toNumberOrNull(c.budgetAmount ?? c.budget),
  start_date: c.startDate || null, end_date: c.endDate || null, currently_working: Boolean(c.currentlyWorking),
  phone: c.phone || '', email: c.email || '', fb: c.fb || '', website: c.website || '', service_type: c.serviceType || '',
  notes: c.notes || '', updated_at: new Date().toISOString(),
});
const mapClientFromDb = r => ({
  id: r.id, name: r.name || '', company: r.company || '', status: r.status || 'Active', budgetType: r.budget_type || 'Monthly',
  budgetAmount: r.budget_amount ?? '', startDate: r.start_date || '', endDate: r.end_date || '', currentlyWorking: Boolean(r.currently_working),
  phone: r.phone || '', email: r.email || '', fb: r.fb || '', website: r.website || '', serviceType: r.service_type || '', notes: r.notes || '',
});
const mapCardToDb = (c, workspaceId) => ({
  id: c.id, workspace_id: workspaceId, name: c.name || '', provider: c.provider || '', card_type: c.cardType || '',
  currency: c.currency || 'USD', initial_balance: toNumberOrNull(c.initialBalance) ?? 0, last4: c.last4 || '',
  expiry_month: c.expiryMonth || '', expiry_year: c.expiryYear || '', status: c.status || 'Active', updated_at: new Date().toISOString(),
});
const mapCardFromDb = r => ({
  id: r.id, name: r.name || '', provider: r.provider || '', cardType: r.card_type || '', currency: r.currency || 'USD',
  initialBalance: r.initial_balance ?? 0, last4: r.last4 || '', expiryMonth: r.expiry_month || '', expiryYear: r.expiry_year || '', status: r.status || 'Active',
});
const mapTxToDb = (t, workspaceId) => ({
  id: t.id, workspace_id: workspaceId, date: t.date || new Date().toISOString().slice(0, 10), type: t.type || '',
  client_id: t.clientId || null, card_id: t.cardId || null, amount_bdt: toNumberOrNull(t.amountBDT),
  cash_out_charge: toNumberOrNull(t.cashOutCharge), amount_usd: toNumberOrNull(t.amountUSD), tax_usd: toNumberOrNull(t.taxUSD),
  method: t.method || '', notes: t.notes || '', ad_account: t.adAccount || '', campaign: t.campaign || '',
  timestamp: t.timestamp || Date.now(), updated_at: new Date().toISOString(),
});
const mapTxFromDb = r => ({
  id: r.id, date: r.date || '', type: r.type || '', clientId: r.client_id || '', cardId: r.card_id || '', amountBDT: r.amount_bdt ?? '',
  cashOutCharge: r.cash_out_charge ?? '', amountUSD: r.amount_usd ?? '', taxUSD: r.tax_usd ?? '', method: r.method || '',
  notes: r.notes || '', adAccount: r.ad_account || '', campaign: r.campaign || '', timestamp: r.timestamp || 0,
});
const mapCampaignToDb = (c, workspaceId) => ({
  id: c.id, workspace_id: workspaceId, name: c.name || '', client_id: c.clientId || null, platform: c.platform || '',
  budget: toNumberOrNull(c.budget), budget_type: c.budgetType || '', status: c.status || '', start_date: c.startDate || null,
  end_date: c.endDate || null, goal: c.goal || '', result_value: toNumberOrNull(c.resultValue), result_label: c.resultLabel || '',
  revenue_bdt: toNumberOrNull(c.revenueBDT), notes: c.notes || '', updated_at: new Date().toISOString(),
});
const mapCampaignFromDb = r => ({
  id: r.id, name: r.name || '', clientId: r.client_id || '', platform: r.platform || '', budget: r.budget ?? '', budgetType: r.budget_type || '',
  status: r.status || '', startDate: r.start_date || '', endDate: r.end_date || '', goal: r.goal || '', resultValue: r.result_value ?? '',
  resultLabel: r.result_label || '', revenueBDT: r.revenue_bdt ?? '', notes: r.notes || '',
});

async function ensureWorkspace(user) {
  const member = await supabase.from('workspace_members').select('workspace_id, role, status, email').eq('user_id', user.id).limit(1).maybeSingle();
  if (member.error) throw member.error;
  if (member.data?.workspace_id) return member.data.workspace_id;
  const owner = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
  if (owner.error) throw owner.error;
  if (owner.data?.id) {
    const { error } = await supabase.from('workspace_members').insert({ workspace_id: owner.data.id, user_id: user.id, email: user.email || '', role: 'Owner', status: 'Active' });
    if (error && error.code !== '23505') throw error;
    return owner.data.id;
  }
  const workspaceId = uuid();
  const workspaceInsert = await supabase.from('workspaces').insert({ id: workspaceId, name: 'AdLytic', owner_id: user.id });
  if (workspaceInsert.error) throw workspaceInsert.error;
  const memberInsert = await supabase.from('workspace_members').insert({ workspace_id: workspaceId, user_id: user.id, email: user.email || '', role: 'Owner', status: 'Active' });
  if (memberInsert.error) throw memberInsert.error;
  return workspaceId;
}

async function loadCloud(workspaceId) {
  const [clients, cards, transactions, campaigns, settings, members] = await Promise.all([
    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
    supabase.from('cards').select('*').eq('workspace_id', workspaceId),
    supabase.from('transactions').select('*').eq('workspace_id', workspaceId),
    supabase.from('campaigns').select('*').eq('workspace_id', workspaceId),
    supabase.from('workspace_settings').select('*').eq('workspace_id', workspaceId).limit(1).maybeSingle(),
    supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId),
  ]);
  for (const result of [clients, cards, transactions, campaigns, settings, members]) if (result.error) throw result.error;
  return {
    clients: (clients.data || []).map(mapClientFromDb), cards: (cards.data || []).map(mapCardFromDb),
    transactions: (transactions.data || []).map(mapTxFromDb), campaigns: (campaigns.data || []).map(mapCampaignFromDb),
    settings: settings.data ? { businessName: settings.data.business_name || 'AdLytic', timezone: settings.data.timezone || 'Asia/Dhaka', alerts: settings.data.alerts !== false, defaultReportRange: settings.data.default_report_range || 'This Month' } : null,
    logo: settings.data?.logo_data || '',
    teamMembers: (members.data || []).filter(m => m.role !== 'Owner').map(m => ({ id: m.user_id || m.id || uuid(), email: m.email || '', role: m.role || 'Manager', status: m.status || 'Active' })),
  };
}

async function saveCollection(table, rows, workspaceId) {
  const mapper = table === 'clients' ? mapClientToDb : table === 'cards' ? mapCardToDb : table === 'transactions' ? mapTxToDb : mapCampaignToDb;
  const dbRows = rows.map(row => mapper(row, workspaceId));
  const existing = await supabase.from(table).select('id').eq('workspace_id', workspaceId);
  if (existing.error) throw existing.error;
  const nextIds = new Set(dbRows.map(r => r.id));
  const deletedIds = (existing.data || []).map(r => r.id).filter(id => !nextIds.has(id));
  if (deletedIds.length) {
    const { error } = await supabase.from(table).delete().in('id', deletedIds).eq('workspace_id', workspaceId);
    if (error) throw error;
  }
  if (dbRows.length) {
    const { error } = await supabase.from(table).upsert(dbRows);
    if (error) throw error;
  }
}
async function saveSettings(workspaceId, settings, logo) {
  const { error } = await supabase.from('workspace_settings').upsert({ workspace_id: workspaceId, business_name: settings?.businessName || 'AdLytic', timezone: settings?.timezone || 'Asia/Dhaka', alerts: settings?.alerts !== false, default_report_range: settings?.defaultReportRange || 'This Month', logo_data: logo || '', updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) throw error;
}

async function migrateLocalIfCloudEmpty(workspaceId, cloud, local) {
  const cloudHasData = cloud.clients.length || cloud.cards.length || cloud.transactions.length || cloud.campaigns.length || cloud.settings || cloud.teamMembers.length || cloud.logo;
  const localHasData = local.clients.length || local.cards.length || local.transactions.length || local.campaigns.length || local.settings || local.team.length || local.logo;
  if (cloudHasData || !localHasData) return cloud;
  await saveCollection('clients', local.clients, workspaceId);
  await saveCollection('cards', local.cards, workspaceId);
  await saveCollection('transactions', local.transactions, workspaceId);
  await saveCollection('campaigns', local.campaigns, workspaceId);
  await saveSettings(workspaceId, local.settings || {}, local.logo || '');
  return loadCloud(workspaceId);
}

function CloudSyncGate({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    let workspaceId = null;
    let syncing = false;
    const pending = new Map();
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    const syncKey = async (key, rawValue) => {
      if (!workspaceId) return;
      let value; try { value = JSON.parse(rawValue); } catch { return; }
      try {
        if (STORAGE_TABLES[key]) await saveCollection(STORAGE_TABLES[key], Array.isArray(value) ? value : [], workspaceId);
        else if (key === SETTINGS_KEY || key === LOGO_KEY) {
          const settings = key === SETTINGS_KEY ? (value || {}) : readLocal(SETTINGS_KEY, {});
          const logo = key === LOGO_KEY ? (value || '') : readLocal(LOGO_KEY, '');
          await saveSettings(workspaceId, settings, logo);
        }
      } catch (error) { console.error('AdLytic cloud sync failed:', error); }
    };
    const flush = async () => {
      if (syncing || !pending.size) return;
      syncing = true;
      const jobs = [...pending.entries()]; pending.clear();
      for (const [key, value] of jobs) await syncKey(key, value);
      syncing = false;
      if (pending.size) void flush();
    };
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this === window.localStorage && (STORAGE_KEYS.includes(key) || key === SETTINGS_KEY || key === LOGO_KEY)) { pending.set(key, String(value)); void flush(); }
    };
    Storage.prototype.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (this === window.localStorage && (STORAGE_KEYS.includes(key) || key === SETTINGS_KEY || key === LOGO_KEY)) { pending.set(key, key === LOGO_KEY ? '""' : '[]'); void flush(); }
    };

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        workspaceId = await ensureWorkspace(user);
        const local = localCollections();
        let cloud = await loadCloud(workspaceId);
        cloud = await migrateLocalIfCloudEmpty(workspaceId, cloud, local);
        nativeSetItem.call(window.localStorage, 'adlytic_workspace_id', workspaceId);
        nativeSetItem.call(window.localStorage, 'adledger_clients', JSON.stringify(cloud.clients));
        nativeSetItem.call(window.localStorage, 'adledger_cards', JSON.stringify(cloud.cards));
        nativeSetItem.call(window.localStorage, 'adledger_transactions', JSON.stringify(cloud.transactions));
        nativeSetItem.call(window.localStorage, 'adledger_campaigns', JSON.stringify(cloud.campaigns));
        nativeSetItem.call(window.localStorage, SETTINGS_KEY, JSON.stringify(cloud.settings || local.settings || { businessName: 'AdLytic', timezone: 'Asia/Dhaka', alerts: true, defaultReportRange: 'This Month' }));
        nativeSetItem.call(window.localStorage, LOGO_KEY, JSON.stringify(cloud.logo || local.logo || ''));
        nativeSetItem.call(window.localStorage, TEAM_KEY, JSON.stringify(cloud.teamMembers));
      } catch (error) {
        console.error('AdLytic cloud bootstrap failed:', error);
        nativeSetItem.call(window.localStorage, 'adlytic_cloud_sync_error', String(error?.message || error));
      } finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; Storage.prototype.setItem = originalSetItem; Storage.prototype.removeItem = originalRemoveItem; };
  }, []);
  if (!ready) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">Syncing your AdLytic workspace…</div>;
  return children;
}
export default CloudSyncGate;
