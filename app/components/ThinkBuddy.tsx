'use client';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Plus, ClockCounterClockwise, CaretRight, CaretDown, Graph, ShieldCheck, Flask, Notebook, Path, Microphone, Stop, Sparkle, X, Play, Pause, Sun, Moon, CloudCheck, Trash, ArrowClockwise, ChatCircleDots, Lightbulb, Check, PencilSimple, Leaf, SignOut, House, Target, Database, FileCode, List, PaperPlaneRight, Lightning } from '@phosphor-icons/react';
import { createDemoMission } from '../lib/demo';
import type { CouncilRequest, Mascot, Mission, Statement, Tool } from '../lib/types';
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

export default function ThinkBuddy({userName}:{userName:string}){
  const [mission,setMission]=useState<Mission|null>(null),[missions,setMissions]=useState<Mission[]>([]);
  const [live,setLive]=useState(false),[tool,setTool]=useState<Tool|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[active,setActive]=useState<string|null>(null);
  const [error,setError]=useState(''),[saveStatus,setSaveStatus]=useState('Loading workspace');
  const [modal,setModal]=useState<'new'|'history'|'saved'|'settings'|'sync'|null>(null),[newTitle,setNewTitle]=useState('');
  const [detail,setDetail]=useState<Statement|null>(null),[manage,setManage]=useState<Mascot|null>(null),[sidebar,setSidebar]=useState(false);
  const [theme,setTheme]=useState<'system'|'light'|'dark'>('light'),[recording,setRecording]=useState(false),[voiceBusy,setVoiceBusy]=useState(false),[paused,setPaused]=useState(false);
  const current=useRef<Mission|null>(null),abort=useRef<AbortController|null>(null),saveQueue=useRef<Promise<void>>(Promise.resolve());
  const debounce=useRef<ReturnType<typeof setTimeout>|null>(null),recorder=useRef<MediaRecorder|null>(null),voiceTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const playback=useRef<ReturnType<typeof setTimeout>[]>([]),dirty=useRef(false);
  const [notice,setNotice]=useState('');
  const [syncMounted,setSyncMounted]=useState(false);
  useEffect(()=>{if(modal==='sync')setSyncMounted(true);},[modal]);
  useEffect(()=>{current.current=mission;},[mission]);
  useEffect(()=>{const t=localStorage.getItem('thinkbuddy-theme-v2');if(t==='dark'||t==='light'||t==='system')setTheme(t);},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  const chooseTheme=(t:'system'|'light'|'dark')=>{setTheme(t);localStorage.setItem('thinkbuddy-theme-v2',t);};
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
  const save=useCallback(async(next:Mission)=>{
    dirty.current=true;
    const task=async()=>{
      setSaveStatus('Saving');
      try{
        const old=current.current?.id===next.id?current.current:null,revision=Math.max(next.revision,old?.revision??0);
        const result=await jsonRequest('/api/missions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mission:{...next,revision},expectedRevision:revision})});
        const saved=result.mission as Mission;
        if(current.current?.id===saved.id){const updated={...current.current,revision:saved.revision};current.current=updated;setMission(updated);}
        setMissions(all=>[saved,...all.filter(m=>m.id!==saved.id)]);setSaveStatus('All changes saved');dirty.current=false;
      }catch(e){setSaveStatus('Not saved');setError(e instanceof Error?e.message:'Could not save your mission.');throw e;}
    };
    const queued=saveQueue.current.then(task,task);saveQueue.current=queued.catch(()=>{});return queued;
  },[]);
  const edit=useCallback((next:Mission)=>{const updated={...next,updatedAt:new Date().toISOString()};current.current=updated;setMission(updated);dirty.current=true;setSaveStatus('Unsaved changes');if(debounce.current)clearTimeout(debounce.current);debounce.current=setTimeout(()=>{debounce.current=null;void save(updated).catch(()=>{});},700);},[save]);
  const flush=useCallback(async()=>{if(debounce.current){clearTimeout(debounce.current);debounce.current=null;if(current.current)await save(current.current);}await saveQueue.current;},[save]);
  useEffect(()=>{
    let disposed=false;
    Promise.all([jsonRequest('/api/missions'),jsonRequest('/api/config')]).then(async([data,config])=>{
      if(disposed)return;setLive(config.live);setMissions(data.missions);const m=data.missions[0]||createDemoMission();setMission(m);current.current=m;setSaveStatus(data.missions.length?'All changes saved':'Sample mission');
      if(!data.missions.length)await save(m);
    }).catch(e=>{if(!disposed){setError(e.message);setSaveStatus('Workspace unavailable');}});
    return()=>{disposed=true;abort.current?.abort();playback.current.forEach(clearTimeout);if(debounce.current)clearTimeout(debounce.current);if(voiceTimer.current)clearTimeout(voiceTimer.current);recorder.current?.stream.getTracks().forEach(t=>t.stop());};
  },[save]);
  useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
  const highlight=(next:Mission)=>{playback.current.forEach(clearTimeout);next.mascots.forEach((m,i)=>playback.current.push(setTimeout(()=>setActive(m.id),i*2000)));playback.current.push(setTimeout(()=>setActive(null),next.mascots.length*2000));};
  async function command(action:CouncilRequest['action'],prompt='',base?:Mission,ids?:string[]){
    if(busy)return;const source=base||current.current;if(!source)return;setBusy(true);setError('');setPaused(false);abort.current=new AbortController();
    try{
      await flush();const fresh=base||current.current!;
      const response=await fetch('/api/council',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action,mission:fresh,prompt,mascotIds:ids||selected}),signal:abort.current.signal});
      if(!response.ok){const e=await response.json() as {error?:string};throw new Error(e.error||'The council could not respond.');}
      const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='',result:Mission|null=null;
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const event=frame.split('\n').find(l=>l.startsWith('event: '))?.slice(7);const payload=frame.split('\n').find(l=>l.startsWith('data: '))?.slice(6);if(!payload)continue;const data=JSON.parse(payload);if(event==='error')throw new Error(data.error);if(event==='statement')setActive(data.mascotId);if(event==='complete')result=data.mission;}}
      if(!result)throw new Error('The response was interrupted. Your saved mission is safe.');
      current.current=result;setMission(result);setInput('');await save(result);highlight(result);
    }catch(e){if(e instanceof Error&&e.name==='AbortError'){setPaused(true);setNotice('Discussion paused. Your previous thoughts are saved.');}else setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);abort.current=null;}
  }
  async function newMission(title:string){if(!title.trim())return;await flush();const next=createDemoMission(title.trim());next.statements=[];next.nodes=[];next.edges=[];next.round=0;setModal(null);setSelected([]);setTool(null);current.current=next;setMission(next);await command('generate','',next);}
  async function openMission(m:Mission){await flush();playback.current.forEach(clearTimeout);setActive(null);setMission(m);current.current=m;setSelected([]);setModal(null);setSidebar(false);setTool(null);}
  async function startRecording(){
    if(recording){recorder.current?.stop();return;}
    if(!live){setError('Voice transcription needs an OpenAI API key. You can type your question in demo mode.');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(stream);recorder.current=r;const chunks:BlobPart[]=[];
      r.ondataavailable=e=>chunks.push(e.data);r.onstop=async()=>{setRecording(false);stream.getTracks().forEach(t=>t.stop());if(voiceTimer.current)clearTimeout(voiceTimer.current);setVoiceBusy(true);try{const form=new FormData();form.append('audio',new Blob(chunks,{type:r.mimeType}),'question.webm');const data=await jsonRequest('/api/transcribe',{method:'POST',body:form});setInput(data.text);setNotice('Review your transcription, then send it.');}catch(e){setError((e as Error).message);}finally{setVoiceBusy(false);}};r.start();setRecording(true);voiceTimer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},60000);
    }catch{setError('Microphone access was unavailable. Check browser permissions or type your question.');}
  }
  const toggleSelected=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const selectedNames=mission?.mascots.filter(m=>selected.includes(m.id)).map(m=>m.name).join(' & ');
  const currentModeLimit=mission?{Quick:1,Standard:2,Deep:3}[mission.mode]:2;
  return <div className="app-shell">
    <div className="navbar-wrap">
      <nav className="navbar" aria-label="Main">
        <a className="brand" href="/" aria-label="ThinkBuddy home"><span className="brand-icon"><Sprite index={0}/></span><span className="brand-name">ThinkBuddy</span></a>
        <div className={'nav-links '+(sidebar?'is-open':'')}>
          <button className={!modal&&!tool?'nav-active':''} onClick={()=>{setTool(null);setModal(null);setSidebar(false);}}><House size={18} weight="bold"/>Home</button>
          <button className={modal==='new'?'nav-active':''} onClick={()=>{setNewTitle('');setModal('new');setSidebar(false);}} disabled={busy}><Target size={18} weight="bold"/>New Mission</button>
          <button className={modal==='saved'?'nav-active':''} onClick={()=>{setModal('saved');setSidebar(false);}}><ClockCounterClockwise size={18} weight="bold"/>Saved<span className="count">{missions.length}</span></button>
          <button className={!modal&&tool==='vault'?'nav-active':''} onClick={()=>{setTool('vault');setModal(null);setSidebar(false);}}><Database size={18} weight="bold"/>ThinkVault</button>
          <button className={modal==='sync'?'nav-active':''} onClick={()=>{setModal('sync');setSidebar(false);}}><FileCode size={18} weight="bold"/>Obsidian Sync</button>
        </div>
        <div className="nav-actions">
          <span className="save-status"><CloudCheck size={16} weight="bold"/>{saveStatus}</span>
          <button className="icon-button nav-icon" onClick={()=>chooseTheme(theme==='dark'?'light':'dark')} aria-label="Toggle color theme">{theme==='dark'?<Sun size={19} weight="bold"/>:<Moon size={19} weight="bold"/>}</button>
          <button className="avatar" onClick={()=>{setModal('settings');setSidebar(false);}} aria-label="Settings and help" title="Settings and help">{userName[0]?.toUpperCase()}</button>
          <button className="icon-button nav-icon menu-button" onClick={()=>setSidebar(!sidebar)} aria-label="Toggle navigation" aria-expanded={sidebar}>{sidebar?<X size={20} weight="bold"/>:<List size={20} weight="bold"/>}</button>
        </div>
      </nav>
    </div>
    {sidebar&&<button className="nav-scrim" onClick={()=>setSidebar(false)} aria-label="Close navigation"/>}
    <main className="workspace">
      <header className="hero">
        <h1 className="hero-title">THINKBUDDY</h1>
        <p className="hero-tagline">One Question. Many Perspectives. Better Thinking.</p>
      </header>
      <div className="workspace-content">
      {!live&&<div className="demo-notice"><span className="demo-chip"><Sparkle size={13} weight="fill"/>Demo</span><span>You’re exploring a sample council. Add your API key in settings to bring your own questions to life.</span><button onClick={()=>setModal('settings')}>Setup <ArrowUpRight size={13} weight="bold"/></button></div>}
      {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><X size={17} weight="bold"/></button></div>}
      {!mission?<div className="workspace-loading"><div className="skeleton-line"/><div className="skeleton-stage"/><p>{error?'Your workspace could not load. Refresh to retry.':'Making a little room for your ideas…'}</p></div>:<>
        <section className="mission-card">
          <span className="mission-symbol"><Target size={34} weight="bold"/></span>
          <div className="mission-text"><span className="mission-eyebrow">Current Mission</span><h2 title={mission.title}>“{mission.title}”</h2></div>
          <button className="brutal-button mission-edit" onClick={()=>{setNewTitle(mission.title);setModal('new');}} disabled={busy} aria-label="Start a revised mission"><PencilSimple size={16} weight="bold"/><span>Edit Mission</span></button>
        </section>
        <div className="mobile-tool-nav">{toolItems.map(t=><button key={t.id} onClick={()=>setTool(t.id)} aria-label={t.name}><span className={'mini-icon tone-'+t.color}><t.icon size={15} weight="bold"/></span>{t.name}</button>)}</div>
        <div className="council-layout"><div className="council-column">
          <div className="section-heading council-toolbar"><div className="council-heading"><h3><span className="heading-dot"/>The Council</h3><span className="buddy-count">{mission.mascots.length} buddies</span>{live&&<span className="mode-badge live-mode"><span/>Live AI</span>}</div><div className="council-controls"><label className="mode-select"><span className="sr-only">Discussion depth</span><select disabled={busy} value={mission.mode} onChange={e=>edit({...mission,mode:e.target.value as Mission['mode']})}><option>Quick</option><option>Standard</option><option>Deep</option></select><CaretDown size={12} weight="bold"/></label><button className="brutal-button small-button" disabled={busy||mission.mascots.length>=6} onClick={()=>{const extra:Mascot={id:crypto.randomUUID(),name:'New perspective',role:'Fresh viewpoint',personality:'Curious and independent',motivation:'Find a missing perspective',color:'#C99681',sprite:mission.mascots.length};void command('replace','Add a relevant perspective we have not considered.',{...mission,mascots:[...mission.mascots,extra]},[extra.id]);}}><Plus size={15} weight="bold"/>Invite buddy</button></div></div>
          <MascotStage mission={mission} selected={selected} onSelect={toggleSelected} busy={busy} active={active} onDetail={setDetail} onManage={setManage}/>
          <div className="quick-actions"><button className="chip chip-yellow" disabled={busy} onClick={()=>void command('turn','What assumption should we question?')}><Lightning size={16} weight="bold"/>Challenge an assumption</button><button className="chip chip-cyan" disabled={busy} onClick={()=>void command('turn',selected.length>1?'Compare your perspectives and explore a meaningful disagreement.':'Offer a different perspective on our mission.')}><ChatCircleDots size={16} weight="bold"/>{selected.length>1?'Start a debate':'Another perspective'}</button><button className="chip chip-mint" disabled={busy} onClick={()=>setTool('vault')}><Notebook size={16} weight="bold"/>Capture a thought</button></div>
          <div className="participation"><div className="composer-context"><span><Sprite index={0}/>{selectedNames?'Talking with '+selectedNames:'What’s on your mind?'}</span>{selected.length>0?<button onClick={()=>setSelected([])}>Talk to everyone <X size={12} weight="bold"/></button>:<span className="enter-hint">Enter to send</span>}</div><form className="composer-row" onSubmit={e=>{e.preventDefault();if(input.trim())void command('turn',input);}}><button type="button" className={'voice-button '+(recording?'recording':'')} disabled={busy||voiceBusy} onClick={()=>void startRecording()} aria-label={recording?'Stop recording':'Record a voice question'} title={recording?'Stop recording':'Use your voice'}>{recording?<Stop size={22} weight="fill"/>:<Microphone size={22} weight="bold"/>}{(recording||voiceBusy)&&<span>{recording?'Stop':'Transcribing…'}</span>}</button><label className="sr-only" htmlFor="question">Your question to the council</label><textarea id="question" rows={1} value={input} onChange={e=>setInput(e.target.value)} placeholder={selectedNames?'Ask '+selectedNames+' a question…':'Ask the council, challenge a point, or add evidence…'} disabled={busy} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(input.trim())void command('turn',input);}}}/><button className="send-button" type="submit" disabled={busy||!input.trim()} aria-label="Send to council"><PaperPlaneRight size={22} weight="fill"/></button></form></div>
          <div className="discussion-footer"><button className="text-button" onClick={()=>setModal('history')}><ClockCounterClockwise size={16} weight="bold"/>Discussion history <span>{mission.statements.length}</span></button><span className="round-pill">Round {mission.round}</span>{busy?<button className="brutal-button small-button" onClick={()=>abort.current?.abort()}><Pause size={15} weight="fill"/>Pause</button>:<button className="brutal-button small-button" onClick={()=>{if(mission.round>=currentModeLimit&&!mission.reflection){setTool('path');setNotice('Take a moment to reflect before another round.');}else void command('turn','Continue the discussion with new insights.');}}><Play size={14} weight="fill"/>{paused?'Resume':'Next round'}</button>}</div>
        </div>
        <aside className={'thinking-space '+(tool?'tool-open':'')}>{tool?<><div className="tool-tabs">{toolItems.map(t=><button key={t.id} className={t.id===tool?'active':''} onClick={()=>setTool(t.id)} aria-label={t.name} title={t.name}><t.icon size={19} weight="bold"/></button>)}</div><Suspense fallback={<div className="skeleton-stage"/>}><ToolsPanel tool={tool} mission={mission} onChange={edit} onCommand={async(action,prompt)=>{await command(action,prompt);}} busy={busy} onClose={()=>setTool(null)}/></Suspense></>:<><div className="section-heading"><h3><span className="heading-dot"/>Thinking Tools</h3></div><div className="tool-launchers">{toolItems.map(t=><button className="tool-launcher" key={t.id} onClick={()=>setTool(t.id)}><span className={'tool-icon tone-'+t.color}><t.icon size={24} weight="bold"/></span><span><strong>{t.name}</strong><small>{t.description}</small></span><CaretRight size={16} weight="bold"/></button>)}</div><div className="reflection-card"><div className="reflection-top"><span className="reflection-icon"><Lightbulb size={22} weight="fill"/></span><span className="small-label">A moment to reflect</span></div><h4>What’s one thing you hadn’t considered?</h4><p>The best insight might be the one that changes your question.</p><button onClick={()=>setTool('path')}>Save your reflection <ArrowUpRight size={16} weight="bold"/></button></div><div className="human-note"><ShieldCheck size={20} weight="fill"/><p>AI brings perspectives. <strong>You make the call.</strong></p></div></>}</aside>
        </div>
      </>}
      <footer className="workspace-footer"><span>ThinkBuddy · A little company for big ideas</span><span>Made for curious minds <Leaf size={13} weight="fill"/></span></footer></div>
    </main>
    {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
    {modal==='new'&&<Modal title="What would you like to think about?" onClose={()=>setModal(null)}><p className="dialog-intro">A decision, a big idea, or a small everyday question. Your council will meet you there.</p><form onSubmit={e=>{e.preventDefault();void newMission(newTitle);}}><label className="field-label" htmlFor="mission-title">Your mission</label><textarea autoFocus id="mission-title" rows={4} maxLength={1000} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="I’ve been wondering…" required/><button className="primary-button full-width" disabled={!newTitle.trim()||busy}>Gather my council <ArrowRight size={18}/></button></form><span className="field-label examples-label">Or start with a little inspiration</span><div className="examples">{examples.map(e=><button key={e} onClick={()=>setNewTitle(e)}>{e}<ArrowUpRight size={14}/></button>)}</div></Modal>}
    {modal==='saved'&&<Modal title="Your saved missions" onClose={()=>setModal(null)}><p className="dialog-intro">Pick up a thought where you left it.</p><div className="saved-list">{missions.map(m=><div key={m.id}><button onClick={()=>void openMission(m)}><strong>{m.title}</strong><small>{new Date(m.updatedAt).toLocaleDateString()} · {m.statements.length} contributions</small></button><button className="icon-button" aria-label={'Delete '+m.title} onClick={async()=>{if(!confirm('Delete this mission and its saved thinking? This cannot be undone.'))return;try{await jsonRequest('/api/missions?id='+encodeURIComponent(m.id),{method:'DELETE'});setMissions(all=>all.filter(x=>x.id!==m.id));if(current.current?.id===m.id){const next=missions.find(x=>x.id!==m.id)||createDemoMission();setMission(next);current.current=next;}setNotice('Mission deleted.');}catch(e){setError((e as Error).message);}}}><Trash size={17}/></button></div>)}</div></Modal>}
    {modal==='history'&&mission&&<Modal title="The thinking journey" onClose={()=>setModal(null)} wide><p className="dialog-intro">Every perspective, in the order it arrived. Select a contribution to look closer.</p><div className="history-list">{mission.statements.map(s=>{const m=mission.mascots.find(m=>m.id===s.mascotId);return <button key={s.id} onClick={()=>{setModal(null);setDetail(s);}}><Sprite index={m?.sprite||0}/><span><strong>{m?.name||'Former council member'}<small>{s.status}</small></strong><span>{s.text}</span></span></button>;})}</div></Modal>}
    {modal==='settings'&&<Modal title="Make yourself at home" onClose={()=>setModal(null)}><section className="settings-section"><h3>Appearance</h3><div className="theme-choices">{(['system','light','dark'] as const).map(t=><button className={theme===t?'chosen':''} onClick={()=>chooseTheme(t)} key={t}>{t}</button>)}</div></section><section className="settings-section"><h3>OpenAI connection <span className="pill">{live?'Connected':'Not configured'}</span></h3><p>{live?'Your key is stored securely on the server.':'The workspace is in demo mode. Add OPENAI_API_KEY as a secret in the Site’s environment settings, then redeploy to enable live discussions, evidence retrieval, and transcription.'}</p><p>Your key is never entered into this page or stored in the browser.</p></section><section className="settings-section"><h3>About your council</h3><p>Your buddies are simulated AI perspectives, not real people or verified professionals. Their ideas are starting points for your judgment. Sources and uncertainty stay visible.</p><p>Reduced motion follows your device preference. Use Shift + arrow keys on a character to reposition it.</p></section><a className="text-button signout" href="/signout-with-chatgpt?return_to=%2F" target="_top"><SignOut size={17}/>Sign out</a></Modal>}
    {syncMounted&&mission&&<Modal open={modal==='sync'} title="Your ideas, connected" onClose={()=>setModal(null)} wide><Suspense fallback={<p>Opening your vault tools…</p>}><SyncPanel mission={mission} onSave={async m=>{current.current=m;setMission(m);await save(m);}} onClose={()=>setModal(null)}/></Suspense></Modal>}
    {detail&&mission&&<Modal title={mission.mascots.find(m=>m.id===detail.mascotId)?.name||'Council contribution'} onClose={()=>setDetail(null)}><span className="pill">{detail.status}</span><h3 className="statement-title">{detail.text}</h3><p className="statement-detail">{detail.detail}</p>{detail.sources.map(s=><a className="source-link" key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowUpRight size={15}/></a>)}<div className="dialog-actions"><button className="secondary-button" onClick={()=>{edit({...mission,notes:[...mission.notes,{id:crypto.randomUUID(),title:detail.text.slice(0,80),content:detail.detail,statementId:detail.id,updatedAt:new Date().toISOString()}]});setNotice('Thought saved to ThinkVault.');setDetail(null);}}><Notebook size={17}/>Save thought</button><button className="primary-button" onClick={()=>{setSelected([detail.mascotId]);setInput('Can you explain or challenge this idea: '+detail.text);setDetail(null);}}><ChatCircleDots size={17}/>Explore further</button></div></Modal>}
    {manage&&mission&&<Modal title={'Get to know '+manage.name} onClose={()=>setManage(null)}><div className="character-profile"><Sprite index={manage.sprite}/><div><span className="pill">Simulated perspective</span><h3>{manage.role}</h3><p>{manage.personality}</p></div></div><label className="field-label">What matters to {manage.name}</label><p>{manage.motivation}</p><label className="field-label" htmlFor="perspective">Perspective</label><input id="perspective" value={manage.role} onChange={e=>setManage({...manage,role:e.target.value})}/><div className="dialog-actions"><button className="primary-button" onClick={()=>{edit({...mission,mascots:mission.mascots.map(m=>m.id===manage.id?manage:m)});setManage(null);}}>Save changes</button>{manage.id!=='buddy'&&<><button className="secondary-button" disabled={busy} onClick={()=>{void command('replace','Find an alternative to '+manage.role+'.',undefined,[manage.id]);setManage(null);}}><ArrowClockwise size={16}/>Replace</button><button className="icon-button" aria-label="Remove buddy" onClick={()=>{edit({...mission,mascots:mission.mascots.filter(m=>m.id!==manage.id)});setSelected(s=>s.filter(x=>x!==manage.id));setManage(null);}}><Trash size={18}/></button></>}</div></Modal>}
  </div>;
}
