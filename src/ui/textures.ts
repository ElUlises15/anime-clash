import Phaser from 'phaser';
import { C } from './theme';

/** Generate shared UI textures once in Boot. Safe to call again (skips existing keys). */
export function generateSharedTextures(scene: Phaser.Scene): void {
  px(scene);
  glow(scene, 'ui-glow', 160, 0xffffff);
  glow(scene, 'ui-glow-magenta', 180, C.magenta);
  glow(scene, 'ui-glow-cyan', 180, C.cyan);
  glow(scene, 'ui-glow-gold', 180, C.gold);
  spark(scene);
  particle(scene);
  halo(scene);
  halftone(scene);
  speedlines(scene);
  noise(scene);
  star(scene);
  pip(scene);
  panel(scene);
  slash(scene);
  logo(scene);
  readyStamp(scene);
  corner(scene);
  energyOrb(scene);
}

function has(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): CanvasRenderingContext2D | null {
  if (has(scene, key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return null;
  return tex.getContext();
}

function refresh(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture | Phaser.Textures.Texture;
  if (tex && typeof (tex as Phaser.Textures.CanvasTexture).refresh === 'function') {
    (tex as Phaser.Textures.CanvasTexture).refresh();
  }
}

function px(scene: Phaser.Scene): void {
  const ctx = canvas(scene, 'ui-px', 4, 4);
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 4, 4);
  refresh(scene, 'ui-px');
}

function glow(scene: Phaser.Scene, key: string, size: number, color: number): void {
  const ctx = canvas(scene, key, size, size);
  if (!ctx) return;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const cx = size / 2;
  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grd.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  grd.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
  grd.addColorStop(0.7, `rgba(${r},${g},${b},0.1)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  refresh(scene, key);
}

function spark(scene: Phaser.Scene): void {
  const s = 24;
  const ctx = canvas(scene, 'ui-spark', s, s);
  if (!ctx) return;
  const cx = s / 2;
  ctx.translate(cx, cx);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 11 : 3;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  refresh(scene, 'ui-spark');
}

function particle(scene: Phaser.Scene): void {
  const ctx = canvas(scene, 'ui-particle', 12, 12);
  if (!ctx) return;
  const grd = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,230,120,0.8)');
  grd.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 12, 12);
  refresh(scene, 'ui-particle');
}

function halo(scene: Phaser.Scene): void {
  const s = 256;
  const ctx = canvas(scene, 'ui-halo', s, s);
  if (!ctx) return;
  const grd = ctx.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,210,63,0.0)');
  grd.addColorStop(0.45, 'rgba(255,46,136,0.18)');
  grd.addColorStop(0.75, 'rgba(41,231,255,0.12)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, s, s);
  refresh(scene, 'ui-halo');
}

function halftone(scene: Phaser.Scene): void {
  const s = 256;
  const ctx = canvas(scene, 'ui-halftone', s, s);
  if (!ctx) return;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const step = 10;
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
      const r = (1 - d) * 2.4;
      if (r < 0.3) continue;
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  refresh(scene, 'ui-halftone');
}

function speedlines(scene: Phaser.Scene): void {
  const s = 512;
  const ctx = canvas(scene, 'ui-speedlines', s, s);
  if (!ctx) return;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const o = (i / 28) * s * 1.6 - s * 0.3;
    ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
    ctx.lineWidth = 1 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(o, -20);
    ctx.lineTo(o + s * 0.55, s + 20);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  refresh(scene, 'ui-speedlines');
}

function noise(scene: Phaser.Scene): void {
  const s = 128;
  const ctx = canvas(scene, 'ui-noise', s, s);
  if (!ctx) return;
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 180 + Math.random() * 75;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28 + Math.random() * 20;
  }
  ctx.putImageData(img, 0, 0);
  refresh(scene, 'ui-noise');
}

function star(scene: Phaser.Scene): void {
  const s = 32;
  const ctx = canvas(scene, 'ui-star', s, s);
  if (!ctx) return;
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#3a2208';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  refresh(scene, 'ui-star');
  // empty star
  const ctx2 = canvas(scene, 'ui-star-empty', s, s);
  if (!ctx2) return;
  ctx2.translate(s / 2, s / 2);
  ctx2.strokeStyle = 'rgba(255,210,63,0.45)';
  ctx2.lineWidth = 2;
  ctx2.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx2.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx2.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx2.closePath();
  ctx2.stroke();
  refresh(scene, 'ui-star-empty');
}

function pip(scene: Phaser.Scene): void {
  const draw = (key: string, fill: string) => {
    const ctx = canvas(scene, key, 28, 18);
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.lineTo(26, 1);
    ctx.lineTo(20, 17);
    ctx.lineTo(2, 17);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.stroke();
    refresh(scene, key);
  };
  draw('ui-pip-on', '#ffd23f');
  draw('ui-pip-off', 'rgba(20,16,32,0.9)');
}

function panel(scene: Phaser.Scene): void {
  const w = 64, h = 64;
  const ctx = canvas(scene, 'ui-panel', w, h);
  if (!ctx) return;
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(28,24,48,0.95)');
  grd.addColorStop(1, 'rgba(10,8,20,0.95)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(41,231,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  refresh(scene, 'ui-panel');
}

function slash(scene: Phaser.Scene): void {
  const w = 96, h = 256;
  const ctx = canvas(scene, 'ui-slash', w, h);
  if (!ctx) return;
  const grd = ctx.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, 'rgba(41,231,255,0)');
  grd.addColorStop(0.35, 'rgba(41,231,255,0.85)');
  grd.addColorStop(0.5, 'rgba(255,255,255,1)');
  grd.addColorStop(0.65, 'rgba(255,46,136,0.85)');
  grd.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w - 40, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  refresh(scene, 'ui-slash');
}

function logo(scene: Phaser.Scene): void {
  const w = 1500, h = 280;
  const ctx = canvas(scene, 'logo-anime-clash', w, h);
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 148px Impact, "Arial Black", sans-serif';

  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 48;
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#07040c';
  ctx.strokeText('ANIME CLASH', w / 2, h / 2 + 6);
  ctx.restore();

  ctx.lineWidth = 18;
  ctx.strokeStyle = '#0a0614';
  ctx.strokeText('ANIME CLASH', w / 2, h / 2);

  const grd = ctx.createLinearGradient(0, 40, 0, h - 30);
  grd.addColorStop(0, '#fff7c8');
  grd.addColorStop(0.28, '#ffd23f');
  grd.addColorStop(0.52, '#ff2e88');
  grd.addColorStop(0.78, '#c43bff');
  grd.addColorStop(1, '#29e7ff');
  ctx.fillStyle = grd;
  ctx.fillText('ANIME CLASH', w / 2, h / 2);

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeText('ANIME CLASH', w / 2, h / 2);

  // inner highlight slice
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 48, w, 52);
  ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ANIME CLASH', w / 2, h / 2);
  ctx.restore();

  refresh(scene, 'logo-anime-clash');
}

function readyStamp(scene: Phaser.Scene): void {
  const w = 280, h = 90;
  const ctx = canvas(scene, 'ui-ready-stamp', w, h);
  if (!ctx) return;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.18);
  roundRect(ctx, -120, -30, 240, 60, 6);
  ctx.fillStyle = 'rgba(180,16,48,0.88)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffd23f';
  ctx.stroke();
  ctx.font = 'italic 42px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2a0810';
  ctx.strokeText('READY', 0, 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('READY', 0, 2);
  refresh(scene, 'ui-ready-stamp');
}

function corner(scene: Phaser.Scene): void {
  const ctx = canvas(scene, 'ui-corner', 80, 80);
  if (!ctx) return;
  ctx.strokeStyle = '#29e7ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, 56);
  ctx.lineTo(8, 8);
  ctx.lineTo(56, 8);
  ctx.stroke();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 68);
  ctx.lineTo(8, 8);
  ctx.lineTo(68, 8);
  ctx.stroke();
  refresh(scene, 'ui-corner');
}

function energyOrb(scene: Phaser.Scene): void {
  const s = 32;
  const ctx = canvas(scene, 'ui-orb', s, s);
  if (!ctx) return;
  const grd = ctx.createRadialGradient(12, 10, 2, 16, 16, 15);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.3, '#29e7ff');
  grd.addColorStop(0.7, '#ff2e88');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, s, s);
  refresh(scene, 'ui-orb');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
