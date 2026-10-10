import { describe, expect, it } from 'vitest';
import {
  decodePacket, encodeInputs, encodePacket, encodePing, encodePong, MAX_PACKET_INPUTS, type InputsPacket,
} from '../../../src/networking/inputCodec';

describe('inputCodec', () => {
  it('round-trips an inputs packet without hash', () => {
    const p: InputsPacket = { type: 'inputs', matchId: 7, startFrame: 123456, inputs: [0, 1, 0x7ff, 0xffff], ackFrame: -1, localFrame: 99 };
    const buf = encodeInputs(p);
    expect(buf.byteLength).toBe(17 + 2 * 4);
    expect(decodePacket(buf)).toEqual(p);
  });

  it('round-trips an inputs packet with hash', () => {
    const p: InputsPacket = {
      type: 'inputs', matchId: 0xffff, startFrame: 0, inputs: [], ackFrame: 2_000_000, localFrame: 0xffffffff,
      hash: { frame: 3000, hash: 0xdeadbeef },
    };
    const buf = encodePacket(p);
    expect(buf.byteLength).toBe(17 + 8);
    expect(decodePacket(buf)).toEqual(p);
  });

  it('caps inputs at MAX_PACKET_INPUTS and masks to u16', () => {
    const inputs = Array.from({ length: 50 }, (_, i) => i | 0x10000);
    const d = decodePacket(encodeInputs({ matchId: 1, startFrame: 10, inputs, ackFrame: 5, localFrame: 12 })) as InputsPacket;
    expect(d.inputs.length).toBe(MAX_PACKET_INPUTS);
    expect(d.inputs[3]).toBe(3);
  });

  it('round-trips ping/pong', () => {
    expect(decodePacket(encodePing(1234.5678))).toEqual({ type: 'ping', ts: 1234.5678 });
    expect(decodePacket(encodePong(42))).toEqual({ type: 'pong', ts: 42 });
  });

  it('decodes from a Uint8Array view with offset', () => {
    const inner = encodeInputs({ matchId: 3, startFrame: 4, inputs: [9, 8], ackFrame: 1, localFrame: 6 });
    const big = new Uint8Array(inner.byteLength + 10);
    big.set(inner, 5);
    expect(decodePacket(big.subarray(5, 5 + inner.byteLength))).toEqual(decodePacket(inner));
  });

  it('returns null on malformed data and never throws', () => {
    expect(decodePacket(new Uint8Array(0))).toBeNull();
    expect(decodePacket(null)).toBeNull();
    expect(decodePacket(new Uint8Array([9, 1, 2, 3]))).toBeNull();
    expect(decodePacket(new Uint8Array([2, 1, 2]))).toBeNull(); // short ping
    const good = encodeInputs({ matchId: 1, startFrame: 2, inputs: [1, 2, 3], ackFrame: 0, localFrame: 3 });
    expect(decodePacket(good.subarray(0, good.byteLength - 1))).toBeNull(); // truncated
    const extra = new Uint8Array(good.byteLength + 1); extra.set(good);
    expect(decodePacket(extra)).toBeNull(); // trailing bytes
    const badCount = new Uint8Array(good); badCount[7] = 200;
    expect(decodePacket(badCount)).toBeNull();
    const badHashFlag = new Uint8Array(good); badHashFlag[good.byteLength - 1] = 1;
    expect(decodePacket(badHashFlag)).toBeNull();
    const nanPing = encodePing(0); new DataView(nanPing.buffer).setFloat64(1, NaN, true);
    expect(decodePacket(nanPing)).toBeNull();

    let x = 0x1234567;
    const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
    for (let i = 0; i < 5000; i++) {
      const len = rnd() % 90;
      const buf = new Uint8Array(len);
      for (let j = 0; j < len; j++) buf[j] = rnd() & 0xff;
      if (len > 0 && i % 3 === 0) buf[0] = 1 + (rnd() % 3);
      expect(() => decodePacket(buf)).not.toThrow();
    }
  });
});
