/** Vegeta — identity, stat points, audio. Moves in moves.ts, visuals in visuals.ts (render team). */
import type { CharacterDef } from '../../types';

export const config: Omit<CharacterDef, 'moves' | 'visuals'> = {
  id: 'vegeta',
  name: 'Vegeta',
  franchise: 'dragonball',
  franchiseName: 'Dragon Ball',
  archetype: 'Rushdown',
  difficulty: 3,
  description: 'Príncipe saiyajin: presión constante con normales que avanzan, ráfagas de ki que cubren la pantalla, '
    + 'Galick Gun para castigar y Big Bang Attack para controlar el espacio. Su Barrera lo protege de proyectiles y '
    + 'estalla para sacarse al rival de encima. Ultimate: Final Flash.',
  stats: { power: 6, speed: 6, mobility: 5, defense: 4, energy: 4 }, // = 25
  audio: { voicePitch: 0.9, cues: { ultimate: 'finalFlash' } },
};
