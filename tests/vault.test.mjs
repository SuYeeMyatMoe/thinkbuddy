import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';

const output = new URL('../.cache/vault-tests/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ['export', 'vault-sync']) {
  const source = await readFile(new URL(`../app/lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace("from './export'", "from './export.mjs'");
  await writeFile(new URL(`${name}.mjs`, output), compiled);
}
const { decideSync, noteHash, connectVault, syncVault, disconnectVault } = await import(new URL('vault-sync.mjs', output));
const { noteMarkdown, parseMarkdown, safeImportPath, importNotes, exportMissionZip, exportObsidianBundle, preserveVaultProperties, secondBrainFiles, noteExportName } = await import(new URL('export.mjs', output));
const note = { id: 'n1', title: 'A title: with "quotes"', content: '# Thought\n\nA [[linked thought]].', updatedAt: '2026-11-04T12:00:00Z', statementId: 's1' };

test('managed note round-trips content and identifiers', () => {
  const parsed = parseMarkdown(noteMarkdown(note, 'm1'), 'fallback', 'fallback-id');
  assert.deepEqual(parsed.note, note); assert.equal(parsed.missionId, 'm1'); assert.equal(parsed.managed, true);
});
test('sync only transfers one-sided edits and detects all destructive cases', () => {
  assert.equal(decideSync(undefined, undefined, 'r'), 'to-local');
  assert.equal(decideSync(undefined, 'l', undefined), 'to-cloud');
  assert.equal(decideSync('a', 'b', 'a'), 'to-cloud');
  assert.equal(decideSync('a', 'a', 'b'), 'to-local');
  assert.equal(decideSync('a', 'b', 'c'), 'conflict');
  assert.equal(decideSync('a', undefined, 'a'), 'deleted-local');
  assert.equal(decideSync('a', 'a', undefined), 'deleted-cloud');
  assert.equal(decideSync('a', 'b', 'b'), 'equal');
  assert.equal(decideSync('a', undefined, undefined), 'gone');
});
test('note hash ignores timestamps and normalizes line endings', async () => {
  assert.equal(await noteHash(note), await noteHash({ ...note, updatedAt: 'later', content: note.content.replace(/\n/g, '\r\n') }));
  assert.notEqual(await noteHash(note), await noteHash({ ...note, content: 'changed' }));
});
test('imports reject traversal and private configuration paths', () => {
  for (const path of ['../secret.md', '/secret.md', 'C:/secret.md', 'folder\\secret.md', '.obsidian/config.md', 'a/../b.md']) assert.equal(safeImportPath(path), false, path);
  assert.equal(safeImportPath('Notes/Idea.md'), true);
});
test('import makes independent IDs and ignores unsafe archive members', async () => {
  const bytes = zipSync({ 'Idea.md': strToU8(noteMarkdown(note)), '../secret.md': strToU8('private'), '.obsidian/config.md': strToU8('config') });
  const notes = await importNotes([new File([bytes], 'notes.zip')]);
  assert.equal(notes.length, 1); assert.notEqual(notes[0].id, note.id); assert.equal(notes[0].content, note.content);
});
test('compressed oversized notes are rejected before inflation', async () => {
  const bytes = zipSync({ 'large.md': strToU8('a'.repeat(1024 * 1024 + 1)) });
  await assert.rejects(importNotes([new File([bytes], 'large.zip')]), /safe import size/);
});
test('exports contain usable notes and JSON Canvas relationships', () => {
  const mission = { id: 'm1', title: 'Test mission', updatedAt: note.updatedAt, mascots: [], statements: [], notes: [note], reflection: '', scenarios: [], actions: [], nodes: [{ id: 'a', label: 'A', x: 0, y: 0 }, { id: 'b', label: 'B', x: 300, y: 0 }], edges: [{ id: 'e', source: 'a', target: 'b', label: 'supports' }] };
  const files = unzipSync(exportMissionZip(mission));
  const canvas = JSON.parse(strFromU8(files['ThinkMap.canvas']));
  assert.equal(canvas.edges[0].fromNode, 'a'); assert.equal(canvas.edges[0].toNode, 'b');
  assert.match(strFromU8(files['Mission.md']), /\[\[A title/);
  assert.equal(Object.keys(files).length, 3);
});
test('sync preserves custom YAML properties on existing vault notes', () => {
  const previous = '---\nthinkbuddy_id: "n1"\ntitle: "Old"\ncustom:\n  nested: true\naliases: [hello]\n---\nOld';
  const updated = preserveVaultProperties(previous, noteMarkdown(note, 'm1'));
  assert.match(updated, /custom:\n  nested: true/); assert.match(updated, /aliases: \[hello\]/); assert.doesNotMatch(updated, /title: "Old"/);
});

test('Obsidian exports preserve themes and automatic-note provenance',async()=>{
 const themed={...note,theme:'Evidence',origin:'automatic'};
 assert.deepEqual(parseMarkdown(noteMarkdown(themed,'m1'),'fallback','fallback').note,themed);
 assert.notEqual(await noteHash(themed),await noteHash({...themed,theme:'Decisions'}));
});

test('Canvas links map ideas to actual exported Markdown files and rounds positions',()=>{
 const mission={id:'m1',title:'Linked map',updatedAt:note.updatedAt,mascots:[],statements:[],notes:[note],reflection:'',scenarios:[],actions:[],nodes:[{id:'idea',label:'My idea',x:10.5,y:20.1,type:'note',noteId:note.id}],edges:[]};
 const files=unzipSync(exportMissionZip(mission));const canvas=JSON.parse(strFromU8(files['ThinkMap.canvas']));
 assert.equal(canvas.nodes[0].type,'file');assert.ok(files[canvas.nodes[0].file]);assert.equal(canvas.nodes[0].x,11);assert.equal(canvas.nodes[0].y,20);
});

test('Obsidian bundle paths resolve from the vault root without colliding across missions',()=>{
 const mission={id:'m1',title:'Linked map',updatedAt:note.updatedAt,mascots:[],statements:[],notes:[note],reflection:'',scenarios:[],actions:[],nodes:[{id:'idea',label:'My idea',x:1,y:2,type:'note',noteId:note.id}],edges:[]};
 const files=unzipSync(exportObsidianBundle(mission));const canvas=JSON.parse(strFromU8(files['ThinkBuddy/m1/ThinkMap.canvas']));
 assert.ok(files['ThinkBuddy/m1/Mission.md']);assert.ok(files[canvas.nodes[0].file]);assert.ok(canvas.nodes[0].file.startsWith('ThinkBuddy/m1/'));
});

const brainMission = () => ({id:'brain-test',title:'Improve our marketing',updatedAt:note.updatedAt,mascots:[{id:'critic',name:'Cleo',role:'Reviewer',motivation:'Check assumptions'}],statements:[{id:'s1',mascotId:'critic',text:'Test a smaller campaign',detail:'Compare two messages before increasing spend.',status:'Assumption',sources:[{title:'Research',url:'https://example.org/research'}]}],notes:[],reflection:'',scenarios:[],actions:[],nodes:[{id:'mission',type:'mission',label:'Marketing',x:0,y:0},{id:'idea',statementId:'s1',label:'Test a campaign',x:300,y:200}],edges:[{id:'e1',source:'mission',target:'idea',label:'explores'}]});

test('second brain generates linked discussion and Canvas even without saved notes',()=>{
  const m=brainMission(),before=structuredClone(m),files=unzipSync(exportObsidianBundle(m));
  const root='ThinkBuddy/brain-test/Second Brain/';
  const overview=strFromU8(files[root+'Mission.md']),idea=strFromU8(files[root+'Idea--s1.md']);
  assert.match(overview,/\[\[ThinkBuddy\/brain-test\/Second Brain\/Idea--s1\|/);
  assert.match(idea,/Evidence status: Assumption/);assert.match(idea,/https:\/\/example.org\/research/);
  assert.match(idea,/\[\[ThinkBuddy\/brain-test\/Second Brain\/Mission\|/);
  const canvas=JSON.parse(strFromU8(files[root+'ThinkMap.canvas']));
  for(const n of canvas.nodes.filter(n=>n.type==='file'))assert.ok(files[n.file],n.file);
  assert.equal(canvas.edges[0].label,'explores');assert.deepEqual(m,before);
});

test('second brain reuses saved notes, respects renamed files, and maps unmapped notes',()=>{
  const m=brainMission();m.notes=[note,{...note,id:'n2',statementId:undefined,title:'Unmapped thought'}];
  const files=secondBrainFiles(m,{n1:'Renamed in Obsidian.md'});
  assert.equal(files['Idea--s1.md'],undefined);
  assert.match(files['Mission.md'],/ThinkBuddy\/brain-test\/Renamed in Obsidian/);
  const canvas=JSON.parse(files['ThinkMap.canvas']);
  assert.ok(canvas.nodes.some(n=>n.file==='ThinkBuddy/brain-test/Renamed in Obsidian.md'));
  assert.ok(canvas.nodes.some(n=>n.file==='ThinkBuddy/brain-test/'+noteExportName(m.notes[1])));
  for(const edge of canvas.edges){assert.ok(canvas.nodes.some(n=>n.id===edge.fromNode));assert.ok(canvas.nodes.some(n=>n.id===edge.toNode));}
});

test('empty mission still generates an overview and a nonempty Canvas',()=>{
  const m={...brainMission(),statements:[],nodes:[],edges:[]};
  const files=secondBrainFiles(m),canvas=JSON.parse(files['ThinkMap.canvas']);
  assert.match(files['Mission.md'],/Improve our marketing/);assert.equal(canvas.nodes.length,1);assert.equal(canvas.nodes[0].type,'file');
});

function memoryDirectory(name){
  const entries=new Map();
  const missing=()=>new DOMException('Missing file','NotFoundError');
  return {kind:'directory',name,entries,queryPermission:async()=> 'granted',requestPermission:async()=> 'granted',
    async getDirectoryHandle(name,options={}){if(!entries.has(name)){if(!options.create)throw missing();entries.set(name,memoryDirectory(name));}return entries.get(name);},
    async getFileHandle(name,options={}){if(!entries.has(name)){if(!options.create)throw missing();const entry={kind:'file',name,text:'',writes:0,async getFile(){return new File([entry.text],name);},async createWritable(){return {async write(text){entry.text=text;entry.writes++;},async close(){}};}};entries.set(name,entry);}return entries.get(name);},
    async removeEntry(name){entries.delete(name);},async *values(){yield* entries.values();}};
}

function memoryDatabase(){
  const data=new Map();
  return {open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(key){const req={};queueMicrotask(()=>{req.result=data.get(key);req.onsuccess();});return req;},put(value,key){data.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete());},delete(key){data.delete(key);queueMicrotask(()=>tx.oncomplete());}};}};return tx;}};request.onsuccess();});return request;}};
}

test('folder sync generates immediately, updates safely, and preserves local changes',async(t)=>{
  const vault=memoryDirectory('My vault');
  // IndexedDB stores real directory handles by structured clone; retain handles in this test double.
  const originalClone=globalThis.structuredClone;
  t.mock.method(globalThis,'structuredClone',value=>value?.handle?value:originalClone(value));
  for(const [key,value] of Object.entries({window:{isSecureContext:true,showDirectoryPicker:async()=>vault},indexedDB:memoryDatabase()})){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  }
  await connectVault();
  const m=brainMission();
  let result=await syncVault(m,async()=>assert.fail('No cloud changes expected'));
  assert.equal(result.generated,3);assert.equal(result.written,0);
  const missionDir=await (await vault.getDirectoryHandle('ThinkBuddy')).getDirectoryHandle(m.id);
  const generated=await missionDir.getDirectoryHandle('Second Brain');
  assert.equal(generated.entries.size,3);
  result=await syncVault(m,async()=>{});assert.equal(result.generated,0);assert.deepEqual(result.preserved,[]);
  m.statements[0].detail='Updated campaign experiment';
  result=await syncVault(m,async()=>{});assert.equal(result.generated,2);
  const idea=await generated.getFileHandle('Idea--s1.md');assert.match(idea.text,/Updated campaign experiment/);
  idea.text+='\nMy local edit';
  m.statements[0].detail='Another update';
  result=await syncVault(m,async()=>{});assert.deepEqual(result.preserved,['Idea--s1.md']);assert.match(idea.text,/My local edit/);
  await generated.removeEntry('ThinkMap.canvas');
  result=await syncVault(m,async()=>{});assert.ok(result.preserved.includes('ThinkMap.canvas'));assert.ok(!generated.entries.has('ThinkMap.canvas'));
  m.notes=[note];
  result=await syncVault(m,async()=>{});assert.equal(result.written,1);
  const managed=await missionDir.getFileHandle(noteExportName(note));
  managed.text=noteMarkdown({...note,content:'Edited in Obsidian'},m.id);
  missionDir.entries.delete(noteExportName(note));managed.name='Renamed note.md';missionDir.entries.set(managed.name,managed);
  let imported;
  result=await syncVault(m,async notes=>{imported=notes;});
  assert.equal(result.imported,1);assert.equal(imported[0].content,'Edited in Obsidian');
  assert.match((await generated.getFileHandle('Mission.md')).text,/ThinkBuddy\/brain-test\/Renamed note/);
  m.notes=imported;
  // A newly connected vault must not overwrite an unrelated file with the same name.
  await connectVault();
  const overview=await generated.getFileHandle('Mission.md');overview.text='My own page';
  result=await syncVault(m,async()=>{});assert.ok(result.preserved.includes('Mission.md'));assert.equal(overview.text,'My own page');
  await disconnectVault();
});
