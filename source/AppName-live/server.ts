import { createServer } from 'node:http';
import { readFile,access } from 'node:fs/promises';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GET as power } from '../crop-rotation/app/api/nasa/power/route';
import { GET as firms } from '../crop-rotation/app/api/nasa/firms/route';
import { GET as eonet } from '../crop-rotation/app/api/nasa/eonet/route';
import { GET as cmr } from '../crop-rotation/app/api/nasa/cmr/route';
import { GET as worldview } from '../crop-rotation/app/api/nasa/worldview/route';
import { GET as capabilities } from '../crop-rotation/app/api/nasa/gibs/capabilities/route';
import { GET as tile } from '../crop-rotation/app/api/nasa/gibs/tile/[layer]/[date]/[z]/[y]/[x]/route';
import { GET as maps } from '../crop-rotation/app/api/maps/[...path]/route';
const dir=path.dirname(fileURLToPath(import.meta.url));
for(const filename of ['.env.local','.env']){const p=path.join(dir,filename);if(existsSync(p)){for(const line of readFileSync(p,'utf8').split(/\r?\n/)){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}}}
process.env.NASA_CACHE_DIR ||= path.join(dir,'.cache','nasa');
const handlers:Record<string,(request:Request)=>Promise<Response>>={'power':power,'firms':firms,'eonet':eonet,'cmr':cmr,'worldview':worldview};
export async function handle(request:Request):Promise<Response>{
 const url=new URL(request.url),p=url.pathname;
 if(request.method!=='GET'&&request.method!=='HEAD')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
 if(p==='/api/health')return Response.json({application:'AppName Live',version:'0.2.3',mode:'live',firmsConfigured:Boolean(process.env.FIRMS_MAP_KEY)});
 if(p.startsWith('/api/maps/'))return maps(request,{params:Promise.resolve({path:p.slice(10).split('/').map(decodeURIComponent)})});
 if(p==='/api/nasa/gibs/capabilities')return capabilities();
 if(p.startsWith('/api/nasa/gibs/tile/')){const [layer,date,z,y,x]=p.slice('/api/nasa/gibs/tile/'.length).split('/').map(decodeURIComponent);return tile(request,{params:Promise.resolve({layer,date,z,y,x})});}
 if(p.startsWith('/api/nasa/')){const h=handlers[p.slice(10)];return h?h(request):Response.json({error:'NOT_FOUND'},{status:404});}
 if(p.startsWith('/api/'))return Response.json({error:'NOT_FOUND'},{status:404});
 const files:Record<string,[string,string]>={'/app.js':['app.js','text/javascript; charset=utf-8'],'/app.css':['app.css','text/css; charset=utf-8'],'/logo.svg':['logo.svg','image/svg+xml']};
 const entry=files[p]??(['/', '/table','/plan','/risks','/sources','/settings'].includes(p)?['index.html','text/html; charset=utf-8']:null);
 if(!entry)return new Response('Not found',{status:404});
 return new Response(new Uint8Array(await readFile(path.join(dir,'public',entry[0]))),{headers:{'Content-Type':entry[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
export const server=createServer(async(req,res)=>{try{const response=await handle(new Request('http://'+(req.headers.host??'localhost')+(req.url??'/'),{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method!=='HEAD')res.end(Buffer.from(await response.arrayBuffer()));else res.end();}catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'SERVER_ERROR',message:'Ошибка обработки запроса. Проверьте параметры.'}));}});
if(process.env.APPNAME_NO_LISTEN!=='1'){const port=Number(process.env.PORT??3000);server.listen(port,'127.0.0.1',()=>console.log(`AppName Live: http://localhost:${port}\nДля остановки: Ctrl+C. Ключ FIRMS никогда не отправляется в браузер.`));server.on('error',(error:NodeJS.ErrnoException)=>{console.error(error.code==='EADDRINUSE'?'Порт занят. Остановите прежнее приложение или запустите с PORT=3001.':'Не удалось запустить сервер: '+error.code);process.exitCode=1;});}
