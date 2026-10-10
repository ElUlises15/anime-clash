/**
 * Phase-2 hooks for ONLINE. Phase 1 shows a coming-soon modal.
 * Keep all CREATE / JOIN wiring here so netcode can replace the bodies later.
 */
import type Phaser from 'phaser';
import { showModal } from './widgets';

const MSG = 'Próximamente — Fase 2 (online P2P)';
const BODY = 'Creá una sala, compartí el código y peleá contra un amigo. Host-authoritative + rollback-ready. Todavía estamos cerrando el combate local.';

export const onlineHandlers = {
  createRoom(scene: Phaser.Scene): void {
    showModal(scene, 'CREATE ROOM', MSG, BODY);
  },
  joinRoom(scene: Phaser.Scene): void {
    showModal(scene, 'JOIN ROOM', MSG, BODY);
  },
};

export function onCreateRoom(scene: Phaser.Scene): void {
  onlineHandlers.createRoom(scene);
}

export function onJoinRoom(scene: Phaser.Scene): void {
  onlineHandlers.joinRoom(scene);
}
