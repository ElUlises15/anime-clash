// PLACEHOLDER — will be replaced by the render team (Codex). Keep export name `visuals`.
import type { CharacterVisuals } from '../../../render/rig/types';
export const visuals: CharacterVisuals = {
  family: 'standard',
  heightPx: 205,
  palette: {
    skin: '#f2c9a0', skinShade: '#d9a57c', hair: '#111111', hairShade: '#000000', eyes: '#222222',
    top: '#f07a1a', topShade: '#c45a0a', pants: '#f07a1a', pantsShade: '#c45a0a', boots: '#1b3a8c',
    accent: '#1b3a8c', outline: '#14101c', aura: '#ffffff',
  },
  hair: { locks: [[[-1, -0.2], [0, -1.8], [1, -0.2]]] },
  accessories: [],
  vfx: { hitSpark: '#ffffff', trail: '#ffffff' },
};
