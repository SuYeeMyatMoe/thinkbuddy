import type { Mission, Note } from './types';
import { noteMarkdown, noteExportName, parseMarkdown, preserveVaultProperties, safeFileName, secondBrainFiles } from './export';

interface VaultFile { kind: 'file'; name: string; getFile(): Promise<File>; createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }
interface VaultDirectory { kind: 'directory'; name: string; getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<VaultDirectory>; getFileHandle(name: string, options?: { create?: boolean }): Promise<VaultFile>; removeEntry(name: string): Promise<void>; values(): AsyncIterable<VaultFile | VaultDirectory>; queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>; requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState> }
interface Baseline { hash: string; path: string; }
export interface SyncConflict { id: string; kind: 'edited-both' | 'deleted-local' | 'deleted-cloud' | 'duplicate-id'; local?: Note; remote?: Note; path: string; }
export type SyncResolution = 'local' | 'remote' | 'delete-local' | 'delete-remote';
export interface SyncResult { notes: Note[]; conflicts: SyncConflict[]; written: number; imported: number; deleted: number; generated: number; preserved: string[]; syncedAt: string; }
const DATABASE = 'thinkbuddy-vault-sync';
let current: VaultDirectory | null = null;
let currentVaultId = '';
let running = false;

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DATABASE, 1); request.onupgradeneeded = () => request.result.createObjectStore('state'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Browser storage is unavailable. Enable site storage to connect a vault.')); });
}
async function stored<T>(key: string): Promise<T | undefined> {
  const db = await database();
  try { return await new Promise<T | undefined>((resolve, reject) => { const request = db.transaction('state').objectStore('state').get(key); request.onsuccess = () => resolve(request.result as T | undefined); request.onerror = () => reject(request.error); }); } finally { db.close(); }
}
async function persist(key: string, value: unknown): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); if (value === undefined) tx.objectStore('state').delete(key); else tx.objectStore('state').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
export function supportsVaultSync(): boolean { return typeof window !== 'undefined' && window.isSecureContext && 'showDirectoryPicker' in window; }
export async function connectVault(): Promise<string> {
  if (!supportsVaultSync()) throw new Error('Folder sync needs desktop Chrome or Edge over HTTPS. Import and export remain available.');
  const picker = (window as unknown as { showDirectoryPicker(options: { mode: string; id: string }): Promise<VaultDirectory> }).showDirectoryPicker;
  const handle = await picker({ mode: 'readwrite', id: 'thinkbuddy-vault' });
  const id = crypto.randomUUID();
  await persist('vault', { handle, id }); current = handle; currentVaultId = id; return handle.name;
}
export async function restoreVault(): Promise<string | null> {
  if (!supportsVaultSync()) return null;
  const connection = await stored<{ handle: VaultDirectory; id: string }>('vault');
  current = connection?.handle || null; currentVaultId = connection?.id || '';
  if (!current || await current.queryPermission({ mode: 'readwrite' }) !== 'granted') { current = null; return null; }
  return current.name;
}
export async function reconnectVault(): Promise<string> {
  const connection = await stored<{ handle: VaultDirectory; id: string }>('vault');
  const handle = current || connection?.handle;
  if (!handle) return connectVault();
  if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Folder permission was not granted. Sync is paused.');
  current = handle; currentVaultId = currentVaultId || connection?.id || crypto.randomUUID(); return handle.name;
}
export async function disconnectVault(): Promise<void> { current = null; currentVaultId = ''; await persist('vault', undefined); }
export async function noteHash(note: Note): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([note.title, note.content.replace(/\r\n/g, '\n').replace(/\n$/, ''), note.statementId || '',note.theme||'',note.origin||'']));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export function decideSync(base: string | undefined, local: string | undefined, remote: string | undefined): 'equal' | 'to-local' | 'to-cloud' | 'conflict' | 'deleted-local' | 'deleted-cloud' | 'gone' {
  if (!local && !remote) return 'gone';
  if (local === remote) return 'equal';
  if (!local) return base ? 'deleted-local' : 'to-local';
  if (!remote) return base ? 'deleted-cloud' : 'to-cloud';
  if (local === base) return 'to-local';
  if (remote === base) return 'to-cloud';
  return 'conflict';
}

