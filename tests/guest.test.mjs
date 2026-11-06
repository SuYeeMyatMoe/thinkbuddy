import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const folder=new URL('../.cache/guest-tests/',import.meta.url);await mkdir(folder,{recursive:true});
for(const name of ['guest-store','server-validation','demo','builder-schema','builder']){
 const source=await readFile(new URL('../app/lib/'+name+'.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'");
 await writeFile(new URL(name+'.mjs',folder),js);
}
const {GUEST_KEY,loadGuestMissions,saveGuestMission,deleteGuestMission}=await import(new URL('guest-store.mjs',folder));
const {createDemoMission}=await import(new URL('demo.mjs',folder));
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};}
test('guest missions persist across reloads and remain isolated between browsers',()=>{
 const a=storage(),b=storage(),m=createDemoMission();const saved=saveGuestMission(m,a);
 assert.equal(saved.revision,1);assert.equal(loadGuestMissions(a)[0].id,m.id);assert.deepEqual(loadGuestMissions(b),[]);
 deleteGuestMission(m.id,a);assert.deepEqual(loadGuestMissions(a),[]);
});
test('stale guest updates do not overwrite another tab',()=>{
 const s=storage(),m=createDemoMission();saveGuestMission(m,s);
 assert.throws(()=>saveGuestMission({...m,title:'stale'},s),/another tab/);
 assert.equal(loadGuestMissions(s)[0].title,m.title);
});
test('invalid stored data and storage exhaustion are reported',()=>{
 const s=storage();s.setItem(GUEST_KEY,'{}');assert.throws(()=>loadGuestMissions(s));
 assert.throws(()=>saveGuestMission(createDemoMission(),{getItem:()=>null,setItem:()=>{throw new Error('quota');}}),/quota/);
});
