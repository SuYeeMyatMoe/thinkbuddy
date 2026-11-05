import type {Mission,Note,MapNode} from './types';
export function captureMapIdea(mission:Mission,nodeId:string):{mission:Mission;noteId:string}{
  const node=mission.nodes.find(n=>n.id===nodeId);if(!node)throw Error('Choose an idea on the map first.');
  const existing=mission.notes.find(n=>n.id===node.noteId||(node.statementId&&n.statementId===node.statementId));
  if(existing)return {mission:{...mission,nodes:mission.nodes.map(n=>n.id===node.id?{...n,noteId:existing.id}:n)},noteId:existing.id};
  if(mission.notes.length>=500)throw Error('This mission has reached its note limit. Export or remove a note before adding another.');
  const statement=mission.statements.find(s=>s.id===node.statementId),stamp=new Date().toISOString();
  const content=[`# ${node.label}`,'',statement?.detail??node.label,...(statement?['',`Evidence status: ${statement.status}`]:[]),...(statement?.sources.length?['','## Sources',...statement.sources.map(s=>`- [${s.title.replace(/[\[\]]/g,'')}](${encodeURI(s.url).replace(/[()]/g,encodeURIComponent)})`)]:[])].join('\n');
  const note:Note={id:crypto.randomUUID(),title:node.label.slice(0,200),content,theme:'Map insights',origin:'user',updatedAt:stamp,...(node.statementId?{statementId:node.statementId}:{})};
  return {mission:{...mission,notes:[...mission.notes,note],nodes:mission.nodes.map(n=>n.id===node.id?{...n,noteId:note.id}:n)},noteId:note.id};
}
export function putNoteOnMap(mission:Mission,noteId:string):Mission{
  const note=mission.notes.find(n=>n.id===noteId);if(!note)throw Error('Choose a note first.');
  if(mission.nodes.some(n=>n.noteId===note.id))return mission;
  if(mission.nodes.length>=1000)throw Error('This mission has reached its map limit.');
  const nodes=[...mission.nodes];if(!nodes.some(n=>n.id==='mission'))nodes.unshift({id:'mission',label:mission.title,x:260,y:10,type:'mission'});
  const id=crypto.randomUUID();const node:MapNode={id,label:note.title,x:50+(nodes.length%3)*260,y:140+Math.floor(nodes.length/3)*170,type:'note',noteId:note.id,...(note.statementId?{statementId:note.statementId}:{})};
  return {...mission,nodes:[...nodes,node],edges:[...mission.edges,{id:crypto.randomUUID(),source:'mission',target:id,label:'Note'}]};
}
