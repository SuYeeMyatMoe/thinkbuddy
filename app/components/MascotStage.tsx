'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { HandWaving } from '@phosphor-icons/react/dist/csr/HandWaving';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import type { Mascot, Mission, Statement } from '../lib/types';

export function Sprite({index=0,className=''}:{index?:number;className?:string}) {
  return <span aria-hidden="true" className={'sprite '+className} style={{backgroundImage:"url('/council-pixel-v2.png')",backgroundPosition:(index%3)*50+'% '+Math.floor(index/3)*100+'%'}} />;
}
type Props = {mission:Mission;selected:string[];onSelect:(id:string)=>void;busy:boolean;active:string|null;onDetail:(statement:Statement)=>void;onManage:(mascot:Mascot)=>void;onReply?:(mascotId:string)=>void;onUpload?:(mascotId:string)=>void;onEvidence?:(statement:Statement)=>void;progress?:Record<string,string>};
export default function MascotStage({mission,selected,onSelect,busy,active,onDetail,onManage,onReply,onUpload,onEvidence,progress={}}:Props) {
  const reduce=useReducedMotion(), stage=useRef<HTMLDivElement>(null);
  const [presenting,setPresenting]=useState<string|null>(null);
  const seen=useRef(new Set<string>()),presentationTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const statementKey=mission.statements.map(s=>s.id).join('|');
  useEffect(()=>{
    const fresh=mission.statements.filter(s=>!seen.current.has(s.id));
    mission.statements.forEach(s=>seen.current.add(s.id));
    if(!fresh.length)return;
    presentationTimers.current.forEach(clearTimeout);
    const latest=[...new Map(fresh.map(s=>[s.mascotId,s])).values()];
    latest.forEach((s,i)=>presentationTimers.current.push(setTimeout(()=>setPresenting(s.mascotId),i*1800)));
    presentationTimers.current.push(setTimeout(()=>setPresenting(null),latest.length*1800));
  // Only new contribution IDs should trigger a presentation, not saves or note edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[statementKey]);
  useEffect(()=>()=>presentationTimers.current.forEach(clearTimeout),[]);
  function gesture(index:number,speaking:boolean){
    if(reduce)return {};
    if(!speaking)return {y:[0,-2,0]};
    switch(index%6){
      case 0:return {y:[0,-9,0,-5,0],scale:[1,1.06,1],rotate:[0,-3,3,0]};
      case 1:return {rotate:[0,-9,7,-5,0],y:[0,-5,0]};
      case 2:return {rotate:[0,-7,-7,4,0],x:[0,-4,4,0]};
      case 3:return {y:[0,-6,0],rotate:[0,5,0],scale:[1,1.04,1]};
      case 4:return {x:[0,-7,7,0],rotate:[0,4,-4,0]};
      default:return {y:[0,-10,0],rotate:[0,-5,5,0]};
    }
  }
  const [order,setOrder]=useState<string[]>([]);
  const dragged=useRef<string|null>(null);
  const arranged=[...order.map(id=>mission.mascots.find(m=>m.id===id)).filter((m):m is Mascot=>Boolean(m)),...mission.mascots.filter(m=>!order.includes(m.id))];
  function move(from:string,to:string){const ids=arranged.map(m=>m.id),start=ids.indexOf(from),end=ids.indexOf(to);if(start<0||end<0||start===end)return;ids.splice(end,0,ids.splice(start,1)[0]);setOrder(ids);}
  const [zoom,setZoom]=useState(false),[compact,setCompact]=useState(true);
  const [inspection,setInspection]=useState<{id:string;x:number;y:number;width:number;pinned:boolean}|null>(null);
  const closing=useRef<ReturnType<typeof setTimeout>|null>(null);
  const keep=()=>{if(closing.current)clearTimeout(closing.current);};
  const inspect=(id:string,node:HTMLElement,pinned=false)=>{if(inspection?.pinned&&!pinned)return;keep();const box=node.getBoundingClientRect(),viewport=document.documentElement.clientWidth,width=Math.min(370,viewport-24);const beside=box.right+12+width<=viewport-12?box.right+12:box.left-12-width>=12?box.left-12-width:null;setInspection({id,x:beside??Math.max(12,Math.min(box.left,viewport-width-12)),y:Math.max(12,Math.min(beside===null?box.top+45:box.top,window.innerHeight-350)),width,pinned});};
  const leave=()=>{keep();closing.current=setTimeout(()=>setInspection(s=>s?.pinned?s:null),250);};
  useEffect(()=>{if(!inspection)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setInspection(null);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[inspection]);
  useEffect(()=>()=>{if(closing.current)clearTimeout(closing.current);},[]);
  const inspected=mission.mascots.find(m=>m.id===inspection?.id);
  const inspectedStatement=mission.statements.filter(s=>s.mascotId===inspection?.id).at(-1);
  const inspectedQuestion=(mission.questions??[]).find(q=>q.mascotId===inspection?.id&&q.status==='open');
  useEffect(()=>{setOrder([]);dragged.current=null;},[mission.id]);
  useEffect(()=>{
    const root=stage.current;if(!root)return;
    let width=-1;
    const observer=new ResizeObserver(entries=>{
      const next=entries[0].contentRect.width;
      if(Math.abs(next-width)<1)return;
      width=next;setCompact(next<620);
    });
    observer.observe(root);return()=>observer.disconnect();
  },[]);
  return <section className={'stage-shell responsive-council hover-council '+(zoom?'stage-zoom':'')} aria-label="Your mascot thinking council">
    <div className="stage-top"><span className="stage-badge"><span className={'live-dot '+(busy?'working':'')}/>{busy?'Council is thinking':'Council active'}</span><div className="stage-tools"><button className="icon-button" onClick={()=>setZoom(!zoom)} aria-label={zoom?'Fit council':'Enlarge council'} aria-pressed={zoom}><ArrowsOut size={17} weight="bold"/></button>{!compact&&<button className="icon-button" onClick={()=>setOrder([])} aria-label="Reset character positions"><ArrowCounterClockwise size={17} weight="bold"/></button>}</div></div>
    <div className="stage-scroll"><div className="mascot-stage" ref={stage}>
      <div className="council-cloud cloud-one" aria-hidden="true"/><div className="council-cloud cloud-two" aria-hidden="true"/><div className="council-cloud cloud-three" aria-hidden="true"/><div className="stage-orbit orbit-one"/><div className="stage-orbit orbit-two"/>
      {arranged.map((m,i)=>{
        const s=mission.statements.filter(item=>item.mascotId===m.id).at(-1);
        const speaking=active===m.id||presenting===m.id;
        return <div key={m.id} className={'mascot-position '+(selected.includes(m.id)?'selected ':'')+(speaking?'is-speaking':'')} draggable={!compact} onDragStart={e=>{dragged.current=m.id;e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(dragged.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(dragged.current)move(dragged.current,m.id);dragged.current=null;}} onDragEnd={()=>{dragged.current=null;}} style={{'--character':m.color} as React.CSSProperties}>
          <div className="mascot-group">
            {s?<button data-bubble={m.id} className={'speech-bubble '+(speaking?'active-bubble':'')} onPointerEnter={e=>{if(e.pointerType==="mouse")inspect(m.id,e.currentTarget);}} onPointerLeave={leave} onFocus={e=>inspect(m.id,e.currentTarget)} onBlur={leave} onClick={e=>{if(onReply)inspect(m.id,e.currentTarget,true);else onDetail(s);}} aria-label={m.name+': '+s.text+'. Open explanation'} aria-expanded={inspection?.id===m.id}><span className="bubble-heading"><span className="bubble-dot" style={{background:m.color}}/><span className="bubble-name">{m.name}</span><span className="bubble-cta">Details</span></span><span className="bubble-text">{s.text}</span>{speaking&&<span className="speaking-bars"><i/><i/><i/></span>}</button>:<span className="mascot-waiting">{progress[m.id]||(busy?'Thinking…':'Ready to listen')}</span>}
            <motion.button className="mascot-body" onClick={()=>{setInspection(null);onSelect(m.id);}} aria-label={(selected.includes(m.id)?'Deselect ':'Select ')+m.name+', '+m.role} aria-pressed={selected.includes(m.id)} onKeyDown={e=>{
              if(e.shiftKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const target=arranged[i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)];if(target)move(m.id,target.id);}
            }} animate={gesture(m.sprite,speaking)} whileHover={reduce?{}:{scale:1.07}} whileTap={reduce?{}:{scale:.97}} transition={{duration:speaking?1.5:4+i*.4,repeat:Infinity,ease:[.45,0,.55,1]}}><span className="mascot-ground"/><Sprite index={m.sprite}/>{selected.includes(m.id)&&<span className="selected-check">✓</span>}</motion.button>
            <div className="mascot-name"><button onClick={()=>{setInspection(null);onSelect(m.id);}}><span className="mascot-label">{m.name}</span><span className="mascot-role">{progress[m.id]||m.role}</span></button><button className="mascot-menu" disabled={busy} onClick={()=>onManage(m)} aria-label={'Manage '+m.name}><DotsThree size={19}/></button></div>
            {(mission.questions??[]).some(q=>q.mascotId===m.id&&q.status==='open')&&onReply&&<button className="mascot-question-reply" onClick={()=>onReply(m.id)}>Has a question · Reply</button>}
          </div>
        </div>;
      })}
    </div></div>
    <div className="stage-caption"><HandWaving size={16} weight="fill"/><span>Select a speech card for the explanation.</span><span className="stage-hint">Select a buddy to talk directly</span></div>
    {inspection&&inspected&&createPortal(<aside className="mascot-inspector" role="dialog" aria-label={inspected.name+' details'} style={{left:inspection.x,top:inspection.y,width:inspection.width,maxHeight:`calc(100dvh - ${inspection.y}px - 12px)`}} onPointerEnter={keep} onPointerLeave={leave} onFocus={keep} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)&&!inspection.pinned)setInspection(null);}}>
      <header><span><strong>{inspected.name}</strong><small>{inspected.role}</small></span><button onClick={()=>setInspection(null)} aria-label="Close mascot details">×</button></header>
      <div className="mascot-inspector-body">{inspectedStatement?<><span className="evidence-label">{inspectedStatement.status}</span><h4>{inspectedStatement.text}</h4><p>{inspectedStatement.detail}</p>{inspectedStatement.evidenceReview&&<p><strong>Evidence review:</strong> {inspectedStatement.evidenceReview.explanation}</p>}{inspectedStatement.sources.map((source,i)=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">[{i+1}] {source.title} ↗</a>)}</>:<p>{inspected.motivation}</p>}{inspectedQuestion&&<div className="inspector-question"><strong>A question for you</strong><p>{inspectedQuestion.text}</p></div>}</div>
      <footer>{onReply&&<button onClick={()=>{setInspection(null);onReply(inspected.id);}}>Reply to {inspected.name}</button>}{onUpload&&<button onClick={()=>{setInspection(null);onUpload(inspected.id);}}>Upload answer</button>}{onEvidence&&inspectedStatement&&<button onClick={()=>{setInspection(null);onEvidence(inspectedStatement);}}>View evidence</button>}</footer>
    </aside>,document.body)}
  </section>;
}
