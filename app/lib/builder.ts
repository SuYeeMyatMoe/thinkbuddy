import type { Mission, Note, CouncilRequest } from './types';
import type { BuilderState, ProblemBreakdown, ResearchTask, BuilderDecision, BuilderAction } from './builder-types';

const id=()=>crypto.randomUUID(), now=()=>new Date().toISOString();
export const builderCommands=['breakdown','summarize','research-draft','research-review','suggest-actions'];
export function builderState(m:Mission):BuilderState{return m.builder??{version:1,purpose:'explore',status:'active',actions:[],research:[],decisions:[],deletedCaptures:[],usedNoteIds:[]};}
export function captureKey(title:string){return 'learning:'+title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().slice(0,900);}
export function captureNote(m:Mission,n:Omit<Note,'id'|'updatedAt'>):Mission{
  const key=n.captureKey??captureKey(n.title), b=builderState(m);
  if(m.notes.length>=500||b.deletedCaptures.includes(key)||m.notes.some(old=>(old.captureKey??captureKey(old.title))===key))return m;
  return {...m,builder:b,notes:[...m.notes,{...n,captureKey:key,id:id(),updatedAt:now()}]};
}
export function preserveLearning(previous:Mission,next:Mission):Mission{
  const b=builderState(next), removed=previous.notes.filter(n=>!next.notes.some(x=>x.id===n.id));
  return {...next,builder:{...b,deletedCaptures:[...new Set([...builderState(previous).deletedCaptures,...b.deletedCaptures,...removed.map(n=>n.captureKey??captureKey(n.title))])]},notes:next.notes.map(n=>{
    const old=previous.notes.find(x=>x.id===n.id);return old?{...old,...n,captureKey:old.captureKey??captureKey(old.title)}:n;
  })};
}
export function relevantNotes(m:Mission,query:string):Note[]{
  const terms=query.toLowerCase().split(/\W+/).filter(t=>t.length>3);
  return m.notes.map(n=>({n,score:terms.filter(t=>(n.title+' '+n.content).toLowerCase().includes(t)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.n);
}
export function initialBreakdown(m:Mission):ProblemBreakdown{
  const study=/study|student|schedule|planner/i.test(m.title), sources=(m.messages??[]).slice(-3).map(x=>x.id);
  const labels=study?['Unrealistic study plans','Recovering after a missed session','Choosing the first useful feature']:['Understand the people affected','Find the main obstacle','Choose a small, feasible test'];
  return {problem:m.title,audience:m.brief?.audience??'',impact:'',outcome:m.brief?.success??'',known:(m.messages??[]).slice(-3).map(x=>x.text).join('\n').slice(0,4000),constraints:[m.brief?.resources,m.brief?.deadline].filter(Boolean).join('\n'),issues:labels.map((title,i)=>({id:id(),title,uncertainty:['Who experiences this, and in what situation?','What causes the difficulty, and what alternatives already help?','What observation would change our choice?'][i],assumption:study?['Plans may become unrealistic as priorities change.','Flexible rescheduling may help more than reminders.','A missed-session prototype may reveal usability problems.'][i]:'This is a suggested area to investigate, not a verified cause.',sourceIds:sources,attribution:'agent'}))};
}
export function setBreakdown(m:Mission,breakdown:ProblemBreakdown):Mission{
  const b=builderState(m);if(b.breakdown)return m;
  return syncLearningMap({...m,builder:{...b,breakdown}});
}
export function suggestActions(m:Mission):BuilderAction[]{
  const b=builderState(m),issue=b.breakdown?.issues.find(x=>x.id===b.breakdown?.focusId);
  if(!issue)throw Error('Choose a focus in Breakdown first.');
  if(b.actions.some(a=>a.issueId===issue.id))return b.actions;
  const first=id(),second=id();return [...b.actions,
    {id:first,title:'Write the assumption to test',purpose:issue.uncertainty,criterion:'One assumption and an observation that would disprove it are written down.',status:'suggested',issueId:issue.id,owner:'',date:''},
    {id:second,title:'Prepare a small user test',purpose:'Investigate '+issue.title,criterion:'The task has questions, an audience, and clear completion requirements.',status:'suggested',issueId:issue.id,dependsOn:first,owner:'',date:''},
    {id:id(),title:'Review the evidence and decide',purpose:'Choose the next step without hiding uncertainty.',criterion:'Record a decision, its evidence, and what remains unknown.',status:'suggested',issueId:issue.id,dependsOn:second,owner:'',date:''}];
}
export function draftResearch(m:Mission,kind:ResearchTask['kind']='poll'):ResearchTask{
  const b=builderState(m), issue=b.breakdown?.issues.find(x=>x.id===b.breakdown?.focusId),topic=issue?.title??m.title;
  const study=/study|schedule|planner/i.test(m.title),q=id();
  return {id:id(),issueId:issue?.id,title:('Test: '+topic).slice(0,500),kind,questions:[{id:q,text:study?'After missing a study session, what would help you most?':('Which approach would help with '+topic+'?').slice(0,500),kind:'single',options:study?['Flexible rescheduling','A reminder','Neither / something else']:['Improve the current approach','Try a different approach','Neither / something else']},...(kind==='poll'?[]:[{id:id(),text:kind==='prototype'?'Try the scenario. What did you do, and where did you get stuck?':'Why did you choose that answer?',kind:'text' as const,options:[]}])],audience:b.breakdown?.audience||m.brief?.audience||'',requirements:kind==='prototype'?'Open the prototype, attempt the scenario, and describe what happened.':'Answer every question based on your experience.',minutes:kind==='prototype'?10:3,compensationCents:200,responseCount:5,reviewTerms:'Completion is assessed against the stated requirements, never whether feedback is favorable. Demo review and payments are simulated.',prototypeUrl:'',status:'draft',simulated:true,responses:[],findings:[],limitations:''};
}
export function validateLaunch(t:ResearchTask){
  if(!t.title.trim()||!t.audience.trim()||!t.requirements.trim()||!t.reviewTerms.trim())throw Error('Add a title, audience, requirements, and review terms before launching.');
  if(!Number.isInteger(t.responseCount)||t.responseCount<1||t.responseCount>100||!Number.isInteger(t.compensationCents)||t.compensationCents<0||t.compensationCents>100000||!Number.isInteger(t.minutes)||t.minutes<1||t.minutes>240)throw Error('Check the response count, compensation, and estimated effort.');
  if(!t.questions.length||t.questions.some(q=>!q.text.trim()||(q.kind!=='text'&&(q.options.length<2||q.options.some(o=>!o.trim())||new Set(q.options.map(o=>o.trim().toLowerCase())).size!==q.options.length))))throw Error('Each question needs text; choice questions need at least two distinct, nonempty options.');
  if(t.kind==='prototype'){try{const u=new URL(t.prototypeUrl);if(!['http:','https:'].includes(u.protocol))throw Error();}catch{throw Error('Add an HTTP or HTTPS prototype URL.');}}
}
export function launchResearch(t:ResearchTask):ResearchTask{
  if(t.status==='launched')return t;validateLaunch(t);
  const responses=Array.from({length:t.responseCount},(_,i)=>({id:id(),label:'Sample respondent '+(i+1),simulated:true as const,answers:t.questions.map(q=>({questionId:q.id,value:q.kind==='text'?`Illustrative answer to “${q.text}”: ${['I would need a simpler first step before trying this.','The idea sounds useful, but I have not tried it.','I prefer my current approach; this may add effort.'][i%3]}`:q.kind==='multiple'&&i%3===1?q.options.slice(0,2).join('; '):q.options[i%q.options.length]}))}));
  return summarizeResearch({...t,status:'launched',responses});
}
export function summarizeResearch(t:ResearchTask):ResearchTask{
  if(t.status!=='launched'||!t.responses.length)throw Error('Launch the simulated task before reviewing responses.');
  const findings=t.questions.slice(0,10).map(q=>({id:'finding-'+q.id,text:q.kind==='text'?`Sample answers to “${q.text}” include hesitation, potential value, and preference for the current approach. These are invented examples, not observed behavior.`:`Sample selections for “${q.text}”: ${q.options.map(o=>`${o}: ${t.responses.filter(r=>r.answers.some(a=>a.questionId===q.id&&a.value.split('; ').includes(o))).length}`).join('; ')}.`,responseIds:t.responses.filter(r=>r.answers.some(a=>a.questionId===q.id)).map(r=>r.id)}));
  return {...t,findings,limitations:'All responses are simulated examples. They establish no demand, usability outcome, or audience preference. A small or self-selected real sample would also need cautious interpretation.'};
}
export function recordDecision(m:Mission,input:Omit<BuilderDecision,'id'|'createdAt'>):Mission{
  if(!input.text.trim()||!input.rationale.trim())throw Error('Write your decision and why you chose it.');
  const b=builderState(m),decision={...input,id:id(),createdAt:now()};
  let next:Mission={...m,builder:{...b,decisions:[...b.decisions,decision]}};
  if(input.nextTest.trim())next={...next,builder:{...builderState(next),actions:[...builderState(next).actions,{id:id(),title:input.nextTest.slice(0,500),purpose:input.uncertainty,criterion:'Record the outcome and update the decision.',status:'planned',issueId:input.issueId,decisionId:decision.id,taskId:input.taskId,owner:'',date:''}]}};
  return syncLearningMap(next);
}
export function checkpoint(m:Mission,simulated=false):Mission{
  const b=builderState(m),stamp=now(),sources=m.statements.slice(-1).map(s=>({kind:'statement' as const,id:s.id}));
  const takeaway=m.result?.summary??m.messages?.at(-1)?.text??m.title,unknown=m.result?.unresolved.join('\n')||'What evidence would support or challenge this idea?',nextAction=m.result?.nextStep||'Choose one uncertainty and prepare a small test.';
  return {...m,builder:{...b,checkpoint:{takeaway,unknown,nextAction,noteIds:[],createdAt:stamp}}};
}
export function runBuilderCommand(req:CouncilRequest):Mission{
  let m=structuredClone(req.mission),b=builderState(m);m.builder=b;
  if(req.action==='breakdown')m=setBreakdown(m,initialBreakdown(m));
  if(req.action==='suggest-actions')m.builder={...b,actions:suggestActions(m)};
  if(req.action==='research-draft'){const kind=['poll','survey','prototype'].includes(req.prompt??'')?req.prompt as ResearchTask['kind']:'poll';m.builder={...b,research:[...b.research,draftResearch(m,kind)]};}
  if(req.action==='research-review')m.builder={...b,research:b.research.map(t=>t.id===req.prompt?summarizeResearch(t):t)};
  if(req.action==='summarize')m=checkpoint(m,true);
  return syncLearningMap({...m,updatedAt:now()});
}
export function syncLearningMap(m:Mission):Mission{
  return m;
}
