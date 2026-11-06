'use client';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { builderState, preserveLearning, syncLearningMap } from '../lib/builder';
import MissionLanding from './MissionLanding';
import CouncilWorkspace from './CouncilWorkspace';
import { addUserMessage, demoWorkspace, mergeStatements, resolveMentions } from '../lib/discussion';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Graph } from '@phosphor-icons/react/dist/csr/Graph';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Flask } from '@phosphor-icons/react/dist/csr/Flask';
import { Notebook } from '@phosphor-icons/react/dist/csr/Notebook';
import { Path } from '@phosphor-icons/react/dist/csr/Path';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { CloudCheck } from '@phosphor-icons/react/dist/csr/CloudCheck';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { ChatCircleDots } from '@phosphor-icons/react/dist/csr/ChatCircleDots';
import { Lightbulb } from '@phosphor-icons/react/dist/csr/Lightbulb';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Target } from '@phosphor-icons/react/dist/csr/Target';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { FileCode } from '@phosphor-icons/react/dist/csr/FileCode';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { PaperPlaneRight } from '@phosphor-icons/react/dist/csr/PaperPlaneRight';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { createDemoMission, demoCouncil } from '../lib/demo';
import { loadGuestMissions, saveGuestMission, deleteGuestMission } from '../lib/guest-store';
import type { CouncilRequest, Mascot, Mission, MissionBrief, Statement, Tool, ReplyAttachment } from '../lib/types';
import MascotStage, { Sprite } from './MascotStage';
const ToolsPanel = lazy(()=>import('./ToolsPanel'));
const SyncPanel = lazy(()=>import('./SyncPanel'));

const toolItems:{id:Tool;name:string;description:string;icon:typeof Graph;color:string}[]=[
  {id:'map',name:'ThinkMap',description:'See how your ideas connect',icon:Graph,color:'blue'},
  {id:'evidence',name:'Evidence Guardian',description:'A little curiosity. A closer look.',icon:ShieldCheck,color:'green'},
  {id:'lab',name:'ThinkLab',description:'Make room for what if',icon:Flask,color:'purple'},
  {id:'vault',name:'ThinkVault',description:'Keep the thoughts that matter',icon:Notebook,color:'yellow'},
  {id:'path',name:'ThinkPath',description:'Turn a thought into a next step',icon:Path,color:'teal'},
];
const examples=['How can we make our school more eco-friendly?','How can I market my new healthy snack?','I want to design an affordable and comfortable family home.','I want to understand how software teams work.'];
function Modal({title,onClose,children,wide=false,open=true}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean;open?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();else if(!open)dialog?.close();return()=>dialog?.close();},[open]);
  return <dialog ref={ref} className={'dialog '+(wide?'wide-dialog':'')} onCancel={e=>{e.preventDefault();onClose();}}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</dialog>;
}
interface ApiResult { error?: string; mission: Mission; missions: Mission[]; live: boolean; text: string; }
async function jsonRequest(url:string,init?:RequestInit):Promise<ApiResult>{const r=await fetch(url,init);const data=await r.json() as ApiResult;if(!r.ok)throw new Error(data.error||'Request failed ('+r.status+')');return data;}

