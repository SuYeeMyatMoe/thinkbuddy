import { z } from 'zod';
import { apiError, database, readJson, requireApiUser, ApiError } from '../../lib/server-api';
import { missionSchema } from '../../lib/server-validation';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const row = await database().prepare('SELECT data FROM missions WHERE owner_id = ? AND id = ?').bind(user.userId, id).first<{data: string}>();
      if (!row) throw new ApiError(404, 'Mission not found.');
      return Response.json({ mission: JSON.parse(row.data) });
    }
    const rows = await database().prepare('SELECT data FROM missions WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100').bind(user.userId).all<{data: string}>();
    return Response.json({ missions: rows.results.map(row => JSON.parse(row.data)) });
  } catch (e) { return apiError(e); }
}
export async function PUT(request: Request) {
  try {
    const user = await requireApiUser(request);
    const {mission, expectedRevision} = z.object({mission: missionSchema, expectedRevision: z.number().int().min(0)}).parse(await readJson(request));
    const next = {...mission, revision: expectedRevision + 1, updatedAt: new Date().toISOString()};
    const result = expectedRevision === 0
      ? await database().prepare('INSERT INTO missions (id, owner_id, title, data, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, id) DO NOTHING').bind(next.id, user.userId, next.title, JSON.stringify(next), next.revision, next.updatedAt).run()
      : await database().prepare('UPDATE missions SET title = ?, data = ?, revision = ?, updated_at = ? WHERE owner_id = ? AND id = ? AND revision = ?').bind(next.title, JSON.stringify(next), next.revision, next.updatedAt, user.userId, next.id, expectedRevision).run();
    if (!result.meta.changes) throw new ApiError(409, 'This mission changed in another tab. Reload the saved version before editing.');
    return Response.json({mission: next});
  } catch (e) { return apiError(e); }
}
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new ApiError(400, 'Choose a mission to delete.');
    await database().prepare('DELETE FROM missions WHERE owner_id = ? AND id = ?').bind(user.userId, id).run();
    return Response.json({ok: true});
  } catch (e) { return apiError(e); }
}
