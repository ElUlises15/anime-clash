import { PEER_ID_PREFIX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './types';

export function generateRoomCode(rand?: () => number): string {
  let code = '';
  while (code.length < ROOM_CODE_LENGTH) {
    if (rand) code += ROOM_CODE_ALPHABET[Math.min(ROOM_CODE_ALPHABET.length - 1, Math.max(0, Math.floor(rand() * ROOM_CODE_ALPHABET.length)))];
    else if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const byte = crypto.getRandomValues(new Uint8Array(1))[0];
      // Rejection sampling avoids modulo bias.
      if (byte < 256 - 256 % ROOM_CODE_ALPHABET.length) code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
    } else code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
export function normalizeRoomCode(input: string): string | null {
  let value = input.trim();
  if (value.includes('#')) value = value.slice(value.indexOf('#'));
  if (value.startsWith('#')) {
    const match = /^#\/room\/([^/?#]+)\/?$/i.exec(value);
    if (!match) return null;
    value = match[1];
  }
  value = value.toUpperCase().replace(/[\s-]/g, '');
  return value.length === ROOM_CODE_LENGTH && [...value].every(c => ROOM_CODE_ALPHABET.includes(c)) ? value : null;
}
export function parseRoomHash(hash: string): string | null {
  return /^#\/room\//i.test(hash.trim()) ? normalizeRoomCode(hash) : null;
}
export function roomUrl(code: string, base?: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('Invalid room code');
  const root = base ?? (typeof location !== 'undefined' ? location.origin + location.pathname : '');
  return `${root.split('#')[0]}#/room/${normalized}`;
}
export const peerIdFor = (code: string): string => PEER_ID_PREFIX + code;
