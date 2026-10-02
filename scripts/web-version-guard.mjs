/** Revalidate restored tabs without losing the current series/episode URL. */
export function webVersionGuard(version) {
  return `<script data-dbs-version-guard>(function(){
    const running=${JSON.stringify(version)};let checking=false,lastCheck=0;
    function newer(next){const a=String(next).split('.'),b=running.split('.');if(a.length!==3||!a.every(x=>/^\\d+$/.test(x)))return false;for(let i=0;i<3;i++){if(+a[i]!==+b[i])return +a[i]>+b[i];}return false;}
    async function check(){if(checking||document.hidden||Date.now()-lastCheck<15000)return;checking=true;lastCheck=Date.now();try{const response=await fetch('/DraBornSeries/DBS-SOURCE.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.ok){const release=await response.json();if(newer(release.version)){const url=new URL(location.href);url.searchParams.set('_dbs_release',release.version);location.replace(url.href);}}}catch{}finally{checking=false;}}
    if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(items=>Promise.all(items.filter(item=>new URL(item.scope).pathname==='/DraBornSeries/').map(item=>item.unregister()))).catch(()=>{});
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(key=>/^(dbs[-_]|drabornseries[-_])/i.test(key)).map(key=>caches.delete(key)))).catch(()=>{});
    window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);check();
  })();</script>`;
}
