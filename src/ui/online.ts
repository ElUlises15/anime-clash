import type Phaser from 'phaser';
import { normalizeRoomCode } from '../networking';
import type { MatchStart, ResumeData, Room } from '../networking/types';
import { SCENES, type FightSceneData } from './sceneData';
import { arcadeText, ArcadeButton } from './widgets';
import { HEX } from './theme';
import { goTo } from './transitions';

export function onlineFightData(room: Room, match: MatchStart, resume?: ResumeData): FightSceneData {
  return { mode: 'online', p1: match.p1, p2: match.p2, seed: match.seed,
    controllers: room.snapshot.me === 0 ? ['p1keys', 'remote'] : ['remote', 'p1keys'], online: { match, resume } };
}
export const onlineHandlers = {
  createRoom(scene: Phaser.Scene): void { goTo(scene, SCENES.Lobby, { action: 'create' }); },
  joinRoom(scene: Phaser.Scene): void {
    let value = ''; let cursor = true; let alive = true; let focus = -1;
    const submit = () => {
      const code = normalizeRoomCode(value);
      if (!code) { error.setText('Código inválido: usá los 6 caracteres de la sala'); return; }
      cleanup(); goTo(scene, SCENES.Lobby, { action: 'join', code });
    };
    const field = arcadeText(scene, 960, 540, '', 42, HEX.gold).setDepth(10001);
    const error = arcadeText(scene, 960, 585, '', 20, HEX.magenta).setDepth(10001);
    const refresh = () => field.setText(`${value.length > 32 ? 'LINK PEGADO' : value.padEnd(6, '·')}${cursor ? ' ▏' : '  '}`);
    const timer = scene.time.addEvent({ delay: 450, loop: true, callback: () => { cursor = !cursor; refresh(); } });
    const pasteValue = (text: string) => { if (!alive) return; value = normalizeRoomCode(text) ?? text.trim(); error.setText(''); refresh(); };
    const paste = (e: ClipboardEvent) => { e.preventDefault(); pasteValue(e.clipboardData?.getData('text') ?? ''); };
    const key = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.code === 'Escape') { e.preventDefault(); cleanup(); }
      else if (e.code === 'Enter' || (focus >= 0 && e.code === 'KeyJ')) {
        e.preventDefault(); if (focus < 0) submit(); else buttons[focus].activate();
      }
      else if (['ArrowDown', 'ArrowUp', 'Tab'].includes(e.code)) {
        e.preventDefault(); const step = e.code === 'ArrowUp' || e.shiftKey ? -1 : 1;
        focus = (focus + step + 4) % 4 - 1;
        buttons.forEach((b, i) => b.setFocused(i === focus));
      }
      else if (focus >= 0 && e.code === 'KeyK') { e.preventDefault(); cleanup(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') { /* native paste event */ }
      else if (e.code === 'Backspace') { e.preventDefault(); value = value.slice(0, -1); refresh(); }
      else if (!e.ctrlKey && !e.metaKey && /^[a-z0-9]$/i.test(e.key) && value.length < 6) { e.preventDefault(); value += e.key.toUpperCase(); error.setText(''); refresh(); }
    };
    document.addEventListener('keydown', key, true);
    const dim = scene.add.rectangle(960, 540, 1920, 1080, 0x080611, 0.96).setDepth(9999).setInteractive();
    const title = arcadeText(scene, 960, 390, 'JOIN ROOM · CÓDIGO / LINK', 40, HEX.cyan).setDepth(10001);
    const connect = new ArcadeButton(scene, 960, 670, 'CONECTAR', submit).setDepth(10001);
    const cancel = new ArcadeButton(scene, 960, 750, 'CANCELAR', () => cleanup()).setDepth(10001);
    const pasteButton = new ArcadeButton(scene, 960, 840, 'PEGAR LINK', () => {
      if (navigator.clipboard?.readText) void navigator.clipboard.readText().then(pasteValue).catch(() => { if (alive) error.setText('Usá Ctrl/V o Cmd/V para pegar'); });
      else error.setText('Usá Ctrl/V o Cmd/V para pegar');
    }, { size: 24 }).setDepth(10001);
    const buttons = [connect, cancel, pasteButton];
    window.addEventListener('paste', paste);
    scene.events.once('shutdown', cleanup); refresh();
    function cleanup(): void {
      if (!alive) return; alive = false; timer.remove();
      document.removeEventListener('keydown', key, true); window.removeEventListener('paste', paste);
      scene.events.off('shutdown', cleanup);
      [field, error, dim, title, connect, cancel, pasteButton].forEach(o => o.destroy());
    }
  },
};
export function onCreateRoom(scene: Phaser.Scene): void { onlineHandlers.createRoom(scene); }
export function onJoinRoom(scene: Phaser.Scene): void { onlineHandlers.joinRoom(scene); }
