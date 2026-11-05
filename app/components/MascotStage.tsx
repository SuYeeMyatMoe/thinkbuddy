'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { HandWaving } from '@phosphor-icons/react/dist/csr/HandWaving';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { ArrowsOut } from '@phosphor-icons/react/dist/csr/ArrowsOut';
import type { Mascot, Mission, Statement } from '../lib/types';

export function Sprite({index=0,className=''}:{index?:number;className?:string}) {
  return <span aria-hidden="true" className={'sprite '+className} style={{backgroundPosition:(index%3)*50+'% '+Math.floor(index/3)*100+'%'}} />;
}
type Props = {mission:Mission;selected:string[];onSelect:(id:string)=>void;busy:boolean;active:string|null;onDetail:(statement:Statement)=>void;onManage:(mascot:Mascot)=>void};
export default function MascotStage({mission,selected,onSelect,busy,active,onDetail,onManage}:Props) {
  const reduce=useReducedMotion(), stage=useRef<HTMLDivElement>(null);
  const [order,setOrder]=useState<string[]>([]);
  const dragged=useRef<string|null>(null);
  const arranged=[...order.map(id=>mission.mascots.find(m=>m.id===id)).filter((m):m is Mascot=>Boolean(m)),...mission.mascots.filter(m=>!order.includes(m.id))];
  function move(from:string,to:string){const ids=arranged.map(m=>m.id),start=ids.indexOf(from),end=ids.indexOf(to);if(start<0||end<0||start===end)return;ids.splice(end,0,ids.splice(start,1)[0]);setOrder(ids);}
  const [zoom,setZoom]=useState(false),[compact,setCompact]=useState(true);
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
  return <section className={'stage-shell responsive-council '+(zoom?'stage-zoom':'')} aria-label="Your mascot thinking council">
    <div className="stage-top"><span className="stage-badge"><span className={'live-dot '+(busy?'working':'')}/>{busy?'Council is thinking':'Council active'}</span><div className="stage-tools"><button className="icon-button" onClick={()=>setZoom(!zoom)} aria-label={zoom?'Fit council':'Enlarge council'} aria-pressed={zoom}><ArrowsOut size={17} weight="bold"/></button>{!compact&&<button className="icon-button" onClick={()=>setOrder([])} aria-label="Reset character positions"><ArrowCounterClockwise size={17} weight="bold"/></button>}</div></div>
    <div className="stage-scroll"><div className="mascot-stage" ref={stage}>
      <div className="stage-orbit orbit-one"/><div className="stage-orbit orbit-two"/>
      {arranged.map((m,i)=>{
        const s=mission.statements.filter(item=>item.mascotId===m.id).at(-1);
        return <div key={m.id} className={'mascot-position '+(selected.includes(m.id)?'selected ':'')+(active===m.id?'is-speaking':'')} draggable={!compact} onDragStart={e=>{dragged.current=m.id;e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(dragged.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(dragged.current)move(dragged.current,m.id);dragged.current=null;}} onDragEnd={()=>{dragged.current=null;}} style={{'--character':m.color} as React.CSSProperties}>
          <div className="mascot-group">
            {s?<button data-bubble={m.id} className={'speech-bubble '+(active===m.id?'active-bubble':'')} onClick={()=>onDetail(s)} aria-label={m.name+': '+s.text+'. Open explanation'}><span className="bubble-heading"><span className="bubble-dot" style={{background:m.color}}/><span className="bubble-name">{m.name}</span><span className="bubble-cta">Look closer</span></span><span className="bubble-text">{s.text}</span>{active===m.id&&<span className="speaking-bars"><i/><i/><i/></span>}</button>:<span className="mascot-waiting">{busy?'Thinking…':'Ready to listen'}</span>}
            <motion.button className="mascot-body" onClick={()=>onSelect(m.id)} aria-label={(selected.includes(m.id)?'Deselect ':'Select ')+m.name+', '+m.role} aria-pressed={selected.includes(m.id)} onKeyDown={e=>{
              if(e.shiftKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const target=arranged[i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)];if(target)move(m.id,target.id);}
            }} animate={reduce?{}:{y:active===m.id?[0,-5,0]:[0,-2,0]}} transition={{duration:active===m.id?1.4:4+i*.4,repeat:Infinity,ease:[.45,0,.55,1]}}><span className="mascot-ground"/><Sprite index={m.sprite}/>{selected.includes(m.id)&&<span className="selected-check">✓</span>}</motion.button>
            <div className="mascot-name"><button onClick={()=>onSelect(m.id)}><span className="mascot-label">{m.name}</span><span className="mascot-role">{m.role}</span></button><button className="mascot-menu" onClick={()=>onManage(m)} aria-label={'Manage '+m.name}><DotsThree size={19}/></button></div>
          </div>
        </div>;
      })}
    </div></div>
    <div className="stage-caption"><HandWaving size={16} weight="fill"/><span>Different minds. A little more possibility.</span><span className="stage-hint">Select a buddy to talk directly</span></div>
  </section>;
}
