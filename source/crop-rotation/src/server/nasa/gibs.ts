import "server-only";
import { z } from "zod/v3";
import type { GIBSLayer } from "../../domain/types";
export const LAYERS = [
  "MODIS_Terra_CorrectedReflectance_TrueColor",
  "MODIS_Terra_NDVI_8Day",
  "VIIRS_SNPP_CorrectedReflectance_TrueColor",
] as const;
export const layerSchema = z.enum(LAYERS);
const xmlText=(text:string)=>text.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();
function tags(xml:string,name:string):string[]{const pattern=new RegExp(`<(?:(?:[\\w.-]+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${name}\\s*>`,'g');return Array.from(xml.matchAll(pattern),m=>m[1]);}
export function parseCapabilities(xml:string):GIBSLayer[]{
 if(xml.length>20_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<(?:\w+:)?Capabilities\b/.test(xml))throw new Error('INVALID_WMTS_XML');
 const result=tags(xml,'Layer').flatMap(layer=>{
  const id=tags(layer,'Identifier').map(xmlText).find(id=>LAYERS.some(v=>v===id));if(!id)return [];
  const matrixSet=tags(layer,'TileMatrixSet').map(xmlText).find(v=>v.includes('GoogleMapsCompatible'));
  if(!matrixSet)return [];
  const dates=tags(layer,'Dimension').flatMap(dimension=>tags(dimension,'Value').map(xmlText));
  return [{id,title:xmlText(tags(layer,'Title')[0]??id),matrixSet,dates}];
 });
 if(!result.length)throw new Error('WMTS_LAYERS_MISSING');
 return result;
}
export function availableDate(values: string[], date: string): boolean {
  return values.some((v) => {
    if (!v.includes("/")) return v === date;
    const [start, end, step] = v.split("/");
    if (date < start.slice(0, 10) || date > end.slice(0, 10)) return false;
    const n = /^P(\d+)D$/.exec(step ?? "P1D");
    return n
      ? (Date.parse(date) - Date.parse(start.slice(0, 10))) %
          (Number(n[1]) * 86400000) ===
          0
      : false;
  });
}
