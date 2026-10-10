import type {CharacterDef} from '../characters/types';
const definitions=new Map<string,CharacterDef>();
/** Render-only content cache, populated by FighterView; never enters simulation state. */
export function registerVisualDefinition(def:CharacterDef){definitions.set(def.id,def);}
export function visualDefinition(id:string){return definitions.get(id);}
