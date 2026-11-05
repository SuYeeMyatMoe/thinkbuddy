import { env } from 'cloudflare:workers';
import { apiError, requireApiUser } from '../../lib/server-api';
export async function GET() {
  try { await requireApiUser(); return Response.json({ live: Boolean(env.OPENAI_API_KEY), model: env.OPENAI_MODEL || 'gpt-5.4' }); }
  catch (e) { return apiError(e); }
}
