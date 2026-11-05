import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
const folder=new URL('../.cache/discussion-tests/',import.meta.url);await mkdir(folder,{recursive:true});
for(const name of ['demo','discussion','server-validation','server-ai']){
  const source=await readFile(new URL(`../app/lib/${name}.ts`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("import { env } from 'cloudflare:workers';","const env=globalThis.__thinkbuddyTestEnv;").replace(/from '\.\/([^']+)'/g,"from './$1.mjs'");
  await writeFile(new URL(name+'.mjs',folder),compiled);
}
await writeFile(new URL('server-api.mjs',folder),'export class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}');
globalThis.__thinkbuddyTestEnv={OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'};
const {createDemoMission,demoCouncil}=await import(new URL('demo.mjs',folder));
const {addUserMessage,mergeStatements,addQuestions,resolveMentions,demoWorkspace}=await import(new URL('discussion.mjs',folder));
const {missionSchema,councilRequestSchema}=await import(new URL('server-validation.mjs',folder));
const {liveCouncil,researchStatement}=await import(new URL('server-ai.mjs',folder));
const result={summary:'A small pilot is a practical first step.',recommendation:'Compare the pilot with a baseline.',changed:'The supplied resource constraint narrows the scope.',unresolved:['Who will run the test?'],nextStep:'Choose one observable measure.',options:[{name:'Pilot',benefit:'Learn before expanding',effort:'Small',risk:'Limited sample',evidenceGap:'Needs observations'}],experiment:{action:'Run one pilot.',owner:'',successMeasure:'Record the chosen measure.',reviewDate:''}};
const full=(mission)=>({mascots:[],statements:[{mascotId:'buddy',text:'Compare the options and run a small pilot.',detail:'This is a recommendation with uncertainty.',status:'Opinion',question:''}],notes:[{title:'Pilot decision',content:'Compare with the baseline before expanding.',theme:'Decisions'}],actions:[{text:'Record a baseline',priority:'High'}],scenario:{name:'',assumption:'',outcome:''},result});
const response=(value,annotations=[])=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:typeof value==='string'?value:JSON.stringify(value),annotations}]}]});

test('user answers are explicitly mapped and legacy missions remain valid',()=>{
  const m=createDemoMission();m.questions=[{id:'q1',mascotId:m.mascots[1].id,text:'Resources?',status:'open'},{id:'q2',mascotId:m.mascots[2].id,text:'Who?',status:'open'}];
  const next=addUserMessage(m,'We have two volunteers.',['q1']);
  assert.equal(next.questions[0].status,'answered');assert.equal(next.questions[1].status,'open');assert.equal(m.questions[0].status,'open');assert.equal(next.messages.length,1);
  assert.ok(missionSchema.safeParse(next).success);assert.ok(missionSchema.safeParse(createDemoMission()).success);
  assert.deepEqual(resolveMentions('@'+m.mascots[1].name+' please explain',m),[m.mascots[1].id]);
});
test('progressive updates replace evidence in place and questions are not duplicated',()=>{
  const m=createDemoMission(),s={...m.statements[0],question:'Who can help?'};
  assert.equal(mergeStatements([s],[{...s,detail:'Updated evidence'}]).length,1);
  assert.equal(mergeStatements([s],[{...s,detail:'Updated evidence'}])[0].detail,'Updated evidence');
  const q=addQuestions([], [s]);assert.equal(addQuestions(q,[{...s,id:'other'}]).length,1);
});
test('all companions run in parallel and stream before the synthesis; result and themed notes persist',async()=>{
  const m=addUserMessage(createDemoMission(),'We can spare two volunteers.');let active=0,maxActive=0,completed=0;const events=[];const original=globalThis.fetch;
  globalThis.fetch=async(_,init)=>{
    const b=JSON.parse(init.body);
    if(b.tools)return response('No independent factual evidence for this recommendation.');
    if(b.text.format.name==='evidence_review')return response({status:'Opinion',explanation:'This is a proposed approach.',limitations:'Requires observations from your setting.',sources:[]});
    if(b.text.format.name==='companion_reply'){
      active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,15+completed*3));active--;completed++;
      return response({text:'Start with a manageable pilot.',detail:'Use your two volunteers to collect a baseline.',status:'Opinion',question:completed===1?'Who will collect the observations?':''});
    }
    assert.equal(completed,4);assert.equal(events.filter(e=>e.event==='statement').length,4);
    assert.equal(JSON.parse(b.input).mission.messages.at(-1).text,'We can spare two volunteers.');return response(full(m));
  };
  try{const next=await liveCouncil({action:'turn',mission:m,prompt:'We can spare two volunteers.'},undefined,(event,data)=>events.push({event,data}));
    assert.equal(maxActive,4);assert.equal(next.statements.length,m.statements.length+5);assert.equal(next.notes[0].origin,'automatic');assert.equal(next.notes[0].theme,'Decisions');assert.equal(next.result.summary,result.summary);assert.equal(next.questions.length,1);assert.equal(next.round,m.round+1);assert.ok(missionSchema.safeParse(next).success);
  }finally{globalThis.fetch=original;}
});
test('positive evidence labels require actual search citations and relevant source summaries',async()=>{
  const m=createDemoMission(),s={...m.statements[1],status:'Unverified'};const original=globalThis.fetch;let cited=false;
  globalThis.fetch=async(_,init)=>{
    const b=JSON.parse(init.body);if(b.tools)return response('Research summary.',cited?[{type:'url_citation',url:'https://example.org/research',title:'Test research'}]:[]);
    return response({status:'Supported',explanation:'Scope-specific support.',limitations:'Only this setting was studied.',sources:[{url:'https://example.org/research',summary:cited?'A relevant paraphrase.':'',publishedAt:''},{url:'https://invented.example/fake',summary:'Not an actual tool citation.',publishedAt:''}]});
  };
  try{const empty=await researchStatement(s,m);assert.equal(empty.status,'Unverified');assert.deepEqual(empty.sources,[]);cited=true;const checked=await researchStatement(s,m);assert.equal(checked.status,'Supported');assert.equal(checked.sources.length,1);assert.equal(checked.sources[0].publisher,'example.org');assert.equal(checked.sources[0].publishedAt,undefined);assert.ok(checked.evidenceReview.checkedAt);
  }finally{globalThis.fetch=original;}
});
test('planning does not require a reflection and long saved takeaways fit the request schema',async()=>{
  const m=createDemoMission(),original=globalThis.fetch;globalThis.fetch=async()=>response(full(m));
  try{const next=await liveCouncil({action:'plan',mission:m});assert.equal(next.actions.length,1);assert.equal(next.reflection,'');m.reflection='a'.repeat(16000);assert.ok(councilRequestSchema.safeParse({action:'plan',mission:m,prompt:m.reflection}).success);}finally{globalThis.fetch=original;}
});
test('guest previews preserve context and transparently label automatic notes',()=>{
  const m=createDemoMission();m.brief={success:'A measurable improvement',audience:'Students',resources:'Two volunteers',deadline:''};
  const req={action:'turn',mission:addUserMessage(m,'We have two volunteers.'),prompt:'We have two volunteers.'};
  const next=demoWorkspace(req,demoCouncil(req));assert.equal(next.messages.length,1);assert.equal(next.brief.resources,'Two volunteers');assert.ok(next.notes[0].content.includes('demo'));assert.ok(next.result.summary.startsWith('Demo:'));assert.ok(missionSchema.safeParse(next).success);
});
