import type {ReplyAttachment} from './types';
export const UPLOAD_LIMITS={files:3,fileBytes:5*1024*1024,totalBytes:10*1024*1024,textCharacters:12000};
export const UPLOAD_ACCEPT='.txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp';
const types:Record<string,string>={txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
export function attachmentMime(name:string):string{
  const ext=name.split('.').at(-1)?.toLowerCase()??'';
  if(!types[ext]||name.startsWith('.')||/[\\/\x00-\x1f]/.test(name))throw new Error('Choose a PDF, PNG/JPEG/WebP image, or TXT/Markdown/CSV/JSON file.');
  return types[ext];
}
export function validateUploads(files:Pick<File,'name'|'size'>[]){
  if(!files.length||files.length>UPLOAD_LIMITS.files)throw new Error('Attach up to 3 files per reply.');
  let total=0;for(const file of files){attachmentMime(file.name);if(file.name.length>200)throw new Error('Use a filename shorter than 200 characters.');if(file.size<1||file.size>UPLOAD_LIMITS.fileBytes)throw new Error('Each file must contain data and be no larger than 5 MB.');total+=file.size;}
  if(total>UPLOAD_LIMITS.totalBytes)throw new Error('Keep the total attachment size under 10 MB.');
}
export function extractPlainText(name:string,bytes:Uint8Array):ReplyAttachment{
  const mime=attachmentMime(name);if(!mime.startsWith('text/')&&mime!=='application/json')throw new Error('This file needs AI document or image reading.');
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{throw new Error('Save text files as UTF-8 before uploading.');}
  if(text.includes('\0')||!text.trim())throw new Error('The file does not contain readable text.');
  return {id:crypto.randomUUID(),name,mime,size:bytes.byteLength,text:text.slice(0,UPLOAD_LIMITS.textCharacters),...(text.length>UPLOAD_LIMITS.textCharacters?{truncated:true}:{})};
}
export function validateBinary(mime:string,bytes:Uint8Array){
  const head=String.fromCharCode(...bytes.slice(0,12));
  const valid=mime==='application/pdf'?head.startsWith('%PDF-'):mime==='image/png'?bytes[0]===137&&head.slice(1,4)==='PNG':mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/webp'?head.startsWith('RIFF')&&head.slice(8,12)==='WEBP':false;
  if(!valid)throw new Error('The file contents do not match the selected PDF or image type.');
}
