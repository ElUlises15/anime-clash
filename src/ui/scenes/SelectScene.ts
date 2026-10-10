import Phaser from 'phaser';
import { getActiveRoom } from '../../networking';
import type { Room } from '../../networking/types';
import { attachOnlineOverlay } from '../onlineOverlay';
import { onlineFightData } from '../online';
import type { CharacterDef } from '../../characters/types';
import { GAME_W, GAME_H, SCENES, type GameMode, type SelectSceneData, type FightSceneData } from '../sceneData';
import { audio } from '../../audio/AudioEngine';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import { ArcadeButton, arcadeText, bodyText, fillPara, strokePara, hintBar, slantPanel } from '../widgets';
import { C, DEPTH, HEX } from '../theme';
import { listFranchises, loadRegistry, resetRegistryCache, type FranchiseGroup } from '../roster';
import { makeFullBodyTexture, makePortraitTexture, loadPortraitModule } from '../portraitAdapter';

interface Cell {
  def: CharacterDef;
  row: number;
  col: number;
  x: number;
  y: number;
  card: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
}

export class SelectScene extends Phaser.Scene {
  private room?: Room;
  private onlineStatus?: Phaser.GameObjects.Text;
  private readyButton?: ArcadeButton;
  private readyAt: number | null = null;
  private mode: GameMode = 'versus';
  private cells: Cell[] = [];
  private rows: Cell[][] = [];
  private cursor: [{ r: number; c: number }, { r: number; c: number }] = [{ r: 0, c: 0 }, { r: 0, c: 0 }];
  private confirmed: [boolean, boolean] = [false, false];
  private locked: [CharacterDef | null, CharacterDef | null] = [null, null];
  private trainingStep: 'p1' | 'dummy' = 'p1';
  private launching = false;
  private waiting = false;
  private previewKey: [string, string] = ['', ''];
  private p1Name!: Phaser.GameObjects.Text;
  private p2Name!: Phaser.GameObjects.Text;
  private p1Meta!: Phaser.GameObjects.Text;
  private p2Meta!: Phaser.GameObjects.Text;
  private p1Desc!: Phaser.GameObjects.Text;
  private p2Desc!: Phaser.GameObjects.Text;
  private p1Moves!: Phaser.GameObjects.Text;
  private p2Moves!: Phaser.GameObjects.Text;
  private p1Img?: Phaser.GameObjects.Image;
  private p2Img?: Phaser.GameObjects.Image;
  private p1Ready?: Phaser.GameObjects.Image;
  private p2Ready?: Phaser.GameObjects.Image;
  private p1Stats!: Phaser.GameObjects.Graphics;
  private p2Stats!: Phaser.GameObjects.Graphics;
  private banner!: Phaser.GameObjects.Text;
  private fightBanner?: Phaser.GameObjects.Text;
  private gridRoot?: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.Select);
  }

  create(data: SelectSceneData): void {
    this.mode = data?.mode ?? 'versus';
    this.room = this.mode === 'online' ? getActiveRoom() ?? undefined : undefined;
    this.readyAt = null;
    this.previewKey = ['', ''];
    this.p1Img = undefined; this.p2Img = undefined;
    if (this.mode === 'online' && !this.room) { goTo(this, SCENES.Title); return; }
    this.confirmed = [false, false];
    this.locked = [null, null];
    this.trainingStep = 'p1';
    this.launching = false;
    this.cells = [];
    this.rows = [];

    playIntroWipe(this);
    attachArcadeBackground(this, 'select');
    audio.music('menu');

    arcadeText(this, GAME_W / 2, 48, 'ELEGÍ TU LUCHADOR', 48, HEX.gold).setLetterSpacing(6);
    const sub = this.mode === 'online' ? `ONLINE · VOS SOS P${this.room!.snapshot.me + 1} · J elegir / READY · K deshacer` : this.mode === 'training' ? 'TRAINING  ·  primero vos, después el dummy' : 'LOCAL VS  ·  P1 y P2 al mismo tiempo';
    arcadeText(this, GAME_W / 2, 92, sub, 20, HEX.cyan, { stroke: 4 });

    this.buildPreviews();
    this.banner = arcadeText(this, GAME_W / 2, 150, '', 26, HEX.orange, { stroke: 5 });
    this.refreshBanner();

    hintBar(this, this.mode === 'online'
      ? 'WASD / flechas mover · J elegir / READY · K deshacer · ESC sala'
      : this.mode === 'training'
      ? 'P1  A/D/W/S mover  ·  J / CLICK confirmar  ·  K / ESC volver'
      : 'P1  WASD + J  ·  P2  flechas + Núm1 / ,  ·  ESC título');

    markUi(SCENES.Select, this);
    this.bindInput();
    if (this.room) {
      const room = this.room;
      this.onlineStatus = arcadeText(this, 960, 1000, '', 20, HEX.cyan);
      this.readyButton = new ArcadeButton(this, 960, 950, 'READY', () => this.confirm(room.snapshot.me), { w: 320, h: 48, size: 24 });
      const unsub = room.on(e => {
        if (e.type === 'matchStart') { this.launching = true; goTo(this, SCENES.Fight, onlineFightData(room, e.match, e.resume)); }
        else if (e.type === 'toLobby') goTo(this, SCENES.Lobby, { action: 'resume' });
        else this.syncOnline();
      });
      this.events.once('shutdown', unsub);
      attachOnlineOverlay(this, room, { onClosed: () => { this.launching = true; } });
      this.time.addEvent({ delay: 100, loop: true, callback: () => this.syncOnline() });
    }
    void this.bootRoster();
  }

  private async bootRoster(): Promise<void> {
    this.waiting = true;
    await loadPortraitModule();
    let groups = listFranchises();
    if (!groups.length) {
      resetRegistryCache();
      await loadRegistry();
      groups = listFranchises();
    }
    if (!groups.length) {
      this.banner.setText('Cargando roster…');
      for (let i = 0; i < 40 && !groups.length; i++) {
        await new Promise((r) => setTimeout(r, 250));
        resetRegistryCache();
        await loadRegistry();
        groups = listFranchises();
      }
    }
    this.waiting = false;
    if (!groups.length) {
      this.banner.setText('Todavía no hay luchadores registrados');
      return;
    }
    if (!this.scene.isActive()) return;
    this.buildGrid(groups);
    if (this.room) {
      const me = this.room.snapshot.me;
      if (this.room.snapshot.players[me].cursor === null) { const cur = this.cursor[me]; this.room.setCursor(this.cells.findIndex(c => c.row === cur.r && c.col === cur.c)); }
      this.syncOnline();
    } else this.refreshAll();
  }

  private buildPreviews(): void {
    slantPanel(this, 24, 130, 430, 820, { accent: C.cyan, skew: 24, alpha: 0.8 });
    slantPanel(this, GAME_W - 454, 130, 430, 820, { accent: C.magenta, skew: 24, alpha: 0.8 });

    arcadeText(this, 240, 158, 'PLAYER 1', 22, HEX.cyan, { stroke: 4 });
    arcadeText(this, GAME_W - 240, 158, this.mode === 'training' ? 'DUMMY' : 'PLAYER 2', 22, HEX.magenta, { stroke: 4 });

    this.p1Name = arcadeText(this, 240, 618, '—', 32, HEX.cream, { stroke: 6 });
    this.p2Name = arcadeText(this, GAME_W - 240, 618, '—', 32, HEX.cream, { stroke: 6 });
    this.p1Meta = arcadeText(this, 240, 652, '', 16, HEX.cyan, { stroke: 4 });
    this.p2Meta = arcadeText(this, GAME_W - 240, 652, '', 16, HEX.magenta, { stroke: 4 });
    this.p1Desc = bodyText(this, 240, 674, '', 13, HEX.dim, [0.5, 0]).setWordWrapWidth(360).setAlign('center');
    this.p2Desc = bodyText(this, GAME_W - 240, 674, '', 13, HEX.dim, [0.5, 0]).setWordWrapWidth(360).setAlign('center');
    this.p1Moves = arcadeText(this, 240, 748, '', 15, HEX.gold, { origin: [0.5, 0], stroke: 4 });
    this.p2Moves = arcadeText(this, GAME_W - 240, 748, '', 15, HEX.gold, { origin: [0.5, 0], stroke: 4 });
    this.p1Stats = this.add.graphics();
    this.p2Stats = this.add.graphics();
    arcadeText(this, 58, 812, 'POW\nSPD\nMOB\nDEF\nNRG', 12, HEX.dim, { origin: [0, 0], stroke: 3, italic: false }).setLineSpacing(6);
    arcadeText(this, 1518, 812, 'POW\nSPD\nMOB\nDEF\nNRG', 12, HEX.dim, { origin: [0, 0], stroke: 3, italic: false }).setLineSpacing(6);

    this.p1Ready = this.add.image(240, 380, 'ui-ready-stamp').setVisible(false).setDepth(DEPTH.fx);
    this.p2Ready = this.add.image(GAME_W - 240, 380, 'ui-ready-stamp').setVisible(false).setDepth(DEPTH.fx);
  }

  private buildGrid(groups: FranchiseGroup[]): void {
    this.gridRoot?.destroy(true);
    this.gridRoot = this.add.container(0, 0);
    this.cells = [];
    this.rows = [];

    const cardW = 168;
    const cardH = 228;
    const gapX = 18;
    const startY = 188;
    let row = 0;
    let y = startY;

    for (const g of groups) {
      if (!g.characters.length) continue;
      const header = arcadeText(this, GAME_W / 2, y, g.name.toUpperCase(), 22, HEX.orange, { stroke: 5 });
      this.gridRoot.add(header);
      y += 36;
      const n = g.characters.length;
      const totalW = n * cardW + (n - 1) * gapX;
      const x0 = GAME_W / 2 - totalW / 2 + cardW / 2;
      const rowCells: Cell[] = [];
      g.characters.forEach((def, col) => {
        const x = x0 + col * (cardW + gapX);
        const cell = this.makeCard(def, x, y + cardH / 2, cardW, cardH, row, col);
        rowCells.push(cell);
        this.cells.push(cell);
        this.gridRoot!.add(cell.card);
      });
      this.rows.push(rowCells);
      y += cardH + 28;
      row++;
    }

    if (this.rows.length) {
      this.cursor[0] = { r: 0, c: 0 };
      const last = this.rows[this.rows.length - 1];
      this.cursor[1] = { r: this.rows.length - 1, c: Math.max(0, last.length - 1) };
      if (this.mode === 'training') this.cursor[1] = { r: 0, c: 0 };
    }
  }

  private makeCard(def: CharacterDef, x: number, y: number, w: number, h: number, row: number, col: number): Cell {
    const card = this.add.container(x, y);
    const frame = this.add.graphics();
    const key = makePortraitTexture(this, def, `sel-p-${def.id}`, 140);
    const img = this.add.image(0, -28, key).setDisplaySize(132, 132);
    const name = arcadeText(this, 0, 58, def.name, 18, HEX.cream, { stroke: 4 });
    const arch = arcadeText(this, 0, 80, def.archetype, 12, HEX.cyan, { stroke: 3 });
    const stars = this.add.container(0, 100);
    for (let i = 0; i < 5; i++) {
      const s = this.add.image((i - 2) * 16, 0, i < def.difficulty ? 'ui-star' : 'ui-star-empty').setScale(0.45);
      stars.add(s);
    }
    card.add([frame, img, name, arch, stars]);
    card.setSize(w, h);
    card.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    card.input!.cursor = 'pointer';
    card.on('pointerover', () => {
      if (this.launching) return;
      const p = this.mousePlayer();
      if (p === null) return;
      this.setCursor(p, row, col);
    });
    card.on('pointerup', () => {
      if (this.launching) return;
      const p = this.mousePlayer();
      if (p === null) return;
      if (this.sameCell(p, row, col)) this.confirm(p);
      else this.setCursor(p, row, col);
    });
    this.paintCard(frame, w, h, false, false);
    return { def, row, col, x, y, card, frame };
  }

  private paintCard(g: Phaser.GameObjects.Graphics, w: number, h: number, p1: boolean, p2: boolean): void {
    g.clear();
    const accent = p1 && p2 ? C.gold : p1 ? C.cyan : p2 ? C.magenta : 0x3a415c;
    fillPara(g, -w / 2, -h / 2, w, h, 14, 0x101018, 0.92);
    strokePara(g, -w / 2, -h / 2, w, h, 14, accent, p1 || p2 ? 4 : 2);
    if (p1 || p2) {
      strokePara(g, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 10, C.white, 1, 0.35);
    }
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat || this.launching) return;
      const c = e.code;
      if (this.room) {
        const me = this.room.snapshot.me;
        if (c === 'Escape') { this.room.returnToRoom(); goTo(this, SCENES.Lobby, { action: 'resume' }); }
        else if (c === 'KeyA' || c === 'ArrowLeft') this.move(me, 0, -1);
        else if (c === 'KeyD' || c === 'ArrowRight') this.move(me, 0, 1);
        else if (c === 'KeyW' || c === 'ArrowUp') this.move(me, -1, 0);
        else if (c === 'KeyS' || c === 'ArrowDown') this.move(me, 1, 0);
        else if (c === 'KeyJ' || c === 'Enter' || c === 'Space') this.confirm(me);
        else if (c === 'KeyK') this.back(me);
        return;
      }
      if (c === 'Escape') {
        this.back(0);
        return;
      }
      // P1
      if (c === 'KeyA') this.move(0, 0, -1);
      else if (c === 'KeyD') this.move(0, 0, 1);
      else if (c === 'KeyW') this.move(0, -1, 0);
      else if (c === 'KeyS') this.move(0, 1, 0);
      else if (c === 'KeyJ' || c === 'Enter' || c === 'Space') this.confirm(0);
      else if (c === 'KeyK') this.back(0);

      if (this.mode === 'versus') {
        if (c === 'ArrowLeft') this.move(1, 0, -1);
        else if (c === 'ArrowRight') this.move(1, 0, 1);
        else if (c === 'ArrowUp') this.move(1, -1, 0);
        else if (c === 'ArrowDown') this.move(1, 1, 0);
        else if (c === 'Numpad1' || c === 'Comma') this.confirm(1);
        else if (c === 'Numpad2' || c === 'Period') this.back(1);
      }
    });
  }

  private mousePlayer(): 0 | 1 | null {
    if (this.room) return this.room.snapshot.me;
    if (this.mode === 'training') {
      if (this.trainingStep === 'p1') return this.confirmed[0] ? null : 0;
      return this.confirmed[1] ? null : 1;
    }
    return this.confirmed[0] ? null : 0;
  }

  private move(player: 0 | 1, dr: number, dc: number): void {
    if (this.waiting || !this.rows.length) return;
    if (this.mode === 'training' && player === 1) return;
    if (this.mode === 'training') {
      player = this.trainingStep === 'dummy' ? 1 : 0;
    }
    if (this.confirmed[player]) return;
    const cur = this.cursor[player];
    let r = Phaser.Math.Clamp(cur.r + dr, 0, this.rows.length - 1);
    const row = this.rows[r];
    let c = Phaser.Math.Clamp(cur.c + dc, 0, row.length - 1);
    if (dr !== 0) c = Phaser.Math.Clamp(cur.c, 0, row.length - 1);
    this.setCursor(player, r, c);
  }

  private setCursor(player: 0 | 1, r: number, c: number): void {
    if (this.confirmed[player]) return;
    const prev = this.cursor[player];
    if (prev.r !== r || prev.c !== c) audio.playSfx('uiMove');
    this.cursor[player] = { r, c };
    if (this.room) { this.room.setCursor(this.cells.findIndex(cell => cell.row === r && cell.col === c)); return; }
    this.refreshAll();
  }

  private sameCell(player: 0 | 1, r: number, c: number): boolean {
    return this.cursor[player].r === r && this.cursor[player].c === c;
  }

  private hovered(player: 0 | 1): Cell | null {
    const { r, c } = this.cursor[player];
    return this.rows[r]?.[c] ?? null;
  }

  private confirm(player: 0 | 1): void {
    if (this.waiting || !this.rows.length || this.launching) return;
    if (this.room) {
      const slot = this.room.snapshot.players[this.room.snapshot.me];
      if (!slot.connected || !this.room.snapshot.players.every(p => p.connected)) return;
      if (slot.ready) return;
      if (slot.charId) this.room.setReady(true);
      else { const cell = this.hovered(this.room.snapshot.me); if (cell) this.room.selectCharacter(cell.def.id); }
      audio.playSfx('ready'); this.syncOnline(); return;
    }
    if (this.mode === 'training') {
      if (this.trainingStep === 'p1') {
        const cell = this.hovered(0);
        if (!cell) return;
        this.locked[0] = cell.def;
        this.confirmed[0] = true;
        this.trainingStep = 'dummy';
        this.cursor[1] = { ...this.cursor[0] };
        audio.playSfx('ready');
        this.refreshBanner();
        this.refreshAll();
        return;
      }
      const cell = this.hovered(1);
      if (!cell) return;
      this.locked[1] = cell.def;
      this.confirmed[1] = true;
      audio.playSfx('ready');
      this.refreshAll();
      this.maybeFight();
      return;
    }
    if (this.confirmed[player]) return;
    const cell = this.hovered(player);
    if (!cell) return;
    this.locked[player] = cell.def;
    this.confirmed[player] = true;
    audio.playSfx('ready');
    this.refreshAll();
    this.maybeFight();
  }

  private back(player: 0 | 1): void {
    if (this.launching) return;
    if (this.room) {
      const slot = this.room.snapshot.players[this.room.snapshot.me];
      if (slot.ready) this.room.setReady(false);
      else if (slot.charId) this.room.selectCharacter(null);
      else { this.room.returnToRoom(); goTo(this, SCENES.Lobby, { action: 'resume' }); }
      this.syncOnline(); return;
    }
    if (this.mode === 'training') {
      if (this.trainingStep === 'dummy') {
        this.confirmed[0] = false;
        this.locked[0] = null;
        this.trainingStep = 'p1';
        audio.playSfx('uiBack');
        this.refreshBanner();
        this.refreshAll();
        return;
      }
      audio.playSfx('uiBack');
      goTo(this, SCENES.Title);
      return;
    }
    if (this.confirmed[player]) {
      this.confirmed[player] = false;
      this.locked[player] = null;
      audio.playSfx('uiBack');
      this.refreshAll();
      return;
    }
    if (player === 0) {
      audio.playSfx('uiBack');
      goTo(this, SCENES.Title);
    }
  }

  private maybeFight(): void {
    const both = this.confirmed[0] && this.confirmed[1];
    if (!both) return;
    this.launching = true;
    audio.playSfx('fight');
    this.fightBanner = arcadeText(this, GAME_W / 2, GAME_H / 2, 'FIGHT!', 120, HEX.gold, { stroke: 14 })
      .setDepth(DEPTH.modal)
      .setScale(0.4);
    this.tweens.add({
      targets: this.fightBanner,
      scale: 1.05,
      duration: 220,
      ease: 'Back.out',
    });
    const p1 = this.locked[0]!;
    const p2 = this.locked[1]!;
    const data: FightSceneData = {
      mode: this.mode,
      p1: p1.id,
      p2: p2.id,
      controllers: this.mode === 'training' ? ['p1keys', 'dummy'] : ['p1keys', 'p2keys'],
    };
    this.time.delayedCall(900, () => {
      audio.music('battle');
      goTo(this, SCENES.Fight, data, 'slash');
    });
  }

  private refreshBanner(): void {
    if (this.mode === 'training') {
      this.banner.setText(this.trainingStep === 'p1' ? 'Elegí tu luchador' : 'Elegí el dummy');
    } else {
      this.banner.setText('');
    }
  }

  private refreshAll(): void {
    const p1cell = this.room && this.room.snapshot.players[0].cursor === null && !this.confirmed[0] ? null : this.confirmed[0] ? this.cellOf(this.locked[0]) : this.hovered(0);
    const p2cell = this.room && this.room.snapshot.players[1].cursor === null && !this.confirmed[1] ? null : this.confirmed[1] ? this.cellOf(this.locked[1]) : this.hovered(this.mode === 'training' && this.trainingStep === 'p1' ? 0 : 1);
    // When training step p1, P2 preview follows P1 hover as a ghost? Better leave P2 empty until dummy pick.
    const p2show = this.mode === 'training' && this.trainingStep === 'p1' ? null : p2cell;

    for (const cell of this.cells) {
      const isP1 = p1cell?.def.id === cell.def.id && this.samePos(this.cursor[0], cell);
      const isP2 = (this.mode === 'versus' || this.mode === 'online')
        ? (p2cell?.def.id === cell.def.id && this.samePos(this.cursor[1], cell))
        : (this.trainingStep === 'dummy' && p2cell?.def.id === cell.def.id && this.samePos(this.cursor[1], cell));
      this.paintCard(cell.frame, 168, 228, !!isP1, !!isP2);
      cell.card.setScale(isP1 || isP2 ? 1.06 : 1);
    }

    this.refreshPreview(0, p1cell?.def ?? null);
    this.refreshPreview(1, p2show?.def ?? (this.locked[1] ?? null));
    this.p1Ready?.setVisible(this.room ? this.room.snapshot.players[0].ready : this.confirmed[0]);
    this.p2Ready?.setVisible(this.room ? this.room.snapshot.players[1].ready : this.confirmed[1]);
  }

  private syncOnline(): void {
    if (!this.room || !this.cells.length || this.launching) return;
    const s = this.room.snapshot;
    s.players.forEach((slot, i) => {
      const side = i as 0 | 1;
      const locked = this.cells.find(cell => cell.def.id === slot.charId);
      const cell = locked ?? (slot.cursor === null ? undefined : this.cells[slot.cursor]);
      if (cell) this.cursor[side] = { r: cell.row, c: cell.col };
      this.locked[side] = locked?.def ?? null;
      this.confirmed[side] = !!locked;
    });
    if (s.phase === 'ready') this.readyAt ??= Date.now(); else this.readyAt = null;
    const countdown = this.readyAt === null ? '' : ` · ${Math.max(1, 3 - Math.floor((Date.now() - this.readyAt) / 1000))}`;
    const mine = s.players[s.me];
    this.banner.setText(s.phase === 'ready' ? `READY${countdown}` : mine.ready ? 'ESPERANDO AL RIVAL...' : mine.charId ? 'J / ENTER PARA READY · K DESBLOQUEAR' : 'ELEGÍ TU LUCHADOR');
    this.onlineStatus?.setText(`RIVAL ${s.players[1 - s.me].connected ? '● CONECTADO' : '○ DESCONECTADO'} · PING ${s.ping ?? '—'} ms`);
    this.readyButton?.setLabel(mine.ready ? 'READY ✓' : mine.charId ? 'READY' : 'ELEGIR');
    this.readyButton?.setEnabled(!mine.ready && s.players.every(p => p.connected) && ['selecting', 'ready'].includes(s.phase));
    this.refreshAll();
  }

  private samePos(cur: { r: number; c: number }, cell: Cell): boolean {
    return cur.r === cell.row && cur.c === cell.col;
  }

  private cellOf(def: CharacterDef | null): Cell | null {
    if (!def) return null;
    return this.cells.find((c) => c.def.id === def.id) ?? null;
  }

  private refreshPreview(side: 0 | 1, def: CharacterDef | null): void {
    const name = side === 0 ? this.p1Name : this.p2Name;
    const meta = side === 0 ? this.p1Meta : this.p2Meta;
    const desc = side === 0 ? this.p1Desc : this.p2Desc;
    const moves = side === 0 ? this.p1Moves : this.p2Moves;
    const statsG = side === 0 ? this.p1Stats : this.p2Stats;
    const cx = side === 0 ? 240 : GAME_W - 240;

    if (!def) {
      (side === 0 ? this.p1Img : this.p2Img)?.setVisible(false);
      this.previewKey[side] = '';
      name.setText('—');
      meta.setText('');
      desc.setText('');
      moves.setText('');
      statsG.clear();
      return;
    }
    name.setText(def.name.toUpperCase());
    meta.setText(`${def.franchiseName}  ·  ${def.archetype}`);
    const raw = def.description ?? '';
    desc.setText(raw.length > 140 ? raw.slice(0, 137) + '…' : raw);
    const m1 = def.moves.special1?.name ?? '—';
    const m2 = def.moves.special2?.name ?? '—';
    const ult = def.moves.ultimate?.name ?? '—';
    moves.setText(`SP1  ${m1}\nSP2  ${m2}\nULT  ${ult}`);

    const key = `sel-body-${def.id}-${side}`;
    if (this.previewKey[side] !== key) {
      this.previewKey[side] = key;
      const tex = makeFullBodyTexture(this, def, key, 320, 'idle');
      if (side === 0) {
        this.p1Img?.destroy();
        this.p1Img = this.add.image(cx, 500, tex).setOrigin(0.5, 1).setScale(0.78).setDepth(DEPTH.content);
      } else {
        this.p2Img?.destroy();
        this.p2Img = this.add.image(cx, 500, tex).setOrigin(0.5, 1).setScale(0.78).setFlipX(true).setDepth(DEPTH.content);
      }
    }

    this.drawStats(statsG, side === 0 ? 110 : 1570, 816, def);
  }

  private drawStats(g: Phaser.GameObjects.Graphics, x: number, y: number, def: CharacterDef): void {
    g.clear();
    const keys: Array<keyof CharacterDef['stats']> = ['power', 'speed', 'mobility', 'defense', 'energy'];
    const labels = ['POW', 'SPD', 'MOB', 'DEF', 'NRG'];
    keys.forEach((k, i) => {
      const yy = y + i * 18;
      const v = Phaser.Math.Clamp(def.stats[k] / 10, 0, 1);
      g.fillStyle(0x0a0810, 0.9);
      g.fillRect(x + 50, yy, 220, 10);
      g.fillStyle(i % 2 ? C.cyan : C.magenta, 1);
      g.fillRect(x + 50, yy, 220 * v, 10);
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeRect(x + 50, yy, 220, 10);
    });
    // labels via scene text would leak; bake tiny captions once per refresh by using existing body texts? skip names, color bars are enough.
    void labels;
  }
}
