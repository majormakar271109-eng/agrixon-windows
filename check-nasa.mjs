import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const port=Number(process.argv[2]??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
const base='http:'+'//127.0.0.1:'+port;
const end=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
const start=new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10);
const bbox='66.743753,47.479811,67.743753,48.479811';
const tasks=[['power',`/api/nasa/power?lat=47.979811&lon=67.243753&start=${start}&end=${end}`],['gibs-capabilities','/api/nasa/gibs/capabilities'],['gibs-ndvi',`/api/nasa/gibs/tile/MODIS_Terra_NDVI_8Day/${end}/8/89/175`],['gibs-truecolor',`/api/nasa/gibs/tile/MODIS_Terra_CorrectedReflectance_TrueColor/${end}/8/89/175`],['worldview',`/api/nasa/worldview?bbox=${bbox}&date=${end}&layer=MODIS_Terra_CorrectedReflectance_TrueColor&width=512&height=512`],['eonet',`/api/nasa/eonet?bbox=${bbox}&days=30`],['cmr','/api/nasa/cmr?keyword=MOD13Q4N'],['firms',`/api/nasa/firms?bbox=${bbox}&days=3`],['basemap','/api/maps/styles/positron']];
console.log('Real local-server NASA checks. No fixtures. Start the application first.');
let health;
try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('health HTTP '+r.status);health=await r.json();}catch{console.error('Application is not available. Start START.bat / node server.mjs, then run this check again.');process.exit(1);}
const results=await Promise.all(tasks.map(async([id,path])=>{
 try{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(90000)});
  const type=response.headers.get('content-type')??'';
  if(type.startsWith('image/')){
   const b=new Uint8Array(await response.arrayBuffer());
   const png=[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);const jpeg=b[0]===255&&b[1]===216;
   const result={id,httpStatus:response.status,ok:response.ok&&(png||jpeg),contentType:type,bytes:b.length,validImageSignature:png||jpeg,verification:'Binary format only; does not prove pixel coverage or browser rendering.'};console.log(id,result.ok?'PASS':'FAIL',response.status);return result;
  }
  const body=await response.json();
  const keyRequired=body.error?.code==='KEY_REQUIRED';
  const ok=response.ok&&!body.error&&(id==='basemap'?body.version===8:body.data!==null&&body.data!==undefined);
  const result={id,httpStatus:response.status,ok,keyRequired,status:body.status??null,error:body.error??null,records:Array.isArray(body.data)?body.data.length:null,dataset:body.source?.datasetId??null,observedAt:body.source?.observedAt??null,cache:body.cache??null};
  console.log(id,ok?'PASS':keyRequired?'KEY REQUIRED':'FAIL',response.status,body.error?.code??'');return result;
 }catch(error){const result={id,ok:false,error:{code:error.cause?.code??error.name,message:'Local-server request failed or timed out'}};console.log(id,'FAIL',result.error.code);return result;}
}));
const passed=results.filter(r=>r.id!=='firms').every(r=>r.ok);
const report={checkedAt:new Date().toISOString(),application:health.application,version:health.version,liveTransport:true,fixtures:false,passedWithoutFirms:passed,firms:results.find(r=>r.id==='firms'),results};
const path=fileURLToPath(new URL('./nasa-diagnostics.json',import.meta.url));await writeFile(path,JSON.stringify(report,null,2));console.log('Saved nasa-diagnostics.json. Live NASA without FIRMS:',passed?'PASS':'NOT PASSED');process.exitCode=passed?0:1;
