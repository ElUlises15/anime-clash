# Anime Clash — Architecture (Phase 1 working contract)

Read `/workspace/anime-clash/SPEC.md` (user requirements, Spanish) first. This doc defines module boundaries and
APIs so several developers can work in parallel. CONTRACT FILES (do not change incompatibly; additive changes OK
and must be mentioned in your final summary):

- `src/game/input/buttons.ts` — input bitmask (BTN.*)
- `src/game/sim/types.ts` — MatchState / FighterState / EntityState / SimEvent / SimApi, constants (FX, stage size)
- `src/characters/types.ts` — CharacterDef / MoveDef / AbilityRef / StatPoints
- `src/render/rig/types.ts` — CharacterVisuals / Palette / HairShape / Pose / AnimClip
- `src/ui/sceneData.ts` — scene keys, scene data payloads, GAME_W/GAME_H (1920x1080 logical), GROUND_Y

Stack: TypeScript 5.6, Vite 6, Phaser 3.90, Vitest 3, Playwright 1.64. Node 20. Path alias `@/` = `src/`.
Logical resolution 1920x1080, Phaser `Scale.FIT` + `autoCenter`. Fighters ~190-215 px tall. Build base `./`.
Phase 2 will add P2P WebRTC (PeerJS, public signaling) with hash routes `#/room/ABC123`, host-authoritative input sync
with prediction, rollback-ready. Therefore the sim MUST be deterministic & serializable.

## Layers

```
input (keyboard/gamepad/AI/remote)  -->  InputBits per player per frame
            |
            v
sim (pure TS, src/game/sim + src/abilities + character data)   step(state, [p1Bits, p2Bits]) -> state + events
            |  (read-only)
            v
render (Phaser: src/render)  FighterView / EntityView / VfxSystem / StageView / CameraRig  ;  audio (src/audio) consumes SimEvents
ui (Phaser scenes: src/ui)   Title / Settings / Select / Fight (integration) / PostMatch ; Hud reads MatchState
```

Rules:
1. `src/game/sim/**`, `src/abilities/**`, `src/characters/**` must NOT import Phaser or touch DOM/window/Date/Math.random.
   Use the seeded RNG in state (`state.rng`). Integers only for positions/velocities (fixed point FX=100 per px). Avoid
   float accumulation; if you need fractions use integer percent math with `Math.trunc`/`Math.round` deterministically.
2. MatchState is plain JSON data (no class instances, no Maps/Sets, no functions). `structuredClone` must work.
3. Fixed timestep 60 Hz. The Fight scene runs an accumulator and calls `step()` 0..N times per render frame.
4. Render never mutates sim state. VFX/SFX are triggered from `state.events` (events of the last step only).
5. Engine never references a specific character id. Characters compose abilities via `AbilityRef` data.

## Sim API (src/game/sim/engine.ts)
```ts
export const sim: SimApi;            // createMatch, step, cloneState, hashState, rematch
export function getDef(charId: string): CharacterDef;    // via registry
export function getHurtbox(f: FighterState): {x,y,w,h};   // world px rect (x,y = left,bottom; y up)  (src/game/sim/boxes.ts)
export function getActiveHitbox(state, f): {x,y,w,h} | null;
export function deriveStats(points: StatPoints, overrides?): DerivedStats;  // src/game/sim/balance.ts
```
Phases: `intro` (~90 frames, inputs ignored, 'roundStart' then 'fight' events) -> `fight` -> `ko` (slow-mo-free ~90 frames)
-> `roundEnd` (~90 frames) -> next round intro, or `matchEnd` (state.winner set). Timer 75 s; time-out: higher HP% wins.
Training mode (`config.mode==='training'`): no timer, no KO end (HP refills when depleted), optional regen.

## Character registry (src/characters/registry.ts)
```ts
export const CHARACTERS: CharacterDef[];
export function getCharacter(id: string): CharacterDef;  // throws if unknown
export function listCharacters(): CharacterDef[];
export function listFranchises(): { id: string; name: string; characters: CharacterDef[] }[];
export function validateCharacter(def: CharacterDef): string[]; // list of problems, [] = valid
```
Character folder: `src/characters/<franchise>/<id>/` with `index.ts` (exports `def: CharacterDef`), `config.ts`
(identity + stat points), `moves.ts` (MoveDef data), `visuals.ts` (exports `visuals: CharacterVisuals`; owned by
render team), optional `audio.ts`. Adding a character = new folder + one line in registry.ts.

