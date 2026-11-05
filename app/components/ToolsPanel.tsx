'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { CheckSquare } from '@phosphor-icons/react/dist/csr/CheckSquare';
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { Flask } from '@phosphor-icons/react/dist/csr/Flask';
import { GitBranch } from '@phosphor-icons/react/dist/csr/GitBranch';
import { LinkSimple } from '@phosphor-icons/react/dist/csr/LinkSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Background, Controls, ReactFlow, useNodesState, type Connection, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ActionItem, Mission, Note, Tool } from '../lib/types';
import './tools.css';
import {captureMapIdea} from '../lib/knowledge';

export interface ToolsPanelProps {
  tool: Tool;
  mission: Mission;
  onChange: (mission: Mission) => void;
  onCommand: (action: 'evidence' | 'scenario' | 'plan', prompt?: string) => Promise<void>;
  busy: boolean;
  onClose: () => void;
}

const titles = {
  map: { name: 'ThinkMap', description: 'See how your ideas connect.', icon: GitBranch },
  evidence: { name: 'Evidence Guardian', description: 'A little curiosity. A closer look.', icon: ShieldCheck },
  lab: { name: 'ThinkLab', description: 'Change an assumption. Explore a possibility.', icon: Flask },
  vault: { name: 'ThinkVault', description: 'Good thinking, kept close.', icon: FloppyDisk },
  path: { name: 'ThinkPath', description: 'Your next steps, on your terms.', icon: CheckSquare },
};

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="tp-empty"><span className="tp-empty-mark"><Plus size={22} weight="light" /></span><p>{children}</p></div>;
}

function mapNodes(mission: Mission): Node[] {
  return mission.nodes.map(node => ({ id: node.id, position: { x: node.x, y: node.y }, data: { label: node.label }, deletable:node.id!=='mission', className: `tp-map-node tp-map-${node.type}`, style: { borderRadius: 10, padding: '12px 15px', fontSize: 12, width: 160 } }));
}

