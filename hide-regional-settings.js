function hideRegionalSettings(){document.querySelectorAll('[data-adlytic-regional-reporting]').forEach(el=>{el.style.display='none';});}
new MutationObserver(hideRegionalSettings).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',hideRegionalSettings);
setTimeout(hideRegionalSettings,500);
setTimeout(hideRegionalSettings,1500);
setTimeout(hideRegionalSettings,3000);
