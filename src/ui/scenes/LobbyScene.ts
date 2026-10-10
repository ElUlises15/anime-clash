import Phaser from 'phaser';
import { audio } from '../../audio/AudioEngine';
import { createOnlineRoom, joinOnlineRoom, getActiveRoom, clearActiveRoom } from '../../networking';
import type { Room, NetError } from '../../networking/types';
import { SCENES, type LobbySceneData } from '../sceneData';
import { attachArcadeBackground, markUi } from '../backdrop';
import { playIntroWipe, goTo } from '../transitions';
import { ArcadeButton, MenuController, arcadeText, slantPanel, hintBar, showToast, copyToClipboard, onlineDialog } from '../widgets';
import { C, HEX } from '../theme';
import { setRoomHash } from '../router';
import { onlineFightData } from '../online';
import { attachOnlineOverlay } from '../onlineOverlay';
import { loadRegistry, getCharacter } from '../roster';
import { loadPortraitModule, makePortraitTexture } from '../portraitAdapter';

export class LobbyScene extends Phaser.Scene {
  private room?: Room;
  private status!: Phaser.GameObjects.Text;
  private cards: Phaser.GameObjects.Text[] = [];
  private portraits: (Phaser.GameObjects.Image | undefined)[] = [];
  private portraitIds: (string | null)[] = [];
  private choose?: ArcadeButton;
  private generation = 0;
  private detachOverlay?: () => void;
  constructor() { super(SCENES.Lobby); }
  create(data: LobbySceneData = { action: 'resume' }): void {
    const generation = ++this.generation;
    this.room = undefined; this.cards = []; this.portraits = []; this.portraitIds = [];
    playIntroWipe(this); attachArcadeBackground(this, 'select'); audio.music('menu');
    arcadeText(this, 960, 100, 'ONLINE · ROOM', 52, HEX.magenta);
    this.status = arcadeText(this, 960, 460, data.action === 'create' ? 'CREANDO SALA...' : `CONECTANDO A ${data.code ?? 'LA SALA'}...`, 30, HEX.cyan);
    this.tweens.add({ targets: this.status, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    const cancel = new ArcadeButton(this, 960, 900, 'SALIR', () => this.leave());
    let menu = new MenuController(this, [cancel], { onBack: () => this.leave() });
    markUi(SCENES.Lobby, this);
    this.events.once('shutdown', () => { ++this.generation; });
    void (async () => {
      try {
        const room = data.action === 'create' ? await createOnlineRoom() : data.action === 'join' ? await joinOnlineRoom(data.code ?? '') : getActiveRoom();
        if (generation !== this.generation || !this.scene.isActive()) { if (room && room === getActiveRoom()) clearActiveRoom(); return; }
        if (!room) { this.leave(); return; }
        this.room = room;
        const unsub = room.on(e => {
          if (e.type === 'matchStart') goTo(this, SCENES.Fight, onlineFightData(room, e.match, e.resume));
        });
        this.events.once('shutdown', unsub);
        await Promise.all([loadRegistry(), loadPortraitModule()]);
        if (generation !== this.generation || !this.scene.isActive()) return;
        menu.destroy(); cancel.destroy(); this.tweens.killTweensOf(this.status); this.status.setAlpha(1).setPosition(960, 810);
        setRoomHash(room.snapshot.code);
        (window as unknown as { __acLobby: unknown }).__acLobby = { code: room.snapshot.code, url: room.snapshot.url };
        arcadeText(this, 960, 230, room.snapshot.code, 100, HEX.gold).setLetterSpacing(16);
        arcadeText(this, 960, 325, room.snapshot.url, 20, HEX.dim).setWordWrapWidth(1600);
        const copy = (text: string, label = '¡Link copiado!') => { void copyToClipboard(text).then(ok => { if (this.scene.isActive()) showToast(this, ok ? label : 'No se pudo copiar'); }); };
        const link = new ArcadeButton(this, 680, 395, 'COPIAR LINK', () => copy(room.snapshot.url), { w: 460, size: 24 });
        const code = new ArcadeButton(this, 1240, 395, 'COPIAR CÓDIGO', () => copy(room.snapshot.code, '¡Código copiado!'), { w: 460, size: 24 });
        for (const side of [0, 1]) {
          const x = side === 0 ? 280 : 1020;
          slantPanel(this, x, 470, 620, 280, { accent: side === 0 ? C.cyan : C.magenta });
          this.cards[side] = arcadeText(this, x + 360, 600, '', 24, side === 0 ? HEX.cyan : HEX.magenta).setLineSpacing(15);
        }
        this.choose = new ArcadeButton(this, 680, 910, 'ELEGIR LUCHADOR', () => goTo(this, SCENES.Select, { mode: 'online' }), { w: 540, size: 27 });
        const leave = new ArcadeButton(this, 1280, 910, 'SALIR', () => this.leave(), { w: 400, accent: 'magenta' });
        menu = new MenuController(this, [this.choose, link, code, leave], { onBack: () => this.leave() });
        hintBar(this, 'W/S · ENTER / J confirmar · ESC / K salir');
        const refreshUnsub = room.on(() => this.refresh());
        this.events.once('shutdown', refreshUnsub);
        this.detachOverlay = attachOnlineOverlay(this, room);
        this.time.addEvent({ delay: 250, loop: true, callback: () => this.refresh() });
        this.refresh();
        if (room.snapshot.role === 'host' && room.snapshot.phase === 'fighting' && room.snapshot.match) goTo(this, SCENES.Fight, onlineFightData(room, room.snapshot.match));
      } catch (err) {
        if (generation !== this.generation) return;
        menu.destroy(); this.status.setText('NO SE PUDO CONECTAR');
        const e = err as NetError;
        const messages: Partial<Record<NetError['kind'], string>> = {
          'peer-unavailable': `No existe la sala ${data.code ?? ''} o el host se fue`,
          'id-taken': 'Ese código ya está en uso. Probá crear otra sala.',
          timeout: 'No se pudo conectar (NAT/firewall). Probá otra red o configurá TURN',
          version: 'Tienen versiones distintas. Actualicen el juego y prueben de nuevo.',
          'room-full': 'La sala está llena. Pedile al host otro código.',
        };
        onlineDialog(this, 'ERROR DE CONEXIÓN', messages[e.kind] ?? e.message ?? 'Falló la conexión. Probá de nuevo.',
          [{ label: 'REINTENTAR', run: () => this.scene.restart(data) }, { label: 'VOLVER', run: () => this.leave() }]);
      }
    })();
  }
  private refresh(): void {
    if (!this.room) return;
    const s = this.room.snapshot;
    this.choose?.setEnabled(s.players.every(p => p.connected) && ['selecting', 'connected', 'ready'].includes(s.phase));
    const phases: Record<string, string> = { waiting: 'ESPERANDO RIVAL...', selecting: 'ELEGÍ TU LUCHADOR', ready: 'READY · POR EMPEZAR', reconnecting: 'RECONECTANDO...', fighting: 'FIGHT', postmatch: 'FIN DEL MATCH' };
    this.status.setText(`${phases[s.phase] ?? s.phase.toUpperCase()}   ·   PING ${s.ping ?? '—'} ms`);
    s.players.forEach((p, i) => {
      const def = p.charId ? getCharacter(p.charId) : undefined;
      const status = p.connected ? '● CONECTADO' : s.phase === 'reconnecting' ? `● RECONECTANDO ${Math.max(0, Math.ceil(((s.reconnectDeadline ?? Date.now()) - Date.now()) / 1000))}s` : '○ ESPERANDO...';
      this.cards[i]?.setText(`${i === 0 ? 'HOST / P1' : 'GUEST / P2'}${i === s.me ? ' · VOS' : ''}\n${status}\n${def?.name ?? 'SIN LUCHADOR'}\n${p.ready ? 'READY' : '—'}`);
      if (this.portraitIds[i] !== p.charId) {
        this.portraitIds[i] = p.charId; this.portraits[i]?.destroy(); this.portraits[i] = undefined;
        if (def) this.portraits[i] = this.add.image(i === 0 ? 410 : 1150, 610, makePortraitTexture(this, def, `lobby-${def.id}`, 160)).setDisplaySize(160, 160);
      }
    });
  }
  private leave(): void { ++this.generation; this.detachOverlay?.(); clearActiveRoom(); setRoomHash(null); goTo(this, SCENES.Title); }
}
