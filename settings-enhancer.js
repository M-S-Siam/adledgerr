const SETTINGS_KEY = 'adledger_settings';
const EXTRA_KEY = 'adlytic_workspace_profile';
let supabasePromise;
let saveTimer;

const safeJson = (value, fallback = {}) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};
const readLocal = () => safeJson(localStorage.getItem(SETTINGS_KEY), {});
const readExtra = () => safeJson(localStorage.getItem(EXTRA_KEY), {});

function writeExtra(patch) {
  const merged = { ...readExtra(), ...patch };
  localStorage.setItem(EXTRA_KEY, JSON.stringify(merged));
  return merged;
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

function countryOptions() {
  return [
    ['BD','Bangladesh'],['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IN','India'],['PK','Pakistan'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['SG','Singapore'],['MY','Malaysia'],['ID','Indonesia'],['DE','Germany'],['FR','France'],['IT','Italy'],['ES','Spain'],['NL','Netherlands'],['BR','Brazil'],['MX','Mexico'],['JP','Japan'],['KR','South Korea'],['CN','China'],['NZ','New Zealand'],['ZA','South Africa'],['NG','Nigeria'],['OTHER','Other']
  ];
}

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
    const merged = { ...(current.data?.data || {}), ...readLocal(), ...readExtra(), ...patch };
    await supabase.from('workspace_app_data').upsert({
      workspace_id: workspaceId,
      data_key: SETTINGS_KEY,
      data: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'workspace_id,data_key' });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('AdLytic workspace profile sync skipped:', error);
  }
}

function scheduleCloudSave(patch = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => cloudMerge(patch), 900);
}

function fieldShell(label, hint = '') {
  const wrap = document.createElement('div');
  wrap.className = 'adlytic-profile-field';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.className = 'adlytic-profile-label';
  wrap.appendChild(labelEl);
  if (hint) {
    const hintEl = document.createElement('div');
    hintEl.textContent = hint;
    hintEl.className = 'adlytic-profile-hint';
    wrap.appendChild(hintEl);
  }
  return wrap;
}

function addInput(parent, key, value, placeholder = '', type = 'text') {
  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  input.placeholder = placeholder;
  input.dataset.profileKey = key;
  input.className = 'adlytic-profile-input';
  input.addEventListener('input', () => {
    const patch = writeExtra({ [key]: input.value });
    scheduleCloudSave(patch);
  });
  parent.appendChild(input);
  return input;
}

function addSelect(parent, key, value, options) {
  const select = document.createElement('select');
  select.dataset.profileKey = key;
  select.className = 'adlytic-profile-input';
  options.forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    select.appendChild(opt);
  });
  if (value && options.some(([val]) => val === value)) select.value = value;
  select.addEventListener('change', () => {
    const patch = writeExtra({ [key]: select.value });
    scheduleCloudSave(patch);
  });
  parent.appendChild(select);
  return select;
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
    const selected = select.value;
    [...select.options].forEach(option => {
      option.hidden = !!q && !option.textContent.toLowerCase().includes(q);
    });
    if (selected) select.value = selected;
  };
  search.addEventListener('input', filter);
}

