/** Sasuke — identity, stat points, audio. Moves in moves.ts, visuals in visuals.ts (render team). */
import type { CharacterDef } from '../../types';

export const config: Omit<CharacterDef, 'moves' | 'visuals'> = {
  id: 'sasuke',
  name: 'Sasuke Uchiha',
  franchise: 'naruto',
  franchiseName: 'Naruto',
  archetype: 'Technical',
  difficulty: 4,
  description: 'Genio Uchiha: controla el espacio con la gran bola de fuego y shuriken, deja trampas de alambre desde '
    + 'el aire y castiga con el Chidori. El Sharingan lee el ataque rival y contraataca por la espalda. '
    + 'Ultimate: Kirin, un rayo que cae del cielo sobre el oponente.',
  stats: { power: 5, speed: 6, mobility: 6, defense: 4, energy: 4 }, // = 25
  audio: { voicePitch: 1.1, cues: { ultimate: 'kirin' } },
};
