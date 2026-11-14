export const MAP_ORIGIN='https:'+'//tiles.openfreemap.org';
const roots=new Set(['styles','sprites','fonts','planet','natural_earth']);
export function mapResourceUrl(parts:string[]):string {
 if(!parts.length||!roots.has(parts[0])||parts.length>10||parts.some(p=>!p||p==='.'||p==='..'||p.includes('/')||p.includes('\\')||p.length>500))throw new Error('INVALID_MAP_PATH');
 return MAP_ORIGIN+'/'+parts.map(encodeURIComponent).join('/');
}
export function rewriteMapJson(value:unknown,origin:string):unknown {
 if(typeof value==='string'&&value.startsWith(MAP_ORIGIN+'/'))return origin+'/api/maps'+value.slice(MAP_ORIGIN.length);
 if(Array.isArray(value))return value.map(v=>rewriteMapJson(v,origin));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewriteMapJson(v,origin)]));
 return value;
}
