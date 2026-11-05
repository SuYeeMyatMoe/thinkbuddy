import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../chatgpt-auth';
import { ZodError } from 'zod';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function requireApiUser(request?: Request) {
  if (request && !['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'This request must come from ThinkBuddy.');
  }
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, 'Sign in to your ThinkBuddy workspace.');
  return user;
}
export function database() { if (!env.DB) throw new ApiError(503, 'Workspace storage is not configured yet.'); return env.DB; }
export function apiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: 'Some fields are invalid.', details: error.issues.slice(0, 5).map(i => ({path:i.path.join('.'),message:i.message})) }, { status: 400 });
  if (error instanceof SyntaxError) return Response.json({ error: 'The request must contain valid JSON.' }, { status: 400 });
  console.error('thinkbuddy_request_failed', {name: error instanceof Error ? error.name : 'Unknown'});
  return Response.json({ error: 'The request could not be completed. Please try again.' }, { status: 500 });
}
export async function readJson(request: Request, limit = 2000000): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new ApiError(413, 'This request is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) throw new ApiError(413, 'This request is too large.');
  return JSON.parse(text);
}
