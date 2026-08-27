const ADLYTIC_PROFILE_KEY = 'adlytic_workspace_profile';
let adlyticProfileSaveTimer;

const profileDefaults = {
  workspaceType: 'Agency',
  industry: 'Digital Marketing',
  country: 'BD',
  currency: 'BDT',
  website: '',
  contactEmail: '',
  phone: '',
  address: '',
  description: '',
  dateFormat: 'DD/MM/YYYY',
  weekStartsOn: 'Monday',
  timeFormat: '12h',
  fiscalYearStart: 'January'
};

function profileRead() {
  try {
    return { ...profileDefaults, ...(JSON.parse(localStorage.getItem(ADLYTIC_PROFILE_KEY) || '{}')) };
  } catch {
    return { ...profileDefaults };
  }
}

function profileWrite(patch) {
  const merged = { ...profileRead(), ...patch };
  localStorage.setItem(ADLYTIC_PROFILE_KEY, JSON.stringify(merged));
  clearTimeout(adlyticProfileSaveTimer);
  adlyticProfileSaveTimer = setTimeout(() => profileCloudSave(merged), 700);
  return merged;
}

async function profileCloudSave(data) {
  try {
    const { supabase } = await import('./src/lib/supabase.js');
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    let workspaceId = null;
    const owned = await supabase.from('workspaces').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!owned.error && owned.data?.id) workspaceId = owned.data.id;

    if (!workspaceId) {
      const membership = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (!membership.error && membership.data?.workspace_id) workspaceId = membership.data.workspace_id;
    }

    if (!workspaceId) return;
    const current = await supabase.from('workspace_app_data').select('data').eq('workspace_id', workspaceId).eq('data_key', 'adledger_settings').maybeSingle();
    const merged = { ...(current.data?.data || {}), ...data };
    await supabase.from('workspace_app_data').upsert({
      workspace_id: workspaceId,
      data_key: 'adledger_settings',
      data: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'workspace_id,data_key' });
  } catch (error) {
    console.warn('AdLytic workspace profile sync skipped:', error);
  }
}

function profileField(label, key, value, placeholder = '', type = 'text', hint = '') {
  const wrap = document.createElement('div');
  wrap.className = 'adlytic-wp-field';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.textContent = hint;
    wrap.appendChild(hintEl);
  }

  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  input.placeholder = placeholder;
  input.className = 'adlytic-wp-input';
  input.dataset.profileKey = key;
  input.addEventListener('input', () => profileWrite({ [key]: input.value }));
  wrap.appendChild(input);
  return wrap;
}

function profileSelect(label, key, value, options, hint = '') {
  const wrap = document.createElement('div');
  wrap.className = 'adlytic-wp-field';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.textContent = hint;
    wrap.appendChild(hintEl);
  }

  const select = document.createElement('select');
  select.className = 'adlytic-wp-input';
  options.forEach(([val, text]) => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = text;
    select.appendChild(option);
  });
  select.value = options.some(([val]) => val === value) ? value : options[0][0];
  select.addEventListener('change', () => profileWrite({ [key]: select.value }));
  wrap.appendChild(select);
  return wrap;
}

function findWorkspaceCard() {
  const heading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Workspace');
  if (!heading) return null;

  let node = heading;
  for (let i = 0; node && i < 10; i += 1, node = node.parentElement) {
    const hasName = [...node.querySelectorAll('label')].some(el => el.textContent.trim() === 'Business / Workspace Name');
    const hasSave = [...node.querySelectorAll('button')].some(el => el.textContent.includes('Save Settings'));
    if (hasName && hasSave) return node;
  }
  return null;
}

