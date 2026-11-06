import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const folder=new URL('../.cache/council-tests/',import.meta.url);await mkdir(folder,{recursive:true});
for(const name of ['demo','server-validation','builder-schema','builder']){
 const source=await readFile(new URL('../app/lib/'+name+'.ts',import.meta.url),'utf8');
 await writeFile(new URL(name+'.mjs',folder),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
}
const {createDemoMission,demoCouncil}=await import(new URL('demo.mjs',folder));
const {missionSchema}=await import(new URL('server-validation.mjs',folder));
test('demo councils have distinct topic perspectives and valid linked graphs',()=>{
 const school=createDemoMission(),home=createDemoMission('Design an affordable home'),unknown=createDemoMission('Explore tidal poetry');
 for(const m of [school,home,unknown]){assert.equal(m.mascots.length,5);assert.equal(m.mascots[0].id,'buddy');assert.ok(missionSchema.safeParse(m).success);assert.ok(m.statements.every(s=>s.sources.length===0&&s.status==='Opinion'));}
 assert.notEqual(school.mascots[1].role,home.mascots[1].role);
});
test('a targeted turn preserves history and responds only with target and Buddy',()=>{
 const m=createDemoMission(),id=m.mascots[2].id;
 const next=demoCouncil({action:'turn',mission:m,prompt:'Why?',mascotIds:[id]});
 assert.equal(next.statements.length,m.statements.length+2);
 assert.deepEqual(next.statements.slice(-2).map(s=>s.mascotId),[id,'buddy']);assert.equal(next.round,m.round+1);
 assert.deepEqual(next.statements.slice(0,m.statements.length),m.statements);
});
test('evidence checks target exact contribution and never invent verification',()=>{
 const m=createDemoMission(),s=m.statements[1];
 const next=demoCouncil({action:'evidence',mission:m,prompt:s.id});
 assert.equal(next.statements[1].status,'Unverified');assert.equal(next.statements[0].status,'Opinion');assert.deepEqual(next.statements[1].sources,[]);
});
test('replacement preserves former statements and permanent Buddy',()=>{
 const m=createDemoMission(),former=m.mascots[2];
 const next=demoCouncil({action:'replace',mission:m,mascotIds:[former.id],prompt:'Accessibility'});
 assert.ok(next.mascots.some(x=>x.id==='buddy'));assert.ok(!next.mascots.some(x=>x.id===former.id));assert.ok(next.statements.some(x=>x.mascotId===former.id));assert.ok(missionSchema.safeParse(next).success);
});
test('validation rejects unsafe citations and dangling graph edges',()=>{
 const m=createDemoMission();m.statements[0].sources=[{title:'unsafe',url:'javascript:alert(1)'}];assert.equal(missionSchema.safeParse(m).success,false);
 const n=createDemoMission();n.edges[0].target='missing';assert.equal(missionSchema.safeParse(n).success,false);
});