## Abilities (src/abilities)
Each ability is a component object registered in `src/abilities/index.ts`:
```ts
interface Ability { type: AbilityRef['type']; trigger(ctx: SimContext, owner: FighterState, params, move: MoveDef): void;
                    updateEntity?(ctx, e: EntityState): void; onEntityHit?(ctx, e, target: FighterState): void }
```
Required: projectile, beam, dashAttack, teleport, counter, buff, transformation, aoe, shield, summon (simple autonomous
clone that runs/attacks), trap. Plus heal/debuff (simple).

## Render (src/render) — Phaser
- `FighterView` (`new FighterView(scene, def, playerIndex)`; `update(f: FighterState, state: MatchState)`; `setDepth`; `destroy`):
  procedural cutout anime rig (NOT boxes). Poses from body-family clips (`src/render/rig/families/*.ts`) + per-character overrides.
  Converts sim coords: `screenX = x/FX`, `screenY = GROUND_Y - y/FX` (world space; camera handles scroll/zoom).
- `EntityView` pool drawing EntityState by `visual` hint (kiBlast, kamehameha beam, rasengan, clone (draws a FighterView-like ghost), rasenshuriken, generic).
- `VfxSystem` (`handleEvents(events, state)`, `update(dtMs)`): pooled hit sparks, flashes, trails, auras, particles,
  camera shake (moderate), ultimate cinematic (zoom, darkening overlay / bg tint, big text, speed lines, particles) driven
  by `state.cinematic`.
- `StageView` — original parallax stage "Arena destruida al atardecer" (sunset, ruins, debris), world width 2400 px.
- `CameraRig` — follows midpoint of fighters, zooms between 0.85..1.15 based on distance, clamps to stage.
- `portrait.ts` — `makePortraitTexture(scene, def, key, size)` and `makeFullBodyTexture(scene, def, key, height, anim?)` for select screen.

## UI (src/ui) — Phaser scenes (keys in sceneData.ts)
Boot (generate textures, fonts), Title, Settings, Select, PostMatch, plus `Hud` class used by Fight scene:
`new Hud(scene, defs:[CharacterDef,CharacterDef], opts)`; `update(state: MatchState, extra?: {ping?: number|null, training?: {...}})`.
Visual direction: dark anime-arcade (deep navy/black, neon magenta/cyan/orange accents, slanted panels, bold italic type,
animated transitions). Spanish rioplatense text, arcade terms in English (READY, FIGHT, KO).

## Audio (src/audio)
`audio` singleton: `unlock()`, `playSfx(key, opts?)`, `playEvent(ev: SimEvent)`, `music(track: 'menu'|'battle'|null)`,
`setVolumes({master,music,sfx})`. All procedural WebAudio, no files.

## Input (src/game/input)
`KeyboardInput` (window listeners, works without a scene) with `sample(set: 'p1keys'|'p2keys'): InputBits` called once per
sim frame (handles double-tap dash and Shift dash). `GamepadInput` abstraction. Default keys P1: A/D move, W jump, S crouch,
J light, K heavy, L sp1, U sp2, I block, O ult, Shift dash. P2: arrows move/jump/crouch, numpad 1 light, 2 heavy, 3 sp1,
4 sp2, 5 block, 6 ult, 0 dash (also keys , . / ; ' ] [ as alternatives for laptops without numpad — see bindings.ts).

## AI (src/game/ai/qaBot.ts)
`createBot(seed, level)` -> `{ next(state: MatchState, me: PlayerIndex): InputBits }` — deterministic given state.
Modes for training dummy: 'idle' | 'block' | 'jump' | 'bot'.

## Ownership in Phase 1 (parallel work — only edit your files)
- Engine team (Claude Code): src/game/sim/**, src/abilities/**, src/characters/** EXCEPT visuals.ts, src/game/ai/**, tests/unit/**.
- Render team (Codex): src/render/**, src/characters/**/visuals.ts.
- UI/Audio/Input team (Grok): src/ui/** (except sceneData.ts contract: additive only), src/audio/**, src/game/input/** (buttons.ts additive only).
- Lead (integration): src/main.ts, src/game/scenes/FightScene.ts, debug overlay, Playwright, docs.
