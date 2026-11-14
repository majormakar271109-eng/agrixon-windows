import { z } from 'zod/v3';
import { polygon } from './schemas';
import { areaHa,validPolygon } from './geometry';
import type { Field } from './types';
const input=z.object({type:z.literal('FeatureCollection'),features:z.array(z.object({type:z.literal('Feature'),geometry:polygon,properties:z.record(z.unknown()).nullable().optional()})).min(1).max(500)});
export function parseFieldsGeojson(text:string):Field[] {
 if(text.length>2_000_000)throw new Error('GeoJSON больше 2 МБ. Разделите файл.');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new Error('Файл не является корректным JSON.');}
 const parsed=input.safeParse(raw);if(!parsed.success)throw new Error('Нужен GeoJSON FeatureCollection с 1–500 Polygon. MultiPolygon и полигоны с отверстиями пока не поддерживаются.');
 return parsed.data.features.map((feature,i)=>{if(!validPolygon(feature.geometry))throw new Error(`Поле ${i+1}: неверные координаты, самопересечение или слишком малая площадь.`);const name=feature.properties?.name;return {id:`import-${i+1}`,name:typeof name==='string'&&name.trim()?name.trim().slice(0,100):`Поле ${i+1}`,geometry:feature.geometry,areaHa:areaHa(feature.geometry),color:'#6E8868'};});
}