/** Save callback must persist returned notes with a cloud revision check and throw on conflict. */
export async function syncVault(mission: Mission, save: (notes: Note[]) => Promise<void>, resolutions: Record<string, SyncResolution> = {}): Promise<SyncResult> {
  if (running) throw new Error('A vault sync is already running.');
  const perform = async () => { running = true; try { return await synchronize(mission, save, resolutions); } finally { running = false; } };
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('thinkbuddy-vault-sync', { ifAvailable: true }, lock => { if (!lock) throw new Error('Another ThinkBuddy tab is syncing this vault.'); return perform(); });
  return perform();
}
async function synchronize(mission: Mission, save: (notes: Note[]) => Promise<void>, resolutions: Record<string, SyncResolution>): Promise<SyncResult> {
  const { id: missionId, notes } = mission;
  if (!current || await current.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Reconnect your vault to resume folder synchronization.');
  const root = await current.getDirectoryHandle('ThinkBuddy', { create: true });
  const folderName = safeFileName(missionId);
  const dir = await root.getDirectoryHandle(folderName, { create: true });
  const storageKey = `base:${currentVaultId}:${missionId}`;
  const base = await stored<Record<string, Baseline>>(storageKey) || {};
  const local = new Map<string, { note: Note; hash: string; path: string }>();
  const conflicts: SyncConflict[] = []; const duplicates = new Set<string>();
  let readCount = 0;
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue;
    if (++readCount > 200) throw new Error('This mission folder contains more than 200 Markdown files. Sync is paused.');
    const file = await entry.getFile();
    if (file.size > 1024 * 1024) throw new Error(`${entry.name} is larger than the 1 MB note limit.`);
    const parsed = parseMarkdown(await file.text(), entry.name.replace(/\.md$/, ''), '');
    if (!parsed.managed || parsed.missionId !== missionId) continue;
    if (local.has(parsed.note.id)) { duplicates.add(parsed.note.id); conflicts.push({ id: parsed.note.id, kind: 'duplicate-id', local: parsed.note, path: entry.name }); continue; }
    local.set(parsed.note.id, { note: parsed.note, hash: await noteHash(parsed.note), path: entry.name });
  }
  const remote = new Map(notes.map(n => [n.id, n]));
  const next = new Map(remote); const nextBase = { ...base };
  const writes: { path: string; note: Note; previous?: string }[] = [];
  const deletes: { path: string; previous: string }[] = [];
  let imported = 0;
  for (const id of new Set([...Object.keys(base), ...local.keys(), ...remote.keys()])) {
    if (duplicates.has(id)) continue;
    const l = local.get(id), r = remote.get(id), rh = r ? await noteHash(r) : undefined;
    const decision = decideSync(base[id]?.hash, l?.hash, rh);
    const path = l?.path || base[id]?.path || (r?noteExportName(r):`${safeFileName(id)}.md`);
    let action: 'to-local' | 'to-cloud' | 'equal' | 'gone' | 'delete-local' | 'delete-remote' | undefined;
    if (decision === 'conflict' || decision === 'deleted-local' || decision === 'deleted-cloud') {
      const resolution = resolutions[id];
      if (resolution === 'local' && l) action = 'to-cloud';
      else if (resolution === 'remote' && r) action = 'to-local';
      else if (resolution === 'delete-local' && decision === 'deleted-cloud') action = 'delete-local';
      else if (resolution === 'delete-remote' && decision === 'deleted-local') action = 'delete-remote';
      else { conflicts.push({ id, kind: decision === 'conflict' ? 'edited-both' : decision, local: l?.note, remote: r, path }); continue; }
    } else action = decision;
    if (action === 'to-cloud' && l) { const note = { ...l.note, updatedAt: new Date().toISOString() }; next.set(id, note); nextBase[id] = { hash: l.hash, path }; imported++; }
    if (action === 'to-local' && r && rh) { writes.push({ path, note: r, previous: l?.hash }); nextBase[id] = { hash: rh, path }; }
    if (action === 'equal' && rh) nextBase[id] = { hash: rh, path };
    if (action === 'delete-local' && l) { deletes.push({ path, previous: l.hash }); delete nextBase[id]; }
    if (action === 'delete-remote') { next.delete(id); delete nextBase[id]; }
    if (action === 'gone') delete nextBase[id];
  }
  const resultNotes = [...next.values()];
  // Persist remote imports before recording a baseline. A failed cloud revision check leaves the local vault untouched.
  if (imported || resultNotes.length !== notes.length) await save(resultNotes);
  const checkUnchanged = async (path: string, previous?: string) => {
    let file: File;
    try { file = await (await dir.getFileHandle(path)).getFile(); } catch (error) { if ((error as DOMException).name === 'NotFoundError' && !previous) return; throw error; }
    const existingText = await file.text();
    const parsed = parseMarkdown(existingText, path, '');
    if (!previous || !parsed.managed || await noteHash(parsed.note) !== previous) throw new Error(`${path} changed during synchronization. Nothing will overwrite it; sync again to review.`);
    return existingText;
  };
  for (const item of writes) { const previous = await checkUnchanged(item.path, item.previous); const writer = await (await dir.getFileHandle(item.path, { create: true })).createWritable(); await writer.write(preserveVaultProperties(previous, noteMarkdown(item.note, missionId))); await writer.close(); }
  for (const item of deletes) { await checkUnchanged(item.path, item.previous); await dir.removeEntry(item.path); }
  await persist(storageKey, nextBase);
  const generated = conflicts.length ? { written: 0, preserved: [] } : await writeSecondBrain(dir, storageKey, secondBrainFiles(
    { ...mission, notes: resultNotes }, Object.fromEntries(Object.entries(nextBase).map(([id, entry]) => [id, entry.path])),
  ));
  return { notes: resultNotes, conflicts, written: writes.length, imported, generated: generated.written, preserved: generated.preserved, deleted: deletes.length + Math.max(0, notes.length - resultNotes.length), syncedAt: new Date().toISOString() };
}

async function textHash(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content.replace(/\r\n/g, '\n'));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}

async function writeSecondBrain(dir: VaultDirectory, storageKey: string, files: Record<string, string>): Promise<{ written: number; preserved: string[] }> {
  const folder = await dir.getDirectoryHandle('Second Brain', { create: true });
  const key = `${storageKey}:generated`;
  const baseline = await stored<Record<string, string>>(key) || {};
  let written = 0;
  const preserved: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const hash = await textHash(content);
    let existing: string | undefined;
    try { existing = await (await (await folder.getFileHandle(name)).getFile()).text(); }
    catch (error) { if ((error as DOMException).name !== 'NotFoundError') throw error; }
    const existingHash = existing === undefined ? undefined : await textHash(existing);
    if (existingHash === hash) { baseline[name] = hash; continue; }
    // A generated file edited (or deleted) in Obsidian belongs to the user now.
    if (existingHash !== baseline[name]) { preserved.push(name); continue; }
    const writer = await (await folder.getFileHandle(name, { create: true })).createWritable();
    await writer.write(content); await writer.close();
    baseline[name] = hash; written++;
    // Commit each successful file so interrupted generation can safely resume.
    await persist(key, baseline);
  }
  await persist(key, baseline);
  return { written, preserved };
}
