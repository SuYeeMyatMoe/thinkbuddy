import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Mission, Note } from './types';

export const IMPORT_LIMITS = { archiveBytes: 10 * 1024 * 1024, expandedBytes: 20 * 1024 * 1024, fileBytes: 1024 * 1024, files: 200 };
const scalar = (value: string) => JSON.stringify(value);
export const safeFileName = (value: string) => value.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/^[. ]+|[. ]+$/g, '').slice(0, 90) || 'Untitled';
export function noteMarkdown(note: Note, missionId?: string): string {
  return ['---', `thinkbuddy_id: ${scalar(note.id)}`, ...(missionId ? [`thinkbuddy_mission: ${scalar(missionId)}`] : []), `title: ${scalar(note.title)}`, `updated: ${scalar(note.updatedAt)}`, ...(note.statementId ? [`statement_id: ${scalar(note.statementId)}`] : []), ...(note.theme?[`thinkbuddy_theme: ${scalar(note.theme)}`]:[]), ...(note.origin?[`thinkbuddy_origin: ${scalar(note.origin)}`]:[]), 'tags: [thinkbuddy]', '---', '', note.content, ''].join('\n');
}
/** Preserve user-owned YAML properties when updating an existing managed vault note. */
export function preserveVaultProperties(previous: string | undefined, generated: string): string {
  const frontmatter = previous?.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  if (!frontmatter) return generated;
  const extras: string[] = []; let skip = false;
  for (const line of frontmatter.split('\n')) {
    if (/^[^\s#][^:]*:/.test(line)) skip = /^(thinkbuddy_id|thinkbuddy_mission|thinkbuddy_theme|thinkbuddy_origin|title|updated|statement_id|tags):/.test(line);
    if (!skip) extras.push(line);
  }
  return extras.length ? generated.replace('\n---\n', `\n${extras.join('\n')}\n---\n`) : generated;
}
function field(frontmatter: string, key: string): string | undefined {
  const value = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!value) return undefined;
  if (value.startsWith('"')) { try { const parsed: unknown = JSON.parse(value); return typeof parsed === 'string' ? parsed : undefined; } catch { return undefined; } }
  return value.replace(/^'|'$/g, '');
}
export function parseMarkdown(text: string, fallbackTitle: string, fallbackId: string): { note: Note; managed: boolean; missionId?: string } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const metadata = match?.[1] || '';
  const id = field(metadata, 'thinkbuddy_id');
  const body = match ? normalized.slice(match[0].length).replace(/^\n/, '') : normalized;
  const title = field(metadata, 'title') || body.match(/^#\s+(.+)$/m)?.[1] || fallbackTitle;
  return { managed: Boolean(id), missionId: field(metadata, 'thinkbuddy_mission'), note: {
    id: id || fallbackId, title: title.slice(0, 300), content: body.replace(/\n$/, ''),
    updatedAt: field(metadata, 'updated') || new Date().toISOString(),
    ...(field(metadata, 'statement_id') ? { statementId: field(metadata, 'statement_id') } : {}),
    ...(field(metadata,'thinkbuddy_theme')?{theme:field(metadata,'thinkbuddy_theme')!.slice(0,500)}:{}),
    ...(['automatic','user'].includes(field(metadata,'thinkbuddy_origin')??'')?{origin:field(metadata,'thinkbuddy_origin') as 'automatic'|'user'}:{}),
  } };
}
export function missionMarkdown(mission: Mission): string {
  const parts = ['---', `title: ${scalar(mission.title)}`, `thinkbuddy_mission: ${scalar(mission.id)}`, `updated: ${scalar(mission.updatedAt)}`, 'tags: [thinkbuddy, mission]', '---', '', `# ${mission.title}`, '', '## Perspectives', ...mission.mascots.map(m => `- **${m.name} (${m.role})**: ${m.motivation}`), '', '## Discussion'];
  if(mission.brief)parts.push('', '## Mission brief', `Success: ${mission.brief.success}`, `People affected: ${mission.brief.audience}`, `Resources: ${mission.brief.resources}`, `Deadline: ${mission.brief.deadline}`);
  if(mission.messages?.length)parts.push('', '## Your contributions',...mission.messages.flatMap(m=>['',`### ${m.kind==='takeaway'?'Saved takeaway':'Message'} (${m.createdAt})`,m.text]));
  for(const message of mission.messages??[])for(const attachment of message.attachments??[])parts.push('',`### Attached material: ${attachment.name}`,`${attachment.mime}; ${attachment.size} bytes; ${attachment.truncated?'excerpt':'extracted content'}`,'',attachment.text);
  for (const s of mission.statements) {
    parts.push('', `### ${mission.mascots.find(m => m.id === s.mascotId)?.name || s.mascotId}`, s.text, '', s.detail, '', `Evidence: ${s.status}`);
    for (const source of s.sources) { if (/^https?:\/\//i.test(source.url)) parts.push(`- [${source.title.replace(/[\[\]]/g, '')}](${encodeURI(source.url).replace(/[()]/g, encodeURIComponent)})`); }
    if(s.evidenceReview)parts.push(`Checked: ${s.evidenceReview.checkedAt}`,s.evidenceReview.explanation,`Limitations: ${s.evidenceReview.limitations}`);
  }
  parts.push('', '## Notes', ...mission.notes.map(n => `- [[${noteExportName(n).replace(/\.md$/, '')}|${n.title.replace(/[|\]\n]/g, ' ')}]]`), '', '## Reflection', mission.reflection || 'No reflection recorded.', '', '## Scenarios');
  for (const s of mission.scenarios) parts.push(`### ${s.name}`, `Assumption: ${s.assumption}`, 'Hypothetical outcome:', s.outcome, '');
  parts.push('## Action plan', ...mission.actions.map(a => `- [${a.done ? 'x' : ' '}] ${a.text} (${a.priority}${a.deadline ? `; due ${a.deadline}` : ''}${a.dependsOn ? `; depends on ${a.dependsOn}` : ''})`));
  if(mission.result){const r=mission.result;parts.push('', '## Working result',r.summary,'',r.recommendation,'',`What changed: ${r.changed}`,'',`Next step: ${r.nextStep}`,'', '### Unresolved',...r.unresolved.map(x=>`- ${x}`),'','### Experiment',r.experiment.action,`Success measure: ${r.experiment.successMeasure}`,`Owner: ${r.experiment.owner}`,`Review date: ${r.experiment.reviewDate}`);}
  if(mission.outcome)parts.push('', '## Outcome review',mission.outcome.observed,'',mission.outcome.learned);
  return parts.join('\n');
}
export const noteExportName = (note: Note) => `${safeFileName(note.title).replace(/[#|^\[\]%]/g,'-')}--${safeFileName(note.id)}.md`;
export function missionCanvas(mission: Mission,noteDirectory=''): string {
  return JSON.stringify({ nodes: mission.nodes.map(n => {
    const note=mission.notes.find(note=>note.id===n.noteId||(n.statementId&&note.statementId===n.statementId));
    return {id:n.id,...(note?{type:'file',file:(noteDirectory?noteDirectory+'/':'')+noteExportName(note)}:{type:'text',text:n.label}),x:Math.round(n.x),y:Math.round(n.y),width:240,height:160};
  }), edges: mission.edges.map(e => ({ id: e.id, fromNode: e.source, toNode: e.target, label: e.label, toEnd: 'arrow' })) }, null, 2);
}
export function exportMissionZip(mission: Mission): Uint8Array {
  const files: Record<string, Uint8Array> = { 'Mission.md': strToU8(missionMarkdown(mission)), 'ThinkMap.canvas': strToU8(missionCanvas(mission)) };
  for (const note of mission.notes) files[noteExportName(note)] = strToU8(noteMarkdown(note, mission.id));
  return zipSync(files, { level: 6 });
}
export function exportObsidianBundle(mission:Mission):Uint8Array{
  const folder=`ThinkBuddy/${safeFileName(mission.id)}`;
  const files:Record<string,Uint8Array>={
    [`${folder}/Mission.md`]:strToU8(missionMarkdown(mission)),
    [`${folder}/ThinkMap.canvas`]:strToU8(missionCanvas(mission,folder)),
  };
  for(const note of mission.notes)files[`${folder}/${noteExportName(note)}`]=strToU8(noteMarkdown(note,mission.id));
  return zipSync(files,{level:6});
}
export function downloadFile(name: string, content: string | Uint8Array, type = 'text/markdown') {
  const data = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export function safeImportPath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('\\') && !/^[A-Za-z]:/.test(path) && !path.split('/').some(p => p === '..' || p.startsWith('.')) && /\.md$/i.test(path);
}
export async function importNotes(files: File[]): Promise<Note[]> {
  let total = 0; const notes: Note[] = [];
  const add = (name: string, bytes: Uint8Array) => {
    if (!safeImportPath(name)) return;
    total += bytes.byteLength;
    if (bytes.byteLength > IMPORT_LIMITS.fileBytes || total > IMPORT_LIMITS.expandedBytes || notes.length >= IMPORT_LIMITS.files) throw new Error('Import exceeds the limit: 200 notes, 1 MB each, 20 MB total.');
    const parsed = parseMarkdown(strFromU8(bytes), name.split('/').pop()!.replace(/\.md$/i, ''), crypto.randomUUID());
    // Imported identifiers never overwrite an existing cloud note implicitly.
    notes.push({ ...parsed.note, id: crypto.randomUUID(), updatedAt: new Date().toISOString() });
  };
  for (const file of files) {
    if (file.size > IMPORT_LIMITS.archiveBytes) throw new Error('Choose files smaller than 10 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      let declared = 0, count = 0;
      const unpacked = unzipSync(bytes, { filter(entry) {
        if (!safeImportPath(entry.name)) return false;
        declared += entry.originalSize; count++;
        if (entry.originalSize > IMPORT_LIMITS.fileBytes || declared + total > IMPORT_LIMITS.expandedBytes || count + notes.length > IMPORT_LIMITS.files) throw new Error('This archive exceeds the safe import size.');
        return true;
      } });
      for (const [name, data] of Object.entries(unpacked)) add(name, data);
    } else if (/\.md$/i.test(file.name)) add(file.name, bytes);
    else throw new Error('Only Markdown (.md) and ZIP files can be imported.');
  }
  return notes;
}