function addWorkspaceProfile(card) {
  if (!card || card.querySelector('[data-adlytic-workspace-profile]')) return card?.querySelector('[data-adlytic-workspace-profile]') || null;

  const data = profileRead();
  const profile = document.createElement('div');
  profile.dataset.adlyticWorkspaceProfile = '1';
  profile.className = 'adlytic-wp-card';
  profile.innerHTML = `
    <div class="adlytic-wp-head">
      <div>
        <div class="adlytic-wp-title">Workspace Profile</div>
        <div class="adlytic-wp-subtitle">Professional business details for reports, organization and workspace identity.</div>
      </div>
      <div class="adlytic-wp-badge">WORKSPACE</div>
    </div>
    <div class="adlytic-wp-grid"></div>
  `;

  const grid = profile.querySelector('.adlytic-wp-grid');
  const countries = [
    ['BD','Bangladesh'],['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IN','India'],['PK','Pakistan'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['SG','Singapore'],['MY','Malaysia'],['ID','Indonesia'],['DE','Germany'],['FR','France'],['IT','Italy'],['ES','Spain'],['NL','Netherlands'],['BR','Brazil'],['MX','Mexico'],['JP','Japan'],['KR','South Korea'],['CN','China'],['NZ','New Zealand'],['ZA','South Africa'],['NG','Nigeria'],['OTHER','Other']
  ];
  const currencies = [
    ['BDT','BDT — Bangladeshi Taka'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['INR','INR — Indian Rupee'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal'],['SGD','SGD — Singapore Dollar'],['AUD','AUD — Australian Dollar'],['CAD','CAD — Canadian Dollar'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['MYR','MYR — Malaysian Ringgit'],['PKR','PKR — Pakistani Rupee']
  ];

  [
    profileSelect('Workspace Type', 'workspaceType', data.workspaceType, [['Agency','Agency'],['Freelancer','Freelancer'],['In-house','In-house Marketing'],['E-commerce','E-commerce'],['Startup','Startup'],['Other','Other']], 'How this workspace is used.'),
    profileSelect('Industry', 'industry', data.industry, [['Digital Marketing','Digital Marketing'],['Advertising','Advertising'],['E-commerce','E-commerce'],['Technology','Technology'],['Retail','Retail'],['Education','Education'],['Real Estate','Real Estate'],['Healthcare','Healthcare'],['Other','Other']], 'Used to personalize workspace context.'),
    profileSelect('Country / Region', 'country', data.country, countries),
    profileSelect('Default Currency', 'currency', data.currency, currencies, 'Primary reporting currency.'),
    profileField('Business Website', 'website', data.website, 'https://yourbusiness.com', 'url'),
    profileField('Business Email', 'contactEmail', data.contactEmail, 'contact@yourbusiness.com', 'email'),
    profileField('Business Phone', 'phone', data.phone, '+880 1XXXXXXXXX', 'tel'),
    profileField('Business Address', 'address', data.address, 'City, Country'),
    profileField('Workspace Description', 'description', data.description, 'Short description of this workspace')
  ].forEach(field => grid.appendChild(field));

  const nameLabel = [...card.querySelectorAll('label')].find(el => el.textContent.trim() === 'Business / Workspace Name');
  const nameBlock = nameLabel?.parentElement;
  if (nameBlock) {
    nameBlock.parentElement.insertBefore(profile, nameBlock);
  } else {
    card.appendChild(profile);
  }

  return profile;
}

function addRegionalReportingSettings(card, profile) {
  if (!card || card.querySelector('[data-adlytic-regional-reporting]')) return;

  const data = profileRead();
  const regional = document.createElement('div');
  regional.dataset.adlyticRegionalReporting = '1';
  regional.className = 'adlytic-wp-card adlytic-regional-card';
  regional.innerHTML = `
    <div class="adlytic-wp-head">
      <div>
        <div class="adlytic-wp-title">Regional &amp; Reporting Settings</div>
        <div class="adlytic-wp-subtitle">Regional preferences for dates, weeks, time and financial reporting.</div>
      </div>
      <div class="adlytic-wp-badge">REGIONAL</div>
    </div>
    <div class="adlytic-wp-grid"></div>
  `;

  const grid = regional.querySelector('.adlytic-wp-grid');
  [
    profileSelect('Date Format', 'dateFormat', data.dateFormat, [['DD/MM/YYYY','DD / MM / YYYY'],['MM/DD/YYYY','MM / DD / YYYY'],['YYYY-MM-DD','YYYY - MM - DD']]),
    profileSelect('Week Starts', 'weekStartsOn', data.weekStartsOn, [['Monday','Monday'],['Sunday','Sunday']]),
    profileSelect('Time Format', 'timeFormat', data.timeFormat, [['12h','12-hour (AM/PM)'],['24h','24-hour']]),
    profileSelect('Fiscal Year Starts', 'fiscalYearStart', data.fiscalYearStart, [['January','January'],['April','April'],['July','July'],['October','October']])
  ].forEach(field => grid.appendChild(field));

  // Place the regional card immediately below Workspace Profile.
  if (profile?.parentElement === card) {
    profile.insertAdjacentElement('afterend', regional);
  } else {
    card.appendChild(regional);
  }
}

const profileStyle = document.createElement('style');
profileStyle.textContent = `
  .adlytic-wp-card{margin:16px 0 18px;padding:18px;border:1px solid #cfe4ef;border-radius:14px;background:linear-gradient(135deg,rgba(246,252,255,.98),rgba(255,255,255,.98));box-shadow:0 8px 22px rgba(10,70,105,.05)}
  .adlytic-wp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
  .adlytic-wp-title{font-size:14px;font-weight:800;color:#123b59}
  .adlytic-wp-subtitle{margin-top:4px;font-size:11px;line-height:1.5;color:#678096}
  .adlytic-wp-badge{padding:5px 9px;border:1px solid #cfe7f2;border-radius:999px;background:#eaf8fe;color:#087cab;font-size:9px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
  .adlytic-wp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
  .adlytic-wp-field{min-width:0}
  .adlytic-wp-field label{display:block!important;margin:0 0 5px!important;color:#36546b!important;font-size:11px!important;font-weight:700!important}
  .adlytic-wp-field span{display:block;margin:-2px 0 5px;color:#8296a6;font-size:9px;line-height:1.3}
  .adlytic-wp-input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cbdde7;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none}
  .adlytic-wp-input:focus{border-color:#67c5ee;box-shadow:0 0 0 3px rgba(14,165,233,.10)}
  .adlytic-regional-card{margin-top:0}
  @media(max-width:700px){.adlytic-wp-card{padding:14px;margin:12px 0 14px}.adlytic-wp-grid{grid-template-columns:1fr;gap:11px}.adlytic-wp-head{gap:10px}.adlytic-wp-badge{font-size:8px}}
`;
document.head.appendChild(profileStyle);

function enhanceWorkspaceProfile() {
  const card = findWorkspaceCard();
  if (!card) return;
  const profile = addWorkspaceProfile(card);
  addRegionalReportingSettings(card, profile);
}

new MutationObserver(enhanceWorkspaceProfile).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhanceWorkspaceProfile);
setTimeout(enhanceWorkspaceProfile, 500);
setTimeout(enhanceWorkspaceProfile, 1500);
