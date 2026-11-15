const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');
const calls=[];
let server,upstream,base;
async function listen(app){const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));return s;}
test.before(async()=>{
 const fake=express();fake.use(express.json());fake.use((req,res)=>{calls.push({method:req.method,path:req.path,query:{...req.query},auth:req.get('authorization'),body:req.body});res.json({academy_id:1,items:[]});});
 upstream=await listen(fake);process.env.MAX_ENGINE_PACA_URL=`http://127.0.0.1:${upstream.address().port}`;
 const app=express();app.use(express.json());app.use('/full',require('../routes/maxEngine'));server=await listen(app);base=`http://127.0.0.1:${server.address().port}/full`;
});
test.after(()=>{server?.close();upstream?.close();});
test('fixed PEAK namespace, bearer passthrough and no-store',async()=>{
 const r=await fetch(base+'/resources/student_records?cursor=100',{headers:{Authorization:'Bearer synthetic-delegation'}});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.deepEqual(calls.at(-1),{method:'GET',path:'/paca/integrations/max-engine/full/peak/resources/student_records',query:{cursor:'100'},auth:'Bearer synthetic-delegation',body:undefined});
});
test('preview and confirmation forward only fixed paths',async()=>{
 const body={preview_token:'synthetic-preview',idempotency_key:'synthetic-key',confirm:true};
 const r=await fetch(base+'/confirm',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-delegation'},body:JSON.stringify(body)});
 assert.equal(r.status,200);assert.equal(calls.at(-1).path,'/paca/integrations/max-engine/full/peak/confirm');assert.deepEqual(calls.at(-1).body,body);
});
test('unsupported methods, traversal and academy override do not reach source',async()=>{
 const n=calls.length;
 assert.equal((await fetch(base+'/resources/students?academy_id=2')).status,422);
 assert.equal((await fetch(base+'/resources/%2e%2e%2fpaca')).status,404);
 assert.equal((await fetch(base+'/resources/students',{method:'DELETE'})).status,404);
 assert.equal(calls.length,n);
});
test('unavailable source fails closed without credentials in response',async()=>{
 const before=process.env.MAX_ENGINE_PACA_URL;process.env.MAX_ENGINE_PACA_URL='http://example.invalid';
 const r=await fetch(base+'/identity',{headers:{Authorization:'Bearer private-synthetic'}});assert.equal(r.status,503);assert.ok(!(await r.text()).includes('private-synthetic'));process.env.MAX_ENGINE_PACA_URL=before;
});
test('malformed login JSON is sanitized before legacy logging',async()=>{
 const privacy=require('../middleware/maxEnginePrivacy');
 const app=express();let logged=false;app.use(express.json());app.use(privacy.errorHandler);
 app.use((_error,_req,res,_next)=>{logged=true;res.sendStatus(500);});
 const s=await listen(app);
 try {
  const r=await fetch(`http://127.0.0.1:${s.address().port}/peak/integrations/max-engine/full/token`,{
   method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"synthetic-private-input"'});
  assert.equal(r.status,400);assert.ok(!(await r.text()).includes('synthetic-private-input'));assert.equal(logged,false);
  assert.equal(privacy.isIntegration({path:'/peak/students'}),false);
 } finally {s.close();}
});
test('workflow parameters and batch/expand pass through fixed PEAK paths',async()=>{
 const params=JSON.stringify({event:'100m',start_date:'2026-09-01',end_date:'2026-09-27'});
 assert.equal((await fetch(base+'/workflows/event_ranking?'+new URLSearchParams({params}))).status,200);
 assert.equal(calls.at(-1).path,'/paca/integrations/max-engine/full/peak/workflows/event_ranking');
 assert.equal(calls.at(-1).query.params,params);
 assert.equal((await fetch(base+'/resources/student_records?'+new URLSearchParams({ids:'[1,2]',expand:'["student","event"]'}))).status,200);
 assert.equal(calls.at(-1).query.ids,'[1,2]');
 const n=calls.length;
 assert.equal((await fetch(base+'/workflows/today_brief')).status,404);
 assert.equal((await fetch(base+'/workflows/recent_records?academy_id=2')).status,422);
 assert.equal(calls.length,n);
});
test('lesson preparation forwards date/slot and bearer to the fixed source without allowing academy override',async()=>{
 const params=JSON.stringify({date:'2026-10-07',time_slot:'afternoon'});
 const r=await fetch(base+'/workflows/teaching_context?'+new URLSearchParams({params}),{headers:{Authorization:'Bearer synthetic-delegation'}});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(calls.at(-1).path,'/paca/integrations/max-engine/full/peak/workflows/teaching_context');
 assert.equal(calls.at(-1).query.params,params);assert.equal(calls.at(-1).auth,'Bearer synthetic-delegation');
 const n=calls.length;assert.equal((await fetch(base+'/workflows/teaching_context?academy_id=2')).status,422);assert.equal(calls.length,n);
});
