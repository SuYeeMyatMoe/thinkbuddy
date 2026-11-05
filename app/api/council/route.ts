import { env } from 'cloudflare:workers';
import { apiError, ApiError, database, readJson, requireApiUser } from '../../lib/server-api';
import { councilRequestSchema, missionSchema } from '../../lib/server-validation';
import { demoCouncil } from '../../lib/demo';
import { liveCouncil } from '../../lib/server-ai';

async function runCouncil(request: Request) {
  let command: {owner:string;id:string}|undefined;
  try {
    const user=await requireApiUser(request);
    const req=councilRequestSchema.parse(await readJson(request));
    const commandId=request.headers.get('Idempotency-Key');
    if(commandId) {
      if(commandId.length>100) throw new ApiError(400,'Invalid command identifier.');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(req)));
      const fingerprint=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const inserted=await database().prepare('INSERT INTO council_commands (owner_id,id,fingerprint,result,created_at) VALUES (?,?,?,NULL,?) ON CONFLICT(owner_id,id) DO NOTHING').bind(user.userId,commandId,fingerprint,new Date().toISOString()).run();
      if(!inserted.meta.changes) {
        const prior=await database().prepare('SELECT fingerprint,result FROM council_commands WHERE owner_id=? AND id=?').bind(user.userId,commandId).first<{fingerprint:string;result:string|null}>();
        if(prior?.fingerprint!==fingerprint) throw new ApiError(409,'This command identifier was already used for a different request.');
        if(prior.result) return Response.json(JSON.parse(prior.result));
        throw new ApiError(409,'This command is already running. Wait before trying again.');
      }
      command={owner:user.userId,id:commandId};
    }
    const mission=missionSchema.parse(env.OPENAI_API_KEY?await liveCouncil(req,request.signal):demoCouncil(req));
    const result={mission,demo:!env.OPENAI_API_KEY};
    if(command) await database().prepare('UPDATE council_commands SET result=? WHERE owner_id=? AND id=?').bind(JSON.stringify(result),command.owner,command.id).run();
    return Response.json(result);
  }catch(error){
    if(command) try {await database().prepare('DELETE FROM council_commands WHERE owner_id=? AND id=? AND result IS NULL').bind(command.owner,command.id).run();}catch{}
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if(!request.headers.get('accept')?.includes('text/event-stream')) return runCouncil(request);
  try { await requireApiUser(request); } catch(error) { return apiError(error); }
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit=(event:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        emit('thinking',{id:crypto.randomUUID(),status:'thinking'});
        const response=await runCouncil(request);
        const result=await response.json() as {mission?:import('../../lib/types').Mission;demo?:boolean;error?:string};
        if(!response.ok) {emit('error',{error:result.error||'Discussion failed.',status:response.status});}
        else {
          // Emit only validated statements; never expose incomplete JSON or unvalidated claims.
          const mission=result.mission!;
          for(const mascot of mission.mascots) {
            const statement=mission.statements.filter(s=>s.mascotId===mascot.id).at(-1);
            if(statement) emit('statement',{id:statement.id,missionId:mission.id,mascotId:mascot.id,statement});
          }
          emit('complete',result);
        }
      }catch {try {emit('error',{error:'The connection was interrupted. Reopen your saved mission and retry.'});}catch{}}
      finally {try{controller.close();}catch{}}
    },
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store','Connection':'keep-alive'}});
}
