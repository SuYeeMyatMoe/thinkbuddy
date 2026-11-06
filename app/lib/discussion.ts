import { builderCommands, runBuilderCommand, checkpoint } from './builder';
import type { Mission, Statement, CouncilQuestion, CouncilRequest, ReplyAttachment } from './types';

export function addUserMessage(mission: Mission, text: string, questionIds: string[] = [], kind: 'message' | 'takeaway' = 'message', attachments:ReplyAttachment[]=[]): Mission {
  const stamp = new Date().toISOString();
  const answer=[text,...attachments.map(a=>`Attached ${a.name}: ${a.text}`)].join('\n\n').slice(0,16000);
  return {...mission, messages:[...(mission.messages ?? []),{id:crypto.randomUUID(),text,kind,createdAt:stamp,...(attachments.length?{attachments}:{})}], questions:(mission.questions ?? []).map(q=>questionIds.includes(q.id)?{...q,status:'answered' as const,answer,answeredAt:stamp}:q), updatedAt:stamp};
}

export function mergeStatements(previous: Statement[], incoming: Statement[]): Statement[] {
  const result = [...previous];
  for (const item of incoming) { const i=result.findIndex(s=>s.id===item.id); if(i<0)result.push(item);else result[i]=item; }
  return result;
}

export function addQuestions(previous: CouncilQuestion[], statements: Statement[]): CouncilQuestion[] {
  const result=[...previous];
  for(const s of statements){
    if(!s.question?.trim() || result.some(q=>q.mascotId===s.mascotId&&q.text.toLowerCase()===s.question!.trim().toLowerCase()))continue;
    result.push({id:s.id,mascotId:s.mascotId,text:s.question.trim(),status:'open',kind:s.questionKind??'text',options:s.questionOptions??[]});
  }
  return result.slice(-500);
}

export function resolveMentions(text: string, mission: Mission): string[] {
  const names = [...text.matchAll(/@([^\s@,!?;:]+)/gu)].map(m=>m[1].toLowerCase());
  return mission.mascots.filter(m=>names.includes(m.name.toLowerCase())).map(m=>m.id);
}

export function demoWorkspace(req: CouncilRequest, generated: Mission): Mission {
  if(builderCommands.includes(req.action))return runBuilderCommand(req);
  let mission:Mission={...generated,builder:req.mission.builder,brief:req.mission.brief,messages:req.mission.messages,reflection:req.mission.reflection,outcome:req.mission.outcome};
  if(!['generate','turn','scenario','plan'].includes(req.action))return mission;
  const stamp=new Date().toISOString();
  const recent=mission.statements.filter(s=>!req.mission.statements.some(old=>old.id===s.id));
  const questions=recent.filter(s=>s.question||s.text.endsWith('?')).slice(0,1).map(s=>({...s,question:s.question||s.text}));
  mission.statements=mission.statements.map(s=>questions.find(q=>q.id===s.id)??s);
  mission.questions=addQuestions(req.mission.questions??[],questions);
  mission.result={summary:'Demo: compare a small pilot with your current approach, then use observations to choose the next step.',recommendation:'Start with one reversible experiment that fits your resources. This is an illustrative recommendation.',changed:req.prompt?`Your latest contribution: ${req.prompt.slice(0,1500)}`:'Your mission is ready for a first discussion.',unresolved:['Which assumption should we test first?','What evidence would change this choice?'],nextStep:'Choose one test, record a baseline, and decide how you will measure the result.',options:[{name:'Small pilot',benefit:'Learn before committing more resources',effort:'Limited scope',risk:'The pilot may not represent the whole situation',evidenceGap:'Needs observations from your setting'},{name:'Keep the current approach',benefit:'Avoid immediate disruption',effort:'Minimal change',risk:'The original problem may continue',evidenceGap:'Needs a baseline for comparison'}],experiment:{action:'Test one small change and record what happens.',owner:'',successMeasure:mission.brief?.success||'Choose an observable measure before starting.',reviewDate:mission.brief?.deadline||''},updatedAt:stamp};

  if(/study|schedule|planner/i.test(mission.title)){mission.result.summary='Demo: flexible rescheduling is a hypothesis worth testing, not a proven need.';mission.result.recommendation='Compare rescheduling and reminders using a missed-session scenario.';mission.result.unresolved=['Can real students recover a missed session without help?','Would they prefer this over their current approach?'];mission.result.nextStep='Prepare a prototype task and observe a student recovering one missed session.';}
  if(req.action==='generate'){mission.questions=[{id:crypto.randomUUID(),mascotId:'buddy',text:'What would help you move forward today?',status:'open',kind:'single',options:['Understand the problem','Choose between options','Prepare a user test']}];}
  if(mission.round>=3)mission=checkpoint(mission,true);
  return mission;
}
