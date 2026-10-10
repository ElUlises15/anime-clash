import { describe, expect, it } from 'vitest';
import { generateRoomCode, normalizeRoomCode, parseRoomHash, peerIdFor, roomUrl } from '../../../src/networking/roomCode';
import { ROOM_CODE_ALPHABET } from '../../../src/networking/types';
import { getPeerOptions } from '../../../src/networking/config';
describe('room codes', () => {
  it('generates six unambiguous characters with injected and crypto randomness', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA');
    expect(generateRoomCode(() => 0.999)).toBe('999999');
    for (let i = 0; i < 20; i++) { const code = generateRoomCode(); expect(code).toHaveLength(6); expect([...code].every(c => ROOM_CODE_ALPHABET.includes(c))).toBe(true); }
  });
  it('normalizes input, URLs and hash routes', () => {
    for (const code of [' abc234 ', 'a b-c 234', '#/room/abc234', 'https://example.test/game/#/room/abc234']) expect(normalizeRoomCode(code)).toBe('ABC234');
    for (const code of ['ABC23', 'ABC2345', 'OBC234', '0BC234', 'IBC234', 'LBC234', '1BC234', '#/other/ABC234', '#/room/ABC234/junk']) expect(normalizeRoomCode(code)).toBeNull();
    expect(parseRoomHash('#/room/abc234')).toBe('ABC234'); expect(parseRoomHash('ABC234')).toBeNull();
    expect(roomUrl('abc234', 'https://example.test/game/')).toBe('https://example.test/game/#/room/ABC234');
    expect(peerIdFor('ABC234')).toBe('animeclash-ABC234');
    expect(() => roomUrl('bad')).toThrow();
  });
  it('loads signaling and STUN defaults without browser PeerJS imports', () => {
    expect(getPeerOptions()).toMatchObject({ host: '0.peerjs.com', port: 443, secure: true, debug: 1 });
    expect(getPeerOptions().config.iceServers[0].urls).toHaveLength(3);
  });
});
