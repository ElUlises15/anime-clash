/**
 * Sasuke move data (Technical). See dragonball/goku/moves.ts for conventions.
 * Identity: precise normals with a dive kick, a slow multi-hit fireball and fast shuriken for zoning, an air-thrown
 * wire trap, a fast long-startup lightning rush and a short but deadly counter.
 */
import type { CharacterDef } from '../../types';

export const moves: CharacterDef['moves'] = {
  light: {
    id: 'sasuke_jab', name: 'Jab', kind: 'normal', anim: 'light',
    startup: 5, active: 3, recovery: 8, damage: 33, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 11,
    level: 'mid', hitbox: { x: 20, y: 140, w: 74, h: 40 }, range: 126, energyCost: 0, cooldown: 0,
    cancelInto: ['light2', 'heavy', 'crouchLight', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  light2: {
    id: 'sasuke_lion_kick', name: 'Shishi Kick', kind: 'normal', anim: 'light2',
    startup: 6, active: 4, recovery: 12, damage: 40, knockback: { x: 4, y: 0 }, hitstun: 17, blockstun: 12,
    level: 'mid', hitbox: { x: 20, y: 120, w: 90, h: 50 }, range: 145, energyCost: 0, cooldown: 0,
    cancelInto: ['heavy', 'crouchHeavy'], vfx: 'hitLight', sfx: 'kickLight',
  },
  heavy: {
    id: 'sasuke_spin_kick', name: 'Spinning Back Kick', kind: 'normal', anim: 'heavy',
    startup: 11, active: 4, recovery: 18, damage: 66, knockback: { x: 9, y: 0 }, hitstun: 22, blockstun: 15,
    level: 'mid', hitbox: { x: 25, y: 105, w: 100, h: 55 }, range: 160, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Patada giratoria de largo alcance. Cancelable en especiales.',
  },
  crouchLight: {
    id: 'sasuke_low_kick', name: 'Low Kick', kind: 'normal', anim: 'crouchLight',
    startup: 5, active: 3, recovery: 8, damage: 27, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 10,
    level: 'low', hitbox: { x: 15, y: 15, w: 84, h: 40 }, range: 128, energyCost: 0, cooldown: 0,
    cancelInto: ['crouchHeavy', 'light', 'heavy'], vfx: 'hitLight', sfx: 'kickLight',
  },
  crouchHeavy: {
    id: 'sasuke_sweep', name: 'Leaf Sweep', kind: 'normal', anim: 'crouchHeavy',
    startup: 10, active: 4, recovery: 22, damage: 64, knockback: { x: 4, y: 5 }, hitstun: 30, blockstun: 14,
    level: 'low', knockdown: true, hitbox: { x: 15, y: 0, w: 118, h: 34 }, range: 160, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Barrida de largo alcance: derriba.',
  },
  airLight: {
    id: 'sasuke_air_kick', name: 'Air Kick', kind: 'normal', anim: 'airLight',
    startup: 4, active: 5, recovery: 8, damage: 33, knockback: { x: 2, y: 0 }, hitstun: 15, blockstun: 10,
    level: 'overhead', hitbox: { x: 10, y: 60, w: 74, h: 60 }, range: 112, energyCost: 0, cooldown: 0,
    cancelInto: ['airHeavy'], vfx: 'hitLight', sfx: 'kickLight',
  },
  airHeavy: {
    id: 'sasuke_dive_kick', name: 'Dive Kick', kind: 'normal', anim: 'airHeavy',
    startup: 7, active: 12, recovery: 12, damage: 56, knockback: { x: 5, y: 0 }, hitstun: 19, blockstun: 12,
    level: 'overhead', hitbox: { x: 5, y: 0, w: 80, h: 70 }, range: 140, energyCost: 0, cooldown: 0,
    selfVelocity: [{ frame: 7, vx: 9, vy: -14 }],
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Patada en picada: cambia el ángulo del salto.',
  },
  special1: {
    id: 'sasuke_goukakyuu', name: 'Katon: Gōkakyū', kind: 'special', anim: 'projectile',
    startup: 16, active: 2, recovery: 20, damage: 30, chip: 5, knockback: { x: 3, y: 0 }, hitstun: 18, blockstun: 12,
    hitstop: 5, range: 900, energyCost: 180, cooldown: 120, vfx: 'fireball', sfx: 'fire',
    abilities: [{ type: 'projectile', frame: 16, params: {
      speed: 9, life: 130, w: 96, h: 96, offsetX: 80, offsetY: 135, power: 3, hits: 2, interval: 9,
      finalKnockdown: true, finalKbx: 7, finalKby: 8, visual: 'fireball' } }],
    description: 'Gran bola de fuego lenta: golpea dos veces y gana a proyectiles chicos.',
  },
  special1Down: {
    id: 'sasuke_shuriken', name: 'Shuriken', kind: 'special', anim: 'projectile',
    startup: 8, active: 2, recovery: 15, damage: 22, chip: 3, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 9,
    hitstop: 4, range: 1000, energyCost: 70, cooldown: 32, vfx: 'shuriken', sfx: 'throw',
    abilities: [{ type: 'projectile', frame: 8, params: {
      count: 2, spacing: 40, speed: 24, life: 60, w: 30, h: 30, offsetX: 55, offsetY: 140, power: 1, visual: 'shuriken' } }],
    description: 'Dos shuriken muy rápidos (↓ + Especial 1).',
  },
  airSpecial1: {
    id: 'sasuke_wire_trap', name: 'Shuriken Trampa', kind: 'special', anim: 'projectile',
    startup: 9, active: 2, recovery: 16, damage: 30, knockback: { x: 0, y: 0 }, hitstun: 30, blockstun: 0,
    range: 200, energyCost: 150, cooldown: 240, vfx: 'wireTrap', sfx: 'throw',
    abilities: [{ type: 'trap', frame: 9, params: {
      offsetX: 170, w: 110, h: 34, armDelay: 18, life: 420, stun: 44, damage: 30, visual: 'wireTrap' } }],
    description: 'Desde el aire clava shuriken con alambre en el piso: el rival que la pisa queda atrapado.',
  },
  special2: {
    id: 'sasuke_chidori', name: 'Chidori', kind: 'special', anim: 'special2',
    startup: 16, active: 18, recovery: 26, damage: 112, chip: 16, knockback: { x: 14, y: 8 }, hitstun: 30, blockstun: 18,
    hitstop: 15, level: 'mid', knockdown: true, hitbox: { x: 20, y: 105, w: 80, h: 70 }, range: 480, energyCost: 300,
    cooldown: 220, vfx: 'chidori', sfx: 'chidori',
    abilities: [{ type: 'dashAttack', frame: 16, params: { speed: 21, frames: 18, orb: true, orbOffsetX: 62, orbOffsetY: 130,
      orbSize: 50, visual: 'chidori' } }],
    description: 'Carga el rayo en la mano y cruza media pantalla en un instante. Derriba.',
  },
  special2Down: {
    id: 'sasuke_sharingan', name: 'Sharingan', kind: 'special', anim: 'counter',
    startup: 2, active: 18, recovery: 22, damage: 86, knockback: { x: 9, y: 9 }, hitstun: 30, blockstun: 0,
    knockdown: true, range: 150, energyCost: 220, cooldown: 260, vfx: 'sharingan', sfx: 'parry',
    abilities: [{ type: 'counter', frame: 2, params: {
      window: 18, response: 'teleportStrike', distance: 75, damage: 86, kbx: 9, kby: 9, knockdown: true,
      visual: 'sharingan' } }],
    description: 'Lee el ataque: si te golpean durante la ventana, aparecés detrás y contraatacás. Ventana corta, '
      + 'castigo fuerte (↓ + Especial 2).',
  },
  ultimate: {
    id: 'sasuke_kirin', name: 'Kirin', kind: 'ultimate', anim: 'ultimate',
    startup: 30, active: 4, recovery: 40, damage: 46, chip: 7, knockback: { x: 3, y: 3 }, hitstun: 26, blockstun: 16,
    hitstop: 5, range: 1500, energyCost: 0, ultCost: 1000, cooldown: 0, invuln: [0, 34], cinematicFrames: 160,
    vfx: 'kirin', sfx: 'chidori',
    abilities: [{ type: 'aoe', frame: 30, params: {
      at: 'opponent', delay: 6, radius: 150, offsetY: 110, life: 36, hits: 6, interval: 5, damage: 46,
      finalKnockdown: true, finalKbx: 6, finalKby: 16, visual: 'kirin' } }],
    description: 'Invoca un dragón de rayos que cae del cielo sobre la posición del rival.',
  },
};
