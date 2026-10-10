/**
 * CONTRACT FILE (Phase 2 networking). Additive changes only; mention them in your summary.
 *
 * Layers:
 *   TransportFactory  -> creates PeerLinks (PeerJS WebRTC in prod, in-memory Loopback in tests)
 *   RoomSession       -> lobby state machine over a PeerLink (reliable JSON messages)
 *   NetSession        -> in-match rollback netcode over the same PeerLink (binary unreliable input packets
 *                        + a few reliable JSON messages: snapshot/resync)
 */
import type { InputBits } from '../game/input/buttons';
import type { MatchState, PlayerIndex, SimEvent } from '../game/sim/types';

/** Bumped when the wire protocol or sim changes incompatibly. Peers with different versions refuse to play. */
export const PROTOCOL_VERSION = 'ac-net-2';
export const PEER_ID_PREFIX = 'animeclash-';
/** Unambiguous alphabet (no 0/O/1/I/L). Codes are 6 chars. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const RECONNECT_WINDOW_MS = 15_000;

// ------------------------------------------------------------------ transport

export type LinkStatus = 'open' | 'closed';

/** One bidirectional connection to the other peer. */
export interface PeerLink {
  readonly id: string; // unique per physical connection (changes on reconnect)
  readonly open: boolean;
  /** Ordered + reliable. Payload must be JSON-serialisable and have a string `t` (type) field. */
  sendReliable(msg: WireMessage): void;
  /** Unordered + unreliable (maxRetransmits 0). Small binary packets (inputs). May be dropped silently. */
  sendUnreliable(data: Uint8Array): void;
  onReliable(cb: (msg: WireMessage) => void): () => void; // returns unsubscribe
  onUnreliable(cb: (data: Uint8Array) => void): () => void;
  onClose(cb: (reason: string) => void): () => void;
  close(): void;
}

/** Host side endpoint: registered under the room's peer id, accepts guest connections. */
export interface HostEndpoint {
  readonly code: string;
  onConnection(cb: (link: PeerLink) => void): () => void;
  /** Fatal endpoint error (signaling lost, id taken...). */
  onError(cb: (err: NetError) => void): () => void;
  close(): void;
}

export type NetErrorKind = 'id-taken' | 'peer-unavailable' | 'network' | 'signaling' | 'webrtc' | 'version' | 'room-full' | 'timeout' | 'unknown';
export interface NetError { kind: NetErrorKind; message: string }

export interface TransportFactory {
  /** Register as host for `code` (peer id = PEER_ID_PREFIX + code). Rejects with NetError (kind 'id-taken' on collision). */
  host(code: string): Promise<HostEndpoint>;
  /** Connect to the host of `code`. Resolves when both channels are open. Rejects with NetError. */
  join(code: string, timeoutMs?: number): Promise<PeerLink>;
  destroy(): void;
}

// ------------------------------------------------------------------ wire messages (reliable channel)

export interface MatchStart {
  matchId: number; // increments each match in the room (rematch => +1)
  seed: number;
  p1: string; // host character (host is always P1)
  p2: string; // guest character
  stage: string;
  inputDelay: number; // frames (2..4), chosen by host from RTT
}

