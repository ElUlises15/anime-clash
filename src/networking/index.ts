export * from './types';
export { RoomSession, virtualRoomTimers } from './room';
export type { RoomOptions, HostRoomOptions, RoomTimers } from './room';
export { generateRoomCode, normalizeRoomCode, parseRoomHash, roomUrl } from './roomCode';
export { PeerJsFactory } from './peerjs';
export { getPeerOptions } from './config';
export { netDiag, resetNetDiag } from './diag';
import type { Room, TransportFactory } from './types';
import { RoomSession } from './room';
import { PeerJsFactory } from './peerjs';
import { LoopbackNetwork } from './loopback';
import { netDiag } from './diag';
let factory: TransportFactory | null = null;
let activeRoom: RoomSession | null = null;
const loopback = new LoopbackNetwork({ realtime: true });
export function getDefaultFactory(): TransportFactory {
  if (!factory) factory = typeof location !== 'undefined' && new URLSearchParams(location.search).get('net') === 'loopback' ? loopback.factory() : new PeerJsFactory();
  return factory;
}
export function setTransportFactory(value: TransportFactory): void { factory = value; }
export async function createOnlineRoom(name?: string): Promise<Room> { const room = await RoomSession.host(getDefaultFactory(), { name }); activeRoom?.leave(); activeRoom = room; return room; }
export async function joinOnlineRoom(code: string, name?: string): Promise<Room> { const room = await RoomSession.join(getDefaultFactory(), code, { name }); activeRoom?.leave(); activeRoom = room; return room; }
export function getActiveRoom(): RoomSession | null { return activeRoom; }
export function clearActiveRoom(): void { activeRoom?.leave(); activeRoom = null; }
if (typeof window !== 'undefined') (window as unknown as { __acNet: unknown }).__acNet = {
  room: () => getActiveRoom()?.snapshot,
  diag: () => JSON.parse(JSON.stringify(netDiag)) as typeof netDiag,
  /** Tests only (host): upcoming matches top up meter on both peers so QA bots can spam specials/ultimates. */
  setTestMeter: (on: boolean) => { const r = getActiveRoom(); if (r) r.testMeter = on; },
};
