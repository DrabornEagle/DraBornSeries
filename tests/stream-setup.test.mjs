import test from 'node:test';
import assert from 'node:assert/strict';
import { configureStream } from '../scripts/configure-stream.mjs';
const account='a'.repeat(32), uid='b'.repeat(32), endpoint='https://xpdiwyxnnrmyvpcqwuyb.supabase.co/functions/v1/dbs-api';
const json=(body)=>Response.json(body);
test('Stream setup requires configured access before any network request',async()=>{
  let requests=0;
  await assert.rejects(configureStream({account,token:'',supabaseToken:'',request:async()=>{requests++;}}),/CREDENTIALS_MISSING/);
  assert.equal(requests,0);
});
test('Stream setup preserves another application webhook',async()=>{
  const calls=[];
  const request=async(url,init)=>{
    calls.push({url,method:init.method,body:init.body&&JSON.parse(init.body)});
    if(url.endsWith('/stream/webhook'))return json({success:true,result:{notificationUrl:'https://another-app.example.invalid/hook'}});
    if(url.endsWith('/secrets'))return json([]);
    const q=JSON.parse(init.body).query;
    return json(q.startsWith('select user_id')?[{user_id:'11111111-1111-1111-1111-111111111111'}]:[]);
  };
  const state=await configureStream({account,token:'test',supabaseToken:'test',request,rounds:1});
  assert.equal(state.webhook,false);
  assert.equal(calls.some(c=>c.url.endsWith('/stream/webhook')&&c.method==='PUT'),false);
  assert.deepEqual(calls.find(c=>c.url.endsWith('/secrets')).body.map(s=>s.name),['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']);
});
test('Catalog import tracks a real returned UID and verifies readiness and signing',async()=>{
  const calls=[],episode='22222222-2222-2222-2222-222222222222';let bound=false;
  const request=async(url,init)=>{
    const body=init.body&&JSON.parse(init.body);calls.push({url,method:init.method,body});
    if(url.endsWith('/stream/webhook'))return json({success:true,result:{notificationUrl:endpoint,secret:'test-signing-secret'}});
    if(url.endsWith('/secrets'))return json([]);
    if(url.includes('/database/query')){
      const q=body.query;
      if(q.startsWith('select user_id'))return json([{user_id:'11111111-1111-1111-1111-111111111111'}]);
      if(q.startsWith('select e.id'))return json([{episode_id:episode,slug:'test-film',number:1,demo_url:'https://media.example.invalid/film.mp4'}]);
      if(q.startsWith('select u.uid'))return json(bound?[]:[{uid}]);
      if(q.startsWith('select drabornseries.dbs_complete_stream_upload'))bound=true;
      if(q.startsWith('select stream_uid'))return json([{stream_uid:uid}]);
      return json([]);
    }
    if(url.includes('?search='))return json({success:true,result:[]});
    if(url.endsWith('/copy'))return json({success:true,result:{uid}});
    if(url.endsWith('/token'))return json({success:true,result:{token:'test-signed-token'}});
    if(url.endsWith('/'+uid))return json({success:true,result:{uid,readyToStream:true,requireSignedURLs:true,duration:30}});
    throw Error('Unexpected request');
  };
  const state=await configureStream({account,token:'test',supabaseToken:'test',request,pause:async()=>{},rounds:2});
  assert.equal(state.pending,0);assert.equal(bound,true);
  assert.equal(calls.find(c=>c.url.endsWith('/copy')).body.requireSignedURLs,true);
  const insert=calls.find(c=>c.body?.query?.startsWith('insert into drabornseries.dbs_video_uploads')).body.query;
  assert.match(insert,new RegExp(uid));assert.match(insert,new RegExp(episode));
  assert.equal(calls.filter(c=>c.url.endsWith('/token')).length,1);
});
