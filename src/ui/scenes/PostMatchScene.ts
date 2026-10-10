import Phaser from 'phaser';
import { GAME_W, GAME_H, SCENES, type PostMatchSceneData, type MatchResult } from '../sceneData';
import { audio } from '../../audio/AudioEngine';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import {
  ArcadeButton, MenuController, arcadeText, hintBar, slantPanel, showToast,
} from '../widgets';
import { C, HEX } from '../theme';
import { getCharacter, loadRegistry, listCharacters } from '../roster';
import { makeFullBodyTexture, loadPortraitModule } from '../portraitAdapter';
import type { CharacterDef } from '../../characters/types';
import type { MatchStats, PlayerIndex } from '../../game/sim/types';

export class PostMatchScene extends Phaser.Scene {
  private result!: MatchResult;
  private menu?: MenuController;

  constructor() {
    super(SCENES.PostMatch);
  }

  create(data: PostMatchSceneData): void {
    playIntroWipe(this);
    attachArcadeBackground(this, 'post');
    audio.music('menu');

    this.result = data?.result ?? fallbackResult();
    const r = this.result;

    void this.paint(r);
    markUi(SCENES.PostMatch, this);
  }

  private async paint(r: MatchResult): Promise<void> {
    await loadPortraitModule();
    await loadRegistry();

    const d1 = getCharacter(r.p1);
    const d2 = getCharacter(r.p2);
    const n1 = d1?.name ?? r.p1;
    const n2 = d2?.name ?? r.p2;
    const f1 = d1?.franchiseName ?? '';
    const f2 = d2?.franchiseName ?? '';

    const winner: PlayerIndex | -1 = r.winner;
    const headline = winner === 0 ? 'P1 WINS' : winner === 1 ? 'P2 WINS' : 'DRAW';
    arcadeText(this, GAME_W / 2, 58, 'WINNER', 28, HEX.gold, { stroke: 5 }).setLetterSpacing(10);
    arcadeText(this, GAME_W / 2, 118, headline, 72, winner === 1 ? HEX.magenta : winner === 0 ? HEX.cyan : HEX.gold, { stroke: 10 })
      .setLetterSpacing(8);

    this.drawFighter(d1, n1, f1, 420, winner === 0, winner !== 0 && winner !== -1);
    this.drawFighter(d2, n2, f2, GAME_W - 420, winner === 1, winner !== 1 && winner !== -1, true);

    this.drawStats(r);
    this.drawHistory(r);
    this.drawButtons(r);
    hintBar(this, 'ENTER / J confirmar  ·  ESC volver');
  }

