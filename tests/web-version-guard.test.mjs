import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webVersionGuard } from "../scripts/web-version-guard.mjs";
async function run(next, fail=false) {
  const events={}, replaced=[];
  const context={ URL, Date, AbortSignal, document:{hidden:false,addEventListener:(n,fn)=>events[n]=fn},window:{addEventListener:(n,fn)=>events[n]=fn},navigator:{},location:{href:"https://www.draborneagle.com/DraBornSeries/hero=season-2/episode-7?keep=yes",replace:url=>replaced.push(url)},fetch:async(_url,options)=>{assert.equal(options.cache,"no-store");if(fail)throw Error("offline");return {ok:true,json:async()=>({version:next})};}};
  vm.runInNewContext(webVersionGuard("0.7.4").replace(/^<script[^>]*>|<\/script>$/g,""),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {events,replaced};
}
test("restored tab upgrade keeps its episode and query",async()=>{const {events,replaced}=await run("0.7.5");assert.equal(typeof events.pageshow,"function");assert.equal(typeof events.visibilitychange,"function");const url=new URL(replaced[0]);assert.equal(url.pathname,"/DraBornSeries/hero=season-2/episode-7");assert.equal(url.searchParams.get("keep"),"yes");assert.equal(url.searchParams.get("_dbs_release"),"0.7.5");});
test("current, older and offline versions do not loop or reload",async()=>{for(const next of ["0.7.4","0.2.0","invalid"])assert.deepEqual((await run(next)).replaced,[]);assert.deepEqual((await run("0.7.5",true)).replaced,[]);});