export default function ThinkBuddy({userName,guest=false,missionId}:{userName:string;guest?:boolean;missionId?:string}){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [startingMission,setStartingMission]=useState(false);
  const [mission,setMission]=useState<Mission|null>(null),[missions,setMissions]=useState<Mission[]>([]);
  const [live,setLive]=useState(false),[tool,setTool]=useState<Tool|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[active,setActive]=useState<string|null>(null);
  const [error,setError]=useState(''),[saveStatus,setSaveStatus]=useState('Loading workspace');
  const [modal,setModal]=useState<'new'|'history'|'saved'|'settings'|'sync'|'vault'|null>(null),[newTitle,setNewTitle]=useState('');
  const [detail,setDetail]=useState<Statement|null>(null),[manage,setManage]=useState<Mascot|null>(null),[sidebar,setSidebar]=useState(false);
  const [theme,setTheme]=useState<'system'|'light'|'dark'>('light'),[recording,setRecording]=useState(false),[voiceBusy,setVoiceBusy]=useState(false),[paused,setPaused]=useState(false);
  const current=useRef<Mission|null>(null),abort=useRef<AbortController|null>(null),saveQueue=useRef<Promise<void>>(Promise.resolve());
  const debounce=useRef<ReturnType<typeof setTimeout>|null>(null),recorder=useRef<MediaRecorder|null>(null),voiceTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const browserRecognition=useRef<{stop:()=>void;abort:()=>void}|null>(null);
  const playback=useRef<ReturnType<typeof setTimeout>[]>([]),dirty=useRef(false);
  const [notice,setNotice]=useState('');
  const [progress,setProgress]=useState<Record<string,string>>({});
  const busyRef=useRef(false),editVersion=useRef(0),knownRevisions=useRef(new Map<string,number>());
  const [syncMounted,setSyncMounted]=useState(false);
  useEffect(()=>{if(modal==='sync')setSyncMounted(true);},[modal]);
  useEffect(()=>{current.current=mission;},[mission]);
  useEffect(()=>{const t=localStorage.getItem('thinkbuddy-theme-v2');if(t==='dark'||t==='light'||t==='system')setTheme(t);},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  const chooseTheme=(t:'system'|'light'|'dark')=>{setTheme(t);localStorage.setItem('thinkbuddy-theme-v2',t);};
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
  const save=useCallback(async(next:Mission)=>{
    const version=editVersion.current;dirty.current=true;
    const task=async()=>{
      setSaveStatus('Saving');
      try{
        const revision=knownRevisions.current.get(next.id)??next.revision;
        const result=guest?{mission:saveGuestMission({...next,revision})}:await jsonRequest('/api/missions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mission:{...next,revision},expectedRevision:revision})});
        const saved=result.mission as Mission;knownRevisions.current.set(saved.id,saved.revision);
        if(current.current?.id===saved.id){const updated={...current.current,revision:saved.revision};current.current=updated;setMission(updated);}
        setMissions(all=>[saved,...all.filter(m=>m.id!==saved.id)]);
        if(editVersion.current===version){dirty.current=false;setSaveStatus(guest?'Saved in this browser':'All changes saved');}else setSaveStatus('Unsaved changes');
      }catch(e){setSaveStatus('Not saved');setError(e instanceof Error?e.message:'Could not save your mission.');throw e;}
    };
    const queued=saveQueue.current.then(task,task);saveQueue.current=queued.catch(()=>{});return queued;
  },[guest]);
  const edit=useCallback((next:Mission)=>{const updated=syncLearningMap({...preserveLearning(current.current??next,next),updatedAt:new Date().toISOString()});editVersion.current+=1;current.current=updated;setMission(updated);dirty.current=true;setSaveStatus('Unsaved changes');if(debounce.current)clearTimeout(debounce.current);debounce.current=setTimeout(()=>{debounce.current=null;void save(updated).catch(()=>{});},700);},[save]);
  const flush=useCallback(async()=>{if(debounce.current){clearTimeout(debounce.current);debounce.current=null;}await saveQueue.current;if(dirty.current&&current.current)await save(current.current);},[save]);
  async function persistMission(next:Mission){if(debounce.current){clearTimeout(debounce.current);debounce.current=null;}await saveQueue.current;next=syncLearningMap(preserveLearning(current.current??next,next));editVersion.current+=1;current.current=next;setMission(next);dirty.current=true;await save(next);}
  async function saveTakeaway(text:string){
    if(!current.current||busyRef.current)return;
    await flush();const m=current.current;const next=addUserMessage({...m,reflection:text,notes:[...m.notes,{id:crypto.randomUUID(),title:'My takeaway',content:text,theme:'My decisions',origin:'user',updatedAt:new Date().toISOString()}]},text,[],'takeaway');
    await persistMission(next);setNotice('Takeaway saved. Your next discussion will use it.');
  }
  useEffect(()=>{
    let disposed=false;
    Promise.all(guest?[Promise.resolve().then(()=>({missions:loadGuestMissions()})),Promise.resolve({live:false})]:[jsonRequest('/api/missions'),jsonRequest('/api/config')]).then(async([data,config])=>{
      if(disposed)return;setLive(config.live);setMissions(data.missions);for(const item of data.missions)knownRevisions.current.set(item.id,item.revision);
      let m=missionId?data.missions.find((item:Mission)=>item.id===missionId):null;
      if(missionId&&!m&&!guest){const found=await jsonRequest('/api/missions?id='+encodeURIComponent(missionId));m=found.mission;}
      if(disposed)return;if(m)knownRevisions.current.set(m.id,m.revision);setMission(m||null);current.current=m||null;setReady(true);setSaveStatus(guest?'Saved in this browser':'All changes saved');
      if(missionId&&!m)setError('This mission is not available in this workspace. Start a new mission from Home.');
    }).catch(e=>{if(!disposed){setError(e.message);setSaveStatus('Workspace unavailable');}});
    return()=>{disposed=true;abort.current?.abort();playback.current.forEach(clearTimeout);if(debounce.current)clearTimeout(debounce.current);if(voiceTimer.current)clearTimeout(voiceTimer.current);recorder.current?.stream.getTracks().forEach(t=>t.stop());browserRecognition.current?.abort();};
  },[save,guest,missionId]);
  useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
  const highlight=(next:Mission)=>{playback.current.forEach(clearTimeout);next.mascots.forEach((m,i)=>playback.current.push(setTimeout(()=>setActive(m.id),i*2000)));playback.current.push(setTimeout(()=>setActive(null),next.mascots.length*2000));};
  async function command(action:CouncilRequest['action'],prompt='',base?:Mission,ids?:string[]){
    if(busyRef.current)return false;const source=base||current.current;if(!source)return false;
    busyRef.current=true;setBusy(true);setProgress({});setError('');setPaused(false);abort.current=new AbortController();
    try{
      await flush();const fresh=current.current?.id===source.id?current.current:source;
      if(guest){
        const request={action,mission:fresh,prompt,mascotIds:ids??[]};const result=demoWorkspace(request,demoCouncil(request));
        current.current=result;setMission(result);await save(result);return true;
      }
      const response=await fetch('/api/council',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action,mission:fresh,prompt,mascotIds:ids??[]}),signal:abort.current.signal});
      if(!response.ok){const e=await response.json() as {error?:string};throw new Error(e.error||'The council could not respond.');}
      const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',result:Mission|null=null;
      const update=(change:(m:Mission)=>Mission)=>{if(!current.current||abort.current?.signal.aborted)return;const next=change(current.current);current.current=next;setMission(next);dirty.current=true;editVersion.current+=1;};
      while(true){
        const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=frame.split('\n').find(l=>l.startsWith('event: '))?.slice(7);const payload=frame.split('\n').find(l=>l.startsWith('data: '))?.slice(6);if(!payload)continue;const data=JSON.parse(payload);
          if(event==='error')throw new Error(data.error);
          if(event==='warning')setNotice(data.message);
          if(event==='thinking'&&data.mascotId)setProgress(all=>({...all,[data.mascotId]:data.status||'Thinking'}));
          if(event==='roster')update(m=>({...m,mascots:data.mascots}));
          if(event==='statement'){
            update(m=>({...m,statements:mergeStatements(m.statements,[data.statement]),questions:data.questions??m.questions}));
            setProgress(all=>{const next={...all};delete next[data.mascotId];return next;});
          }
          if(event==='result')update(m=>({...m,result:data.result}));
          if(event==='notes')update(m=>({...m,notes:[...m.notes,...data.notes.filter((n:{id:string})=>!m.notes.some(old=>old.id===n.id))]}));
          if(event==='complete')result=data.mission;
        }
      }
      if(!result)throw new Error('The response was interrupted. Your messages and completed replies are saved.');
      result={...result,revision:knownRevisions.current.get(result.id)??result.revision};current.current=result;setMission(result);await save(result);
      if(action==='plan')setTool('path');return true;
    }catch(e){
      if(e instanceof Error&&e.name==='AbortError'){setPaused(true);setNotice('Discussion paused. Completed contributions are kept.');}
      else setError(e instanceof Error?e.message:'Something went wrong.');
      if(dirty.current&&current.current)try{await save(current.current);}catch{}
      return false;
    }finally{busyRef.current=false;setBusy(false);setProgress({});abort.current=null;}
  }
  async function sendCouncil(text:string,ids:string[],questions:string[],attachments:ReplyAttachment[]=[]){
    if(busyRef.current||!current.current)return false;
    if(builderState(current.current).status==='finished'){setError('Choose Explore further to resume this discussion.');return false;}
    const next=addUserMessage(current.current,text,questions,'message',attachments);editVersion.current+=1;current.current=next;setMission(next);dirty.current=true;
    const mentions=resolveMentions(text,next);return command('turn',text,next,mentions.length?mentions:ids);
  }
  async function discussCommand(action:CouncilRequest['action'],prompt='',ids?:string[]){
    if(action==='turn')return sendCouncil(prompt,ids??[],[]);
    return command(action,prompt,undefined,ids);
  }
  async function goHome(){if(busy)return;try{await flush();setStartingMission(false);setModal(null);setSidebar(false);setTool(null);setNewTitle('');router.push('/');}catch(e){setError((e as Error).message);}}
  async function newMission(title:string,brief?:MissionBrief){
    if(!title.trim()||busy)return;
    try{await flush();playback.current.forEach(clearTimeout);setActive(null);const next=createDemoMission(title.trim());next.brief=brief;next.statements=[];next.nodes=[];next.edges=[];next.round=0;setModal(null);setSelected([]);setTool(null);setStartingMission(true);current.current=next;setMission(next);const ok=await command('generate','',next);if(ok)router.push('/mission/'+encodeURIComponent(next.id));}catch(e){setError((e as Error).message);}
  }
  async function openMission(m:Mission){try{await flush();playback.current.forEach(clearTimeout);setActive(null);setSelected([]);setModal(null);setSidebar(false);setTool(null);router.push('/mission/'+encodeURIComponent(m.id));}catch(e){setError((e as Error).message);}}
  async function goMission(){
    if(busy||!ready)return;
    const target=current.current||missions[0];
    if(target)await openMission(target);else{setNewTitle('');setModal('new');setSidebar(false);}
  }
  async function openWorkspaceTool(kind:'vault'|'sync'){
    if(busy||!ready)return;
    try{await flush();const target=current.current||missions[0];if(target){current.current=target;setMission(target);}setSidebar(false);setModal(kind);setTool(null);}catch(e){setError((e as Error).message);}
  }
  async function chooseToolMission(id:string){
    try{await flush();const target=missions.find(m=>m.id===id);if(target){current.current=target;setMission(target);}}catch(e){setError((e as Error).message);}
  }
  async function startRecording(){
    if(recording){if(browserRecognition.current)browserRecognition.current.stop();else recorder.current?.stop();return;}
    if(!live){
      type Recognition={lang:string;interimResults:boolean;continuous:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
      const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
      const Constructor=w.SpeechRecognition??w.webkitSpeechRecognition;
      if(!Constructor){setError('Voice recognition is unavailable in this browser. Type your answer, or use live AI transcription when configured.');return;}
      try{const r=new Constructor();r.lang='en-US';r.interimResults=false;r.continuous=false;r.onresult=e=>{const text=Array.from(e.results).map(x=>x[0].transcript).join(' ');setInput(old=>[old,text].filter(Boolean).join(' '));setNotice('Review your transcript, then send it.');};r.onerror=e=>{setError('Voice recognition could not finish ('+e.error+'). You can type your answer.');setRecording(false);};r.onend=()=>{setRecording(false);browserRecognition.current=null;if(voiceTimer.current)clearTimeout(voiceTimer.current);};browserRecognition.current=r;r.start();setRecording(true);voiceTimer.current=setTimeout(()=>r.stop(),60000);}catch{setError('Microphone access was unavailable. You can type your answer.');setRecording(false);}return;
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(stream);recorder.current=r;const chunks:BlobPart[]=[];
      r.ondataavailable=e=>chunks.push(e.data);r.onstop=async()=>{setRecording(false);stream.getTracks().forEach(t=>t.stop());if(voiceTimer.current)clearTimeout(voiceTimer.current);setVoiceBusy(true);try{const form=new FormData();form.append('audio',new Blob(chunks,{type:r.mimeType}),'question.webm');const data=await jsonRequest('/api/transcribe',{method:'POST',body:form});setInput(data.text);setNotice('Review your transcription, then send it.');}catch(e){setError((e as Error).message);}finally{setVoiceBusy(false);}};r.start();setRecording(true);voiceTimer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},60000);
    }catch{setError('Microphone access was unavailable. Check browser permissions or type your question.');}
  }
  const toggleSelected=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const selectedNames=mission?.mascots.filter(m=>selected.includes(m.id)).map(m=>m.name).join(' & ');

  return <div className="app-shell">
    <div className="navbar-wrap">
      <nav className="navbar" aria-label="Main">
        <a className="brand" href="/" aria-label="ThinkBuddy home"><span className="brand-icon" aria-hidden="true">🧠</span><span className="brand-name">ThinkBuddy</span></a>
        <div className="nav-links">
          <button className={!missionId&&!modal?'nav-active':''} disabled={busy} onClick={()=>void goHome()}><House size={18} weight="bold"/>Home</button>
          <button className={missionId&&!modal?'nav-active':''} onClick={()=>void goMission()} disabled={busy||!ready}><Target size={18} weight="bold"/>Mission</button>
          <button className={modal==='saved'?'nav-active':''} onClick={()=>{setModal('saved');setSidebar(false);}}><ClockCounterClockwise size={18} weight="bold"/>Saved<span className="count">{missions.length}</span></button>
          <button className={modal==='vault'?'nav-active':''} disabled={busy||!ready} onClick={()=>void openWorkspaceTool('vault')}><Database size={18} weight="bold"/>ThinkVault</button>
          <button className={modal==='sync'?'nav-active':''} disabled={busy||!ready} onClick={()=>void openWorkspaceTool('sync')}><FileCode size={18} weight="bold"/>Obsidian Sync</button>
        </div>
        <button className="projects-toggle secondary-button" onClick={()=>setSidebar(!sidebar)} aria-expanded={sidebar} aria-controls="project-sidebar"><List size={18}/>Projects</button>
        <div className="nav-actions">
          
          <button className="icon-button nav-icon" onClick={()=>chooseTheme(theme==='dark'?'light':'dark')} aria-label="Toggle color theme">{theme==='dark'?<Sun size={19} weight="bold"/>:<Moon size={19} weight="bold"/>}</button>
          <button className="avatar" onClick={()=>{setModal('settings');setSidebar(false);}} aria-label="Settings and help" title="Settings and help">{userName[0]?.toUpperCase()}</button>
          <button className="icon-button nav-icon menu-button" onClick={()=>setSidebar(!sidebar)} aria-label="Toggle navigation" aria-expanded={sidebar}>{sidebar?<X size={20} weight="bold"/>:<List size={20} weight="bold"/>}</button>
        </div>
      </nav>
    </div>
    {sidebar&&<><button className="project-scrim" onClick={()=>setSidebar(false)} aria-label="Close projects"/><aside id="project-sidebar" className="project-sidebar" aria-label="Your projects"><div className="section-heading"><h2>Your projects</h2><button onClick={()=>setSidebar(false)} aria-label="Close projects">×</button></div><button className="primary-button" disabled={busy} onClick={()=>{setSidebar(false);setNewTitle('');setModal('new');}}>+ New project</button><button className="secondary-button" disabled={busy} onClick={()=>void goHome()}>Home</button>{missions.map(m=><button className={'project-item '+(mission?.id===m.id?'current':'')} key={m.id} disabled={busy} onClick={()=>void openMission(m)}><strong>{m.title}</strong><small>{new Date(m.updatedAt).toLocaleDateString()}</small></button>)}<button className="text-button" onClick={()=>{setSidebar(false);setModal('saved');}}>Manage saved projects</button></aside></>}
    <main className="workspace">
      {missionId&&<header className="hero">
        <h1 className="hero-title">THINKBUDDY</h1>
        <p className="hero-tagline">One Question. Many Perspectives. Better Thinking.</p>
      </header>}
      <div className="workspace-content">
      {!live&&!missionId&&!startingMission&&<div className="demo-notice"><span className="demo-chip"><Sparkle size={13} weight="fill"/>Demo</span><span>{guest?'Guest demo: explore without an account. Missions save in this browser.':'You are exploring a sample council. Live AI requires a configured server API key.'}</span><button onClick={()=>setModal('settings')}>Setup <ArrowUpRight size={13} weight="bold"/></button></div>}
      {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><X size={17} weight="bold"/></button></div>}
      {!missionId&&!startingMission?<MissionLanding onStart={newMission} onOpen={openMission} missions={missions} busy={busy} ready={ready}/>:!mission?<div className="workspace-loading"><div className="skeleton-line"/><div className="skeleton-stage"/><p>{error?'Your workspace could not load. Refresh to retry.':'Making a little room for your ideas…'}</p></div>:<>
        {saveStatus==='Not saved'&&<button className="secondary-button" disabled={busy} onClick={()=>void flush().catch(e=>setError((e as Error).message))}>Retry save</button>}
        <section className="mission-card">
          <span className="mission-symbol"><Target size={34} weight="bold"/></span>
          <div className="mission-text"><span className="mission-eyebrow">YOUR QUESTION</span><h2 title={mission.title}>“{mission.title}”</h2></div>
          <button className="brutal-button mission-edit" onClick={()=>{setNewTitle("");setModal("new");}} disabled={busy}><Plus size={16} weight="bold"/><span>New Mission</span></button>
        </section>
        <CouncilWorkspace key={mission.id} mission={mission} busy={busy} live={live} saveStatus={saveStatus} progress={progress}
          input={input} setInput={setInput} recording={recording} voiceBusy={voiceBusy} onVoice={()=>void startRecording()}
          onRetry={()=>command('turn',current.current?.messages?.at(-1)?.text??'')} onSend={sendCouncil} onCommand={discussCommand} onChange={edit} onSave={persistMission} onTakeaway={saveTakeaway}
          onOpenSync={()=>void openWorkspaceTool('sync')} onPause={()=>abort.current?.abort()} onManage={setManage} onOpenTool={setTool}/>
        {tool&&<Modal title={toolItems.find(t=>t.id===tool)?.name??'Thinking tools'} wide onClose={()=>setTool(null)}><Suspense fallback={<p>Opening your workspace…</p>}><ToolsPanel tool={tool} mission={mission} onChange={edit} onCommand={async(action,prompt)=>{await command(action,prompt);}} busy={busy} onClose={()=>setTool(null)}/></Suspense></Modal>}

      </>}
      <footer className="workspace-footer"><span>ThinkBuddy · A little company for big ideas</span><span>Made for curious minds <Leaf size={13} weight="fill"/></span></footer></div>
    </main>
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {modal==='new'&&<Modal title="What would you like to think about?" onClose={()=>setModal(null)}><p className="dialog-intro">A decision, a big idea, or a small everyday question. Your council will meet you there.</p><form onSubmit={e=>{e.preventDefault();void newMission(newTitle);}}><label className="field-label" htmlFor="mission-title">Your mission</label><textarea autoFocus id="mission-title" rows={4} maxLength={1000} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="I’ve been wondering…" required/><button className="primary-button full-width" disabled={!newTitle.trim()||busy}>Gather my council <ArrowRight size={18}/></button></form><span className="field-label examples-label">Or start with a little inspiration</span><div className="examples">{examples.map(e=><button key={e} onClick={()=>setNewTitle(e)}>{e}<ArrowUpRight size={14}/></button>)}</div></Modal>}
    {modal==='saved'&&<Modal title="Your saved missions" onClose={()=>setModal(null)}><p className="dialog-intro">Pick up a thought where you left it.</p><div className="saved-list">{missions.map(m=><div key={m.id}><button onClick={()=>void openMission(m)}><strong>{m.title}</strong><small>{new Date(m.updatedAt).toLocaleDateString()} · {m.statements.length} contributions</small></button><button className="icon-button" aria-label={'Delete '+m.title} onClick={async()=>{if(!confirm('Delete this mission and its saved thinking? This cannot be undone.'))return;try{if(guest)deleteGuestMission(m.id);else await jsonRequest('/api/missions?id='+encodeURIComponent(m.id),{method:'DELETE'});setMissions(all=>all.filter(x=>x.id!==m.id));if(current.current?.id===m.id){const next=missions.find(x=>x.id!==m.id)||createDemoMission();setMission(next);current.current=next;router.push('/');}setNotice('Mission deleted.');}catch(e){setError((e as Error).message);}}}><Trash size={17}/></button></div>)}</div></Modal>}
    {modal==='history'&&mission&&<Modal title="The thinking journey" onClose={()=>setModal(null)} wide><p className="dialog-intro">Every perspective, in the order it arrived. Select a contribution to look closer.</p><div className="history-list">{mission.statements.map(s=>{const m=mission.mascots.find(m=>m.id===s.mascotId);return <button key={s.id} onClick={()=>{setModal(null);setDetail(s);}}><Sprite index={m?.sprite||0}/><span><strong>{m?.name||'Former council member'}<small>{s.status}</small></strong><span>{s.text}</span></span></button>;})}</div></Modal>}
    {modal==='settings'&&<Modal title="Make yourself at home" onClose={()=>setModal(null)}><section className="settings-section"><h3>Appearance</h3><div className="theme-choices">{(['system','light','dark'] as const).map(t=><button className={theme===t?'chosen':''} onClick={()=>chooseTheme(t)} key={t}>{t}</button>)}</div></section><section className="settings-section"><h3>{guest?'Guest workspace':'OpenAI connection'} <span className="pill">{live?'Connected':'Not configured'}</span></h3><p>{guest?'You can explore without signing in. Guest discussions are simulated, and missions stay in this browser. Clearing browser data removes your guest projects.':live?'Your key is stored securely on the server.':'The workspace is in demo mode. Add OPENAI_API_KEY as a secret in the Site’s environment settings, then redeploy to enable live discussions, evidence retrieval, and transcription.'}</p><p>Your key is never entered into this page or stored in the browser.</p></section><section className="settings-section"><h3>About your council</h3><p>Your buddies are simulated AI perspectives, not real people or verified professionals. Their ideas are starting points for your judgment. Sources and uncertainty stay visible.</p><p>Reduced motion follows your device preference. Use Shift + arrow keys on a character to reposition it.</p></section>{!guest&&<a className="text-button signout" href="/signout-with-chatgpt?return_to=%2F" target="_top"><SignOut size={17}/>Sign out</a>}</Modal>}
    {syncMounted&&mission&&<Modal open={modal==='sync'} title="Your ideas, connected" onClose={()=>setModal(null)} wide><label className="tool-mission-picker">Mission<select value={mission.id} disabled={busy} onChange={e=>void chooseToolMission(e.target.value)}>{missions.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label><Suspense fallback={<p>Opening your vault tools…</p>}><SyncPanel key={mission.id} mission={mission} paused={busy} onSave={async (m,expectedNotes)=>{if(busyRef.current)throw Error("Wait for the council to finish before syncing notes.");await flush();const latest=current.current;if(!latest||latest.id!==m.id)throw Error("Open this mission before syncing it.");if(expectedNotes&&JSON.stringify(latest.notes)!==JSON.stringify(expectedNotes))throw Error("Your notes changed during sync. Sync again to include the latest edits.");await persistMission({...latest,notes:m.notes});}} onClose={()=>setModal(null)}/></Suspense></Modal>}
    {modal==='vault'&&<Modal title="ThinkVault" onClose={()=>setModal(null)} wide>{mission?<><label className="tool-mission-picker">Mission<select value={mission.id} disabled={busy} onChange={e=>void chooseToolMission(e.target.value)}>{missions.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label><div className="vault-dialog-panel"><Suspense fallback={<p>Opening your notes…</p>}><ToolsPanel tool="vault" mission={mission} onChange={edit} onCommand={async()=>{}} busy={busy} onClose={()=>setModal(null)}/></Suspense></div></>:<div className="workspace-empty"><h3>Your thoughts will live here.</h3><p>Start a mission, then save notes and insights to your vault.</p><button className="primary-button" onClick={()=>{setNewTitle('');setModal('new');}}>Start Mission<ArrowRight size={17}/></button></div>}</Modal>}
    {modal==='sync'&&!mission&&<Modal title="Obsidian Sync" onClose={()=>setModal(null)}><div className="workspace-empty"><h3>Connect your thinking to Obsidian.</h3><p>Create a mission first, then sync or export its notes. Folder sync works in desktop Chrome and Edge; note import and export are available on other devices.</p><button className="primary-button" onClick={()=>{setNewTitle('');setModal('new');}}>Start Mission<ArrowRight size={17}/></button></div></Modal>}
    {detail&&mission&&<Modal title={mission.mascots.find(m=>m.id===detail.mascotId)?.name||'Council contribution'} onClose={()=>setDetail(null)}><span className="pill">{detail.status}</span><h3 className="statement-title">{detail.text}</h3><p className="statement-detail">{detail.detail}</p>{detail.sources.map(s=><a className="source-link" key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowUpRight size={15}/></a>)}<div className="dialog-actions"><button className="secondary-button" onClick={()=>{edit({...mission,notes:[...mission.notes,{id:crypto.randomUUID(),title:detail.text.slice(0,80),content:detail.detail,statementId:detail.id,updatedAt:new Date().toISOString()}]});setNotice('Thought saved to ThinkVault.');setDetail(null);}}><Notebook size={17}/>Save thought</button><button className="primary-button" onClick={()=>{setSelected([detail.mascotId]);setInput('Can you explain or challenge this idea: '+detail.text);setDetail(null);}}><ChatCircleDots size={17}/>Explore further</button></div></Modal>}
    {manage&&mission&&<Modal title={'Get to know '+manage.name} onClose={()=>setManage(null)}><div className="character-profile"><Sprite index={manage.sprite}/><div><span className="pill">Simulated perspective</span><h3>{manage.role}</h3><p>{manage.personality}</p></div></div><label className="field-label">What matters to {manage.name}</label><p>{manage.motivation}</p><label className="field-label" htmlFor="perspective">Perspective</label><input id="perspective" value={manage.role} onChange={e=>setManage({...manage,role:e.target.value})}/><div className="dialog-actions"><button className="primary-button" onClick={()=>{edit({...mission,mascots:mission.mascots.map(m=>m.id===manage.id?manage:m)});setManage(null);}}>Save changes</button>{manage.id!=='buddy'&&<><button className="secondary-button" disabled={busy} onClick={()=>{void command('replace','Find an alternative to '+manage.role+'.',undefined,[manage.id]);setManage(null);}}><ArrowClockwise size={16}/>Replace</button><button className="icon-button" aria-label="Remove buddy" onClick={()=>{edit({...mission,mascots:mission.mascots.filter(m=>m.id!==manage.id)});setSelected(s=>s.filter(x=>x!==manage.id));setManage(null);}}><Trash size={18}/></button></>}</div></Modal>}
  </div>;
}
