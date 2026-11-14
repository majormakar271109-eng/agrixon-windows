import type { FarmSnapshot } from '../domain/types';
import { DEFAULT_RULES } from '../config/rule-defaults';
export function createWorkspace():FarmSnapshot {return {fields:[],plantings:[],budgets:{},seasons:Array.from({length:5},(_,i)=>({id:String(2022+i),year:2022+i,startsAt:`${2022+i}-04-01`,endsAt:`${2022+i}-10-31`})),groups:[],rules:structuredClone(DEFAULT_RULES),demo:false};}
