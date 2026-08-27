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
  adlyticProfileSaveTimer = setTimeout(() => profileCloudSave(merged), 650);
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

function makeField(label, key, data, placeholder = '', type = 'text', hint = '') {
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
  input.value = data[key] || '';
  input.placeholder = placeholder;
  input.className = 'adlytic-wp-input';
  input.autocomplete = type === 'email' ? 'email' : 'off';
  input.addEventListener('input', () => profileWrite({ [key]: input.value }));
  wrap.appendChild(input);
  return wrap;
}

function makeTextarea(label, key, data, placeholder = '', hint = '') {
  const wrap = document.createElement('div');
  wrap.className = 'adlytic-wp-field adlytic-wp-wide';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  if (hint) {
    const hintEl = document.createElement('span');
    hintEl.textContent = hint;
    wrap.appendChild(hintEl);
  }

  const textarea = document.createElement('textarea');
  textarea.value = data[key] || '';
  textarea.placeholder = placeholder;
  textarea.className = 'adlytic-wp-input adlytic-wp-textarea';
  textarea.rows = 2;
  textarea.addEventListener('input', () => profileWrite({ [key]: textarea.value }));
  wrap.appendChild(textarea);
  return wrap;
}

function makeSelect(label, key, data, options, hint = '') {
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
  options.forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });
  select.value = options.some(([value]) => value === data[key]) ? data[key] : options[0][0];
  select.addEventListener('change', () => profileWrite({ [key]: select.value }));
  wrap.appendChild(select);
  return wrap;
}

function findWorkspaceCard() {
  const heading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Workspace');
  if (!heading) return null;

  let node = heading;
  for (let i = 0; node && i < 12; i += 1, node = node.parentElement) {
    const hasName = [...node.querySelectorAll('label')].some(el => el.textContent.trim() === 'Business / Workspace Name');
    const hasSave = [...node.querySelectorAll('button')].some(el => el.textContent.includes('Save Settings'));
    if (hasName && hasSave) return node;
  }
  return null;
}

