/**
 * Binary codec for the unreliable in-match channel (little endian, DataView).
 *
 *   inputs: u8 type=1 | u16 matchId | u32 startFrame | u8 count | count × u16 input | i32 ackFrame | u32 localFrame
 *           | u8 hasHash | [u32 hashFrame | u32 hash]
 *   ping:   u8 type=2 | f64 timestamp
 *   pong:   u8 type=3 | f64 timestamp
 *
 * `decodePacket` never throws: malformed data returns null.
 */
import type { InputBits } from '../game/input/buttons';

export const PKT_INPUTS = 1;
export const PKT_PING = 2;
export const PKT_PONG = 3;
/** Max inputs carried by one packet (redundancy window). */
export const MAX_PACKET_INPUTS = 32;

export interface InputsPacket {
  type: 'inputs';
  matchId: number; // u16
  startFrame: number; // frame of inputs[0]
  inputs: InputBits[]; // u16 each, count <= MAX_PACKET_INPUTS
  ackFrame: number; // highest remote frame known contiguously, -1 none
  localFrame: number; // sender's current local frame (time sync)
  hash?: { frame: number; hash: number };
}
export interface PingPacket { type: 'ping'; ts: number }
export interface PongPacket { type: 'pong'; ts: number }
export type NetPacket = InputsPacket | PingPacket | PongPacket;

const INPUTS_HEADER = 1 + 2 + 4 + 1; // type, matchId, startFrame, count
const INPUTS_TRAILER = 4 + 4 + 1; // ackFrame, localFrame, hasHash

export function encodeInputs(p: Omit<InputsPacket, 'type'>): Uint8Array {
  const count = Math.min(p.inputs.length, MAX_PACKET_INPUTS);
  const size = INPUTS_HEADER + count * 2 + INPUTS_TRAILER + (p.hash ? 8 : 0);
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  let o = 0;
  dv.setUint8(o, PKT_INPUTS); o += 1;
  dv.setUint16(o, p.matchId & 0xffff, true); o += 2;
  dv.setUint32(o, p.startFrame >>> 0, true); o += 4;
  dv.setUint8(o, count); o += 1;
  for (let i = 0; i < count; i++) { dv.setUint16(o, p.inputs[i] & 0xffff, true); o += 2; }
  dv.setInt32(o, p.ackFrame | 0, true); o += 4;
  dv.setUint32(o, p.localFrame >>> 0, true); o += 4;
  dv.setUint8(o, p.hash ? 1 : 0); o += 1;
  if (p.hash) {
    dv.setUint32(o, p.hash.frame >>> 0, true); o += 4;
    dv.setUint32(o, p.hash.hash >>> 0, true);
  }
  return buf;
}

function encodeTs(type: number, ts: number): Uint8Array {
  const buf = new Uint8Array(9);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, type);
  dv.setFloat64(1, ts, true);
  return buf;
}
export const encodePing = (ts: number): Uint8Array => encodeTs(PKT_PING, ts);
export const encodePong = (ts: number): Uint8Array => encodeTs(PKT_PONG, ts);

export function encodePacket(p: NetPacket): Uint8Array {
  if (p.type === 'inputs') return encodeInputs(p);
  return encodeTs(p.type === 'ping' ? PKT_PING : PKT_PONG, p.ts);
}

export function decodePacket(data: Uint8Array | null | undefined): NetPacket | null {
  try {
    if (!(data instanceof Uint8Array) || data.byteLength < 1) return null;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const type = dv.getUint8(0);
    if (type === PKT_PING || type === PKT_PONG) {
      if (data.byteLength !== 9) return null;
      const ts = dv.getFloat64(1, true);
      if (!Number.isFinite(ts)) return null;
      return type === PKT_PING ? { type: 'ping', ts } : { type: 'pong', ts };
    }
    if (type !== PKT_INPUTS || data.byteLength < INPUTS_HEADER + INPUTS_TRAILER) return null;
    let o = 1;
    const matchId = dv.getUint16(o, true); o += 2;
    const startFrame = dv.getUint32(o, true); o += 4;
    const count = dv.getUint8(o); o += 1;
    if (count > MAX_PACKET_INPUTS) return null;
    const base = INPUTS_HEADER + count * 2 + INPUTS_TRAILER;
    if (data.byteLength !== base && data.byteLength !== base + 8) return null;
    const inputs: InputBits[] = new Array<InputBits>(count);
    for (let i = 0; i < count; i++) { inputs[i] = dv.getUint16(o, true); o += 2; }
    const ackFrame = dv.getInt32(o, true); o += 4;
    const localFrame = dv.getUint32(o, true); o += 4;
    const hasHash = dv.getUint8(o); o += 1;
    if (ackFrame < -1) return null;
    if (hasHash > 1 || (hasHash === 1) !== (data.byteLength === base + 8)) return null;
    const pkt: InputsPacket = { type: 'inputs', matchId, startFrame, inputs, ackFrame, localFrame };
    if (hasHash) {
      const frame = dv.getUint32(o, true); o += 4;
      pkt.hash = { frame, hash: dv.getUint32(o, true) };
    }
    return pkt;
  } catch {
    return null;
  }
}
