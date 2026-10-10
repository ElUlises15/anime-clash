# Networking (Phase 2) — P2P WebRTC, rollback netcode

Online play is **peer-to-peer WebRTC** with **no backend of our own**: the free public **PeerJS cloud broker**
(`0.peerjs.com`) is used only for signaling (exchanging SDP/ICE so the two browsers can find each other). After that, all
game traffic goes directly browser ↔ browser over DataChannels. The site is static (GitHub Pages), rooms are hash routes:
`https://elulises15.github.io/anime-clash/#/room/ABC234`. The room creator is the **host** (P1, left side).

## Modules (`src/networking/`)

| File | Role |
|---|---|
| `types.ts` | CONTRACT: `PeerLink`, `TransportFactory`, `WireMessage`, `RoomWire/RoomSnapshot/RoomEvent`, `Room`, `NetSession*` types, `PROTOCOL_VERSION`. |
| `peerjs.ts` | `PeerJsFactory` — real transport. Host registers peer id `animeclash-<CODE>`; guest opens two DataConnections: `rel` (reliable, ordered, JSON — lobby + snapshots) and `unrel` (`reliable:false`, raw binary — per-frame inputs). PeerJS is imported lazily so tests/node never load it. Signaling drop → `peer.reconnect()` (existing P2P links survive). |
| `loopback.ts` | `LoopbackNetwork` — in-memory transport with configurable latency / jitter / loss and a **virtual clock** (`advance(ms)`) for deterministic tests. `?net=loopback` uses it in-page (dev only). |
| `config.ts` | Reads `VITE_PEER_*` / `VITE_TURN_*`, builds PeerJS options + `iceServers` (Google + Cloudflare STUN, optional TURN). |
| `roomCode.ts` | 6-char codes from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L), `normalizeRoomCode` (accepts code, URL or `#/room/x`), `parseRoomHash`, `roomUrl`. |
| `room.ts` | `RoomSession` — lobby state machine (host authoritative). |
| `netcode.ts` + `inputCodec.ts` | `NetSession` — in-match rollback netcode + binary packet codec. |
| `index.ts` | `createOnlineRoom`, `joinOnlineRoom`, `getActiveRoom`, `clearActiveRoom`, `setTransportFactory`. |

UI: `src/ui/scenes/LobbyScene.ts` (code, copy link, both players' status, ping), `SelectScene` online mode (each player
controls only their side with P1 keys), `PostMatchScene` online buttons, `src/ui/onlineOverlay.ts` (disconnect banner/modals),
`src/ui/router.ts` (hash routes). `FightScene` drives the `NetSession` when `mode === 'online'`.

## Room flow / state machine

```
host: idle → connecting → waiting ──guest hello──▶ selecting ⇄ ready(countdown 3 s) ──start──▶ fighting ──▶ postmatch
                                                      ▲   changeFighter / returnToRoom   │  rematch (both) ──▶ fighting
                                                      └───────────────────────────────────┘
any phase with a guest: link drop ──▶ reconnecting (15 s window) ──guest back──▶ previous phase   | expiry ──▶ waiting (host) / closed (guest)
```

* Host keeps the authoritative `RoomWire` and broadcasts `{t:'room'}` after every change; the guest sends its actions.
* READY requires a locked character. When both are READY the host waits the countdown, then sends `start` with
  `MatchStart {matchId, seed, p1, p2, stage, inputDelay}`; both peers build the same match with `sim.createMatch`.
* Input delay is chosen by the host from the measured RTT: ≤60 ms → 2 frames, ≤130 ms → 3, else 4.
* Rematch: both press REMATCH → host sends a new `start` (new seed, `matchId+1`). CHANGE FIGHTER → both return to select
  (chars cleared). RETURN TO ROOM → both return to the lobby (chars kept, READY cleared).
* Disconnect: an explicit `leave` frees the guest slot immediately. A dropped link starts a **15 s reconnection window**:
  the guest auto-redials every ~2 s; a fresh page opening the same `#/room/CODE` is also accepted as the returning guest.
  If the match was running, the host sends `start` + `net:snapshot` (confirmed state + all inputs known after it) and the
  guest resumes from there. If the **host** leaves, the room is closed (the peer id belongs to the host).

