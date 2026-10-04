const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const root = process.env.DBS_UI_PROOF || 'artifacts/web-commerce';
const user = { id:'11111111-1111-4111-8111-111111111111', email:'visual-test@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{}, identities:[] };
const end = new Date(Date.now() + 12 * 86400000 + 7200000).toISOString();
const membership = {product_id:'dbs_vip_monthly',provider:'google_play',status:'active',starts_at:new Date().toISOString(),expires_at:end,auto_renew:true};
const products = [
 ...['weekly','monthly','yearly'].map((period,index)=>({id:'dbs_vip_'+period,kind:'vip',title:'DraBornSeries '+['Haftalık','Aylık','Yıllık'][index]+' VIP',billing_period:period,coins:0,bonus_coins:0,active:true,sort_order:index})),
 ...[50,100,250,500,1000,2500].map((amount,index)=>({id:'dbs_coins_'+amount,kind:'coins',title:amount+' BornCoins',coins:amount+[0,10,30,80,200,600][index],bonus_coins:[0,10,30,80,200,600][index],active:true,sort_order:10+index}))
];
const prices={dbs_vip_weekly:'₺71,99',dbs_vip_monthly:'₺199,99',dbs_vip_yearly:'₺1.999,99',dbs_coins_50:'₺35,99',dbs_coins_100:'₺61,99',dbs_coins_250:'₺129,99',dbs_coins_500:'₺249,99',dbs_coins_1000:'₺364,99',dbs_coins_2500:'₺609,99'};
const tasks=[{id:'welcome',name:'DraBornSeries’e hoş geldin',description:'E-posta hesabınla giriş yap; bir defalık karşılama ödülünü al.',data:{coins:80}}, {id:'favorite',name:'İlk hikâyeni listene ekle',description:'Bir diziyi Listem’e ekle, sonra ödülünü al.',data:{coins:10}}, {id:'profile',name:'Profilini kişiselleştir',description:'Ayarlar bölümünde adını veya profil fotoğrafını kaydet.',data:{coins:10}}];
(async()=>{
 await fs.mkdir(root,{recursive:true}); const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,reducedMotion:'reduce'});
 let active=true, favoriteClaimed=false; const errors=[];
 await context.addInitScript(({user})=>{
  const payload={sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600};
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify(payload))+'.visual-test';
  localStorage.setItem('dbs-auth-session',JSON.stringify({access_token:token,refresh_token:'visual-test-only',token_type:'bearer',expires_in:3600,expires_at:payload.exp,user}));
 },{user});
 await context.route('**/xpdiwyxnnrmyvpcqwuyb.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').at(-1);
  let data=[];
  if(url.pathname.startsWith('/auth/')) data=user;
  else if(url.pathname.includes('/functions/')) {
   const body=req.postDataJSON()||{};
   data=body.action==='billing-catalog'?{configured:true,prices,available:Object.keys(prices),checkedAt:new Date().toISOString(),region:'TR'}:body.action==='ads-config'?{mode:'test'}:body.action==='status'?{version:'0.7.7.1'}:{};
  } else if(url.pathname.includes('/rpc/')) {
   if(name==='dbs_claim_task') { favoriteClaimed=true; data={coins:10}; }
   else data=name==='dbs_is_vip'?active:name==='dbs_is_admin'?false:name==='dbs_bootstrap'?{}:{};
  }
  else if(name==='dbs_google_play_products') data=products;
  else if(name==='dbs_tasks') data=tasks;
  else if(name==='dbs_user_tasks') data=[{tasks_id:'welcome',claimed_at:new Date().toISOString()},...(favoriteClaimed?[{tasks_id:'favorite',claimed_at:new Date().toISOString()}]:[])];
  else if(name==='dbs_profiles') data={user_id:user.id,username:'Test İzleyicisi',full_name:'Test İzleyicisi',language:'tr',status:'active',autoplay_preview:false};
  else if(name==='dbs_borncoins_wallet') data={balance:147};
  else if(name==='dbs_user_streaks') data={days:2,last_claim_date:null};
  else if(name==='dbs_vip_subscriptions') data=active?[membership]:[];
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Content-Type':'application/json'};
  await route.fulfill({status:200,headers:cors,body:JSON.stringify(data)});
 });
 const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
 const visit=async name=>{await page.goto('http://localhost:8765/DraBornSeries/?page='+name,{waitUntil:'networkidle'});await page.getByLabel('DraBornSeries açılıyor',{exact:true}).waitFor({state:'detached'});};
 await visit('store');
 await page.getByRole('button',{name:'VIP üyelik bilgilerimi aç'}).waitFor({timeout:20000});
 await page.getByRole('button',{name:'VIP üyelik bilgilerimi aç'}).click();
 await page.getByText('Ayrıcalıkların seninle',{exact:true}).waitFor();
 assert.ok(await page.getByText('KALAN SÜRE',{exact:true}).isVisible());
 assert.ok(await page.getByText('12 gün',{exact:true}).isVisible());
 await page.screenshot({path:root+'/vip-badge.png'});
 await page.getByRole('button',{name:/Mağazayı\ keşfet/}).click();
 await page.getByText('Ayrıcalıkların seninle',{exact:true}).waitFor({state:'detached'});
 assert.equal(await page.getByText('Cüzdanına toplam',{exact:false}).count(),0);
 assert.equal(await page.getByRole('button',{name:/BornCoins paketi/}).count(),6);
 await page.getByRole('button',{name:/VIP\ avantajlarını\ keşfet/}).click();
 await page.getByRole('button',{name:/Aktif\ VIP\ üyeliğimi\ gör/}).click();
 await page.getByText('VIP üyeliğin zaten aktif',{exact:true}).waitFor();
 await page.screenshot({path:root+'/vip-owned.png'});
 assert.equal(await page.getByText('Google Play ile Abone Ol',{exact:true}).count(),0);
 await page.getByRole('button',{name:/VIP\ bilgisini\ kapat/}).click();
 await page.getByText('VIP üyeliğin zaten aktif',{exact:true}).waitFor({state:'detached'});
 await page.getByText('VIP dünyanda neler var?',{exact:true}).scrollIntoViewIfNeeded();
 assert.ok(await page.getByText('VIP içerik koleksiyonları',{exact:true}).isVisible());
 assert.ok(await page.getByText('Erken erişim',{exact:true}).count());
 assert.ok(await page.getByText('Sana özel VIP rozeti',{exact:true}).count());
 await page.screenshot({path:root+'/vip-benefits.png'});
 await page.getByRole('button',{name:/Ödüller/}).click();
 await page.getByText('BornCoins kazan',{exact:true}).scrollIntoViewIfNeeded();
 await page.getByText('1 / 3 görev tamamlandı',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:root+'/borncoins-rewards.png'});
 assert.ok(await page.getByText('1 / 3 görev tamamlandı',{exact:true}).isVisible());
 const claimButton=page.getByTestId('reward-claim-favorite');
 await claimButton.scrollIntoViewIfNeeded();
 const transform=()=>claimButton.evaluate(element=>getComputedStyle(element).transform);
 const still=await transform();
 await page.waitForTimeout(150); assert.equal(await transform(),still);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>{const element=document.querySelector('[data-testid="reward-claim-favorite"]');return element&&getComputedStyle(element).transform!=='none'&&getComputedStyle(element).transform!=='matrix(1, 0, 0, 1, 0, 0)';}).catch(async error=>{console.error(JSON.stringify(await page.evaluate(()=>({hidden:document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,transform:getComputedStyle(document.querySelector('[data-testid="reward-claim-favorite"]')).transform}))));throw error;});
 const moving=await transform(); await page.waitForTimeout(200); assert.notEqual(await transform(),moving);
 await page.screenshot({path:root+'/borncoins-rewards-animated.png'});
 // A pulsing button intentionally never has a stable bounding box. Tap its
 // center as a viewer would, keeping normal motion enabled for the popup check.
 const claimBounds=await claimButton.getByRole('button',{name:/Ödülü al/}).boundingBox();
 assert.ok(claimBounds); await page.mouse.click(claimBounds.x+claimBounds.width/2,claimBounds.y+claimBounds.height/2);
 await page.getByText('Ödülün hesabına eklendi.',{exact:false}).waitFor();
 assert.equal(await claimButton.count(),0);
 assert.equal(await page.getByText('Ödül alındı',{exact:true}).count(),2);
 const otherReward=page.getByTestId('reward-claim-profile');
 await page.waitForFunction(()=>{const element=document.querySelector('[data-testid="reward-claim-profile"]');return element&&getComputedStyle(element).transform==='matrix(1, 0, 0, 1, 0, 0)';});
 const paused=await otherReward.evaluate(element=>getComputedStyle(element).transform);
 await page.waitForTimeout(200); assert.equal(await otherReward.evaluate(element=>getComputedStyle(element).transform),paused);
 await page.getByRole('button',{name:'Harika!',exact:true}).click();
 await page.getByText('Ödülün hesabına eklendi.',{exact:false}).waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:/Mağaza/}).first().click().catch(async()=>{await visit('store');});
 await page.getByRole('button',{name:/Satın\ alımlarımı\ geri\ yükle/}).click();
 assert.equal(await page.getByTestId('reward-claim-profile').count(),0);
 await page.getByText('Hesabın güncellendi',{exact:true}).waitFor();
 await page.screenshot({path:root+'/restore-result.png'});
 await page.getByRole('button',{name:/Tamam,\ hesabım\ güncel/}).click();
 active=false;
 await visit('vip');
 await page.getByRole('button',{name:/Seçili\ paketi\ incele/}).click();
 await page.getByText('Google Play aboneliği',{exact:true}).waitFor();
 assert.ok(await page.getByText('1080p / 4K',{exact:true}).isVisible());
 assert.ok(await page.getByText('FULL HD',{exact:true}).isVisible());
 assert.ok(await page.getByText('ULTRA HD',{exact:true}).isVisible());
 assert.ok(await page.getByText('Sınırsız İzleme',{exact:true}).isVisible());
 assert.ok(await page.getByText('Reklamsız',{exact:true}).isVisible());
 await page.screenshot({path:root+'/vip-checkout-top.png'});
 await page.getByRole('button',{name:/Google\ Play\ ile\ Abone\ Ol/}).scrollIntoViewIfNeeded();
 await page.screenshot({path:root+'/vip-checkout-payment.png'});
 await page.getByLabel('Kapat',{exact:true}).first().click();
 await visit('store');
 await page.getByRole('button',{name:/50 BornCoins paketi/}).first().scrollIntoViewIfNeeded();
 await page.screenshot({path:root+'/borncoins-cards.png'});
 assert.equal(await page.getByText('Cüzdanına toplam',{exact:false}).count(),0);
 const layout=await page.evaluate(()=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth}));
 console.log(JSON.stringify({layout}));
 const overflow=layout.width>layout.viewport+1;
 assert.equal(overflow,false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({screenshots:9,errors,verified:['vip-badge-membership-popup','owned-vip-block','countdown','unchanged-vip-world','reward-progress','reward-animation-and-reduced-motion','claimed-reward-static','reward-modal-pauses-animation','reward-page-cleanup','restore-result','new-vip-purchase-benefits','six-clean-coin-cards','no-horizontal-overflow']}));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
