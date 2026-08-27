const SETTINGS_KEY = 'adledger_settings';
let supabasePromise;
let saveTimer;

const safeJson = (value, fallback = {}) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const readLocal = () => safeJson(localStorage.getItem(SETTINGS_KEY), {});

function supabaseClient() {
  if (!supabasePromise) supabasePromise = import('./src/lib/supabase.js').then(m => m.supabase);
  return supabasePromise;
}

async function cloudMerge(patch) {
  try {
    const supabase = await supabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let workspaceId = null;
    const owned = await supabase.from('workspaces').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!owned.error && owned.data?.id) workspaceId = owned.data.id;
    if (!workspaceId) {
      const membership = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (!membership.error && membership.data?.workspace_id) workspaceId = membership.data.workspace_id;
    }
    if (!workspaceId) return;

    const current = await supabase.from('workspace_app_data').select('data').eq('workspace_id', workspaceId).eq('data_key', SETTINGS_KEY).maybeSingle();
    const merged = { ...(current.data?.data || {}), ...readLocal(), ...patch };
    await supabase.from('workspace_app_data').upsert({
      workspace_id: workspaceId,
      data_key: SETTINGS_KEY,
      data: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'workspace_id,data_key' });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('AdLytic settings sync skipped:', error);
  }
}

function scheduleCloudSave(patch = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => cloudMerge(patch), 700);
}

function getTimezoneOffsetLabel(zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
  } catch { return 'GMT'; }
}

function timezoneLabel(zone) {
  return `${zone} — ${getTimezoneOffsetLabel(zone)}`;
}

function allTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return ['UTC', ...Intl.supportedValuesOf('timeZone').filter(z => z !== 'UTC')];
    }
  } catch {}
  return ['UTC','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','America/Chicago','America/Denver','America/Los_Angeles','America/New_York','Asia/Dhaka','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Europe/Berlin','Europe/London','Pacific/Auckland'];
}

function populateTimezoneSelect(select, selected) {
  const zones = allTimezones();
  const current = selected || select.value || 'Asia/Dhaka';
  select.innerHTML = '';
  zones.forEach(zone => {
    const option = document.createElement('option');
    option.value = zone;
    option.textContent = timezoneLabel(zone);
    select.appendChild(option);
  });
  select.value = zones.includes(current) ? current : 'Asia/Dhaka';
}

function enhanceTimezone(workspaceCard) {
  const label = [...workspaceCard.querySelectorAll('label')].find(el => el.textContent.trim() === 'Timezone');
  const select = label?.parentElement?.querySelector('select');
  if (!select || select.dataset.adlyticTimezoneEnhanced) return;

  select.dataset.adlyticTimezoneEnhanced = '1';
  populateTimezoneSelect(select, select.value);
  select.addEventListener('change', () => scheduleCloudSave({ timezone: select.value }));

  const searchWrap = document.createElement('div');
  searchWrap.className = 'adlytic-timezone-search-wrap';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search time zone or city…';
  search.className = 'adlytic-profile-input';
  searchWrap.appendChild(search);
  label.parentElement.insertBefore(searchWrap, select);

  const filter = () => {
    const q = search.value.trim().toLowerCase();
    const selectedValue = select.value;
    [...select.options].forEach(option => {
      option.hidden = !!q && !option.textContent.toLowerCase().includes(q);
    });
    if (selectedValue) select.value = selectedValue;
  };
  search.addEventListener('input', filter);
}

function fixPlatformBranding() {
  const logo = document.querySelector('aside img[alt="Workspace logo"]');
  if (logo) {
    const holder = logo.parentElement;
    logo.style.display = 'none';
    if (!holder.querySelector('.adlytic-fixed-brand-mark')) {
      const mark = document.createElement('div');
      mark.className = 'adlytic-fixed-brand-mark';
      mark.textContent = 'A';
      holder.insertBefore(mark, holder.firstChild);
    }
  }
}

function enhanceSettings() {
  const settingsTitle = [...document.querySelectorAll('h1')].find(el => el.textContent.trim() === 'Settings');
  if (!settingsTitle) return;
  const workspaceHeading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Workspace');
  const workspaceCard = workspaceHeading?.closest('.bg-white');
  if (!workspaceCard) return;
  enhanceTimezone(workspaceCard);
  fixPlatformBranding();
}

const style = document.createElement('style');
style.textContent = `
  .adlytic-fixed-brand-mark{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;background:linear-gradient(135deg,#38bdf8,#0284c7);box-shadow:0 8px 22px rgba(56,189,248,.28);flex:0 0 auto}
  .adlytic-timezone-search-wrap{margin:7px 0 5px}
  .adlytic-timezone-search-wrap .adlytic-profile-input{margin-top:0}
  .adlytic-profile-input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cfe0ea;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none}
  .adlytic-profile-input:focus{border-color:#7dd3fc;box-shadow:0 0 0 3px rgba(56,189,248,.12)}
`;
document.head.appendChild(style);

const observer = new MutationObserver(() => enhanceSettings());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhanceSettings);
setTimeout(enhanceSettings, 300);
setTimeout(enhanceSettings, 1200);