export function ThinkingMap({ mission, onChange, busy=false, onOpenNote }: Pick<ToolsPanelProps, 'mission' | 'onChange'> & {busy?:boolean;onOpenNote?:(id:string)=>void}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(mapNodes(mission));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [relationship, setRelationship] = useState('Supports');
  const [mapMessage,setMapMessage]=useState('');
  useEffect(() => { setNodes(mapNodes(mission)); }, [mission.nodes, setNodes]);
  const selected = mission.nodes.find(n => n.id === selectedId);
  const statement = mission.statements.find(s => s.id === selected?.statementId);
  const linkedNote=mission.notes.find(n=>n.id===selected?.noteId);
  const connect = (connection: Connection) => {
    if (busy || !connection.source || !connection.target || connection.source === connection.target) return;
    if (mission.edges.some(e => e.source === connection.source && e.target === connection.target && e.label === relationship)) return;
    onChange({ ...mission, edges: [...mission.edges, { id: crypto.randomUUID(), source: connection.source, target: connection.target, label: relationship }] });
  };
  function addNode(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !label.trim()) return;
    const id = crypto.randomUUID();
    onChange({ ...mission, nodes: [...mission.nodes, { id, label: label.trim(), x: 50 + mission.nodes.length % 2 * 190, y: 80 + Math.floor(mission.nodes.length / 2) * 100, type: 'idea' }] });
    setLabel(''); setSelectedId(id);
  }
  return <>
    <div className="tp-map" aria-label="Interactive thinking map">
      <ReactFlow nodesDraggable={!busy} nodesConnectable={!busy} elementsSelectable={!busy} nodes={nodes} edges={mission.edges.map(e => ({ ...e, type: 'smoothstep', style: { stroke: 'var(--text)', strokeWidth: 2 }, labelStyle: { fontSize: 10, fontWeight: 700, fill: 'var(--text)' } }))} onNodesChange={onNodesChange} onSelectionChange={({nodes:selected})=>{if(selected.length===1)setSelectedId(selected[0].id);}} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} onNodeDragStop={(_, node) => onChange({ ...mission, nodes: mission.nodes.map(n => n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n) })} onNodesDelete={removed => { const ids = new Set(removed.map(n => n.id)); onChange({ ...mission, nodes: mission.nodes.filter(n => !ids.has(n.id)), edges: mission.edges.filter(e => !ids.has(e.source) && !ids.has(e.target)) }); }} onEdgesDelete={removed => onChange({ ...mission, edges: mission.edges.filter(e => !removed.some(r => r.id === e.id)) })} fitView minZoom={0.15} maxZoom={2} deleteKeyCode={busy?null:['Backspace', 'Delete']} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Zoom in on thinking map', 'controls.zoomOut.ariaLabel': 'Zoom out of thinking map', 'controls.fitView.ariaLabel': 'Fit all ideas in view' }}>
        <Background color="#7b8a94" gap={20} size={1.4} /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <p className="tp-hint">Drag ideas to arrange them. Connect handles to link thoughts. Select an idea to turn it into an Obsidian note.</p>
    <label className="tp-field">Relationship<select value={relationship} onChange={e => setRelationship(e.target.value)}>{['Supports', 'Challenges', 'Contradicts', 'Depends On', 'Causes', 'Leads To'].map(r => <option key={r}>{r}</option>)}</select></label>
    <form onSubmit={addNode} className="tp-form"><label className="tp-field">Add an idea<input disabled={busy} value={label} maxLength={200} onChange={e => setLabel(e.target.value)} placeholder="Something worth exploring" /></label><button className="tp-button" disabled={busy||!label.trim()}><Plus size={16} /> Add to map</button></form>
    {selected && <div className="tp-detail"><div className="tp-row"><span className="tp-kicker">Selected idea</span><button disabled={busy||selected.id==='mission'} className="tp-icon-button" title="Remove idea" aria-label="Remove selected idea" onClick={() => { onChange({ ...mission, nodes: mission.nodes.filter(n => n.id !== selected.id), edges: mission.edges.filter(e => e.source !== selected.id && e.target !== selected.id) }); setSelectedId(null); }}><Trash size={16} /></button></div><label className="tp-field">Idea text<textarea disabled={busy} maxLength={4000} value={selected.label} onChange={e => onChange({ ...mission, nodes: mission.nodes.map(n => n.id === selected.id ? { ...n, label: e.target.value } : n) })} /></label>{statement && <p>{statement.detail}</p>}<button className="tp-button tp-primary" disabled={busy} onClick={()=>{try{const captured=captureMapIdea(mission,selected.id);onChange(captured.mission);setMapMessage('Idea linked to a note.');onOpenNote?.(captured.noteId);}catch(e){setMapMessage((e as Error).message);}}}><FloppyDisk size={16}/>{linkedNote?'Open linked note':'Save idea as note'}</button></div>}
    {mapMessage&&<p className="tp-hint" role="status">{mapMessage}</p>}
  </>;
}

