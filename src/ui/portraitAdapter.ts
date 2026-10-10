/**
 * Tries `makePortraitTexture` / `makeFullBodyTexture` from the render team.
 * Falls back to a palette-based original silhouette so Select/HUD never crash.
 */
import Phaser from 'phaser';
import type { CharacterDef } from '../characters/types';

interface PortraitMod {
  makePortraitTexture?: (scene: Phaser.Scene, def: CharacterDef, key: string, size: number) => string;
  makeFullBodyTexture?: (scene: Phaser.Scene, def: CharacterDef, key: string, height: number, anim?: string) => string;
}

const eager = import.meta.glob('../render/portrait.ts', { eager: true }) as Record<string, PortraitMod>;
const loaders = import.meta.glob('../render/portrait.ts') as Record<string, () => Promise<PortraitMod>>;
let mod: PortraitMod | null | undefined = Object.values(eager)[0] ?? undefined;

export async function loadPortraitModule(): Promise<void> {
  if (mod !== undefined && mod) return;
  const loader = Object.values(loaders)[0];
  if (!loader) {
    mod = null;
    return;
  }
  try {
    mod = await loader();
  } catch {
    mod = null;
  }
}

export function makePortraitTexture(scene: Phaser.Scene, def: CharacterDef, key: string, size: number): string {
  if (mod?.makePortraitTexture) {
    try {
      const k = mod.makePortraitTexture(scene, def, key, size);
      if (k && scene.textures.exists(k)) return k;
    } catch { /* fallback */ }
  }
  return fallbackPortrait(scene, def, key, size);
}

export function makeFullBodyTexture(
  scene: Phaser.Scene,
  def: CharacterDef,
  key: string,
  height: number,
  anim?: string,
): string {
  if (mod?.makeFullBodyTexture) {
    try {
      const k = mod.makeFullBodyTexture(scene, def, key, height, anim);
      if (k && scene.textures.exists(k)) return k;
    } catch { /* fallback */ }
  }
  return fallbackFullBody(scene, def, key, height, anim);
}

function fallbackPortrait(scene: Phaser.Scene, def: CharacterDef, key: string, size: number): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const p = def.visuals?.palette;
  const skin = p?.skin ?? '#c9a07a';
  const hair = p?.hair ?? '#1a1a1a';
  const top = p?.top ?? '#ff2e88';
  const accent = p?.accent ?? '#29e7ff';
  const outline = p?.outline ?? '#140c18';
  const aura = p?.aura ?? '#29e7ff';

  const grd = ctx.createRadialGradient(size * 0.5, size * 0.55, 8, size * 0.5, size * 0.5, size * 0.55);
  grd.addColorStop(0, hexA(aura, 0.35));
  grd.addColorStop(1, '#0c0a14');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // shoulders
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(size * 0.08, size);
  ctx.quadraticCurveTo(size * 0.5, size * 0.55, size * 0.92, size);
  ctx.lineTo(size, size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.stroke();

  // neck
  ctx.fillStyle = skin;
  ctx.fillRect(size * 0.42, size * 0.52, size * 0.16, size * 0.16);

  // head
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.42, size * 0.2, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.stroke();

  // hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(size * 0.28, size * 0.42);
  ctx.quadraticCurveTo(size * 0.22, size * 0.12, size * 0.5, size * 0.08);
  ctx.quadraticCurveTo(size * 0.82, size * 0.1, size * 0.74, size * 0.4);
  ctx.quadraticCurveTo(size * 0.62, size * 0.22, size * 0.5, size * 0.26);
  ctx.quadraticCurveTo(size * 0.36, size * 0.22, size * 0.28, size * 0.42);
  ctx.fill();

  // eyes
  ctx.fillStyle = p?.eyes ?? '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(size * 0.42, size * 0.44, size * 0.03, size * 0.04, 0, 0, Math.PI * 2);
  ctx.ellipse(size * 0.58, size * 0.44, size * 0.03, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // accent stripe
  ctx.fillStyle = accent;
  ctx.fillRect(0, size - 8, size, 8);

  ctx.font = `italic ${Math.floor(size * 0.16)}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = outline;
  ctx.fillStyle = '#fff4d2';
  const ch = (def.name?.[0] ?? '?').toUpperCase();
  ctx.strokeText(ch, 10, size - 12);
  ctx.fillText(ch, 10, size - 12);

  tex.refresh();
  return key;
}

function fallbackFullBody(
  scene: Phaser.Scene,
  def: CharacterDef,
  key: string,
  height: number,
  anim?: string,
): string {
  if (scene.textures.exists(key)) {
    // victory vs idle can share a silhouette; if anim requested and key exists, keep it
    return key;
  }
  const w = Math.round(height * 0.62);
  const h = height;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  const p = def.visuals?.palette;
  const skin = p?.skin ?? '#c9a07a';
  const hair = p?.hair ?? '#1a1a1a';
  const top = p?.top ?? '#ff7a1a';
  const pants = p?.pants ?? '#1b3a8c';
  const boots = p?.boots ?? '#141018';
  const outline = p?.outline ?? '#140c18';
  const aura = p?.aura ?? '#29e7ff';
  const victory = anim === 'victory';

  ctx.clearRect(0, 0, w, h);
  const grd = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.6, h * 0.55);
  grd.addColorStop(0, hexA(aura, 0.28));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const stroke = Math.max(2, h * 0.012);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = outline;

  const limb = (x1: number, y1: number, x2: number, y2: number, thick: number, color: string) => {
    ctx.strokeStyle = outline;
    ctx.lineWidth = thick + stroke;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = outline;
    ctx.lineWidth = stroke;
  };

  const hipY = h * 0.55;
  const shY = h * 0.32;
  const headY = h * 0.18;
  const armUp = victory ? -0.95 : 0.35;

  // legs
  limb(cx - 16, hipY, cx - 22, h * 0.78, h * 0.055, pants);
  limb(cx + 16, hipY, cx + 20, h * 0.78, h * 0.055, pants);
  limb(cx - 22, h * 0.78, cx - 24, h * 0.94, h * 0.048, boots);
  limb(cx + 20, h * 0.78, cx + 26, h * 0.94, h * 0.048, boots);

  // torso
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(cx - 28, shY);
  ctx.lineTo(cx + 28, shY);
  ctx.lineTo(cx + 22, hipY + 8);
  ctx.lineTo(cx - 22, hipY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // arms
  const handY = shY + Math.sin(armUp) * h * 0.22;
  const handXL = cx - 28 + Math.cos(armUp + Math.PI) * h * 0.16;
  const handXR = cx + 28 + Math.cos(armUp) * h * 0.16;
  const handYL = victory ? shY - h * 0.18 : handY;
  const handYR = victory ? shY - h * 0.2 : shY + h * 0.2;
  limb(cx - 26, shY + 6, handXL, handYL, h * 0.042, skin);
  limb(cx + 26, shY + 6, handXR, handYR, h * 0.042, skin);

  // head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, headY, h * 0.07, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.08, headY);
  ctx.quadraticCurveTo(cx - h * 0.1, headY - h * 0.16, cx, headY - h * 0.16);
  ctx.quadraticCurveTo(cx + h * 0.12, headY - h * 0.14, cx + h * 0.08, headY + 4);
  ctx.quadraticCurveTo(cx, headY - h * 0.04, cx - h * 0.08, headY);
  ctx.fill();

  ctx.fillStyle = p?.eyes ?? '#111';
  ctx.beginPath();
  ctx.ellipse(cx - 10, headY + 4, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 10, headY + 4, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  tex.refresh();
  return key;
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return `rgba(41,231,255,${a})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
