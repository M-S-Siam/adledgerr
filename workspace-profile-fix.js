const ADLYTIC_PROFILE_KEY = 'adlytic_workspace_profile';
const defaults = {
  workspaceType: 'Agency', industry: 'Digital Marketing', country: 'BD', currency: 'BDT',
  website: '', contactEmail: '', phone: '', address: '', description: '',
  dateFormat: 'DD/MM/YYYY', weekStartsOn: 'Monday', timeFormat: '12h', fiscalYearStart: 'January',
  financialAlertsEnabled: true, financialAlertThreshold: '80', financialEmailAlerts: false, language: 'English'
};
let saveTimer;

function readProfile() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(ADLYTIC_PROFILE_KEY) || '{}') }; }
  catch { return { ...defaults }; }
}
function saveProfile(patch) {
  const next = { ...readProfile(), ...patch };
  localStorage.setItem(ADLYTIC_PROFILE_KEY, JSON.stringify(next));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const { supabase } = await import('./src/lib/supabase.js');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const owned = await supabase.from('workspaces').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      let workspaceId = owned.data?.id;
      if (!workspaceId) {
        const member = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
        workspaceId = member.data?.workspace_id;
      }
      if (!workspaceId) return;
      const current = await supabase.from('workspace_app_data').select('data').eq('workspace_id', workspaceId).eq('data_key', 'adledger_settings').maybeSingle();
      await supabase.from('workspace_app_data').upsert({ workspace_id: workspaceId, data_key: 'adledger_settings', data: { ...(current.data?.data || {}), ...next }, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,data_key' });
    } catch (e) { console.warn('AdLytic profile sync skipped', e); }
  }, 500);
  return next;
}

