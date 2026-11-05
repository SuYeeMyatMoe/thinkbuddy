import { env } from 'cloudflare:workers';
import { apiError, ApiError, requireApiUser } from '../../lib/server-api';

export async function POST(request: Request) {
  try {
    await requireApiUser(request);
    if(!env.OPENAI_API_KEY) throw new ApiError(503,'Voice transcription needs an OpenAI API key. You can type your question instead.');
    if(Number(request.headers.get('content-length'))>12000000) throw new ApiError(413,'Recording is too large. Record a shorter question.');
    const form=await request.formData();
    const file=form.get('file') ?? form.get('audio');
    if(!(file instanceof File)||file.size===0) throw new ApiError(400,'Record a question first.');
    if(file.size>12000000) throw new ApiError(413,'Recording is too large. Record a shorter question.');
    if(!/^(audio\/(webm|mp4|mpeg|wav|ogg|x-m4a)|video\/webm)/.test(file.type)) throw new ApiError(400,'This audio format is not supported.');
    const data=new FormData();data.set('file',file);data.set('model',env.OPENAI_TRANSCRIBE_MODEL||'gpt-transcribe');
    const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:data,signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw new ApiError(response.status===429?429:502,'Transcription is unavailable. Please try again or type your question.');
    const result=await response.json() as {text?:string};
    if(!result.text) throw new ApiError(502,'No speech was detected. Try again in a quieter place.');
    return Response.json({text:result.text});
  }catch(error){return apiError(error);}
}
