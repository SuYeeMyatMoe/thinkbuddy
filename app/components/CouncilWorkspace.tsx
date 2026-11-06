'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react/dist/csr/PaperPlaneRight';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Notebook } from '@phosphor-icons/react/dist/csr/Notebook';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import MascotStage, { Sprite } from './MascotStage';
import { Paperclip } from '@phosphor-icons/react/dist/csr/Paperclip';
import { UPLOAD_ACCEPT, validateUploads, extractPlainText, attachmentMime } from '../lib/attachments';
import type { CouncilRequest, Mascot, Mission, Statement, Tool, ReplyAttachment } from '../lib/types';
import './discussion.css';
import './board.css';
import ObsidianNotebook from './ObsidianNotebook';
import { GitBranch } from '@phosphor-icons/react/dist/csr/GitBranch';
import { FolderOpen } from '@phosphor-icons/react/dist/csr/FolderOpen';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
const InlineMap=lazy(()=>import('./ToolsPanel').then(m=>({default:m.ThinkingMap})));


type View='discussion'|'result'|'map'|'notes'|'sources';
type Reply={text:string;ids:string[];questions:string[];files:File[]};
interface Props {
  mission:Mission;busy:boolean;live:boolean;saveStatus:string;progress:Record<string,string>;
  input:string;setInput:(v:string)=>void;recording:boolean;voiceBusy:boolean;onVoice:()=>void;
  onSend:(text:string,ids:string[],questions:string[],attachments?:ReplyAttachment[])=>Promise<unknown>;
  onCommand:(action:CouncilRequest['action'],prompt?:string,ids?:string[])=>Promise<unknown>;
  onChange:(m:Mission)=>void;onSave:(m:Mission)=>Promise<void>;onTakeaway:(text:string)=>Promise<void>;
  onOpenSync:()=>void;onPause:()=>void;onManage:(m:Mascot)=>void;onOpenTool:(t:Tool)=>void;
}
const tools:[Tool,string][]=[['map','ThinkMap'],['lab','What if?'],['path','Action plan'],['vault','ThinkVault']];

