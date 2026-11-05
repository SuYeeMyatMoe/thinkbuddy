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
const { decideSync, noteHash } = await import(new URL('vault-sync.mjs', output));
const { noteMarkdown, parseMarkdown, safeImportPath, importNotes, exportMissionZip, exportObsidianBundle, preserveVaultProperties } = await import(new URL('export.mjs', output));
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
