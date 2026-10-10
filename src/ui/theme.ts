/** Visual tokens — dark anime-arcade. */

export const C = {
  bg: 0x07060c,
  bgDeep: 0x05040a,
  navy: 0x0b1020,
  navy2: 0x10182c,
  panel: 0x101018,
  panel2: 0x161422,
  magenta: 0xff2e88,
  cyan: 0x29e7ff,
  orange: 0xff9a1f,
  gold: 0xffd23f,
  white: 0xffffff,
  cream: 0xfff4d2,
  dim: 0x8a90a8,
  hp: 0x3dff8a,
  hpTrail: 0xff3355,
  energy: 0x29e7ff,
  ult: 0xffd23f,
  p1: 0x29e7ff,
  p2: 0xff2e88,
  ink: 0x07060c,
  stroke: 0x05030a,
} as const;

export const HEX = {
  magenta: '#ff2e88',
  cyan: '#29e7ff',
  orange: '#ff9a1f',
  gold: '#ffd23f',
  white: '#ffffff',
  cream: '#fff4d2',
  dim: '#8a90a8',
  ink: '#07060c',
  hp: '#3dff8a',
} as const;

export const FONT = 'Impact, "Arial Black", "Arial Narrow", sans-serif';
export const FONT_BODY = '"Arial Black", Impact, Arial, sans-serif';
export const FONT_UI = 'Arial, Helvetica, sans-serif';

export const DEPTH = {
  bg: -30,
  bgFx: -26,
  panel: -10,
  content: 20,
  fx: 40,
  hud: 200,
  modal: 800,
  toast: 900,
  transition: 2000,
} as const;
