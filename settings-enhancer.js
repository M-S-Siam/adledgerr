const SETTINGS_KEY = 'adledger_settings';
const PROFILE_KEY = 'adlytic_workspace_profile';
let saveTimer;
let supabasePromise;

const safeJson = (value, fallback = {}) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const readSettings = () => safeJson(localStorage.getItem(SETTINGS_KEY), {});
const readProfile = () => safeJson(localStorage.getItem(PROFILE_KEY), {});

async function getSupabase() {
  if (!supabasePromise) supabasePromise = import('./src/lib/supabase.js').then(m => m.supabase);
  return supabasePromise;
}

async function getWorkspaceId(supabase, user) {
  const owned = await supabase.from('workspaces').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!owned.error && owned.data?.id) return owned.data.id;
  const membership = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  return !membership.error ? membership.data?.workspace_id : null;
}

async function cloudSave(patch = {}) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const workspaceId = await getWorkspaceId(supabase, user);
    if (!workspaceId) return;
    const current = await supabase.from('workspace_app_data').select('data').eq('workspace_id', workspaceId).eq('data_key', SETTINGS_KEY).maybeSingle();
    const merged = { ...(current.data?.data || {}), ...readSettings(), ...readProfile(), ...patch };
    await supabase.from('workspace_app_data').upsert({ workspace_id: workspaceId, data_key: SETTINGS_KEY, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,data_key' });
  } catch (error) {
    console.warn('AdLytic settings sync skipped:', error);
  }
}

function saveProfile(patch) {
  const next = { ...readProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => cloudSave(patch), 500);
}

function field(label, hint = '') {
  const wrap = document.createElement('div');
  wrap.className = 'adlytic-profile-field';
  const l = document.createElement('label');
  l.className = 'adlytic-profile-label';
  l.textContent = label;
  wrap.appendChild(l);
  if (hint) {
    const h = document.createElement('div');
    h.className = 'adlytic-profile-hint';
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

function input(parent, key, value, placeholder = '', type = 'text') {
  const el = document.createElement('input');
  el.type = type;
  el.value = value || '';
  el.placeholder = placeholder;
  el.className = 'adlytic-profile-input';
  el.addEventListener('input', () => saveProfile({ [key]: el.value }));
  parent.appendChild(el);
  return el;
}

function select(parent, key, value, options) {
  const el = document.createElement('select');
  el.className = 'adlytic-profile-input';
  options.forEach(([v, text]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = text;
    el.appendChild(o);
  });
  if (options.some(([v]) => v === value)) el.value = value;
  el.addEventListener('change', () => saveProfile({ [key]: el.value }));
  parent.appendChild(el);
  return el;
}

function allTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return ['UTC', ...Intl.supportedValuesOf('timeZone').filter(z => z !== 'UTC')];
  } catch {}
  return ['UTC','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','America/Chicago','America/Denver','America/Los_Angeles','America/New_York','Asia/Dhaka','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Europe/Berlin','Europe/London','Pacific/Auckland'];
}

function offset(zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
  } catch { return 'GMT'; }
}

function timezoneText(zone) {
  const city = zone === 'UTC' ? 'UTC' : zone.split('/').slice(-1)[0].replace(/_/g, ' ');
  return `${city} — ${zone} (${offset(zone)})`;
}

function enhanceTimezone(workspaceCard, profile) {
  const label = [...workspaceCard.querySelectorAll('label')].find(el => el.textContent.trim() === 'Timezone');
  const baseSelect = label?.parentElement?.querySelector('select');
  if (!baseSelect || baseSelect.dataset.adlyticTimezoneEnhanced) return;
  baseSelect.dataset.adlyticTimezoneEnhanced = '1';
  const zones = allTimezones();
  baseSelect.innerHTML = '';
  zones.forEach(zone => {
    const o = document.createElement('option');
    o.value = zone;
    o.textContent = timezoneText(zone);
    baseSelect.appendChild(o);
  });
  const current = profile.timezone || readSettings().timezone || 'Asia/Dhaka';
  baseSelect.value = zones.includes(current) ? current : 'Asia/Dhaka';
  baseSelect.addEventListener('change', () => saveProfile({ timezone: baseSelect.value }));

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search city or time zone…';
  search.className = 'adlytic-profile-input adlytic-timezone-search';
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    [...baseSelect.options].forEach(o => { o.hidden = !!q && !o.textContent.toLowerCase().includes(q); });
  });
  label.parentElement.insertBefore(search, baseSelect);
}

