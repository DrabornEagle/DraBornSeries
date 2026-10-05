/** Revalidate restored tabs, including fixes published under the same version. */
export function webVersionGuard(version, commit = "uncommitted") {
  return `<script data-dbs-version-guard>(function(){
    const running=${JSON.stringify(version)},source=${JSON.stringify(commit)},reloadKey='dbs-web-last-reload';let checking=false,reloading=false,lastCheck=0;
    function compare(next){const a=String(next).split('.'),b=running.split('.');if(a.length<3||a.length>4||!a.every(x=>/^\\d+$/.test(x)))return null;for(let i=0;i<Math.max(a.length,b.length);i++){const diff=Number(a[i]||0)-Number(b[i]||0);if(diff)return diff;}return 0;}
    function isCommit(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
    async function check(force=false){if(checking||reloading||document.hidden||(!force&&Date.now()-lastCheck<15000))return;checking=true;lastCheck=Date.now();try{const response=await fetch('/DraBornSeries/DBS-SOURCE.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const release=await response.json(),order=compare(release.version);if(order===null||order<0||!(order>0||(isCommit(source)&&isCommit(release.commit)&&source!==release.commit)))return;
      const target=release.version+':'+(isCommit(release.commit)?release.commit:''),now=Date.now(),url=new URL(location.href),recent=time=>Number.isFinite(Number(time))&&now-Number(time)>=0&&now-Number(time)<60000;if(url.searchParams.get('_dbs_release')===release.version&&(!isCommit(release.commit)||url.searchParams.get('_dbs_source')===release.commit)&&recent(url.searchParams.get('_dbs_reload')))return;
      try{const previous=JSON.parse(sessionStorage.getItem(reloadKey)||'null');if(previous&&previous.target===target&&recent(previous.time))return;sessionStorage.setItem(reloadKey,JSON.stringify({target,time:now}));}catch{}
      url.searchParams.set('_dbs_release',release.version);if(isCommit(release.commit))url.searchParams.set('_dbs_source',release.commit);url.searchParams.set('_dbs_reload',String(now));reloading=true;location.replace(url.href);
    }catch{}finally{checking=false;}}
    if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(items=>Promise.all(items.filter(item=>new URL(item.scope).pathname==='/DraBornSeries/').map(item=>item.unregister()))).catch(()=>{});
    if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(key=>/^(dbs[-_]|drabornseries[-_])/i.test(key)).map(key=>caches.delete(key)))).catch(()=>{});
    window.addEventListener('pageshow',event=>check(event.persisted));window.addEventListener('focus',()=>check());window.addEventListener('online',()=>check(true));document.addEventListener('visibilitychange',()=>check());document.addEventListener('resume',()=>check(true));check();
  })();</script>`;
}