export type WireMessage =
  | { t: 'hello'; version: string; name: string; resume?: boolean }
  | { t: 'welcome'; version: string; room: RoomWire }
  | { t: 'reject'; reason: NetErrorKind; message: string }
  | { t: 'room'; room: RoomWire } // host -> guest authoritative room state broadcast
  | { t: 'select'; charId: string | null } // guest -> host (host applies locally)
  | { t: 'cursor'; index: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'start'; match: MatchStart } // host -> guest
  | { t: 'rematch' } // either -> other (request/accept)
  | { t: 'changeFighter' }
  | { t: 'returnToRoom' }
  | { t: 'matchEnd'; matchId: number; winner: PlayerIndex | -1; frame: number; hash: number }
  | { t: 'leave' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  // netcode (NetSession)
  | { t: 'net:resyncReq'; matchId: number; frame: number }
  | { t: 'net:snapshot'; matchId: number; frame: number; state: MatchState; inputs: [InputBits[], InputBits[]]; inputsFrom: number };

// ------------------------------------------------------------------ room

export type RoomPhase =
  | 'idle'
  | 'connecting' // guest dialing / host registering
  | 'waiting' // host registered, no guest yet
  | 'connected' // both connected (transient: goes to selecting)
  | 'selecting' // character select
  | 'ready' // both ready, countdown, host about to send start
  | 'fighting'
  | 'postmatch'
  | 'reconnecting' // opponent dropped, waiting up to RECONNECT_WINDOW_MS
  | 'closed' // room ended (host left, user left, reconnect window expired)
  | 'error';

export interface PlayerSlot {
  connected: boolean;
  name: string;
  charId: string | null; // locked choice
  cursor: number | null; // hovered roster index (live cursor, optional)
  ready: boolean;
  rematch: boolean;
}

/** Serialisable room state (host is the source of truth and broadcasts it). Index 0 = host/P1, 1 = guest/P2. */
export interface RoomWire {
  code: string;
  phase: RoomPhase;
  players: [PlayerSlot, PlayerSlot];
  match: MatchStart | null;
  matchCount: number;
  lastWinner: PlayerIndex | -1 | null;
}

export interface RoomSnapshot extends RoomWire {
  role: 'host' | 'guest';
  me: PlayerIndex; // 0 host, 1 guest
  ping: number | null; // ms RTT
  error: NetError | null;
  /** Shareable URL (hash route) for this room. */
  url: string;
  reconnectDeadline: number | null; // epoch ms while phase==='reconnecting'
}

export type RoomEvent =
  | { type: 'change'; room: RoomSnapshot }
  | { type: 'matchStart'; match: MatchStart; room: RoomSnapshot; resume?: ResumeData }
  | { type: 'opponentLeft'; room: RoomSnapshot; final: boolean } // final=false: reconnect window running
  | { type: 'opponentReturned'; room: RoomSnapshot }
  | { type: 'toSelect'; room: RoomSnapshot } // change fighter
  | { type: 'toLobby'; room: RoomSnapshot } // return to room
  | { type: 'closed'; room: RoomSnapshot; reason: string };

/** Data a reconnecting guest needs to resume an in-progress match. */
export interface ResumeData { frame: number; state: MatchState; inputs: [InputBits[], InputBits[]]; inputsFrom: number }

/** Public API used by UI scenes (implemented by RoomSession in room.ts). */
export interface Room {
  readonly snapshot: RoomSnapshot;
  readonly link: PeerLink | null; // current link to the opponent (changes on reconnect)
  on(cb: (ev: RoomEvent) => void): () => void;
  selectCharacter(charId: string | null): void; // lock (or unlock with null)
  setCursor(index: number): void;
  setReady(ready: boolean): void; // host: when both ready -> 'ready' phase, ~3 s countdown, then start
  requestRematch(): void; // both -> host sends new start
  changeFighter(): void; // both go back to selecting (ready/char cleared)
  returnToRoom(): void; // both go to lobby ('selecting' phase, keeps chars, clears ready)
  reportMatchEnd(winner: PlayerIndex | -1, frame: number, hash: number): void; // -> 'postmatch'
  leave(): void; // sends 'leave', closes link/endpoint, phase 'closed'
}

// ------------------------------------------------------------------ netcode

export interface NetSessionOptions {
  link: PeerLink;
  role: 'host' | 'guest';
  me: PlayerIndex; // 0 host, 1 guest
  match: MatchStart;
  resume?: ResumeData; // guest rejoining mid match
  now?: () => number; // ms clock (tests inject)
  maxPrediction?: number; // frames, default 8
  hashInterval?: number; // frames, default 30
}

export interface NetStats {
  ping: number | null;
  inputDelay: number;
  rollbacks: number;
  maxRollback: number;
  stalls: number;
  desyncs: number;
  resyncs: number;
  confirmedFrame: number;
  remoteFrame: number;
  localFrame: number;
}

/** Result of one fixed 60 Hz tick of the online session. */
export interface NetTick {
  advanced: boolean; // false = stalled (waiting for remote inputs or time-sync skip)
  events: SimEvent[]; // events of the newest simulated frame (for VFX/audio); [] when not advanced
  rolledBack: number; // frames re-simulated this tick
}
