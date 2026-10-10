/** Naruto — identity, stat points, audio. Moves in moves.ts, visuals in visuals.ts (render team). */
import type { CharacterDef } from '../../types';

export const config: Omit<CharacterDef, 'moves' | 'visuals'> = {
  id: 'naruto',
  name: 'Naruto Uzumaki',
  franchise: 'naruto',
  franchiseName: 'Naruto',
  archetype: 'Rushdown',
  difficulty: 2,
  description: 'Ninja hiperactivo: camina rápido, doble salto, ráfagas de golpes y clones de sombra para abrir la '
    + 'guardia. Rasengan para cerrar combos y Kawarimi para castigar ataques.',
  stats: { power: 4, speed: 6, mobility: 7, defense: 5, energy: 3 }, // = 25
  audio: { voicePitch: 1.25, cues: { ultimate: 'rasenshuriken' } },
};
