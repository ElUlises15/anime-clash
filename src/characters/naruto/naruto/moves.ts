/** Naruto move data. See dragonball/goku/moves.ts for conventions. */
import type { CharacterDef } from '../../types';

export const moves: CharacterDef['moves'] = {
  light: {
    id: 'naruto_jab', name: 'Quick Jab', kind: 'normal', anim: 'light',
    startup: 4, active: 2, recovery: 8, damage: 35, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 10,
    level: 'mid', hitbox: { x: 18, y: 140, w: 76, h: 40 }, range: 128, energyCost: 0, cooldown: 0,
    cancelInto: ['light2', 'heavy', 'crouchLight', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  light2: {
    id: 'naruto_flurry', name: 'Uzumaki Flurry', kind: 'normal', anim: 'light2',
    startup: 5, active: 10, recovery: 12, damage: 22, multiHit: 3, knockback: { x: 2, y: 0 }, hitstun: 15, blockstun: 10,
    hitstop: 4, level: 'mid', hitbox: { x: 18, y: 115, w: 84, h: 65 }, range: 136, energyCost: 0, cooldown: 0,
    cancelInto: ['heavy', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchLight', description: 'Ráfaga de 3 golpes.',
  },
  heavy: {
    id: 'naruto_rising_kick', name: 'Rising Kick', kind: 'normal', anim: 'heavy',
    startup: 11, active: 4, recovery: 17, damage: 68, knockback: { x: 3, y: 15 }, hitstun: 30, blockstun: 15,
    level: 'mid', launcher: true, hitbox: { x: 15, y: 80, w: 94, h: 130 }, range: 140, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Lanzador: en hit, mantené ↑ para perseguir en el aire.',
  },
  crouchLight: {
    id: 'naruto_low_kick', name: 'Low Kick', kind: 'normal', anim: 'crouchLight',
    startup: 5, active: 3, recovery: 8, damage: 28, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 10,
    level: 'low', hitbox: { x: 15, y: 15, w: 84, h: 40 }, range: 128, energyCost: 0, cooldown: 0,
    cancelInto: ['crouchHeavy', 'light', 'heavy'], vfx: 'hitLight', sfx: 'kickLight',
  },
  crouchHeavy: {
    id: 'naruto_slide', name: 'Sliding Kick', kind: 'normal', anim: 'crouchHeavy',
    startup: 10, active: 6, recovery: 20, damage: 66, knockback: { x: 5, y: 5 }, hitstun: 30, blockstun: 14,
    level: 'low', knockdown: true, hitbox: { x: 12, y: 0, w: 100, h: 36 }, range: 200, energyCost: 0, cooldown: 0,
    selfVelocity: [{ frame: 8, vx: 10, vy: 0 }], vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Barrida deslizante.',
  },
  airLight: {
    id: 'naruto_air_kick', name: 'Air Kick', kind: 'normal', anim: 'airLight',
    startup: 4, active: 5, recovery: 8, damage: 33, knockback: { x: 2, y: 0 }, hitstun: 15, blockstun: 10,
    level: 'overhead', hitbox: { x: 10, y: 60, w: 70, h: 60 }, range: 110, energyCost: 0, cooldown: 0,
    cancelInto: ['airHeavy'], vfx: 'hitLight', sfx: 'kickLight',
  },
  airHeavy: {
    id: 'naruto_heel_drop', name: 'Heel Drop', kind: 'normal', anim: 'airHeavy',
    startup: 9, active: 5, recovery: 14, damage: 60, knockback: { x: 4, y: -10 }, hitstun: 20, blockstun: 14,
    level: 'overhead', knockdown: true, hitbox: { x: 5, y: 10, w: 82, h: 80 }, range: 110, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Talonazo: estrella al rival contra el piso.',
  },
  special1: {
    id: 'naruto_kage_bunshin', name: 'Kage Bunshin', kind: 'special', anim: 'summon',
    startup: 14, active: 2, recovery: 20, damage: 44, chip: 5, knockback: { x: 6, y: 4 }, hitstun: 24, blockstun: 14,
    range: 700, energyCost: 250, cooldown: 280, vfx: 'clone', sfx: 'poof',
    abilities: [{ type: 'summon', frame: 14, params: {
      count: 2, speed: 12, life: 150, delayStep: 12, spacing: 40, offsetX: 30, attackRange: 75, windup: 7, recover: 12,
      visual: 'clone' } }],
    description: 'Dos clones de sombra corren y golpean al rival.',
  },
  special2: {
    id: 'naruto_rasengan', name: 'Rasengan', kind: 'special', anim: 'special2',
    startup: 15, active: 22, recovery: 22, damage: 118, chip: 16, knockback: { x: 13, y: 9 }, hitstun: 30, blockstun: 18,
    hitstop: 14, level: 'mid', knockdown: true, hitbox: { x: 25, y: 105, w: 70, h: 70 }, range: 400, energyCost: 300,
    cooldown: 210, vfx: 'rasengan', sfx: 'rasengan',
    abilities: [{ type: 'dashAttack', frame: 15, params: { speed: 15, frames: 22, orb: true, orbOffsetX: 60, orbOffsetY: 135, visual: 'rasengan' } }],
    description: 'Carga hacia adelante con la esfera giratoria. Derriba.',
  },
  special1Down: {
    id: 'naruto_kunai', name: 'Kunai', kind: 'special', anim: 'projectile',
    startup: 9, active: 2, recovery: 14, damage: 34, chip: 4, knockback: { x: 3, y: 0 }, hitstun: 14, blockstun: 10,
    range: 1000, energyCost: 60, cooldown: 26, vfx: 'kunai', sfx: 'throw',
    abilities: [{ type: 'projectile', frame: 9, params: {
      speed: 21, life: 70, w: 38, h: 16, offsetX: 55, offsetY: 145, power: 1, visual: 'kunai' } }],
    description: 'Kunai rápido y barato (↓ + Especial 1).',
  },
  special2Down: {
    id: 'naruto_kawarimi', name: 'Kawarimi', kind: 'special', anim: 'counter',
    startup: 3, active: 24, recovery: 18, damage: 80, knockback: { x: 8, y: 9 }, hitstun: 30, blockstun: 0,
    knockdown: true, range: 150, energyCost: 200, cooldown: 240, vfx: 'smoke', sfx: 'poof',
    abilities: [{ type: 'counter', frame: 3, params: {
      window: 24, response: 'teleportStrike', distance: 75, damage: 80, kbx: 8, kby: 9, knockdown: true, visual: 'smoke' } }],
    description: 'Sustitución: si te golpean, aparecés detrás y pateás (↓ + Especial 2).',
  },
  ultimate: {
    id: 'naruto_rasenshuriken', name: 'Rasenshuriken', kind: 'ultimate', anim: 'ultimate',
    startup: 28, active: 4, recovery: 34, damage: 44, chip: 6, knockback: { x: 2, y: 0 }, hitstun: 30, blockstun: 20,
    range: 1300, energyCost: 0, ultCost: 1000, cooldown: 0, invuln: [0, 32], cinematicFrames: 150,
    vfx: 'rasenshuriken', sfx: 'rasenshuriken',
    abilities: [{ type: 'projectile', frame: 28, params: {
      speed: 10, life: 150, w: 130, h: 130, offsetX: 85, offsetY: 135, power: 10, visual: 'rasenshuriken',
      explode: true, explodeRadius: 175, explodeHits: 8, explodeInterval: 5, explodeDamage: 36, explodeLife: 48,
      explodeVisual: 'explosion' } }],
    description: 'Shuriken de viento gigante que estalla en una tormenta de cortes.',
  },
};