export default function CouncilWorkspace(p:Props){
  const {mission,busy,live}=p;
  const [view,setView]=useState<View>('discussion'),[side,setSide]=useState<Exclude<View,'discussion'>>('result');
  const [targets,setTargets]=useState<string[]>([]),[answerIds,setAnswerIds]=useState<string[]>([]),[queue,setQueue]=useState<Reply[]>([]);
  const [takeawayOpen,setTakeawayOpen]=useState(false),[takeaway,setTakeaway]=useState(mission.reflection),[feedback,setFeedback]=useState('');
  const [selectedClaim,setSelectedClaim]=useState<string|null>(null),[showQuestions,setShowQuestions]=useState(false);
  const [observed,setObserved]=useState(mission.outcome?.observed??''),[learned,setLearned]=useState(mission.outcome?.learned??'');
  const feed=useRef<HTMLDivElement>(null),composer=useRef<HTMLTextAreaElement>(null),follow=useRef(true),sending=useRef(false);
  const [dispatching,setDispatching]=useState(false);
  const [saving,setSaving]=useState(false);
  const [files,setFiles]=useState<File[]>([]),[uploading,setUploading]=useState(false),[failedReply,setFailedReply]=useState<Reply|null>(null);
  const filePicker=useRef<HTMLInputElement>(null);
  const alive=useRef(true),uploadAbort=useRef<AbortController|null>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;uploadAbort.current?.abort();};},[]);
  const openQuestions=(mission.questions??[]).filter(q=>q.status==='open');
  const answered=(mission.questions??[]).filter(q=>q.status!=='open');
  const result=mission.result;
  const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
  function openNote(id:string){setSelectedNoteId(id);showSide('notes');}
  async function exportCanvas(){try{const e=await import('../lib/export');e.downloadFile(e.safeFileName(mission.title)+'.canvas',e.missionCanvas(mission,'ThinkBuddy/'+e.safeFileName(mission.id)),'application/json');setFeedback('ThinkMap Canvas downloaded. Export the Obsidian bundle to include linked note files.');}catch(e){setFeedback((e as Error).message);}}

  const entries=[...(mission.messages??[]).map(m=>({kind:'user' as const,id:m.id,createdAt:m.createdAt,message:m})),...mission.statements.map(s=>({kind:'companion' as const,id:s.id,createdAt:s.createdAt,statement:s}))].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const sourceCount=mission.statements.reduce((n,s)=>n+s.sources.length,0);
  useEffect(()=>{if(follow.current&&feed.current)feed.current.scrollTo({top:feed.current.scrollHeight,behavior:'auto'});},[entries.length]);
  useEffect(()=>{
    if(busy||dispatching||sending.current||!queue.length)return;
    const [next,...rest]=queue;sending.current=true;setDispatching(true);setQueue(rest);
    void deliver(next).finally(()=>{sending.current=false;setDispatching(false);});
  },[busy,dispatching,queue,p.onSend]);
  async function deliver(next:Reply){
    try{
      let attachments:ReplyAttachment[]=[];
      if(next.files.length){
        setUploading(true);setFeedback('Reading your attachments…');
        if(!live){attachments=await Promise.all(next.files.map(async file=>extractPlainText(file.name,new Uint8Array(await file.arrayBuffer()))));}
        else{
          const form=new FormData();next.files.forEach(file=>form.append('files',file));
          form.append('question',[next.text,...(mission.questions??[]).filter(q=>next.questions.includes(q.id)).map(q=>q.text)].join('\n'));
          uploadAbort.current=new AbortController();
          const response=await fetch('/api/attachments',{method:'POST',body:form,signal:uploadAbort.current.signal});
          const data=await response.json() as {attachments?:ReplyAttachment[];error?:string};
          if(!response.ok||!data.attachments?.length)throw Error(data.error||'The files could not be read. Try again.');
          attachments=data.attachments;
        }
        setUploading(false);setFeedback('Attachments read. Your council is using them in this reply.');
      }
      if(!alive.current)return;
      await p.onSend(next.text,next.ids,next.questions,attachments);if(alive.current)setFailedReply(null);
    }catch(e){if(alive.current){setFailedReply(next);setFeedback(e instanceof Error?e.message:'The attachment could not be read. Your files are available to retry.');}}
    finally{if(alive.current)setUploading(false);uploadAbort.current=null;}
  }
  function chooseFiles(list:FileList|null){
    if(!list?.length)return;
    try{const next=[...files,...Array.from(list)];validateUploads(next);
      if(!live&&next.some(f=>!attachmentMime(f.name).startsWith('text/')&&attachmentMime(f.name)!=='application/json'))throw Error('PDF and image reading requires live AI. Text, Markdown, CSV and JSON work in demo mode.');
      setFiles(next);setFeedback('Files selected. They will be read when you send your reply.');
    }catch(e){setFeedback((e as Error).message);}finally{if(filePicker.current)filePicker.current.value='';}
  }
  function stageReply(id:string,upload=false){
    const ids=openQuestions.filter(q=>q.mascotId===id).map(q=>q.id);setTargets(ids.length?[]:[id]);answer(ids);
    if(upload)filePicker.current?.click();
  }
  function showSide(next:Exclude<View,'discussion'>){setSide(next);setView(next);}
  function evidence(s:Statement){setSelectedClaim(s.id);showSide('sources');}
  async function submit(text=p.input){
    if((!text.trim()&&!files.length)||uploading)return;
    const next={text:text.trim()||'I attached supporting material for this question.',ids:targets,questions:answerIds,files};
    if(busy||sending.current){if(queue.length>=5)return;setQueue(q=>[...q,next]);}
    else {sending.current=true;setDispatching(true);void deliver(next).finally(()=>{sending.current=false;setDispatching(false);});}
    p.setInput('');setFiles([]);setAnswerIds([]);follow.current=true;
  }
  function answer(ids:string[]){setAnswerIds(ids);setView('discussion');composer.current?.focus();}
  function questionState(id:string,status:'open'|'skipped'){
    p.onChange({...mission,questions:(mission.questions??[]).map(q=>q.id===id?{...q,status,answer:undefined,answeredAt:undefined}:q)});
  }
  async function saveTakeaway(){setSaving(true);setFeedback('Saving…');try{await p.onTakeaway(takeaway);setFeedback('Takeaway saved. The council will use it in your next message.');setTakeawayOpen(false);}catch(e){setFeedback(e instanceof Error?e.message:'Could not save. Your draft is still here.');}finally{setSaving(false);}}
  async function saveReview(){setSaving(true);setFeedback('Saving review…');try{await p.onSave({...mission,outcome:{observed,learned,updatedAt:new Date().toISOString()}});setFeedback('Outcome saved. Your next discussion will include what you learned.');}catch(e){setFeedback(e instanceof Error?e.message:'Could not save your review.');}finally{setSaving(false);}}
  const safeDate=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString();};
  const statusFor=(m:Mascot)=>p.progress[m.id]||(openQuestions.some(q=>q.mascotId===m.id)?'Has a question':'Ready');
  const activeSources=selectedClaim?mission.statements.filter(s=>s.id===selectedClaim):mission.statements.filter(s=>s.sources.length||s.evidenceReview);

  return <div className="discussion-workspace"><details className="workspace-tools"><summary>Workspace tools</summary><div className="knowledge-launchers" aria-label="Thinking and note-taking tools"><button aria-pressed={side==='result'} onClick={()=>showSide('result')}><Sparkle size={16}/>Answer summary</button><button aria-pressed={side==='map'} onClick={()=>showSide('map')}><GitBranch size={16}/>ThinkMap</button><button aria-pressed={side==='notes'} onClick={()=>showSide('notes')}><Notebook size={16}/>Notes for Obsidian</button><button disabled={busy} onClick={p.onOpenSync}><FolderOpen size={16}/>Connect Obsidian</button></div></details>

    <div className="workspace-switcher" aria-label="Workspace views">{(['discussion','map','notes','sources'] as View[]).map(v=><button key={v} aria-pressed={view===v||(v==='discussion'&&view==='result')} onClick={()=>{setView(v);if(v!=='discussion')setSide(v);}}>{v==='discussion'?'Council':v==='map'?'ThinkMap':v==='notes'?`Notes ${mission.notes.length}`:`Sources ${sourceCount}`}</button>)}</div>
    <div className={'conversation-layout mobile-view-'+view}>
      <section className="conversation-panel" aria-label="Council conversation">
        <div className="conversation-heading"><div><span className="panel-eyebrow">ONE QUESTION. MANY PERSPECTIVES.</span><h3>The Council <span className="workspace-label">{live?'Live AI':'Demo'}</span></h3></div><div className="board-controls"><button className={!targets.length?'everyone selected':'everyone'} onClick={()=>setTargets([])}>Everyone</button><button className="invite-perspective" disabled={busy||mission.mascots.length>=6} onClick={()=>void p.onCommand('replace','Add a missing perspective that contributes something different to this mission.')}>+ Invite buddy</button></div></div>
        <MascotStage mission={mission} selected={targets} onSelect={id=>setTargets(t=>t.includes(id)?t.filter(x=>x!==id):[...t,id])} busy={busy} active={Object.keys(p.progress)[0]??null} progress={p.progress} onDetail={evidence} onManage={p.onManage} onReply={id=>stageReply(id)} onUpload={id=>stageReply(id,true)} onEvidence={evidence}/>
        <details className="board-conversation"><summary>Discussion <span>{entries.length} messages</span>{busy&&<span> · Council responding…</span>}</summary>

        <div className="conversation-feed" ref={feed} role="log" aria-label="Discussion messages" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=feed.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}>
          {!entries.length&&<div className="conversation-empty"><Sprite index={0}/><h4>Your council is gathering.</h4><p>Ask a question or tell us what matters. Replies will appear here.</p></div>}
          {entries.map(entry=>{
            if(entry.kind==='user')return <article className="conversation-message user-message" key={entry.id}><span className="message-byline">You{entry.message.kind==='takeaway'?' · Saved takeaway':''}</span><p>{entry.message.text}</p>{entry.message.attachments?.map(file=><details className="message-attachment" key={file.id}><summary><Paperclip size={13}/>{file.name} · {file.truncated?'Excerpt':'Read content'}</summary><p>{file.text}</p></details>)}</article>;
            const s=entry.statement,m=mission.mascots.find(m=>m.id===s.mascotId);
            return <article className={'conversation-message companion-message '+(s.mascotId==='buddy'?'buddy-message':'')} key={s.id} style={{'--companion-color':m?.color??'#669A89'} as React.CSSProperties}>
              <div className="message-top"><span className="message-avatar"><Sprite index={m?.sprite??0}/></span><div><strong>{m?.name??'Previous companion'}</strong><small>{m?.role??'Earlier perspective'}</small></div><span className={'evidence-label evidence-'+s.status.toLowerCase().replaceAll(' ','-')}>{s.status}</span></div>
              <p className="message-answer">{s.text}</p>
              {s.question&&<p className="message-question"><strong>A question for you</strong>{s.question}</p>}
              <details className="message-detail"><summary>Read explanation</summary><p>{s.detail}</p>{s.evidenceReview&&<p><strong>Evidence review:</strong> {s.evidenceReview.explanation}</p>}</details>
              {!!s.sources.length&&<div className="inline-citations">{s.sources.map((source,i)=><a href={source.url} target="_blank" rel="noopener noreferrer" key={source.url}>[{i+1}] {source.publisher??source.title}<ArrowUpRight size={12}/></a>)}</div>}
              <div className="message-actions"><button onClick={()=>evidence(s)}><ShieldCheck size={14}/>{s.sources.length?`${s.sources.length} sources`:'Show evidence'}</button><button disabled={busy} onClick={()=>void p.onCommand('turn','Explain this contribution with a concrete example and its limitations: '+s.text,[s.mascotId])}>Explain more</button><button disabled={busy} onClick={()=>void p.onCommand('turn','Constructively challenge this contribution, using earlier arguments: '+s.text)}>Challenge</button><button disabled={busy} onClick={()=>{p.onChange({...mission,notes:[...mission.notes,{id:crypto.randomUUID(),title:s.text.slice(0,80),content:s.detail,statementId:s.id,origin:'user',theme:'Saved ideas',updatedAt:new Date().toISOString()}]});setFeedback('Idea added to your notes.');}}>Save idea</button></div>
            </article>;
          })}
          {busy&&<div className="conversation-progress" role="status"><span className="typing-dots"><i/><i/><i/></span><span>{Object.values(p.progress).includes('Checking sources')?'Checking sources. You can keep writing.':'Your council is working. Replies appear as they arrive.'}</span><button onClick={p.onPause}><Pause size={14}/>Pause</button></div>}
        </div>
        </details>
        {!!openQuestions.length&&<section className="question-queue" aria-label="Questions for you"><div className="question-queue-heading"><strong>{openQuestions.length} {openQuestions.length===1?'question':'questions'} for you</strong><button onClick={()=>answer(openQuestions.map(q=>q.id))}>Answer together</button></div>{(showQuestions?openQuestions:openQuestions.slice(0,2)).map(q=><div className={'queued-question '+(answerIds.includes(q.id)?'answering':'')} key={q.id}><label><input type="checkbox" checked={answerIds.includes(q.id)} onChange={e=>setAnswerIds(ids=>e.target.checked?[...ids,q.id]:ids.filter(id=>id!==q.id))}/><span><strong>{mission.mascots.find(m=>m.id===q.mascotId)?.name??'Companion'} asks</strong>{q.text}</span></label><button onClick={()=>answer([q.id])}>Reply</button><button onClick={()=>{answer([q.id]);filePicker.current?.click();}}>Upload answer</button><button disabled={busy} onClick={()=>questionState(q.id,'skipped')} aria-label={'Skip question: '+q.text}>Skip</button></div>)}{openQuestions.length>2&&<button className="question-more" onClick={()=>setShowQuestions(!showQuestions)}>{showQuestions?'Show fewer':'Show all questions'}</button>}</section>}
        {!!answered.length&&<details className="answered-questions"><summary>{answered.length} answered or skipped questions · review mapping</summary>{answered.slice(-8).map(q=><div key={q.id}><strong>{q.status==='answered'?'Answered':'Skipped'}: {q.text}</strong>{q.answer&&<p>Your answer: {q.answer}</p>}<button disabled={busy} onClick={()=>questionState(q.id,'open')}>Reopen question</button></div>)}</details>}
        {!!queue.length&&<div className="pending-replies" aria-label="Queued messages">{queue.map((q,i)=><div key={i}><span>Next message: {q.text}</span><button onClick={()=>setQueue(all=>all.filter((_,j)=>j!==i))} aria-label="Remove queued message"><X size={14}/></button></div>)}</div>}
        <div className="conversation-composer"><input ref={filePicker} type="file" accept={UPLOAD_ACCEPT} multiple hidden aria-label="Attach files to your reply" onChange={e=>chooseFiles(e.target.files)}/>{!!files.length&&<div className="reply-attachments">{files.map((file,i)=><span key={i}><Paperclip size={13}/>{file.name}<button type="button" aria-label={'Remove attachment '+file.name} onClick={()=>setFiles(all=>all.filter((_,j)=>i!==j))}><X size={13}/></button></span>)}</div>}<div className="composer-recipient"><span>{targets.length?'To '+mission.mascots.filter(m=>targets.includes(m.id)).map(m=>m.name).join(', '):'To the whole council'}</span><small>{answerIds.length?`Answering ${answerIds.length} selected questions`:'Use @name to address a companion'}</small></div><form onSubmit={e=>{e.preventDefault();void submit();}}><button type="button" className="attach-reply" disabled={uploading||files.length>=3} onClick={()=>filePicker.current?.click()} aria-label="Attach supporting files" title="Attach PDF, image or text"><Paperclip size={21}/></button><button type="button" className="voice-button" disabled={p.voiceBusy} onClick={p.onVoice} aria-label={p.recording?'Stop recording':'Record a voice question'}>{p.recording?<Stop size={21}/>:<Microphone size={21}/>}</button><label className="sr-only" htmlFor="council-message">Message the council</label><textarea id="council-message" ref={composer} value={p.input} maxLength={16000} onChange={e=>p.setInput(e.target.value)} rows={2} placeholder="Ask a follow-up or a new question…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}}/><button className="send-button" aria-label={busy?'Queue message':'Send to council'} disabled={uploading||(!p.input.trim()&&!files.length)||queue.length>=5}><PaperPlaneRight size={21} weight="fill"/><span>Send</span></button></form><div className="composer-footnote"><span>{uploading?'Reading attachments…':p.voiceBusy?'Transcribing…':p.recording?'Recording…':busy?'Send now to queue your next message.':'Enter to send · Shift + Enter for a new line'}</span><button onClick={()=>{setTakeaway(mission.reflection);setTakeawayOpen(!takeawayOpen);}}>Save a takeaway</button></div></div>
        {takeawayOpen&&<div className="takeaway-editor"><label>What do you think now?<textarea value={takeaway} maxLength={16000} onChange={e=>setTakeaway(e.target.value)} placeholder="What changed your mind? What would you like to do?"/></label><button className="primary-button" disabled={busy||saving||!takeaway.trim()} onClick={()=>void saveTakeaway()}><Check size={16}/>Save takeaway</button><p>Saved separately from planning. It becomes context for the next reply.</p></div>}
        {feedback&&<p className="workspace-feedback" role="status">{feedback}</p>}{failedReply&&<div className="failed-reply"><span>Your upload reply is ready to retry.</span><button disabled={busy||uploading||dispatching} onClick={()=>{sending.current=true;setDispatching(true);void deliver(failedReply).finally(()=>{sending.current=false;setDispatching(false);});}}>Retry upload reply</button><button onClick={()=>setFailedReply(null)}>Dismiss</button></div>}<p className="upload-help">Up to 3 files · 5 MB each · 10 MB total · PDF, images or text. Saved replies keep extracted content; original files are not stored.</p>
        <div className="conversation-shortcuts"><button disabled={busy} onClick={()=>void p.onCommand('turn','Summarize our current answer, the main disagreement, and the next useful step.',['buddy'])}>Summarize so far</button><button disabled={busy} onClick={()=>void p.onCommand('turn','Explore a meaningfully different option and compare its trade-offs.')}>Another option</button>{tools.map(([id,label])=><button key={id} onClick={()=>p.onOpenTool(id)}>{label}</button>)}</div>
      </section>
      <aside className="result-panel" aria-label="Mission results and resources"><div className="result-tabs" aria-label="Result views">{(['result','map','notes','sources'] as const).map(t=><button key={t} aria-pressed={side===t} onClick={()=>showSide(t)}>{t==='result'?'Result':t==='map'?'ThinkMap':t==='notes'?`Notes (${mission.notes.length})`:`Sources (${sourceCount})`}</button>)}</div><div className="result-content">
        {side==='result'&&<><div className="result-heading"><span className="result-icon"><Sparkle size={22} weight="fill"/></span><div><span className="panel-eyebrow">YOUR WORKING ANSWER</span><h3>ANSWER</h3></div></div><p className="result-saving">{busy?'Updating as the discussion unfolds…':result?'Updated '+safeDate(result.updatedAt):'Your next discussion will build this result.'} · {p.saveStatus}</p>
          {result?<><p className="result-summary">{result.summary}</p><section className="result-section recommendation"><h4>💡 Key Takeaway</h4><p>{result.recommendation}</p></section><details className="answer-more"><summary>Explore the reasoning &amp; options</summary>{result.changed&&<section className="result-section"><h4>What your answer changes</h4><p>{result.changed}</p></section>}{!!result.options.length&&<section className="result-section"><h4>Options worth considering</h4>{result.options.map((o,i)=><details className="option-card" key={i}><summary><span>{String(i+1).padStart(2,'0')}</span>{o.name}</summary><p>{o.benefit}</p><dl><dt>Cost</dt><dd>{o.cost||"Not estimated"}</dd><dt>Effort</dt><dd>{o.effort}</dd><dt>Risk</dt><dd>{o.risk}</dd><dt>Evidence gap</dt><dd>{o.evidenceGap}</dd></dl><button disabled={busy} onClick={()=>void p.onCommand('turn','I want to explore this option: '+o.name+'. Compare it with the alternatives and update our result.')}>Discuss this option <ArrowUpRight size={12}/></button></details>)}</section>}{!!result.unresolved.length&&<section className="result-section"><h4>Still unresolved</h4><ul>{result.unresolved.map((u,i)=><li key={i}>{u}</li>)}</ul></section>}</details><details className="answer-more"><summary>Plan your next step</summary><section className="result-section experiment"><span className="panel-eyebrow">TRY SOMETHING SMALL</span><h4>Your next experiment</h4><p>{result.experiment.action||result.nextStep}</p><label>Success measure<textarea maxLength={2000} value={result.experiment.successMeasure} disabled={busy} onChange={e=>p.onChange({...mission,result:{...result,experiment:{...result.experiment,successMeasure:e.target.value}}})}/></label><div className="experiment-fields"><label>Owner<input maxLength={500} value={result.experiment.owner} placeholder="Choose someone" disabled={busy} onChange={e=>p.onChange({...mission,result:{...result,experiment:{...result.experiment,owner:e.target.value}}})}/></label><label>Review date<input maxLength={100} value={result.experiment.reviewDate} placeholder="Choose a date" disabled={busy} onChange={e=>p.onChange({...mission,result:{...result,experiment:{...result.experiment,reviewDate:e.target.value}}})}/></label></div><button className="primary-button" disabled={busy} onClick={()=>void p.onCommand('plan',mission.reflection||result.recommendation)}><Check size={15}/>Build action plan</button></section></details></>:<div className="result-empty"><p>Your council’s synthesis will appear here with options and a practical next step.</p><button className="primary-button" disabled={busy} onClick={()=>void p.onCommand('turn','Answer our mission and build a clear working result using our existing discussion.')}>Build our result</button></div>}
          {mission.reflection&&<section className="result-section"><h4>Your saved takeaway</h4><p>{mission.reflection}</p></section>}
          <details className="mission-brief"><summary>Mission brief · give your council context</summary>{(['success','audience','resources','deadline'] as const).map(field=><label key={field}>{field==='success'?'What would success look like?':field==='audience'?'Who is affected?':field==='resources'?'Resources and constraints':'Deadline'}<input value={mission.brief?.[field]??''} maxLength={field==='deadline'?100:2000} disabled={busy} onChange={e=>p.onChange({...mission,brief:{success:'',audience:'',resources:'',deadline:'',...mission.brief,[field]:e.target.value}})}/></label>)}</details>
          <details className="outcome-review"><summary>Review what happened</summary><p>Compare your experiment’s result with the success measure above.</p><label>What did you observe?<textarea value={observed} maxLength={8000} onChange={e=>setObserved(e.target.value)}/></label><label>What did you learn?<textarea value={learned} maxLength={8000} onChange={e=>setLearned(e.target.value)}/></label><button disabled={busy||saving||!observed.trim()} className="secondary-button" onClick={()=>void saveReview()}>Save outcome review</button>{mission.outcome&&<small>Last saved {safeDate(mission.outcome.updatedAt)}</small>}</details>
          <div className="reference-next-steps"><h4>Next Steps</h4><div><button disabled={busy||saving} onClick={async()=>{setSaving(true);try{await p.onSave(mission);setFeedback('Mission saved.');}catch(e){setFeedback(e instanceof Error?e.message:'Could not save your mission.');}finally{setSaving(false);}}}>Save Mission</button><button disabled={busy} onClick={()=>void p.onCommand('plan',mission.reflection||mission.result?.recommendation||mission.title)}>Turn into a Plan</button></div></div><p className="result-disclaimer">A working recommendation. Check the evidence and use your judgment. Companion agreement is not independent verification.</p>
        </>}
        {side==='map'&&<section className="inline-thinkmap" aria-label="ThinkMap workspace"><div className="inline-map-heading"><div><span className="panel-eyebrow">CONNECT YOUR THINKING</span><h3>ThinkMap</h3></div><button onClick={()=>p.onOpenTool('map')}>Expand map ↗</button></div><Suspense fallback={<p>Opening your thinking map…</p>}><InlineMap mission={mission} onChange={p.onChange} busy={busy} onOpenNote={openNote}/></Suspense><div className="inline-map-actions"><button onClick={()=>void exportCanvas()}><DownloadSimple size={14}/>Download Canvas</button><button onClick={()=>showSide('notes')}><Notebook size={14}/>Open notebook</button></div></section>}
        {side==='notes'&&<ObsidianNotebook mission={mission} onChange={p.onChange} busy={busy} saveStatus={p.saveStatus} onConnect={p.onOpenSync} onShowMap={()=>showSide('map')} initialNoteId={selectedNoteId}/>}
        {side==='sources'&&<><div className="result-heading"><ShieldCheck size={25}/><div><span className="panel-eyebrow">EVIDENCE GUARDIAN</span><h3>Look at the evidence.</h3></div></div><p className="result-saving">Up to two key contributions and their factual basis are researched automatically per turn. Every claim can also be checked here.</p>{selectedClaim&&<button className="text-button" onClick={()=>setSelectedClaim(null)}>Show all reviewed claims</button>}{!activeSources.length&&<div className="result-empty"><p>No external evidence has been attached yet. Opinions and assumptions are not verified facts.</p><p>Choose a contribution below to research it.</p></div>}{activeSources.map(s=><article className="evidence-card" key={s.id}><span className="evidence-label">{s.status}</span><h4>{s.text}</h4>{s.evidenceReview?<><p>{s.evidenceReview.explanation}</p><p className="evidence-limitations"><strong>Limits:</strong> {s.evidenceReview.limitations||'Check whether this evidence applies to your situation.'}</p><small>Checked {safeDate(s.evidenceReview.checkedAt)}</small></>:<p>This contribution has not had an evidence review.</p>}{s.sources.map((source,i)=><div className="source-card" key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">[{i+1}] {source.title}<ArrowUpRight size={14}/></a><small>{source.publisher??new URL(source.url).hostname} · {source.publishedAt?'Published '+safeDate(source.publishedAt):'Publication date unavailable'}</small>{source.summary&&<p><strong>AI summary of source:</strong> {source.summary}</p>}</div>)}{!s.sources.length&&<p className="evidence-limitations">No external sources attached. This is not proof.</p>}<button disabled={busy} className="secondary-button" onClick={()=>void p.onCommand('evidence',s.id)}>{busy?'Council working…':'Check sources'}</button></article>)}<details className="claim-picker"><summary>Choose another contribution to check</summary>{mission.statements.slice().reverse().map(s=><button key={s.id} onClick={()=>setSelectedClaim(s.id)}>{s.text}</button>)}</details><p className="result-disclaimer">Source summaries are AI-generated paraphrases. Open the original sources to inspect their evidence and context.</p></>}
      </div></aside>
    </div>
  </div>;
}