function workspaceCard() {
  const heading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Workspace');
  return heading?.closest('.bg-white') || null;
}
function labelElement(card, text) {
  return [...card.querySelectorAll('label')].find(el => el.textContent.trim() === text) || null;
}
function nativeControl(card, text) {
  const label = labelElement(card, text);
  if (!label) return null;
  return label.parentElement?.querySelector('input,select,textarea') || null;
}
function nativeBlock(card, text) {
  const label = labelElement(card, text);
  return label?.parentElement || null;
}
function hideNative(card, text) {
  const block = nativeBlock(card, text);
  if (block) block.classList.add('adlytic-native-hidden');
}
function syncNative(card, label, value) {
  const control = nativeControl(card, label);
  if (!control) return;
  if (control.value !== String(value ?? '')) {
    const setter = Object.getOwnPropertyDescriptor(control.__proto__, 'value')?.set;
    if (setter) setter.call(control, String(value ?? '')); else control.value = String(value ?? '');
  }
  control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  if (control.tagName !== 'SELECT') control.dispatchEvent(new Event('change', { bubbles: true }));
}
function makeField(label, key, value, placeholder = '', type = 'text', onChange) {
  const wrap = document.createElement('div'); wrap.className = 'adlytic-settings-field';
  const lab = document.createElement('label'); lab.textContent = label; wrap.appendChild(lab);
  const input = document.createElement('input'); input.type = type; input.value = value || ''; input.placeholder = placeholder; input.className = 'adlytic-settings-control';
  input.addEventListener('input', () => onChange(input.value)); wrap.appendChild(input); return wrap;
}
function makeSelect(label, key, value, options, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'adlytic-settings-field';
  const lab = document.createElement('label'); lab.textContent = label; wrap.appendChild(lab);
  const select = document.createElement('select'); select.className = 'adlytic-settings-control';
  options.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; select.appendChild(o); });
  if (options.some(x => x[0] === value)) select.value = value;
  select.addEventListener('change', () => onChange(select.value)); wrap.appendChild(select); return wrap;
}
function makeToggle(label, value, onChange, hint = '') {
  const wrap = document.createElement('div'); wrap.className = 'adlytic-settings-field adlytic-toggle-field';
  const text = document.createElement('div'); const lab = document.createElement('label'); lab.textContent = label; text.appendChild(lab);
  if (hint) { const small = document.createElement('span'); small.textContent = hint; text.appendChild(small); }
  const button = document.createElement('button'); button.type = 'button'; button.className = 'adlytic-switch';
  const set = v => { button.classList.toggle('is-on', !!v); button.setAttribute('aria-pressed', String(!!v)); };
  set(value); button.addEventListener('click', () => { const next = button.getAttribute('aria-pressed') !== 'true'; set(next); onChange(next); });
  wrap.append(text, button); return wrap;
}
function makeCard(title, subtitle, badge) {
  const card = document.createElement('section'); card.className = 'adlytic-settings-card';
  card.innerHTML = `<div class="adlytic-settings-head"><div><h4>${title}</h4><p>${subtitle}</p></div><span>${badge}</span></div><div class="adlytic-settings-grid"></div>`;
  return card;
}
function timezoneOptions() {
  try { return ['UTC', ...Intl.supportedValuesOf('timeZone').filter(z => z !== 'UTC')]; }
  catch { return ['UTC','Asia/Dhaka','Asia/Kolkata','Asia/Dubai','Asia/Tokyo','Europe/London','Europe/Berlin','America/New_York','America/Chicago','America/Los_Angeles','Australia/Sydney']; }
}
function timezoneLabel(z) {
  try { const p = new Intl.DateTimeFormat('en-US',{timeZone:z,timeZoneName:'shortOffset',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date()); return `${z} — ${p.find(x=>x.type==='timeZoneName')?.value || 'GMT'}`; }
  catch { return z; }
}
function buildCards(card) {
  if (card.querySelector('[data-adlytic-settings-root]')) return;
  const d = readProfile();
  ['Business / Workspace Name','Timezone','Default Report Range','Financial alerts'].forEach(x => hideNative(card, x));
  const nativeSave = [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Settings');
  if (nativeSave) nativeSave.classList.add('adlytic-native-save-hidden');

  const root = document.createElement('div'); root.dataset.adlyticSettingsRoot = '1';
  const general = makeCard('General Workspace Settings','Core workspace identity and reporting behavior.','GENERAL');
  const profile = makeCard('Workspace Profile','Professional business and organization details.','WORKSPACE');
  const regional = makeCard('Regional & Reporting Settings','Regional preferences for dates, weeks, time and financial reporting.','REGIONAL');
  const financial = makeCard('Financial Alerts','Control when AdLytic should flag important workspace spending activity.','FINANCE');
  const save = document.createElement('button'); save.type='button'; save.className='adlytic-settings-save'; save.innerHTML='Save Settings'; save.addEventListener('click',()=>{ const btn=[...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Settings' && !b.classList.contains('adlytic-settings-save')); if(btn) btn.click(); else saveProfile({}); });

  const gg = general.querySelector('.adlytic-settings-grid');
  gg.appendChild(makeField('Business / Workspace Name','businessName',card.querySelector('input')?.value || 'AdLytic','', 'text', v => { saveProfile({businessName:v}); syncNative(card,'Business / Workspace Name',v); }));
  const tz = makeSelect('Timezone','timezone',nativeControl(card,'Timezone')?.value || 'Asia/Dhaka',timezoneOptions().map(z=>[z,timezoneLabel(z)]),v=>{saveProfile({timezone:v});syncNative(card,'Timezone',v)}); gg.appendChild(tz);
  gg.appendChild(makeSelect('Default Report Range','defaultReportRange',nativeControl(card,'Default Report Range')?.value || 'This Month',[['This Month','This Month'],['Last 7 Days','Last 7 Days'],['Last 30 Days','Last 30 Days'],['Lifetime','Lifetime']],v=>{saveProfile({defaultReportRange:v});syncNative(card,'Default Report Range',v)}));
  gg.appendChild(makeSelect('Language','language',d.language,[['English','English'],['Bangla','বাংলা']],v=>saveProfile({language:v})));

  const pg = profile.querySelector('.adlytic-settings-grid');
  const countries=[['BD','Bangladesh'],['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['IN','India'],['PK','Pakistan'],['AE','United Arab Emirates'],['SA','Saudi Arabia'],['SG','Singapore'],['MY','Malaysia'],['DE','Germany'],['FR','France'],['IT','Italy'],['JP','Japan'],['KR','South Korea'],['CN','China'],['OTHER','Other']];
  const currencies=[['BDT','BDT — Bangladeshi Taka'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['INR','INR — Indian Rupee'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal'],['SGD','SGD — Singapore Dollar'],['AUD','AUD — Australian Dollar'],['CAD','CAD — Canadian Dollar'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['MYR','MYR — Malaysian Ringgit'],['PKR','PKR — Pakistani Rupee']];
  [[makeSelect('Workspace Type','workspaceType',d.workspaceType,[['Agency','Agency'],['Freelancer','Freelancer'],['In-house','In-house Marketing'],['E-commerce','E-commerce'],['Startup','Startup'],['Other','Other']],v=>saveProfile({workspaceType:v})),makeSelect('Industry','industry',d.industry,[['Digital Marketing','Digital Marketing'],['Advertising','Advertising'],['E-commerce','E-commerce'],['Technology','Technology'],['Retail','Retail'],['Education','Education'],['Real Estate','Real Estate'],['Healthcare','Healthcare'],['Other','Other']],v=>saveProfile({industry:v}))],[makeSelect('Country / Region','country',d.country,countries,v=>saveProfile({country:v})),makeSelect('Default Currency','currency',d.currency,currencies,v=>saveProfile({currency:v}))],[makeField('Business Website','website',d.website,'https://yourbusiness.com','url',v=>saveProfile({website:v})),makeField('Business Email','contactEmail',d.contactEmail,'contact@yourbusiness.com','email',v=>saveProfile({contactEmail:v}))],[makeField('Business Phone','phone',d.phone,'+880 1XXXXXXXXX','tel',v=>saveProfile({phone:v})),makeField('Business Address','address',d.address,'City, Country','text',v=>saveProfile({address:v}))],[makeField('Workspace Description','description',d.description,'Short description of this workspace','text',v=>saveProfile({description:v}))]].flat().forEach(x=>pg.appendChild(x));

  const rg = regional.querySelector('.adlytic-settings-grid');
  rg.appendChild(makeSelect('Date Format','dateFormat',d.dateFormat,[['DD/MM/YYYY','DD / MM / YYYY'],['MM/DD/YYYY','MM / DD / YYYY'],['YYYY-MM-DD','YYYY - MM - DD']],v=>saveProfile({dateFormat:v})));
  rg.appendChild(makeSelect('Week Starts','weekStartsOn',d.weekStartsOn,[['Monday','Monday'],['Sunday','Sunday']],v=>saveProfile({weekStartsOn:v})));
  rg.appendChild(makeSelect('Time Format','timeFormat',d.timeFormat,[['12h','12-hour (AM/PM)'],['24h','24-hour']],v=>saveProfile({timeFormat:v})));
  rg.appendChild(makeSelect('Fiscal Year Starts','fiscalYearStart',d.fiscalYearStart,[['January','January'],['April','April'],['July','July'],['October','October']],v=>saveProfile({fiscalYearStart:v})));

  const fg = financial.querySelector('.adlytic-settings-grid');
  fg.appendChild(makeToggle('Enable financial alerts',d.financialAlertsEnabled,v=>{saveProfile({financialAlertsEnabled:v});syncNative(card,'Financial alerts',v)},'Monitor important spending changes.'));
  fg.appendChild(makeSelect('Alert Threshold','financialAlertThreshold',String(d.financialAlertThreshold),[['70','70% of budget'],['80','80% of budget'],['90','90% of budget'],['100','100% of budget']],v=>saveProfile({financialAlertThreshold:v})));
  fg.appendChild(makeToggle('Email notifications',d.financialEmailAlerts,v=>saveProfile({financialEmailAlerts:v}),'Send alerts to the workspace email.'));

  root.append(general,profile,regional,financial,save);
  const logoBlock = card.querySelector('.rounded-2xl.border.border-sky-100');
  if (logoBlock) logoBlock.insertAdjacentElement('afterend',root); else card.appendChild(root);
}

const style = document.createElement('style');
style.textContent = `.adlytic-native-hidden,.adlytic-native-save-hidden{display:none!important}.adlytic-settings-card{margin:16px 0;padding:18px;border:1px solid #cfe4ef;border-radius:14px;background:linear-gradient(135deg,#f7fcff,#fff);box-shadow:0 8px 22px rgba(10,70,105,.05)}.adlytic-settings-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}.adlytic-settings-head h4{margin:0;color:#123b59;font-size:14px;font-weight:800}.adlytic-settings-head p{margin:4px 0 0;color:#6b8192;font-size:11px}.adlytic-settings-head span{padding:5px 9px;border:1px solid #cfe7f2;border-radius:999px;background:#eaf8fe;color:#087cab;font-size:9px;font-weight:800;letter-spacing:.08em}.adlytic-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.adlytic-settings-field{min-width:0}.adlytic-settings-field label{display:block!important;margin:0 0 5px!important;color:#36546b!important;font-size:11px!important;font-weight:700!important}.adlytic-settings-field span{display:block;margin:2px 0 0;color:#8296a6;font-size:9px}.adlytic-settings-control{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cbdde7;border-radius:9px;background:#fff;color:#173b53;font-size:12px;outline:none}.adlytic-toggle-field{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px}.adlytic-toggle-field>div:first-child{min-width:0}.adlytic-switch{width:38px;height:22px;border:0;border-radius:999px;background:#cbd5df;position:relative;cursor:pointer;flex:0 0 auto}.adlytic-switch:after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s ease}.adlytic-switch.is-on{background:#0ea5e9}.adlytic-switch.is-on:after{transform:translateX(16px)}.adlytic-settings-save{display:inline-flex;align-items:center;padding:10px 16px;margin-top:2px;border:0;border-radius:9px;background:#0ea5e9;color:#fff;font-size:12px;font-weight:700;cursor:pointer}@media(max-width:700px){.adlytic-settings-grid{grid-template-columns:1fr}.adlytic-settings-head{flex-direction:column}}`;
document.head.appendChild(style);

function enhanceWorkspaceSettings(){const card=workspaceCard();if(card)buildCards(card)}
new MutationObserver(enhanceWorkspaceSettings).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',enhanceWorkspaceSettings);
setTimeout(enhanceWorkspaceSettings,500);setTimeout(enhanceWorkspaceSettings,1200);setTimeout(enhanceWorkspaceSettings,2500);
