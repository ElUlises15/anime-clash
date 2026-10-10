import Phaser from 'phaser';
import type { Room } from '../networking/types';
import { clearActiveRoom } from '../networking';
import { arcadeText, onlineDialog } from './widgets';
import { SCENES } from './sceneData';
import { HEX } from './theme';
import { goTo } from './transitions';
import { setRoomHash } from './router';

export function attachOnlineOverlay(scene: Phaser.Scene, room: Room, opts?: { onClosed?: () => void }): () => void {
  const banner = arcadeText(scene, 960, 28, '', 24, HEX.orange).setDepth(9000).setScrollFactor(0).setVisible(false);
  let detached = false; let closeModal: (() => void) | undefined;
  const refresh = () => {
    const s = room.snapshot;
    banner.setVisible(s.phase === 'reconnecting');
    if (s.phase === 'reconnecting') banner.setText(`RIVAL DESCONECTADO — esperando reconexión ${Math.max(0, Math.ceil(((s.reconnectDeadline ?? Date.now()) - Date.now()) / 1000))}s`);
  };
  const showClosed = (closed: boolean) => {
    if (closeModal || detached) return;
    opts?.onClosed?.();
    const actions = [];
    if (!closed && room.snapshot.role === 'host') actions.push({ label: 'VOLVER A LA SALA', run: () => { detach(); goTo(scene, SCENES.Lobby, { action: 'resume' }); } });
    actions.push({ label: 'MENÚ PRINCIPAL', run: () => { detach(); clearActiveRoom(); setRoomHash(null); goTo(scene, SCENES.Title); } });
    closeModal = onlineDialog(scene, closed ? 'SALA CERRADA' : 'EL RIVAL SE FUE',
      closed ? 'La sala terminó. Volvé al menú para crear otra.' : 'Podés esperar a otro rival en tu sala.', actions);
  };
  const unsub = room.on(e => {
    if (e.type === 'closed') showClosed(true);
    else if (e.type === 'opponentLeft' && e.final) showClosed(false);
    refresh();
  });
  const timer = scene.time.addEvent({ delay: 200, loop: true, callback: refresh });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
  refresh(); if (room.snapshot.phase === 'closed') showClosed(true);
  function detach(): void {
    if (detached) return; detached = true;
    unsub(); timer.remove(); banner.destroy(); closeModal?.();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, detach);
  }
  return detach;
}
