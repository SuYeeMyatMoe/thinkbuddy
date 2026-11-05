'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DotsThree, HandWaving, ArrowCounterClockwise, ArrowsOut } from '@phosphor-icons/react';
import type { Mascot, Mission, Statement } from '../lib/types';

export function Sprite({index=0,className=''}:{index?:number;className?:string}) {
  return <span aria-hidden="true" className={`sprite ${className}`} style={{backgroundPosition:`${(index%3)*50}% ${Math.floor(index/3)*100}%`}} />;
}
const positions = [[35,73],[17,31],[50,28],[83,31],[70,74],[50,74]];
export default function MascotStage({mission,selected,onSelect,busy,active,onDetail,onManage}:{mission:Mission;selected:string[];onSelect:(id:string)=>void;busy:boolean;active:string|null;onDetail:(statement:Statement)=>void;onManage:(mascot:Mascot)=>void}) {
  const reduce=useReducedMotion();
  const stage=useRef<HTMLDivElement>(null);
  const [offsets,setOffsets]=useState<Record<string,{x:number;y:number}>>({});
  const [zoom,setZoom]=useState(false);
  const [bubbleOffsets,setBubbleOffsets]=useState<Record<string,number>>({});
  const latest=(id:string)=>mission.statements.filter(s=>s.mascotId===id).at(-1);
  useEffect(()=>{setOffsets({});},[mission.id]);
  useEffect(()=>{
    const root=stage.current;if(!root)return;
    let raf=0;
    const measure=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const bounds=root.getBoundingClientRect(), rects:DOMRect[]=[];const next:Record<string,number>={};
      const bubbles=[...root.querySelectorAll<HTMLElement>('[data-bubble]')].sort((a,b)=>Number(b.dataset.bubble===active)-Number(a.dataset.bubble===active));
      for(const b of bubbles){const r=b.getBoundingClientRect();let shift=0;for(const prev of rects){if(r.left<prev.right+8&&r.right>prev.left-8&&r.top+shift<prev.bottom+8&&r.bottom+shift>prev.top-8)shift=Math.max(shift,prev.bottom-r.top+10);} if(r.bottom+shift>bounds.bottom-45)shift=0;next[b.dataset.bubble!]=shift;rects.push(new DOMRect(r.x,r.y+shift,r.width,r.height));}
      setBubbleOffsets(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);
    });};
    const observer=new ResizeObserver(measure);observer.observe(root);measure();return()=>{observer.disconnect();cancelAnimationFrame(raf);};
  },[mission.statements.length,mission.mascots.length,active,zoom]);
  return <section className={`stage-shell ${zoom?'stage-zoom':''}`} aria-label="Your mascot thinking council">
    <div className="stage-top"><span className="stage-badge"><span className={`live-dot ${busy?'working':''}`} />{busy?'Council is thinking':'Council active'}</span><div className="stage-tools"><button className="icon-button" onClick={()=>setZoom(!zoom)} aria-label={zoom?'Fit council':'Enlarge council'}><ArrowsOut size={17} weight="bold"/></button><button className="icon-button" onClick={()=>setOffsets({})} aria-label="Reset character positions"><ArrowCounterClockwise size={17} weight="bold"/></button></div></div>
    <div className="stage-scroll"><div className="mascot-stage" ref={stage}>
      <div className="stage-orbit orbit-one"/><div className="stage-orbit orbit-two"/>
      {mission.mascots.map((m,i)=>{const s=latest(m.id);const pos=positions[i]||positions[5];const offset=offsets[m.id]||{x:0,y:0};return <motion.div key={m.id} className={`mascot-position ${selected.includes(m.id)?'selected':''} ${active===m.id?'is-speaking':''}`} style={{left:`${pos[0]}%`,top:`${pos[1]}%`,'--character':m.color} as React.CSSProperties} initial={reduce?false:{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} transition={{type:'spring',stiffness:130,damping:20,delay:i*.07}}>
        <motion.div className="mascot-group" drag dragConstraints={stage} dragElastic={.1} dragMomentum={false} animate={{x:offset.x,y:offset.y}} onDragEnd={(_,info)=>setOffsets(o=>({...o,[m.id]:{x:offset.x+info.offset.x,y:offset.y+info.offset.y}}))}>
          {s&&<button data-bubble={m.id} className={`speech-bubble ${active===m.id?'active-bubble':''}`} style={{marginTop:bubbleOffsets[m.id]||0}} onClick={()=>onDetail(s)} aria-label={`${m.name}: ${s.text}. Open explanation`}><span className="bubble-heading"><span className="bubble-dot" style={{background:m.color}}/><span className="bubble-name">{m.name}</span><span className="bubble-cta">Look closer</span></span><span className="bubble-text">{s.text}</span>{active===m.id&&<span className="speaking-bars"><i/><i/><i/></span>}</button>}
          <motion.button className="mascot-body" onClick={()=>onSelect(m.id)} aria-label={`${selected.includes(m.id)?'Deselect':'Select'} ${m.name}, ${m.role}`} aria-pressed={selected.includes(m.id)} onKeyDown={e=>{if(e.shiftKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setOffsets(o=>({...o,[m.id]:{x:offset.x+(e.key==='ArrowRight'?12:e.key==='ArrowLeft'?-12:0),y:offset.y+(e.key==='ArrowDown'?12:e.key==='ArrowUp'?-12:0)}}));}}} animate={reduce?{}:{y:active===m.id?[0,-6,0]:[0,-2,0],rotate:active===m.id?[0,-2,2,0]:0}} transition={{duration:active===m.id?1.4:4+i*.4,repeat:Infinity,ease:[.45,0,.55,1]}}><span className="mascot-ground"/><Sprite index={m.sprite}/>{selected.includes(m.id)&&<span className="selected-check">✓</span>}</motion.button>
          <div className="mascot-name"><button onClick={()=>onSelect(m.id)}><span className="mascot-label">{m.name}</span><span className="mascot-role">{m.role}</span></button><button className="mascot-menu" onClick={()=>onManage(m)} aria-label={`Manage ${m.name}`}><DotsThree size={19}/></button></div>
        </motion.div>
      </motion.div>;})}
    </div></div>
    <div className="stage-caption"><HandWaving size={16} weight="fill"/><span>Different minds. A little more possibility.</span><span className="stage-hint">Select a buddy to talk directly</span></div>
  </section>;
}