### Reliable messages (JSON, `rel` channel)
`hello{version,name,resume?}`, `welcome{room}`, `reject{reason}`, `room{room}`, `select{charId}`, `cursor{index}`,
`ready{ready}`, `start{match}`, `rematch`, `changeFighter`, `returnToRoom`, `matchEnd{matchId,winner,frame,hash}`, `leave`,
`ping{ts}`/`pong{ts}` (1 Hz, lobby RTT), `net:resyncReq{matchId,frame}`, `net:snapshot{matchId,frame,state,inputs,inputsFrom}`.
Peers with a different `PROTOCOL_VERSION` are rejected.

### Input packet (binary, `unrel` channel, little endian) — sent every frame
```
u8 type=1 | u16 matchId | u32 startFrame | u8 count | count × u16 inputs | i32 ackFrame | u32 localFrame | u8 hasHash [u32 hashFrame u32 hash]
```
`inputs` = every local input the remote has not acked yet (≤ 32) → each packet carries redundant history, so packet loss
doesn't stall. Typical packet: 20–40 bytes. Ping/pong: `u8 type(2|3) | f64 timestamp` every 500 ms → HUD ping slot.
No sprites/state are ever streamed; only a full snapshot on resync/resume (~10 KB JSON, rare).

## Netcode: rollback (GGPO-style) on top of the deterministic sim

* **Input delay** `D` (2–4): local input sampled at frame L is applied at frame L+D.
* **Two states**: `confirmedState` advances only through frames where both inputs are known (authoritative: hashes,
  snapshots, match result); the **predicted state** (rendered) runs ahead using *last known remote input* as prediction.
* **Rollback**: when a confirmed remote input differs from the prediction, `predicted = clone(confirmed)` and the
  unconfirmed frames are re-simulated in the same tick (cheap: 2 fighters + few entities). Only the newest frame's events
  feed VFX/audio.
* **Prediction window**: at most 8 frames ahead of confirmed; beyond that the peer stalls (counted in `stats.stalls`).
* **Time sync**: each packet carries the sender's frame; the peer that runs ahead (smoothed frame advantage > 1) skips one tick
  at most every 10 ticks, so both clocks converge without drift.
* **Desync detection**: the host includes `hash(confirmedState)` at every 30th confirmed frame in its packets; the guest compares
  with its own and on mismatch requests a resync (rate-limited 1/s). The host's confirmed state + inputs replace the guest's.
* **Authority**: KO/round/winner are read from `confirmedState`, so both screens show the same result; the host's match end is
  the reference.
* Target: 60–120 ms RTT feels local with D=2–3 and ≤ 3–5 frames of rollback.

Unit tests (`tests/unit/net/`): 3000-frame bot vs bot runs over the loopback transport at 0 ms, 50 ms+jitter+5 % loss and
100 ms + 20 % loss with identical hashes at every common confirmed frame; desync injection → resync; mid-match resume on a new
link; full match to `matchEnd` with the same winner; room create/join/ready/countdown/rematch/change fighter/return to room,
version mismatch, room full, leave, drop → reconnect, reconnect window expiry, id collision retry.

## Configuration (`.env`, see `.env.example`)

| Var | Default | |
|---|---|---|
| `VITE_PEER_HOST` / `PORT` / `PATH` / `SECURE` / `KEY` | `0.peerjs.com` / 443 / `/` / true / `peerjs` | Signaling server (self-host `peerjs-server` if the public one is down). |
| `VITE_TURN_URL` / `USER` / `PASS` | empty | Optional TURN relay (comma separated URLs). |

STUN (`stun.l.google.com:19302`, `stun1.l.google.com:19302`, `stun.cloudflare.com:3478`) is always included.
**Limits**: without TURN, pairs where both sides are behind symmetric NAT / strict corporate firewalls / some mobile CGNAT
cannot connect (the join times out with a clear message). Configure a TURN server for those (values in `VITE_*` are public in
the bundle → use restricted/short-lived credentials). The public PeerJS broker is best-effort (no SLA); if `animeclash-CODE`
is still registered after a host reload, a new code is generated.