  private drawFighter(
    def: CharacterDef | undefined,
    name: string,
    franchise: string,
    x: number,
    isWinner: boolean,
    dim: boolean,
    flip = false,
  ): void {
    if (def) {
      const key = `post-body-${def.id}-${flip ? 'r' : 'l'}-${isWinner ? 'v' : 'l'}`;
      const tex = makeFullBodyTexture(this, def, key, 380, isWinner ? 'victory' : 'idle');
      const img = this.add.image(x, 430, tex);
      if (flip) img.setFlipX(true);
      if (dim) img.setAlpha(0.38).setTint(0x6688aa);
      if (isWinner) {
        const halo = this.add.image(x, 400, 'ui-halo').setScale(2.2, 2.8).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: halo, alpha: { from: 0.4, to: 0.85 }, duration: 900, yoyo: true, repeat: -1 });
      }
    }
    arcadeText(this, x, 640, name.toUpperCase(), 32, isWinner ? HEX.gold : HEX.cream, { stroke: 6 });
    arcadeText(this, x, 676, franchise, 16, HEX.dim, { stroke: 4 });
  }

  private drawStats(r: MatchResult): void {
    slantPanel(this, 120, 700, 1680, 200, { accent: C.gold, skew: 28, alpha: 0.8 });
    const labels = ['DAÑO', 'HITS', 'MAX COMBO', 'BLOCKS', 'SPECIALS', 'ULTIMATES', 'ROUNDS'];
    const keys: (keyof MatchStats)[] = [
      'damageDealt', 'hitsLanded', 'maxCombo', 'blocks', 'specialsUsed', 'ultimatesUsed', 'roundsWon',
    ];
    arcadeText(this, 260, 728, '', 1);
    labels.forEach((lab, i) => {
      const x = 280 + i * 220;
      arcadeText(this, x, 728, lab, 14, HEX.dim, { stroke: 3 });
      const v1 = r.stats[0][keys[i]] ?? 0;
      const v2 = r.stats[1][keys[i]] ?? 0;
      arcadeText(this, x, 768, String(v1), 26, HEX.cyan, { stroke: 5 });
      arcadeText(this, x, 808, String(v2), 26, HEX.magenta, { stroke: 5 });
    });
    arcadeText(this, 170, 768, 'P1', 18, HEX.cyan, { stroke: 4 });
    arcadeText(this, 170, 808, 'P2', 18, HEX.magenta, { stroke: 4 });
  }

  private drawHistory(r: MatchResult): void {
    const hist = (r.roundWinners ?? []).map((w, i) => {
      const tag = w === 0 ? 'P1' : w === 1 ? 'P2' : 'DRAW';
      return `R${i + 1} ${tag}`;
    }).join('   ·   ');
    arcadeText(this, GAME_W / 2, 880, hist || '—', 18, HEX.cream, { stroke: 4 });
  }

  private drawButtons(r: MatchResult): void {
    const y = 980;
    const online = r.mode === 'online';
    const returnLabel = online ? 'RETURN TO ROOM' : 'RETURN';
    const rematch = new ArcadeButton(this, 300, y, 'REMATCH', () => {
      goTo(this, SCENES.Fight, r.fightData);
    }, { w: 300, h: 58, accent: 'gold', size: 22 });
    const change = new ArcadeButton(this, 640, y, 'CHANGE FIGHTER', () => {
      goTo(this, SCENES.Select, { mode: r.mode });
    }, { w: 340, h: 58, accent: 'cyan', size: 22 });
    const ret = new ArcadeButton(this, 1020, y, returnLabel, () => {
      goTo(this, SCENES.Title);
    }, { w: 360, h: 58, accent: 'magenta', size: 20 });
    const share = new ArcadeButton(this, 1420, y, 'SHARE RESULT', () => {
      void this.share(r);
    }, { w: 320, h: 58, accent: 'orange', size: 22 });

    this.menu = new MenuController(this, [rematch, change, ret, share], {
      horizontal: true,
      onBack: () => goTo(this, SCENES.Title),
    });
  }

  private async share(r: MatchResult): Promise<void> {
    const d1 = getCharacter(r.p1);
    const d2 = getCharacter(r.p2);
    const n1 = d1?.name ?? r.p1;
    const n2 = d2?.name ?? r.p2;
    const w = r.winner === 0 ? n1 : r.winner === 1 ? n2 : 'EMPATE';
    const lines = [
      'ANIME CLASH — RESULTADO',
      `${n1} vs ${n2}`,
      `WINNER: ${w}`,
      `Rounds: ${r.roundWins[0]}-${r.roundWins[1]}  (${(r.roundWinners ?? []).join(',')})`,
      `P1  dmg ${r.stats[0].damageDealt}  hits ${r.stats[0].hitsLanded}  maxcombo ${r.stats[0].maxCombo}  blocks ${r.stats[0].blocks}  sp ${r.stats[0].specialsUsed}  ult ${r.stats[0].ultimatesUsed}`,
      `P2  dmg ${r.stats[1].damageDealt}  hits ${r.stats[1].hitsLanded}  maxcombo ${r.stats[1].maxCombo}  blocks ${r.stats[1].blocks}  sp ${r.stats[1].specialsUsed}  ult ${r.stats[1].ultimatesUsed}`,
    ];
    const text = lines.join('\n');
    const ok = await copyText(text);
    this.snapshotPng();
    showToast(this, ok ? '¡Copiado!' : 'No se pudo copiar');
  }

  private snapshotPng(): void {
    try {
      this.game.renderer.snapshot((img: HTMLImageElement | Phaser.Display.Color) => {
        if (!('src' in img)) return;
        try {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          c.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `anime-clash-result.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }, 'image/png');
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  }
}

function fallbackResult(): MatchResult {
  const chars = listCharacters();
  const a = chars[0]?.id ?? 'goku';
  const b = chars[1]?.id ?? chars[0]?.id ?? 'naruto';
  const empty = { damageDealt: 0, hitsLanded: 0, maxCombo: 0, blocks: 0, specialsUsed: 0, ultimatesUsed: 0, roundsWon: 0 };
  return {
    mode: 'versus',
    p1: a,
    p2: b,
    winner: 0,
    roundWinners: [0, 0],
    roundWins: [2, 0],
    stats: [empty, empty],
    durationFrames: 0,
    fightData: { mode: 'versus', p1: a, p2: b, controllers: ['p1keys', 'p2keys'] },
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

