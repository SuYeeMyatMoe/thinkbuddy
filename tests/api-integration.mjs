import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const base='http://127.0.0.1:5173';
const folder=new URL('../.cache/api-tests/',import.meta.url);await mkdir(folder,{recursive:true});
await writeFile(new URL('demo.mjs',folder),ts.transpileModule(await readFile(new URL('../app/lib/demo.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {createDemoMission}=await import(new URL('demo.mjs',folder));
const anon=await fetch(base+'/api/missions');assert.equal(anon.status,401);
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
assert.ok(cookie,'Development login must supply a local cookie');
const headers={'Cookie':cookie,'Origin':base,'Content-Type':'application/json'};
const call=async(path,method='GET',body,extra={})=>{const res=await fetch(base+path,{method,headers:{...headers,...extra},body:body?JSON.stringify(body):undefined});return {status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():{error:await res.text()}};};
const draft=createDemoMission('API integration test: build an accessible garden');
let id=draft.id;
try{
 const created=await call('/api/missions','PUT',{mission:draft,expectedRevision:0});assert.equal(created.status,200);assert.equal(created.data.mission.revision,1);
 const restored=await call('/api/missions?id='+id);assert.equal(restored.data.mission.title,draft.title);
 const stale=await call('/api/missions','PUT',{mission:draft,expectedRevision:0});assert.equal(stale.status,409);
 const key=crypto.randomUUID(),body={action:'turn',mission:created.data.mission,prompt:'What assumptions matter?',mascotIds:[draft.mascots[1].id]};
 const turn=await call('/api/council','POST',body,{'Idempotency-Key':key});assert.equal(turn.status,200);assert.equal(turn.data.demo,true);assert.equal(turn.data.mission.statements.length,7);
 const repeated=await call('/api/council','POST',body,{'Idempotency-Key':key});assert.deepEqual(repeated.data,turn.data);
 const changed=await call('/api/council','POST',{...body,prompt:'Changed'},{'Idempotency-Key':key});assert.equal(changed.status,409);
 const saved=await call('/api/missions','PUT',{mission:turn.data.mission,expectedRevision:1});assert.equal(saved.data.mission.revision,2);
 const sse=await fetch(base+'/api/council',{method:'POST',headers:{...headers,Accept:'text/event-stream'},body:JSON.stringify({...body,mission:saved.data.mission})});const stream=await sse.text();assert.match(stream,/event: thinking/);assert.match(stream,/event: statement/);assert.match(stream,/event: complete/);
 const forbidden=await call('/api/missions','PUT',{mission:draft,expectedRevision:2},{Origin:'https://unrelated.example'});assert.equal(forbidden.status,403);
 const invalid=await call('/api/council','POST',{...body,mission:{...draft,mascots:[]}});assert.equal(invalid.status,400);
 console.log('PASS: authentication, creation, persistence, revision conflicts, targeted turns, idempotency, SSE, origin checks, input validation');
}finally{const removed=await call('/api/missions?id='+id,'DELETE');assert.equal(removed.status,200);console.log('Disposable API test mission removed.');}
