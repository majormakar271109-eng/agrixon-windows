import { upstream,staleHours, NasaError, transportMessage } from '@/server/nasa/client';
import { mapResourceUrl,rewriteMapJson } from '@/server/maps/proxy';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{path:string[]}>}) {
 let url:string;try{url=mapResourceUrl((await context.params).path);}catch{return Response.json({error:{code:'INVALID_MAP_PATH',message:'Неверный ресурс карты'}},{status:400});}
 try {
  const {entry,stale}=await upstream(url,true,undefined,true);
  const body=Buffer.from(entry.body,'base64');
  const headers={'Cache-Control':stale?'no-cache':'public, max-age=21600','X-Map-Status':stale?'stale':'fresh','X-Map-Stale-Hours':String(staleHours(entry.fetchedAt)),'X-Content-Type-Options':'nosniff'};
  if(entry.contentType.includes('json')){const data:unknown=JSON.parse(body.toString('utf8'));return Response.json(rewriteMapJson(data,new URL(request.url).origin),{headers});}
  return new Response(new Uint8Array(body),{headers:{...headers,'Content-Type':entry.contentType}});
 }catch(error){const code=error instanceof NasaError?error.code:'UPSTREAM_UNAVAILABLE';return Response.json({error:{code,message:transportMessage(code)}},{status:503});}
}
