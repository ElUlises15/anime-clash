/**
 * Vegeta move data (Rushdown). See dragonball/goku/moves.ts for conventions.
 * Identity: normals that step forward and are slightly plus on block, a screen-filling ki barrage, a beam for
 * punishes, a slow exploding projectile for space control and a barrier that absorbs pressure then bursts.
 */
import type { CharacterDef } from '../../types';

export const moves: CharacterDef['moves'] = {
  light: {
    id: 'vegeta_jab', name: 'Jab', kind: 'normal', anim: 'light',
    startup: 5, active: 3, recovery: 8, damage: 33, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 12,
    level: 'mid', hitbox: { x: 20, y: 140, w: 74, h: 40 }, range: 126, energyCost: 0, cooldown: 0,
    cancelInto: ['light2', 'heavy', 'crouchLight', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchLight',
    description: 'Jab rápido, levemente ventajoso en guardia.',
  },
  light2: {
    id: 'vegeta_elbow', name: 'Rushing Elbow', kind: 'normal', anim: 'light2',
    startup: 6, active: 3, recovery: 12, damage: 45, knockback: { x: 5, y: 0 }, hitstun: 17, blockstun: 13,
    level: 'mid', hitbox: { x: 15, y: 125, w: 82, h: 50 }, range: 150, energyCost: 0, cooldown: 0,
    selfVelocity: [{ frame: 2, vx: 7, vy: 0 }],
    cancelInto: ['heavy', 'crouchHeavy'], vfx: 'hitLight', sfx: 'punchMedium',
    description: 'Codazo que avanza: mantiene la presión.',
  },
  heavy: {
    id: 'vegeta_knee', name: 'Prince Knee', kind: 'normal', anim: 'heavy',
    startup: 11, active: 4, recovery: 18, damage: 70, knockback: { x: 9, y: 0 }, hitstun: 22, blockstun: 16,
    level: 'mid', hitbox: { x: 22, y: 95, w: 86, h: 70 }, range: 150, energyCost: 0, cooldown: 0,
    selfVelocity: [{ frame: 4, vx: 6, vy: 0 }],
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Rodillazo con paso adelante. Cancelable en especiales.',
  },
  crouchLight: {
    id: 'vegeta_low_punch', name: 'Low Punch', kind: 'normal', anim: 'crouchLight',
    startup: 5, active: 3, recovery: 9, damage: 27, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 10,
    level: 'low', hitbox: { x: 18, y: 25, w: 76, h: 40 }, range: 122, energyCost: 0, cooldown: 0,
    cancelInto: ['crouchHeavy', 'light', 'heavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  crouchHeavy: {
    id: 'vegeta_sweep', name: 'Sweep', kind: 'normal', anim: 'crouchHeavy',
    startup: 9, active: 4, recovery: 23, damage: 64, knockback: { x: 4, y: 5 }, hitstun: 30, blockstun: 14,
    level: 'low', knockdown: true, hitbox: { x: 20, y: 0, w: 108, h: 34 }, range: 148, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'kickHeavy', description: 'Barrida: derriba.',
  },
  airLight: {
    id: 'vegeta_air_punch', name: 'Air Punch', kind: 'normal', anim: 'airLight',
    startup: 4, active: 5, recovery: 9, damage: 34, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 10,
    level: 'overhead', hitbox: { x: 10, y: 75, w: 72, h: 55 }, range: 110, energyCost: 0, cooldown: 0,
    cancelInto: ['airHeavy'], vfx: 'hitLight', sfx: 'punchLight',
  },
  airHeavy: {
    id: 'vegeta_hammer', name: 'Double Axe Handle', kind: 'normal', anim: 'airHeavy',
    startup: 9, active: 5, recovery: 15, damage: 64, knockback: { x: 4, y: -12 }, hitstun: 20, blockstun: 14,
    level: 'overhead', knockdown: true, hitbox: { x: 5, y: 25, w: 86, h: 80 }, range: 115, energyCost: 0, cooldown: 0,
    vfx: 'hitHeavy', sfx: 'punchHeavy', description: 'Martillo con ambos puños: estrella al rival contra el piso.',
  },
  special1: {
    id: 'vegeta_ki_barrage', name: 'Ráfaga de Ki', kind: 'special', anim: 'projectile',
    startup: 12, active: 2, recovery: 18, damage: 17, chip: 3, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 9,
    hitstop: 3, range: 950, energyCost: 140, cooldown: 65, vfx: 'kiBlastPurple', sfx: 'kiBlast',
    abilities: [{ type: 'projectile', frame: 12, params: {
      count: 4, spacing: 55, speed: 17, life: 110, w: 34, h: 34, offsetX: 65, offsetY: 140, power: 1,
      visual: 'kiBlastPurple' } }],
    description: 'Cuatro esferas de ki en ráfaga. Cada una anula un proyectil débil.',
  },
  airSpecial1: {
    id: 'vegeta_air_barrage', name: 'Ráfaga de Ki (Aire)', kind: 'special', anim: 'projectile',
    startup: 10, active: 2, recovery: 18, damage: 17, chip: 3, knockback: { x: 2, y: 0 }, hitstun: 14, blockstun: 9,
    hitstop: 3, level: 'overhead', range: 650, energyCost: 140, cooldown: 70, vfx: 'kiBlastPurple', sfx: 'kiBlast',
    abilities: [{ type: 'projectile', frame: 10, params: {
      count: 3, spacing: 45, speed: 13, vy: -8, life: 80, w: 34, h: 34, offsetX: 55, offsetY: 90, power: 1,
      visual: 'kiBlastPurple' } }],
    description: 'Ráfaga en diagonal hacia abajo desde el aire.',
  },
  special2: {
    id: 'vegeta_galick_gun', name: 'Galick Gun', kind: 'special', anim: 'beam',
    startup: 20, active: 36, recovery: 22, damage: 19, chip: 3, knockback: { x: 3, y: 0 }, hitstun: 20, blockstun: 14,
    hitstop: 4, range: 950, energyCost: 300, cooldown: 210, vfx: 'galickGun', sfx: 'kamehameha',
    abilities: [{ type: 'beam', frame: 20, params: {
      duration: 36, maxLength: 950, growSpeed: 75, thickness: 70, offsetX: 55, offsetY: 135, hits: 6, interval: 6,
      power: 3, finalKnockdown: true, finalKbx: 11, finalKby: 10, visual: 'galickGun' } }],
    description: 'Onda violeta sostenida, multi-hit. Combea desde el rodillazo.',
  },
  special1Down: {
    id: 'vegeta_big_bang', name: 'Big Bang Attack', kind: 'special', anim: 'special1',
    startup: 20, active: 2, recovery: 22, damage: 48, chip: 8, knockback: { x: 4, y: 6 }, hitstun: 24, blockstun: 16,
    range: 900, energyCost: 250, cooldown: 240, vfx: 'bigBang', sfx: 'kiBlast',
    abilities: [{ type: 'projectile', frame: 20, params: {
      speed: 8, life: 95, w: 84, h: 84, offsetX: 75, offsetY: 135, power: 4, visual: 'bigBang',
      explode: true, explodeRadius: 150, explodeHits: 4, explodeInterval: 6, explodeDamage: 22, explodeLife: 30,
      explodeVisual: 'explosion' } }],
    description: 'Esfera lenta y enorme que explota al impactar o al final de su recorrido (↓ + Especial 1).',
  },
  special2Down: {
    id: 'vegeta_barrier', name: 'Barrera', kind: 'special', anim: 'special2',
    startup: 3, active: 34, recovery: 14, damage: 40, chip: 6, knockback: { x: 13, y: 6 }, hitstun: 24, blockstun: 14,
    range: 120, energyCost: 220, cooldown: 300, vfx: 'barrier', sfx: 'shield',
    abilities: [
      { type: 'shield', frame: 3, params: { w: 180, h: 250, offsetX: 0, offsetY: 120, life: 31, hp: 200, follow: true,
        visual: 'barrier' } },
      { type: 'aoe', frame: 34, params: { radius: 120, offsetX: 0, offsetY: 110, life: 8, hits: 1, damage: 40,
        knockdown: true, kbx: 13, kby: 6, visual: 'barrierBurst' } },
    ],
    description: 'Domo de ki que absorbe golpes y proyectiles y luego estalla empujando al rival (↓ + Especial 2).',
  },
  ultimate: {
    id: 'vegeta_final_flash', name: 'Final Flash', kind: 'ultimate', anim: 'ultimate',
    startup: 32, active: 66, recovery: 32, damage: 31, chip: 5, knockback: { x: 4, y: 0 }, hitstun: 22, blockstun: 16,
    hitstop: 5, range: 1600, energyCost: 0, ultCost: 1000, cooldown: 0, invuln: [0, 36], cinematicFrames: 170,
    vfx: 'finalFlash', sfx: 'superKamehameha',
    abilities: [{ type: 'beam', frame: 32, params: {
      duration: 62, maxLength: 1600, growSpeed: 120, thickness: 175, offsetX: 60, offsetY: 130, hits: 10, interval: 6,
      power: 12, finalKnockdown: true, finalKbx: 15, finalKby: 14, visual: 'finalFlash' } }],
    description: 'Carga ambas manos y libera un rayo amarillo colosal que cruza el escenario.',
  },
};
