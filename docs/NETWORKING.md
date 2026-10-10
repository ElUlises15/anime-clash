# Networking plan (Phase 2) — P2P WebRTC, host-authoritative input sync, rollback-ready

Decision (user, 2026-10-10): **P2P WebRTC** with a **public signaling server** (PeerJS cloud broker or equivalent; no
backend of our own, no accounts), frontend on **GitHub Pages** under `/anime-clash/`, **hash routes** for rooms
(`https://<user>.github.io/anime-clash/#/room/ABC123`) because Pages has no SPA rewrites. The room creator is the **host**.

## Why this works with the Phase 1 sim

The sim (`src/game/sim`) is already built for lockstep/rollback:

| Property | How Phase 1 guarantees it |
|---|---|
| Deterministic | Integer fixed-point (FX = 100 units/px), seeded xorshift RNG stored in `state.rng`, no `Math.random`/`Date`/floats accumulated in state, characters/abilities are pure data + pure functions. Unit test: same inputs → same `hashState` every frame for 3000+ frames. |
| Tiny inputs | One `InputBits` (11 bits, fits in a `Uint16`) per player per frame (`src/game/input/buttons.ts`). DASH is resolved on the sending side (double tap / Shift), so only bits travel. |
| Serializable state | `MatchState` is plain JSON (no classes/Maps). `sim.cloneState()` is a deep copy; JSON round-trip + continue gives an identical hash (tested). |
| Desync detection | `sim.hashState(state)` = FNV-1a over a canonical serialization (32-bit). |
| Render decoupled | Renderer/HUD/audio only *read* state + per-step `events`; re-simulating frames never touches Phaser. |

Sim API used by netcode (`src/game/sim/engine.ts`):

```ts
sim.createMatch(config: MatchConfig): MatchState     // both peers build it from the same {p1,p2,seed,mode:'online'}
sim.step(state, [p1Bits, p2Bits]): MatchState         // advance exactly one 60 Hz frame (mutates + returns state)
sim.cloneState(state): MatchState                     // snapshot for rollback ring buffer
sim.hashState(state): number                          // desync check
sim.rematch(state): MatchState
```

`FightScene` already isolates input gathering in `gatherInputs()` and the controller type `'remote'` exists in
`FightSceneData.controllers`. Phase 2 replaces that method with a `NetSession`.

## Topology & room flow

```
Host (creator)                          Public signaling (PeerJS broker)                Guest
  CREATE ROOM -> code ABC123 ----------> register peer id "animeclash-ABC123"
  URL #/room/ABC123 copied                                                      opens URL -> connect("animeclash-ABC123")
  <==================== WebRTC DataChannel (unordered, maxRetransmits:0 for inputs; reliable channel for lobby) ====>
```

* Room code: 6 chars from an unambiguous alphabet (no 0/O/1/I); peer id = `animeclash-<code>`. Collision → regenerate.
* STUN: public Google/Cloudflare STUN. TURN: optional (configurable via `VITE_TURN_*` in `.env`, documented in `.env.example`); without TURN some symmetric-NAT pairs will fail — show a clear error.
* Lobby messages (reliable channel, JSON): `hello{version,name}`, `select{charId}`, `ready{bool}`, `start{seed,p1,p2,frameDelay}`, `rematch`, `changeFighter`, `leave`, `ping{t}`/`pong{t}`.
* The host decides `seed`, sides (host = P1), and the start frame. Version string must match (refuse otherwise).

## In-match protocol (host-authoritative input sync with prediction)

Each peer sends, every frame, a small binary packet on the unreliable channel:
`[u8 type][u32 frame][u8 count][count × u16 inputs for frames frame-count+1..frame][u32 ackFrame][u32 hash@ackFrame?]`
(redundancy: the last ~8 inputs are re-sent in every packet, so packet loss doesn't stall).

1. **Input delay** `D` (2–3 frames, adaptive from RTT): local input for frame `f` is scheduled for frame `f + D`.
2. **Prediction**: when the remote input for a frame hasn't arrived, repeat the last known remote input.
3. **Rollback** (ready now, enable in Phase 2 or 2.1): keep a ring buffer of `cloneState` snapshots (~12 frames). When a
   remote input arrives that differs from the prediction for frame `k`, restore snapshot `k`, re-step to the present with
   corrected inputs (`step` is cheap: two fighters + few entities). Events produced during re-simulation are suppressed except
   for those of the final frame (VFX/audio de-duplicated by `(type, frame, player)`).
4. **Host authority**: the host's confirmed input stream is the canonical one. Every 30 frames the host sends
   `hash(confirmedFrame)`; if the guest's hash differs it requests a **state resync**: host sends the JSON `MatchState` of a
   confirmed frame (≈ 5–10 KB, compressed), guest replaces its state and re-simulates its unconfirmed frames.
   Round/match results (KO, time-up, winner) are taken from the host.
5. **Time sync**: guest adjusts its frame pacing ±1 frame per second to keep `localFrame - remoteFrame` close to `D`
   (frame advantage balancing), avoiding drift.
6. **Ping** shown in the HUD slot (`Hud.update(state, {ping})`).

If the first iteration ships without rollback (pure delay + prediction + periodic host resync), the sim API doesn't change.

## Disconnects / reconnection

* Heartbeat via input packets; no packet for 1 s → "conexión inestable" banner and sim pauses (both sides) at the last
  confirmed frame; 10 s → "rival desconectado" with RETURN TO ROOM.
* Reconnect: guest re-opens the same room URL; host re-sends `start` + full state snapshot + input history since snapshot.
* Host leaving ends the room (guest sees a message and can create a new room).

## Rematch / change fighter

PostMatch buttons send lobby messages: `rematch` (both must press → host sends new `start` with a new seed),
`changeFighter` (both return to the room's select screen), `RETURN TO ROOM` (room lobby, connection kept).

## Tests planned for Phase 2

* Two `NetSession`s connected through an in-memory transport with configurable latency/jitter/loss: both reach identical
  hashes for a full bot-vs-bot match (incl. rollback paths).
* Room create/join with a mocked signaling layer; disconnect + reconnect; rematch handshake.
* Playwright: two browser contexts, host creates room, guest opens `#/room/CODE`, both pick + READY, fight runs, HP changes.
