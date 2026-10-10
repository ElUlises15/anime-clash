import { parseRoomHash, normalizeRoomCode } from '../networking';
export function getRoomCodeFromLocation(): string | null {
  return typeof location === 'undefined' ? null : parseRoomHash(location.hash);
}
export function setRoomHash(code: string | null): void {
  const normalized = code ? normalizeRoomCode(code) : null;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${normalized ? `#/room/${normalized}` : ''}`);
}
