/** Effective stats = derived base stats x form multipliers x status effects. */
import type { DerivedStats } from '../../characters/types';
import type { FighterState } from './types';
import { baseStats, getDef } from './defs';
import { jumpVxFor } from './balance';

export interface EffStats extends DerivedStats {
  jumpVx: number;
}

const pct = (v: number, p: number) => Math.trunc((v * p) / 100);

export function effStats(f: FighterState): EffStats {
  const b = baseStats(f.charId);
  let power = 100, speed = 100, defense = 100, regen = 100;
  if (f.form) {
    const form = getDef(f.charId).forms?.[f.form];
    if (form?.statMul) {
      power = pct(power, form.statMul.powerMul ?? 100);
      speed = pct(speed, form.statMul.speed ?? 100);
      defense = pct(defense, form.statMul.defense ?? 100);
    }
  }
  for (const s of f.statuses) {
    switch (s.kind) {
      case 'powerUp': power = pct(power, s.magnitude); break;
      case 'weakenAtk': power = pct(power, s.magnitude); break;
      case 'speedUp': case 'slow': speed = pct(speed, s.magnitude); break;
      case 'defenseUp': case 'weaken': defense = pct(defense, s.magnitude); break;
      case 'energyRegen': regen = pct(regen, s.magnitude); break;
    }
  }
  const walk = pct(b.walkSpeed, speed);
  return {
    ...b,
    powerMul: pct(b.powerMul, power),
    walkSpeed: walk,
    backWalkSpeed: pct(b.backWalkSpeed, speed),
    dashSpeed: pct(b.dashSpeed, speed),
    defense: pct(b.defense, defense),
    energyRegen: pct(b.energyRegen, regen),
    jumpVx: jumpVxFor(walk),
  };
}
