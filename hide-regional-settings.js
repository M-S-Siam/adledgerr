function hideRegionalSettings(){document.querySelectorAll('[data-adlytic-regional-reporting]').forEach(el=>{el.style.display='none';});}
function hideLegacyFinancialAlert(){
  const warning='Show negative card balance warnings.';
  const nodes=[...document.querySelectorAll('*')].filter(el=>{
    if(!el.isConnected) return false;
    if(el.closest('[data-adlytic-settings-root]')) return false;
    const text=el.textContent.replace(/\s+/g,' ').trim();
    return text.includes('Financial alerts') && text.includes(warning) && text.length < 180;
  });
  nodes.forEach(el=>{el.style.display='none';});
}
function applySettingsCleanup(){hideRegionalSettings();hideLegacyFinancialAlert();}
new MutationObserver(applySettingsCleanup).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',applySettingsCleanup);
setTimeout(applySettingsCleanup,500);
setTimeout(applySettingsCleanup,1500);
setTimeout(applySettingsCleanup,3000);