function addProfileCard(workspaceCard) {
  if (workspaceCard.querySelector('[data-adlytic-profile]')) return workspaceCard.querySelector('[data-adlytic-profile]');
  const extra = readExtra();
  const card = document.createElement('div');
  card.dataset.adlyticProfile = '1';
  card.className = 'adlytic-profile-card';
  card.innerHTML = `<div class="adlytic-profile-head"><div><h4>Workspace Profile</h4><p>Professional business details used to personalize this workspace.</p></div><span>Workspace</span></div>`;

  const grid = document.createElement('div');
  grid.className = 'adlytic-profile-grid';

  const typeField = fieldShell('Workspace Type', 'How this workspace is used.');
  addSelect(typeField, 'workspaceType', extra.workspaceType || 'Agency', [['Agency','Agency'],['Freelancer','Freelancer'],['In-house','In-house Marketing'],['E-commerce','E-commerce'],['Startup','Startup'],['Other','Other']]);
  grid.appendChild(typeField);

  const industryField = fieldShell('Industry', 'Optional business category.');
  addSelect(industryField, 'industry', extra.industry || 'Digital Marketing', [['Digital Marketing','Digital Marketing'],['Advertising','Advertising'],['E-commerce','E-commerce'],['Technology','Technology'],['Retail','Retail'],['Education','Education'],['Real Estate','Real Estate'],['Healthcare','Healthcare'],['Other','Other']]);
  grid.appendChild(industryField);

  const countryField = fieldShell('Country / Region');
  addSelect(countryField, 'country', extra.country || 'BD', countryOptions());
  grid.appendChild(countryField);

  const currencyField = fieldShell('Default Currency', 'Used as the workspace reporting currency.');
  addSelect(currencyField, 'currency', extra.currency || 'BDT', [['BDT','BDT — Bangladeshi Taka'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['INR','INR — Indian Rupee'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal'],['SGD','SGD — Singapore Dollar'],['AUD','AUD — Australian Dollar'],['CAD','CAD — Canadian Dollar'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['MYR','MYR — Malaysian Ringgit'],['PKR','PKR — Pakistani Rupee']]);
  grid.appendChild(currencyField);

  const websiteField = fieldShell('Business Website');
  addInput(websiteField, 'website', extra.website || '', 'https://yourbusiness.com', 'url');
  grid.appendChild(websiteField);

  card.appendChild(grid);
  const firstField = [...workspaceCard.querySelectorAll('label')].find(el => el.textContent.trim() === 'Business / Workspace Name')?.parentElement;
  if (firstField) workspaceCard.insertBefore(card, firstField);
  else workspaceCard.appendChild(card);
  return card;
}

function addRegionalReportingCard(workspaceCard, profileCard) {
  if (workspaceCard.querySelector('[data-adlytic-regional-reporting]')) return;
  const extra = readExtra();
  const card = document.createElement('div');
  card.dataset.adlyticRegionalReporting = '1';
  card.className = 'adlytic-profile-card adlytic-regional-card';
  card.innerHTML = `<div class="adlytic-profile-head"><div><h4>Regional &amp; Reporting Settings</h4><p>Regional preferences used for dates, weeks, time and financial reporting.</p></div><span>Regional</span></div>`;

  const grid = document.createElement('div');
  grid.className = 'adlytic-profile-grid';

  const dateFormatField = fieldShell('Date Format');
  addSelect(dateFormatField, 'dateFormat', extra.dateFormat || 'DD/MM/YYYY', [['DD/MM/YYYY','DD / MM / YYYY'],['MM/DD/YYYY','MM / DD / YYYY'],['YYYY-MM-DD','YYYY - MM - DD']]);
  grid.appendChild(dateFormatField);

  const weekField = fieldShell('Week Starts');
  addSelect(weekField, 'weekStartsOn', extra.weekStartsOn || 'Monday', [['Monday','Monday'],['Sunday','Sunday']]);
  grid.appendChild(weekField);

  const timeFormatField = fieldShell('Time Format');
  addSelect(timeFormatField, 'timeFormat', extra.timeFormat || '12h', [['12h','12-hour (AM/PM)'],['24h','24-hour']]);
  grid.appendChild(timeFormatField);

  const fiscalField = fieldShell('Fiscal Year Starts');
  addSelect(fiscalField, 'fiscalYearStart', extra.fiscalYearStart || 'January', [['January','January'],['April','April'],['July','July'],['October','October']]);
  grid.appendChild(fiscalField);

  card.appendChild(grid);
  if (profileCard?.parentElement === workspaceCard) {
    profileCard.insertAdjacentElement('afterend', card);
  } else {
    workspaceCard.appendChild(card);
  }
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
  const profileCard = addProfileCard(workspaceCard);
  addRegionalReportingCard(workspaceCard, profileCard);
  enhanceTimezone(workspaceCard);
  fixPlatformBranding();

  const saveButton = [...workspaceCard.querySelectorAll('button')].find(btn => btn.textContent.includes('Save Settings'));
  if (saveButton && !saveButton.dataset.adlyticSaveHooked) {
    saveButton.dataset.adlyticSaveHooked = '1';
    saveButton.addEventListener('click', () => setTimeout(() => cloudMerge(readExtra()), 1300), true);
  }
}

const style = document.createElement('style');
style.textContent = `
  .adlytic-fixed-brand-mark{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;background:linear-gradient(135deg,#38bdf8,#0284c7);box-shadow:0 8px 22px rgba(56,189,248,.28);flex:0 0 auto}
  .adlytic-profile-card{margin:18px 0 4px;padding:16px;border:1px solid #cfeaf7;border-radius:16px;background:linear-gradient(135deg,#f4fbff,#ffffff);box-shadow:0 8px 24px rgba(7,89,133,.05)}
  .adlytic-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
  .adlytic-profile-head h4{margin:0;color:#123b59;font-size:14px;font-weight:800}
  .adlytic-profile-head p{margin:4px 0 0;color:#587188;font-size:11px;line-height:1.5}
  .adlytic-profile-head span{font-size:10px;font-weight:800;color:#0284c7;background:#e8f7fe;border:1px solid #cfeaf7;border-radius:999px;padding:5px 8px;white-space:nowrap}
  .adlytic-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .adlytic-profile-label{display:block!important;margin:0!important;color:#36546b!important;font-size:11px!important;font-weight:700!important}
  .adlytic-profile-hint{margin-top:2px;color:#7a91a3;font-size:10px;line-height:1.35}
  .adlytic-profile-input{width:100%;box-sizing:border-box;margin-top:6px;padding:9px 10px;border:1px solid #cfe0ea;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none}
  .adlytic-profile-input:focus{border-color:#7dd3fc;box-shadow:0 0 0 3px rgba(56,189,248,.12)}
  .adlytic-timezone-search-wrap{margin:7px 0 5px}
  .adlytic-timezone-search-wrap .adlytic-profile-input{margin-top:0}
  @media(max-width:700px){.adlytic-profile-grid{grid-template-columns:1fr}.adlytic-profile-head{flex-direction:column}.adlytic-profile-head span{align-self:flex-start}}
`;
document.head.appendChild(style);

const observer = new MutationObserver(() => enhanceSettings());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhanceSettings);
setTimeout(enhanceSettings, 300);
