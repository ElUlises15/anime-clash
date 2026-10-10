/** Goku — identity, stat points, forms, audio. Moves in moves.ts, visuals in visuals.ts (render team). */
import type { CharacterDef } from '../../types';

export const config: Omit<CharacterDef, 'moves' | 'visuals'> = {
  id: 'goku',
  name: 'Goku',
  franchise: 'dragonball',
  franchiseName: 'Dragon Ball',
  archetype: 'Balanced',
  difficulty: 2,
  description: 'Saiyan de manual: buena movilidad con air dash, Ki Blasts para presionar a distancia, Kamehameha para '
    + 'castigar y Transmisión Instantánea para cruzar al rival. Su ultimate lo transforma en Super Saiyan.',
  stats: { power: 5, speed: 5, mobility: 6, defense: 5, energy: 4 }, // = 25
  forms: {
    ssj: { name: 'Super Saiyan', statMul: { powerMul: 115, speed: 112 } },
  },
  audio: { voicePitch: 1.0, cues: { ultimate: 'superKamehameha' } },
};
