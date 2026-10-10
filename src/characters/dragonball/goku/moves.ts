/**
 * Goku move data. Frame data at 60 Hz: startup = frames before the first active frame, then `active`, then `recovery`.
 * Hitboxes in px relative to feet (+x forward, y up). Knockback px/frame. Damage on a ~1000 HP scale.
 */
import type { CharacterDef } from '../../types';

export const moves: CharacterDef['moves'] = {
  light: {
    id: 'goku_jab', name: 'Jab', kind: 'normal', anim: 'light',
    startup: 5, active: 3, recovery: 8, damage: 34, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 11,
    level: 'mid', hitbox: { x: 20, y: 140, w: 72, h: 40 }, range: 125, energyCost: 0, cooldown: 0,
    cancelInto: ['light2', 'heavy', 'crouchLight', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchLight',
    description: 'Jab rápido. Encadena a Straight o a patada.',
  },
  light2: {
    id: 'goku_straight', name: 'Straight', kind: 'normal', anim: 'light2',
    startup: 6, active: 3, recovery: 12, damage: 42, knockback: { x: 4, y: 0 }, hitstun: 17, blockstun: 12,
    level: 'mid', hitbox: { x: 22, y: 135, w: 80, h: 40 }, range: 135, energyCost: 0, cooldown: 0,
    cancelInto: ['heavy', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchMedium',
  },
  heavy: {
    id: 'goku_roundhouse', name: 'Roundhouse Kick', kind: 'normal', anim: 'heavy',
    startup: 10, active: 4, recovery: 18, damage: 66, knockback: { x: 8, y: 0 }, hitstun: 22, blockstun: 16,
    level: 'mid', hitbox: { x: 25, y: 100, w: 88, h: 60 }, range: 138, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Patada giratoria. Cancelable en especiales.',
  },
  crouchLight: {
    id: 'goku_low_jab', name: 'Low Jab', kind: 'normal', anim: 'crouchLight',
    startup: 5, active: 3, recovery: 9, damage: 28, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 10,
    level: 'low', hitbox: { x: 18, y: 25, w: 74, h: 40 }, range: 120, energyCost: 0, cooldown: 0,
    cancelInto: ['crouchHeavy', 'light', 'heavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  crouchHeavy: {
    id: 'goku_sweep', name: 'Sweep', kind: 'normal', anim: 'crouchHeavy',
    startup: 9, active: 4, recovery: 22, damage: 66, knockback: { x: 4, y: 5 }, hitstun: 30, blockstun: 14,
    level: 'low', knockdown: true, hitbox: { x: 20, y: 0, w: 110, h: 34 }, range: 150, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Barrida baja: derriba.',
  },
  airLight: {
    id: 'goku_air_jab', name: 'Air Jab', kind: 'normal', anim: 'airLight',
    startup: 4, active: 6, recovery: 8, damage: 34, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 10,
    level: 'overhead', hitbox: { x: 10, y: 70, w: 70, h: 60 }, range: 110, energyCost: 0, cooldown: 0,
    cancelInto: ['airHeavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  airHeavy: {
    id: 'goku_axe_kick', name: 'Axe Kick', kind: 'normal', anim: 'airHeavy',
    startup: 8, active: 5, recovery: 14, damage: 60, knockback: { x: 5, y: 2 }, hitstun: 19, blockstun: 13,
    level: 'overhead', hitbox: { x: 10, y: 20, w: 88, h: 75 }, range: 120, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy',
  },
  special1: {
    id: 'goku_ki_blast', name: 'Ki Blast', kind: 'special', anim: 'projectile',
    startup: 11, active: 2, recovery: 16, damage: 38, chip: 6, knockback: { x: 4, y: 0 }, hitstun: 17, blockstun: 12,
    range: 900, energyCost: 100, cooldown: 46, vfx: 'kiBlast', sfx: 'kiBlast',
    abilities: [{ type: 'projectile', frame: 11, params: {
      speed: 15, life: 110, w: 40, h: 40, offsetX: 65, offsetY: 140, power: 1, visual: 'kiBlast' } }],
    description: 'Esfera de ki rápida y barata.',
  },
  airSpecial1: {
    id: 'goku_air_ki_blast', name: 'Ki Blast (Air)', kind: 'special', anim: 'projectile',
    startup: 9, active: 2, recovery: 16, damage: 38, chip: 6, knockback: { x: 4, y: 0 }, hitstun: 16, blockstun: 12,
    level: 'overhead', range: 600, energyCost: 100, cooldown: 40, vfx: 'kiBlast', sfx: 'kiBlast',
    abilities: [{ type: 'projectile', frame: 9, params: {
      speed: 12, vy: -9, life: 90, w: 40, h: 40, offsetX: 55, offsetY: 90, power: 1, visual: 'kiBlast' } }],
    description: 'Ki Blast en diagonal hacia abajo desde el aire.',
  },
  special2: {
    id: 'goku_kamehameha', name: 'Kamehameha', kind: 'special', anim: 'beam',
    startup: 18, active: 40, recovery: 20, damage: 18, chip: 3, knockback: { x: 3, y: 0 }, hitstun: 20, blockstun: 14,
    hitstop: 4, range: 950, energyCost: 300, cooldown: 210, vfx: 'kamehameha', sfx: 'kamehameha',
    abilities: [{ type: 'beam', frame: 18, params: {
      duration: 40, maxLength: 950, growSpeed: 70, thickness: 64, offsetX: 55, offsetY: 135, hits: 6, interval: 6,
      power: 3, finalKnockdown: true, finalKbx: 10, finalKby: 10, visual: 'kamehameha' } }],
    description: 'Onda de energía sostenida, multi-hit. Combea desde la patada.',
  },
  special2Down: {
    id: 'goku_instant_transmission', name: 'Instant Transmission', kind: 'special', anim: 'teleport',
    startup: 16, active: 4, recovery: 16, damage: 70, chip: 8, knockback: { x: 6, y: 11 }, hitstun: 30, blockstun: 15,
    level: 'mid', knockdown: true, hitbox: { x: 15, y: 110, w: 85, h: 70 }, range: 1100, energyCost: 250,
    cooldown: 240, invuln: [0, 15], vfx: 'instantTransmission', sfx: 'teleport',
    abilities: [{ type: 'teleport', frame: 7, params: { mode: 'behind', distance: 80, invuln: 10, visual: 'instantTransmission' } }],
    description: 'Aparece detrás del rival y golpea con el codo (↓ + Especial 2).',
  },
  special1Down: {
    id: 'goku_kiai', name: 'Kiai', kind: 'special', anim: 'special1',
    startup: 7, active: 10, recovery: 20, damage: 30, chip: 0, knockback: { x: 14, y: 4 }, hitstun: 20, blockstun: 14,
    range: 120, energyCost: 200, cooldown: 300, invuln: [0, 9], vfx: 'aura', sfx: 'kiai',
    abilities: [{ type: 'aoe', frame: 7, params: { radius: 125, offsetX: 15, offsetY: 110, life: 10, hits: 1, visual: 'kiai' } }],
    description: 'Grito de ki invulnerable que empuja al rival (↓ + Especial 1).',
  },
  ultimate: {
    id: 'goku_super_kamehameha', name: 'Super Kamehameha', kind: 'ultimate', anim: 'ultimate',
    startup: 26, active: 70, recovery: 30, damage: 30, chip: 5, knockback: { x: 4, y: 0 }, hitstun: 22, blockstun: 16,
    hitstop: 5, range: 1500, energyCost: 0, ultCost: 1000, cooldown: 0, invuln: [0, 30], cinematicFrames: 150,
    vfx: 'superKamehameha', sfx: 'superKamehameha',
    abilities: [
      { type: 'transformation', frame: 0, params: { form: 'ssj', frames: 900, visual: 'aura' } },
      { type: 'beam', frame: 26, params: {
        duration: 66, maxLength: 1500, growSpeed: 110, thickness: 150, offsetX: 60, offsetY: 125, hits: 10, interval: 6,
        power: 10, finalKnockdown: true, finalKbx: 14, finalKby: 14, visual: 'superKamehameha' } },
    ],
    description: 'Se transforma en Super Saiyan y dispara un Kamehameha gigante.',
  },
};
