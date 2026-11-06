'use client';
import { useEffect, useRef } from 'react';
export default function StarTrail(){
 const layer=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let last=0;const particles=new Set<HTMLElement>();
  const clear=()=>{particles.forEach(p=>p.remove());particles.clear();};
  const move=(event:PointerEvent)=>{if(media.matches||event.pointerType!=='mouse'||performance.now()-last<45||document.hidden)return;last=performance.now();if(particles.size>=24)return;const star=document.createElement('span');star.className='cursor-star';star.style.left=event.clientX+'px';star.style.top=event.clientY+'px';star.style.background=['#ffe34d','#ffffff','#c68cfa'][Math.floor(Math.random()*3)];layer.current?.appendChild(star);particles.add(star);const animation=star.animate([{transform:'translate(-50%,-50%) scale(1) rotate(0deg)',opacity:1},{transform:'translate('+(-20+Math.random()*40)+'px,30px) scale(0) rotate(90deg)',opacity:0}],{duration:650,easing:'ease-out'});animation.onfinish=()=>{star.remove();particles.delete(star);};};
  window.addEventListener('pointermove',move,{passive:true});media.addEventListener('change',clear);return()=>{window.removeEventListener('pointermove',move);media.removeEventListener('change',clear);clear();};
 },[]);
 return <div ref={layer} className="star-trail" aria-hidden="true"/>;
}
