import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const dir=new URL('../.cache/builder-tests/',import.meta.url);await mkdir(dir,{recursive:true});
for(const name of ['builder','builder-schema','demo','discussion','server-validation','guest-store']){
 const source=await readFile(new URL(`../app/lib/${name}.ts`,import.meta.url),'utf8');
 await writeFile(new URL(name+'.mjs',dir),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
}
const {createDemoMission,demoCouncil}=await import(new URL('demo.mjs',dir));
const {demoWorkspace,addUserMessage}=await import(new URL('discussion.mjs',dir));
const {builderState,runBuilderCommand,draftResearch,launchResearch,recordDecision,checkpoint,suggestActions}=await import(new URL('builder.mjs',dir));
const {missionSchema,councilRequestSchema}=await import(new URL('server-validation.mjs',dir));
const {saveGuestMission,loadGuestMissions}=await import(new URL('guest-store.mjs',dir));
const mission=()=>createDemoMission('Should my study planner use reminders or flexible schedules?');
test('breakdown reuses facts and never regenerates edited issues',()=>{
 let m=mission();m.brief={audience:'University students',resources:'One week',success:'Recover a missed session',deadline:''};m=addUserMessage(m,'Three students said plans become unrealistic.');
 m=runBuilderCommand({mission:m,action:'breakdown'});assert.equal(m.builder.breakdown.issues.length,3);assert.match(m.builder.breakdown.known,/unrealistic/);assert.equal(m.builder.breakdown.audience,'University students');
 m.builder.breakdown.issues[0].title='My edited focus';const next=runBuilderCommand({mission:m,action:'breakdown'});assert.deepEqual(next.builder.breakdown,m.builder.breakdown);assert.equal(next.notes.length,0);assert.ok(missionSchema.safeParse(next).success);
});
test('actions require a chosen focus, remain suggestions, and preserve adopted edits',()=>{
 let m=runBuilderCommand({mission:mission(),action:'breakdown'});assert.throws(()=>suggestActions(m),/Choose a focus/);m.builder.breakdown.focusId=m.builder.breakdown.issues[0].id;
 m=runBuilderCommand({mission:m,action:'suggest-actions'});assert.equal(m.builder.actions.length,3);assert.ok(m.builder.actions.every(a=>a.status==='suggested'&&a.owner===''&&a.date===''));assert.equal(m.builder.actions[1].dependsOn,m.builder.actions[0].id);
 m.builder.actions[0].status='planned';m.builder.actions[0].criterion='My criterion';assert.deepEqual(suggestActions(m),m.builder.actions);
});
test('research validates commitment fields, preserves disagreements, and launches idempotently',()=>{
 const t=draftResearch(mission(),'survey');assert.throws(()=>launchResearch(t),/audience/);t.audience='Students';t.responseCount=4;t.compensationCents=250;
 const next=launchResearch(t);assert.equal(next.responses.length,4);assert.equal(next.responseCount*next.compensationCents,1000);assert.ok(next.responses.every(r=>r.simulated));assert.match(next.limitations,/no demand/);assert.ok(next.findings.every(f=>f.responseIds.every(id=>next.responses.some(r=>r.id===id))));assert.ok(new Set(next.responses.map(r=>r.answers[0].value)).size>1);assert.deepEqual(launchResearch(next),next);assert.equal(t.responses.length,0);
 const bad={...t,questions:[{...t.questions[0],options:['Same','Same']}]};assert.throws(()=>launchResearch(bad),/distinct/);assert.throws(()=>launchResearch({...t,responseCount:1.5}),/response count/);
 const prototype=draftResearch(mission(),'prototype');prototype.audience='Students';prototype.prototypeUrl='javascript:alert(1)';assert.throws(()=>launchResearch(prototype),/HTTPS/);
});
test('decisions preserve history and create linked actions without notebook entries',()=>{
 const original=mission(),legacy={id:'old-note',title:'Legacy',content:'Keep me',updatedAt:original.updatedAt};original.notes=[legacy];
 const input={text:'Test flexible rescheduling',rationale:'Explore the missed-session scenario',uncertainty:'Actual usability',nextTest:'Run the scenario',responseIds:[],simulated:true};
 const first=recordDecision(original,input),second=recordDecision(first,{...input,text:'Revise the scenario'});assert.equal(second.builder.decisions.length,2);assert.equal(second.builder.actions[0].decisionId,first.builder.decisions[0].id);assert.deepEqual(second.notes,[legacy]);assert.equal(second.builder.actions[0].status,'planned');assert.ok(missionSchema.safeParse(second).success);
});
test('poll answer, receipt, finish and reload preserve the mission and legacy data',()=>{
 let m=mission();const request={action:'generate',mission:m};m=demoWorkspace(request,demoCouncil(request));const q=m.questions[0];assert.equal(q.kind,'single');assert.equal(q.options.length,3);
 m=addUserMessage(m,'Understand the problem',[q.id]);assert.equal(m.questions[0].status,'answered');m=checkpoint(m,true);m.builder.status='finished';assert.equal(m.builder.checkpoint.noteIds.length,0);assert.equal(m.notes.length,0);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};m=saveGuestMission(m,storage);const loaded=loadGuestMissions(storage)[0];assert.equal(loaded.builder.status,'finished');assert.deepEqual(loaded.builder.checkpoint,m.builder.checkpoint);assert.equal(loaded.messages[0].text,'Understand the problem');
 for(const action of ['breakdown','summarize','research-draft','research-review','suggest-actions'])assert.ok(councilRequestSchema.safeParse({mission:loaded,action}).success);
});
