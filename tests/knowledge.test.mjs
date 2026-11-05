import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import ts from 'typescript';
const dir=new URL('../.cache/knowledge-tests/',import.meta.url);await mkdir(dir,{recursive:true});
for(const name of ['knowledge','demo','server-validation']){await writeFile(new URL(name+'.mjs',dir),ts.transpileModule(await readFile(new URL(`../app/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);}
const {captureMapIdea,putNoteOnMap}=await import(new URL('knowledge.mjs',dir));const {createDemoMission,addThinkingNodes}=await import(new URL('demo.mjs',dir));const {missionSchema}=await import(new URL('server-validation.mjs',dir));
test('capturing a mapped contribution creates one linked note with explanation and evidence',()=>{
 const m=createDemoMission(),n=m.nodes.find(n=>n.statementId);m.statements.find(s=>s.id===n.statementId).sources=[{title:'Example source',url:'https://example.org/evidence'}];
 const captured=captureMapIdea(m,n.id);assert.equal(captured.mission.notes.length,1);assert.ok(captured.mission.notes[0].content.includes('https://example.org/evidence'));assert.ok(captured.mission.notes[0].content.includes('Evidence status'));
 assert.equal(captureMapIdea(captured.mission,n.id).mission.notes.length,1);assert.ok(missionSchema.safeParse(captured.mission).success);assert.equal(m.notes.length,0);
});
test('notes can be added to the map without duplicates or dangling edges',()=>{
 const m=createDemoMission();m.nodes=[];m.edges=[];m.notes=[{id:'note1',title:'Pilot idea',content:'Try one change.',updatedAt:m.updatedAt}];
 const next=putNoteOnMap(m,'note1');assert.ok(next.nodes.some(n=>n.id==='mission'));assert.equal(next.nodes.filter(n=>n.noteId==='note1').length,1);assert.deepEqual(putNoteOnMap(next,'note1'),next);assert.ok(missionSchema.safeParse(next).success);
});
test('new council contributions restore a missing map root without dropping custom ideas',()=>{
 const m=createDemoMission();m.nodes=[{id:'custom',label:'Keep me',x:1,y:2,type:'idea'}];m.edges=[];
 const next=addThinkingNodes(m,[m.statements[1]]);assert.ok(next.nodes.some(n=>n.id==='custom'));assert.ok(next.nodes.some(n=>n.id==='mission'));assert.ok(missionSchema.safeParse(next).success);
});
