/**
 * Ability component registry. To add a component: create a file exporting an `Ability`, register it below.
 * The engine looks abilities up by `AbilityRef.type` / `EntityState.abilityType` only.
 */
import { registerAbility, getAbility, listAbilityTypes } from './registry';
import { projectile } from './projectile';
import { beam } from './beam';
import { dashAttack } from './dashAttack';
import { teleport } from './teleport';
import { counter } from './counter';
import { buff } from './buff';
import { debuff } from './debuff';
import { heal } from './heal';
import { transformation } from './transformation';
import { aoe } from './aoe';
import { shield } from './shield';
import { summon } from './summon';
import { trap } from './trap';
import { grab } from './grab';

export const ABILITIES = [projectile, beam, dashAttack, teleport, counter, buff, debuff, heal, transformation, aoe,
  shield, summon, trap, grab];
for (const a of ABILITIES) registerAbility(a);

export { getAbility, listAbilityTypes };
export type { Ability, AbilityParams } from './types';