function addWorkspaceProfile(card) {
  if (!card || card.querySelector('[data-adlytic-workspace-profile]')) return;

  const data = profileRead();
  const profile = document.createElement('section');
  profile.dataset.adlyticWorkspaceProfile = '1';
  profile.className = 'adlytic-wp-card';
  profile.innerHTML = `
    <div class="adlytic-wp-head">
      <div>
        <div class="adlytic-wp-title">Workspace Profile</div>
        <div class="adlytic-wp-subtitle">Professional business identity and reporting preferences for this workspace.</div>
      </div>
      <div class="adlytic-wp-badge">WORKSPACE</div>
    </div>
    <div class="adlytic-wp-group-title">Business identity</div>
    <div class="adlytic-wp-grid" data-wp-identity></div>
    <div class="adlytic-wp-divider"></div>
    <div class="adlytic-wp-group-title">Reporting & regional preferences</div>
    <div class="adlytic-wp-grid" data-wp-reporting></div>
    <div class="adlytic-wp-save-note"><span class="adlytic-wp-dot"></span> Changes are saved automatically to this workspace.</div>
  `;

  const identity = profile.querySelector('[data-wp-identity]');
  const reporting = profile.querySelector('[data-wp-reporting]');

  const countries = [
    ['BD','Bangladesh'],['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IN','India'],['PK','Pakistan'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['SG','Singapore'],['MY','Malaysia'],['ID','Indonesia'],['DE','Germany'],['FR','France'],['IT','Italy'],['ES','Spain'],['NL','Netherlands'],['BR','Brazil'],['MX','Mexico'],['JP','Japan'],['KR','South Korea'],['CN','China'],['NZ','New Zealand'],['ZA','South Africa'],['NG','Nigeria'],['OTHER','Other']
  ];
  const currencies = [
    ['BDT','BDT — Bangladeshi Taka'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['INR','INR — Indian Rupee'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal'],['SGD','SGD — Singapore Dollar'],['AUD','AUD — Australian Dollar'],['CAD','CAD — Canadian Dollar'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['MYR','MYR — Malaysian Ringgit'],['PKR','PKR — Pakistani Rupee']
  ];

  [
    makeSelect('Workspace Type', 'workspaceType', data, [['Agency','Agency'],['Freelancer','Freelancer'],['In-house','In-house Marketing'],['E-commerce','E-commerce'],['Startup','Startup'],['Other','Other']], 'How this workspace is used.'),
    makeSelect('Industry', 'industry', data, [['Digital Marketing','Digital Marketing'],['Advertising','Advertising'],['E-commerce','E-commerce'],['Technology','Technology'],['Retail','Retail'],['Education','Education'],['Real Estate','Real Estate'],['Healthcare','Healthcare'],['Other','Other']], 'Used to personalize workspace context.'),
    makeSelect('Country / Region', 'country', data, countries),
    makeSelect('Default Currency', 'currency', data, currencies, 'Primary reporting currency.'),
    makeField('Business Website', 'website', data, 'https://yourbusiness.com', 'url'),
    makeField('Business Email', 'contactEmail', data, 'contact@yourbusiness.com', 'email'),
    makeField('Business Phone', 'phone', data, '+880 1XXXXXXXXX', 'tel'),
    makeField('Business Address', 'address', data, 'City, Country'),
    makeTextarea('Workspace Description', 'description', data, 'Short description of this workspace', 'Optional description shown as workspace context.')
  ].forEach(field => identity.appendChild(field));

  [
    makeSelect('Date Format', 'dateFormat', data, [['DD/MM/YYYY','DD / MM / YYYY'],['MM/DD/YYYY','MM / DD / YYYY'],['YYYY-MM-DD','YYYY - MM - DD']]),
    makeSelect('Week Starts On', 'weekStartsOn', data, [['Monday','Monday'],['Sunday','Sunday']]),
    makeSelect('Time Format', 'timeFormat', data, [['12h','12-hour (AM/PM)'],['24h','24-hour']]),
    makeSelect('Fiscal Year Starts', 'fiscalYearStart', data, [['January','January'],['April','April'],['July','July'],['October','October']])
  ].forEach(field => reporting.appendChild(field));

  const nameLabel = [...card.querySelectorAll('label')].find(el => el.textContent.trim() === 'Business / Workspace Name');
  const nameBlock = nameLabel?.parentElement;
  const logoBlock = [...card.children].find(el => el.querySelector?.('img[alt="Workspace logo"]'));

  if (nameBlock?.parentElement) {
    nameBlock.parentElement.insertBefore(profile, nameBlock);
  } else if (logoBlock?.parentElement) {
    logoBlock.parentElement.insertBefore(profile, logoBlock.nextSibling);
  } else {
    card.insertBefore(profile, card.firstChild);
  }

  const saveButton = [...card.querySelectorAll('button')].find(btn => btn.textContent.includes('Save Settings'));
  if (saveButton && !saveButton.dataset.adlyticProfileSaveHooked) {
    saveButton.dataset.adlyticProfileSaveHooked = '1';
    saveButton.addEventListener('click', () => profileCloudSave(profileRead()), true);
  }
}

const profileStyle = document.createElement('style');
profileStyle.textContent = `
  .adlytic-wp-card{margin:14px 0 18px;padding:18px;border:1px solid #cfe4ef;border-radius:14px;background:linear-gradient(135deg,rgba(246,252,255,.98),rgba(255,255,255,.98));box-shadow:0 8px 22px rgba(10,70,105,.05)}
  .adlytic-wp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
  .adlytic-wp-title{font-size:14px;font-weight:800;color:#123b59}
  .adlytic-wp-subtitle{margin-top:4px;font-size:11px;line-height:1.5;color:#678096}
  .adlytic-wp-badge{padding:5px 9px;border:1px solid #cfe7f2;border-radius:999px;background:#eaf8fe;color:#087cab;font-size:9px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
  .adlytic-wp-group-title{margin:2px 0 9px;color:#45647a;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
  .adlytic-wp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .adlytic-wp-field{min-width:0}
  .adlytic-wp-wide{grid-column:1 / -1}
  .adlytic-wp-field label{display:block!important;margin:0 0 5px!important;color:#36546b!important;font-size:11px!important;font-weight:700!important}
  .adlytic-wp-field span{display:block;margin:-2px 0 5px;color:#8296a6;font-size:9px;line-height:1.3}
  .adlytic-wp-input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cbdde7;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none}
  .adlytic-wp-input:focus{border-color:#67c5ee;box-shadow:0 0 0 3px rgba(14,165,233,.10)}
  .adlytic-wp-textarea{resize:vertical;min-height:54px;font-family:inherit}
  .adlytic-wp-divider{height:1px;background:#e1edf3;margin:17px 0 14px}
  .adlytic-wp-save-note{display:flex;align-items:center;gap:7px;margin-top:14px;color:#71899a;font-size:10px}
  .adlytic-wp-dot{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.10);flex:0 0 auto}
  @media(max-width:700px){.adlytic-wp-card{padding:14px;margin:12px 0 14px}.adlytic-wp-grid{grid-template-columns:1fr;gap:10px}.adlytic-wp-wide{grid-column:auto}.adlytic-wp-head{gap:10px}.adlytic-wp-badge{font-size:8px}}
`;
document.head.appendChild(profileStyle);

function enhanceWorkspaceProfile() {
  const card = findWorkspaceCard();
  if (card) addWorkspaceProfile(card);
}

new MutationObserver(enhanceWorkspaceProfile).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhanceWorkspaceProfile);
setTimeout(enhanceWorkspaceProfile, 400);
setTimeout(enhanceWorkspaceProfile, 1200);
setTimeout(enhanceWorkspaceProfile, 2500);