function Evidence({ mission, command, busy }: { mission: Mission; command: ToolsPanelProps['onCommand']; busy: boolean }) {
  const supported = mission.statements.filter(s => s.status === 'Supported' || s.status === 'Partially Supported').length;
  return <>
    <div className="tp-evidence-summary"><ShieldCheck size={28} weight="light" /><div><strong>{supported} of {mission.statements.length}</strong><span>contributions have supporting evidence</span></div></div>
    <p className="tp-hint">Perspectives are simulated. Check the sources before relying on a factual claim.</p>
    <button className="tp-button tp-primary" disabled={busy || !mission.statements.length} onClick={() => void command('evidence')}><MagnifyingGlass size={16} /> {busy ? 'Checking evidence…' : 'Check latest contribution'}</button>
    {!mission.statements.length && <Empty>Evidence will appear as your council shares ideas.</Empty>}
    <div className="tp-list">{mission.statements.slice().reverse().map(statement => <details key={statement.id} className="tp-evidence-item"><summary><span className={`tp-status tp-status-${statement.status.toLowerCase().replaceAll(' ', '-')}`}>{statement.status}</span><p>{statement.text}</p><span className="tp-byline">{mission.mascots.find(m => m.id === statement.mascotId)?.name ?? 'Previous companion'} · View reasoning</span></summary><div className="tp-evidence-body"><p>{statement.detail}</p>{statement.sources.length ? <ul className="tp-sources">{statement.sources.filter(s => /^https?:\/\//i.test(s.url)).map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer"><LinkSimple size={14} />{source.title}<ArrowSquareOut size={13} /></a></li>)}</ul> : <p className="tp-hint">No external sources attached.</p>}<button className="tp-button" disabled={busy} onClick={() => void command('evidence', statement.id)}>Check this claim</button></div></details>)}</div>
  </>;
}

function Lab({ mission, command, busy }: { mission: Mission; command: ToolsPanelProps['onCommand']; busy: boolean }) {
  const [assumption, setAssumption] = useState('');
  return <><div className="tp-callout"><Flask size={23} weight="light" /><p>Try a different possibility.<br /><strong>These are hypothetical scenarios, not forecasts.</strong></p></div><form className="tp-form" onSubmit={e => { e.preventDefault(); if (assumption.trim()) void command('scenario', assumption.trim()).then(() => setAssumption('')); }}><label className="tp-field">What would you change?<textarea value={assumption} onChange={e => setAssumption(e.target.value)} placeholder="What if we had half the budget?" maxLength={2000} rows={4} /></label><button className="tp-button tp-primary" disabled={busy || !assumption.trim()}><Flask size={16} /> {busy ? 'Exploring…' : 'Explore scenario'}</button></form>{!mission.scenarios.length ? <Empty>Your scenarios will collect here so you can compare their trade-offs.</Empty> : <div className="tp-list">{mission.scenarios.map((scenario, index) => <article key={scenario.id} className="tp-scenario"><span className="tp-kicker">Possibility {index + 1}</span><h3>{scenario.name}</h3><p className="tp-assumption">{scenario.assumption}</p><p className="tp-prewrap">{scenario.outcome}</p></article>)}</div>}</>;
}

function Vault({ mission, onChange }: Pick<ToolsPanelProps, 'mission' | 'onChange'>) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = mission.notes.filter(note => `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()));
  const selected = mission.notes.find(note => note.id === selectedId);
  function update(note: Note, changes: Partial<Note>) { onChange({ ...mission, notes: mission.notes.map(n => n.id === note.id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n) }); }
  function add() { const note = { id: crypto.randomUUID(), title: 'Untitled note', content: '', updatedAt: new Date().toISOString() }; onChange({ ...mission, notes: [...mission.notes, note] }); setSelectedId(note.id); }
  async function exportNotes(format: 'markdown' | 'zip') {
    try { const exports = await import('../lib/export'); const name = exports.safeFileName(mission.title); if (format === 'markdown') exports.downloadFile(`${name}.md`, exports.missionMarkdown(mission)); else exports.downloadFile(`${name}.zip`, exports.exportObsidianBundle(mission), 'application/zip'); setMessage('Export downloaded.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not export notes.'); }
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    try { const exports = await import('../lib/export'); const notes = await exports.importNotes(Array.from(files)); const existing = new Set(mission.notes.map(n => n.id)); onChange({ ...mission, notes: [...mission.notes, ...notes.map(n => existing.has(n.id) ? { ...n, id: crypto.randomUUID(), title: `${n.title} (imported)` } : n)] }); setMessage(`Imported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import notes.'); } finally { if (inputRef.current) inputRef.current.value = ''; }
  }
  return <><div className="tp-row tp-actions"><button className="tp-button tp-primary" onClick={add}><Plus size={16} /> New note</button><button className="tp-button" onClick={() => inputRef.current?.click()}><UploadSimple size={16} /> Import</button><input ref={inputRef} type="file" accept=".md,.zip" multiple hidden onChange={e => void importFiles(e.target.files)} /></div><label className="tp-field tp-search">Search notes<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a thought…" /></label>{selected ? <div className="tp-note-editor"><div className="tp-row"><button className="tp-text-button" onClick={() => setSelectedId(null)}>All notes</button><span className="tp-hint">Saved with your mission</span></div><label className="tp-field">Note title<input value={selected.title} onChange={e => update(selected, { title: e.target.value })} maxLength={200} /></label><label className="tp-field">Your note<textarea rows={10} value={selected.content} onChange={e => update(selected, { content: e.target.value })} placeholder="Keep an insight, a question, or a new direction." /></label>{selected.statementId && <p className="tp-hint">Linked to a council contribution.</p>}<button className="tp-button tp-danger" onClick={() => setConfirmDelete(selected.id)}><Trash size={15} /> Delete note</button></div> : <div className="tp-list">{filtered.length ? filtered.map(note => <button className="tp-note" key={note.id} onClick={() => setSelectedId(note.id)}><span className="tp-note-icon"><FloppyDisk size={20} weight="light" /></span><span><strong>{note.title || 'Untitled note'}</strong><span>{note.content.slice(0, 95) || 'A little room for your thoughts.'}</span></span></button>) : <Empty>{search ? 'No notes match your search.' : 'Keep the ideas you want to come back to.'}</Empty>}</div>}{confirmDelete && <div className="tp-confirm" role="alert"><p>Delete this note from ThinkBuddy?</p><div className="tp-row"><button className="tp-button tp-danger" onClick={() => { onChange({ ...mission, notes: mission.notes.filter(n => n.id !== confirmDelete) }); setSelectedId(null); setConfirmDelete(null); }}>Delete note</button><button className="tp-button" onClick={() => setConfirmDelete(null)}>Keep note</button></div></div>}<div className="tp-export"><span className="tp-kicker">Take your thinking with you</span><button className="tp-button" onClick={() => void exportNotes('markdown')}><ArrowDown size={15} /> Markdown</button><button className="tp-button" onClick={() => void exportNotes('zip')}><ArrowDown size={15} /> Obsidian bundle</button></div>{message && <p className="tp-hint" role="status">{message}</p>}</>;
}

function hasCycle(actions: ActionItem[], id: string, dependency: string): boolean {
  const seen = new Set([id]); let cursor = dependency;
  while (cursor) { if (seen.has(cursor)) return true; seen.add(cursor); cursor = actions.find(a => a.id === cursor)?.dependsOn ?? ''; }
  return false;
}

function Path({ mission, onChange, command, busy }: Pick<ToolsPanelProps, 'mission' | 'onChange' | 'busy'> & { command: ToolsPanelProps['onCommand'] }) {
  const [task, setTask] = useState('');
  const [error, setError] = useState('');
  function update(id: string, changes: Partial<ActionItem>) {
    if (changes.dependsOn && hasCycle(mission.actions, id, changes.dependsOn)) { setError('That dependency would create a loop. Choose another task.'); return; }
    setError(''); onChange({ ...mission, actions: mission.actions.map(a => a.id === id ? { ...a, ...changes } : a) });
  }
  return <><div className="tp-callout"><CheckSquare size={23} weight="light" /><p><strong>{mission.actions.filter(a => a.done).length} of {mission.actions.length} steps complete</strong><br />You decide what happens next.</p></div><label className="tp-field">Your takeaway (optional)<textarea maxLength={16000} value={mission.reflection} onChange={e => onChange({ ...mission, reflection: e.target.value })} placeholder="The perspective I find most useful is…" rows={3} /></label><button className="tp-button tp-primary" disabled={busy} onClick={() => void command('plan', mission.reflection)}><Check size={16} /> {busy ? 'Planning…' : 'Build action plan'}</button><p className="tp-hint">Creates a suggested checklist. No actions are carried out for you.</p><div className="tp-task-list">{mission.actions.map(action => <article className={`tp-task ${action.done ? 'tp-task-done' : ''}`} key={action.id}><div className="tp-task-title"><input type="checkbox" checked={action.done} aria-label={`Complete ${action.text}`} onChange={e => update(action.id, { done: e.target.checked })} /><label className="tp-sr-only" htmlFor={`task-${action.id}`}>Task</label><input id={`task-${action.id}`} value={action.text} onChange={e => update(action.id, { text: e.target.value })} /><button className="tp-icon-button" aria-label={`Remove task ${action.text}`} onClick={() => onChange({ ...mission, actions: mission.actions.filter(a => a.id !== action.id).map(a => a.dependsOn === action.id ? { ...a, dependsOn: '' } : a) })}><Trash size={15} /></button></div><div className="tp-task-fields"><label className="tp-field">Priority<select value={action.priority} onChange={e => update(action.id, { priority: e.target.value as ActionItem['priority'] })}>{['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}</select></label><label className="tp-field">Due date<input type="date" value={action.deadline} onChange={e => update(action.id, { deadline: e.target.value })} /></label></div><label className="tp-field">Depends on<select value={action.dependsOn} onChange={e => update(action.id, { dependsOn: e.target.value })}><option value="">No dependency</option>{mission.actions.filter(a => a.id !== action.id).map(a => <option key={a.id} value={a.id}>{a.text}</option>)}</select></label></article>)}</div><form className="tp-form" onSubmit={e => { e.preventDefault(); if (!task.trim()) return; onChange({ ...mission, actions: [...mission.actions, { id: crypto.randomUUID(), text: task.trim(), done: false, priority: 'Medium', deadline: '', dependsOn: '' }] }); setTask(''); }}><label className="tp-field">Add your own step<input value={task} onChange={e => setTask(e.target.value)} placeholder="A small, practical next step" maxLength={300} /></label><button className="tp-button" disabled={!task.trim()}><Plus size={16} /> Add step</button></form>{error && <p className="tp-error" role="alert">{error}</p>}</>;
}

export default function ToolsPanel({ tool, mission, onChange, onCommand, busy, onClose }: ToolsPanelProps) {
  const [error, setError] = useState('');
  const info = titles[tool]; const Icon = info.icon;
  const command: ToolsPanelProps['onCommand'] = async (action, prompt) => { setError(''); try { await onCommand(action, prompt); } catch (err) { setError(err instanceof Error ? err.message : 'That did not finish. Please try again.'); } };
  return <aside className="tools-panel" aria-label={info.name}><header className="tp-header"><span className="tp-header-icon"><Icon size={23} weight="bold" /></span><div><h2>{info.name}</h2><p>{info.description}</p></div><button className="tp-icon-button" aria-label="Close thinking tool" onClick={onClose}><X size={18} /></button></header><div className="tp-body" key={`${mission.id}-${tool}`}>{error && <p className="tp-error" role="alert">{error}</p>}{tool === 'map' && <ThinkingMap mission={mission} onChange={onChange} busy={busy} />}{tool === 'evidence' && <Evidence mission={mission} command={command} busy={busy} />}{tool === 'lab' && <Lab mission={mission} command={command} busy={busy} />}{tool === 'vault' && <Vault mission={mission} onChange={onChange} />}{tool === 'path' && <Path mission={mission} onChange={onChange} command={command} busy={busy} />}</div><footer className="tp-footer"><span>One question. Many possibilities.</span><span className="tp-footer-mark"><GitBranch size={14} /></span></footer></aside>;
}
