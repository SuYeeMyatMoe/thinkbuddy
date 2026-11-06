import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const dir=new URL('../.cache/attachment-tests/',import.meta.url);await mkdir(dir,{recursive:true});
for(const name of ['attachments','discussion','server-validation','builder','builder-schema']){
  const s=await readFile(new URL(`../app/lib/${name}.ts`,import.meta.url),'utf8');
  await writeFile(new URL(name+'.mjs',dir),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
}
const {attachmentMime,validateUploads,extractPlainText,validateBinary}=await import(new URL('attachments.mjs',dir));
const {addUserMessage}=await import(new URL('discussion.mjs',dir));
const {attachmentSchema}=await import(new URL('server-validation.mjs',dir));
test('upload validation enforces types, sizes, count and total before processing',()=>{
  assert.equal(attachmentMime('PHOTO.JPEG'),'image/jpeg');assert.equal(attachmentMime('audit.csv'),'text/csv');
  for(const name of ['.env','run.exe','image.svg','../note.txt','a/b.pdf'])assert.throws(()=>attachmentMime(name));
  assert.throws(()=>validateUploads([{name:'empty.txt',size:0}]));
  assert.throws(()=>validateUploads(Array.from({length:4},()=>({name:'note.txt',size:1}))));
  assert.throws(()=>validateUploads([{name:'a.pdf',size:5*1024*1024},{name:'b.pdf',size:5*1024*1024},{name:'c.pdf',size:1}]));
});
test('text extraction preserves user content, marks excerpts, rejects unreadable data',()=>{
  const a=extractPlainText('audit.csv',new TextEncoder().encode('date,weight\n2026-11-05,12'));
  assert.ok(attachmentSchema.safeParse(a).success);assert.ok(a.text.includes('weight'));assert.equal(a.truncated,undefined);
  const long=extractPlainText('note.txt',new TextEncoder().encode('x'.repeat(13000)));assert.equal(long.text.length,12000);assert.equal(long.truncated,true);
  assert.throws(()=>extractPlainText('note.txt',new Uint8Array([255,254,0])));
});
test('binary validation rejects disguised files and accepts known file headers',()=>{
  validateBinary('application/pdf',new TextEncoder().encode('%PDF-1.4\n'));
  validateBinary('image/png',new Uint8Array([137,80,78,71,13,10,26,10]));
  assert.throws(()=>validateBinary('image/png',new TextEncoder().encode('<svg>')));
});
test('a file-only answer maps extracted content to selected questions and preserves attachments',()=>{
  const file=extractPlainText('resources.txt',new TextEncoder().encode('Two volunteers and one existing scale.'));
  const original={messages:[],questions:[{id:'q1',mascotId:'m1',text:'What resources?',status:'open'},{id:'q2',mascotId:'m2',text:'Who?',status:'open'}]};
  const next=addUserMessage(original,'I attached supporting material.',['q1'],'message',[file]);
  assert.equal(next.messages[0].attachments[0].name,'resources.txt');assert.ok(next.questions[0].answer.includes('Two volunteers'));assert.equal(next.questions[1].status,'open');assert.equal(original.questions[0].status,'open');
});