function addWorkspaceProfile(workspaceCard) {
  if (workspaceCard.querySelector('[data-adlytic-workspace-profile]')) return;
  const profile = readProfile();
  const card = document.createElement('section');
  card.dataset.adlyticWorkspaceProfile = '1';
  card.className = 'adlytic-profile-card';
  card.innerHTML = `
    <div class="adlytic-profile-head">
      <div>
        <div class="adlytic-profile-kicker">WORKSPACE PROFILE</div>
        <h4>Business & workspace details</h4>
        <p>Set up the identity, contact information and regional preferences for this workspace. These details belong to the workspace—not the AdLytic platform.</p>
      </div>
      <span class="adlytic-profile-badge">Workspace</span>
    </div>
    <div class="adlytic-profile-section-title">Business identity</div>
  `;

  const identity = document.createElement('div');
  identity.className = 'adlytic-profile-grid';

  const legal = field('Legal / Business Name', 'Official business name used for records.');
  input(legal, 'legalBusinessName', profile.legalBusinessName, 'Your legal business name');
  identity.appendChild(legal);

  const type = field('Workspace Type', 'How you operate this workspace.');
  select(type, 'workspaceType', profile.workspaceType || 'Agency', [['Agency','Agency'],['Freelancer','Freelancer'],['In-house','In-house Marketing'],['E-commerce','E-commerce'],['Startup','Startup'],['Other','Other']]);
  identity.appendChild(type);

  const industry = field('Industry', 'Primary business category.');
  select(industry, 'industry', profile.industry || 'Digital Marketing', [['Digital Marketing','Digital Marketing'],['Advertising','Advertising'],['E-commerce','E-commerce'],['Technology','Technology'],['Retail','Retail'],['Education','Education'],['Real Estate','Real Estate'],['Healthcare','Healthcare'],['Finance','Finance'],['Travel','Travel & Hospitality'],['Other','Other']]);
  identity.appendChild(industry);

  const website = field('Business Website');
  input(website, 'website', profile.website, 'https://yourbusiness.com', 'url');
  identity.appendChild(website);

  const email = field('Business Email', 'Primary workspace contact.');
  input(email, 'businessEmail', profile.businessEmail, 'you@yourbusiness.com', 'email');
  identity.appendChild(email);

  const phone = field('Business Phone');
  input(phone, 'businessPhone', profile.businessPhone, '+880 1XXXXXXXXX', 'tel');
  identity.appendChild(phone);

  const address = field('Business Address');
  input(address, 'businessAddress', profile.businessAddress, 'City, Country');
  identity.appendChild(address);

  const country = field('Country / Region', 'Used for workspace regional context.');
  input(country, 'country', profile.country, 'e.g. Bangladesh');
  identity.appendChild(country);

  const registration = field('Business Registration No.', 'Optional company registration reference.');
  input(registration, 'registrationNumber', profile.registrationNumber, 'Optional registration number');
  identity.appendChild(registration);

  const tax = field('Tax / VAT ID', 'Optional tax or VAT reference.');
  input(tax, 'taxId', profile.taxId, 'Optional tax / VAT ID');
  identity.appendChild(tax);

  card.appendChild(identity);

  const regionalTitle = document.createElement('div');
  regionalTitle.className = 'adlytic-profile-section-title';
  regionalTitle.textContent = 'Regional & reporting preferences';
  card.appendChild(regionalTitle);

  const regional = document.createElement('div');
  regional.className = 'adlytic-profile-grid';

  const currency = field('Default Currency', 'Main currency for workspace reporting.');
  select(currency, 'currency', profile.currency || 'BDT', [['BDT','BDT — Bangladeshi Taka'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['INR','INR — Indian Rupee'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal'],['SGD','SGD — Singapore Dollar'],['AUD','AUD — Australian Dollar'],['CAD','CAD — Canadian Dollar'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['MYR','MYR — Malaysian Ringgit'],['PKR','PKR — Pakistani Rupee']]);
  regional.appendChild(currency);

  const date = field('Date Format');
  select(date, 'dateFormat', profile.dateFormat || 'DD/MM/YYYY', [['DD/MM/YYYY','DD / MM / YYYY'],['MM/DD/YYYY','MM / DD / YYYY'],['YYYY-MM-DD','YYYY - MM - DD']]);
  regional.appendChild(date);

  const time = field('Time Format');
  select(time, 'timeFormat', profile.timeFormat || '12h', [['12h','12-hour (AM/PM)'],['24h','24-hour']]);
  regional.appendChild(time);

  const week = field('Week Starts On');
  select(week, 'weekStartsOn', profile.weekStartsOn || 'Monday', [['Monday','Monday'],['Sunday','Sunday']]);
  regional.appendChild(week);

  const fiscal = field('Fiscal Year Starts', 'Useful for annual financial reporting.');
  select(fiscal, 'fiscalYearStart', profile.fiscalYearStart || 'January', [['January','January'],['April','April'],['July','July'],['October','October']]);
  regional.appendChild(fiscal);

  const language = field('Workspace Language');
  select(language, 'language', profile.language || 'en', [['en','English'],['bn','বাংলা']]);
  regional.appendChild(language);

  card.appendChild(regional);

  const note = document.createElement('div');
  note.className = 'adlytic-profile-note';
  note.innerHTML = '<strong>Important:</strong> Workspace branding and business details are user-specific. The AdLytic platform name and logo stay fixed.';
  card.appendChild(note);

  const anchor = [...workspaceCard.querySelectorAll('label')].find(el => el.textContent.trim() === 'Business / Workspace Name')?.parentElement;
  if (anchor) workspaceCard.insertBefore(card, anchor);
  else workspaceCard.appendChild(card);
}

function fixPlatformBranding() {
  const aside = document.querySelector('.adl-shell aside');
  const header = aside?.firstElementChild;
  const brandRow = header?.querySelector(':scope > div');
  if (!brandRow) return;

  let mark = brandRow.querySelector('.adl-brand-mark, .adlytic-fixed-brand-mark');
  const workspaceLogo = brandRow.querySelector('img[alt="Workspace logo"]');
  if (workspaceLogo) {
    mark = document.createElement('div');
    mark.className = 'adl-brand-mark adlytic-fixed-brand-mark w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg';
    mark.textContent = 'A';
    workspaceLogo.replaceWith(mark);
  }
  if (mark) {
    mark.textContent = 'A';
    mark.classList.add('adlytic-fixed-brand-mark');
  }
  const name = brandRow.querySelector('span');
  if (name) {
    name.textContent = 'AdLytic';
    name.classList.add('adlytic-platform-name');
  }
}

function enhanceSettings() {
  const title = [...document.querySelectorAll('h1')].find(el => el.textContent.trim() === 'Settings');
  if (!title) return;
  const heading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Workspace');
  const card = heading?.closest('.bg-white');
  if (!card) return;
  addWorkspaceProfile(card);
  enhanceTimezone(card, readProfile());
  fixPlatformBranding();
  const save = [...card.querySelectorAll('button')].find(b => b.textContent.includes('Save Settings'));
  if (save && !save.dataset.adlyticHooked) {
    save.dataset.adlyticHooked = '1';
    save.addEventListener('click', () => setTimeout(() => cloudSave(readProfile()), 500), true);
  }
}

const style = document.createElement('style');
style.textContent = `
.adlytic-fixed-brand-mark{width:36px!important;height:36px!important;border-radius:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:800!important;font-size:18px!important;color:#fff!important;background:linear-gradient(135deg,#38bdf8,#0284c7)!important;box-shadow:0 8px 22px rgba(56,189,248,.28)!important;flex:0 0 auto!important}
.adlytic-platform-name{color:#fff!important}
.adlytic-profile-card{margin:18px 0 16px;padding:20px;border:1px solid #cfeaf7;border-radius:16px;background:linear-gradient(145deg,#f5fbff 0%,#fff 55%,#f7fcff 100%);box-shadow:0 10px 28px rgba(7,89,133,.06)}
.adlytic-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}
.adlytic-profile-kicker{font-size:9px;letter-spacing:.14em;font-weight:800;color:#0284c7;margin-bottom:5px}
.adlytic-profile-head h4{margin:0;color:#123b59;font-size:16px;font-weight:800}
.adlytic-profile-head p{margin:5px 0 0;color:#587188;font-size:11px;line-height:1.55;max-width:700px}
.adlytic-profile-badge{font-size:10px;font-weight:800;color:#0284c7;background:#e8f7fe;border:1px solid #cfeaf7;border-radius:999px;padding:6px 10px;white-space:nowrap}
.adlytic-profile-section-title{font-size:11px;font-weight:800;color:#244b66;padding:10px 0 8px;margin-top:2px;border-bottom:1px solid #e0eef5;text-transform:uppercase;letter-spacing:.06em}
.adlytic-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;padding:14px 0 4px}
.adlytic-profile-label{display:block!important;margin:0!important;color:#36546b!important;font-size:11px!important;font-weight:750!important}
.adlytic-profile-hint{margin-top:2px;color:#7a91a3;font-size:10px;line-height:1.35}
.adlytic-profile-input{width:100%;box-sizing:border-box;margin-top:6px;padding:10px 11px;border:1px solid #cfe0ea;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
.adlytic-profile-input::placeholder{color:#9aadb9}
.adlytic-profile-input:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.12);background:#fff}
.adlytic-timezone-search{margin-top:7px!important;margin-bottom:5px!important}
.adlytic-profile-note{margin-top:14px;padding:10px 12px;border:1px solid #d7edf7;border-radius:10px;background:#effaff;color:#60798b;font-size:10px;line-height:1.5}
.adlytic-profile-note strong{color:#245b79}
@media(max-width:700px){.adlytic-profile-card{padding:15px;margin-top:14px;border-radius:14px}.adlytic-profile-head{flex-direction:column;gap:10px}.adlytic-profile-badge{align-self:flex-start}.adlytic-profile-grid{grid-template-columns:1fr;gap:12px}}
`;
document.head.appendChild(style);

const observer = new MutationObserver(() => enhanceSettings());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhanceSettings);
setTimeout(enhanceSettings, 300);
