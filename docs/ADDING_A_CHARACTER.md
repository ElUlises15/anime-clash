# Adding a character

A character is pure data composed from reusable ability components. You never touch the engine
(`src/game/sim/**`) or the ability components (`src/abilities/**`) to add one.

```
src/characters/<franchise>/<id>/
  config.ts    identity, stat points, forms, audio        (engine team / designers)
  moves.ts     MoveDef data (frame data, hitboxes, abilities)
  visuals.ts   CharacterVisuals: rig family, palette, hair, accessories, VFX colors   (render team)
  index.ts     assembles the CharacterDef
src/characters/registry.ts   one import + one entry in CHARACTERS
```

## Step by step

1. **Pick an identity.** Archetype (`Balanced`, `Rushdown`, `Zoner`, `Grappler`, `Bruiser`, `Glass Cannon`,
   `Defensive`, `Technical`, `Summoner`), difficulty 1–5, a one-paragraph Spanish description.
2. **Spend 25 stat points** (`power`, `speed`, `mobility`, `defense`, `energy`, each 1..10). See
   [BALANCING.md](BALANCING.md) for what each point buys. Mobility ≥7 = 2 air actions (double jump + air dash).
3. **Write the moves** (`moves.ts`). Required slots: `light`, `heavy`, `special1`, `special2`, `ultimate`.
   Optional: `light2` (chain from light), `crouchLight`, `crouchHeavy`, `airLight`, `airHeavy`, `airSpecial1`
   (SP1 in the air), `special1Down` / `special2Down` (DOWN + special; fall back to the normal special if absent).
   * Normals (`kind: 'normal'`) need a `hitbox`, cost no energy and chain via `cancelInto` (on hit/block).
   * Every normal can be cancelled into any special on hit/block, and specials/normals into the ultimate on hit.
   * Specials/ultimates attach ability components through `abilities: [{ type, frame, params }]`.
   * Ultimates: `kind: 'ultimate'`, `ultCost: 1000`, `cinematicFrames: 120..300` (the world freezes for the
     cinematic, then the move continues), usually `invuln: [0, startup + 4]`.
   * Set `vfx` / `sfx` (and `params.visual`) to render/audio keys.
4. **Visuals** (`visuals.ts`, render team): export `visuals: CharacterVisuals`. Add per-form overrides if you use a
   transformation (`forms: { myForm: { palette, hair, aura } }`).
5. **Assemble** `index.ts` exactly like the others and **register**: in `src/characters/registry.ts` add
   `import { def as myChar } from './<franchise>/<id>';` and append `myChar` to `CHARACTERS`.
6. **Validate**: `npx vitest run`. `tests/unit/characters.registry.test.ts` runs `validateCharacter` on every
   registered character (budget, required moves, frame-data ranges, ability types, cancel targets, forms) and the bot
   test checks that every move of every character gets used in bot matches, that all matchups end with a winner and
   that nobody wins > 80% of a matchup. `sim.feel.test.ts` runs the feel checks (tap buffer, chain timing, jump
   airtime, dash, block advantage ≤ +3, projectile clashes) on every registered character automatically. Add a
   `balance.test.ts` BnB entry and kit tests like `tests/unit/characters.kits.test.ts`. Then run the win-rate matrix
   (`BALANCE_REPORT=1 BALANCE_N=300 npx vitest run tests/unit/balance.report.test.ts`).

## Ability components (`AbilityRef.type`)

| type            | What it does                                                         | Key params |
|-----------------|----------------------------------------------------------------------|------------|
| `projectile`    | flying hitbox; clashes with opposing projectiles by `power`          | speed, vy, life, w, h, offsetX/Y, hits, power, count, explode(+explodeRadius/Hits/Damage) |
| `beam`          | sustained, growing hitbox anchored to the hand; multi-hit; ends if interrupted | duration, maxLength, growSpeed, thickness, hits, interval, power, finalKnockdown |
| `dashAttack`    | owner travels with the move hitbox; stops on contact                 | speed, frames, orb (visual entity) |
| `teleport`      | reposition behind/front of opponent or forward/back, with i-frames   | mode, distance, invuln, matchHeight |
| `counter`       | parry window; negates a hit (melee or entity) and auto-strikes       | window, response (`strike`/`teleportStrike`), range, + hit keys |
| `aoe`           | area burst around self or opponent, optional delay, multi-hit       | radius, at, delay, life, hits, interval |
| `summon`        | clones that run in, wind up, strike once and poof; struck clones poof | count, speed, life, delayStep, attackRange, windup |
| `trap`          | ground trap, arms after a delay, stuns on contact (unblockable)      | offsetX, armDelay, life, stun, damage |
| `shield`        | barrier entity absorbing projectiles and melee until its hp runs out | w, h, offsetX/Y, life, hp, follow |
| `buff` / `debuff` | status effect on self / opponent (`stun` also applies hitstun)     | kind, frames, magnitude, range |
| `heal`          | restore HP                                                           | amount, percent |
| `transformation`| sets `fighter.form` (uses `def.forms[form].statMul`) for N frames (-1 = round) | form, frames, heal, energy |
| `grab`          | unblockable close-range throw                                        | range, + hit keys |

"Hit keys" accepted by every damaging component (falling back to the move's values): `damage, chip, kbx, kby,
hitstun, blockstun, hitstop, level, knockdown, launcher, hitVisual, sfx, energyGain`.

Need a new mechanic? Add a component in `src/abilities/<name>.ts` implementing `Ability` (`trigger`, optional `tick`,
`updateEntity`, `onEntityHit`, `onExpire`, `onEntityStruck`, `interceptHit`), register it in `src/abilities/index.ts`,
add the type to `AbilityRef['type']` (contract, additive) and `KNOWN_ABILITY_TYPES` in the registry. Components must be
deterministic: integers only, no `Math.random`/`Date`, all state in `EntityState.data` / `FighterState`.

## Worked examples: Vegeta and Sasuke (added with zero engine changes)

Both were added as new folders + 2 lines in `registry.ts`; every mechanic is an existing component configured by data.
Read their `moves.ts` side by side with Goku/Naruto to see how the same components produce different characters.

### Vegeta — `dragonball/vegeta` (Rushdown, difficulty 3, points `6/6/5/4/4`)

| Slot | Move | How it's built |
|------|------|----------------|
| `light2`, `heavy` | Rushing Elbow, Prince Knee | `selfVelocity: [{ frame, vx }]` steps forward so pressure carries; jab is 12f blockstun (≈ +1). |
| `special1` | Ráfaga de Ki | `projectile` with `count: 4, spacing: 55` → four small blasts in a line (each `power: 1`, so each one cancels one weak projectile). Visual `kiBlastPurple`. |
| `airSpecial1` | Ráfaga de Ki (aire) | same component, `count: 3, vy: -8` (diagonal down). |
| `special2` | Galick Gun | `beam` (6 ticks, `power: 3`, `finalKnockdown`), visual `galickGun`. |
| `special1Down` | Big Bang Attack | slow (`speed: 8`) 84 px `projectile` with `explode: true` → spawns an `aoe` (4 ticks) on contact, on clash or at the end of its life. Visual `bigBang`. |
| `special2Down` | Barrera | two abilities in one move: a `shield` that follows him (`offsetX: 0`, 180×250, absorbs projectiles, beams, melee and clone strikes) on frame 3, then an `aoe` burst on frame 34 that knocks the rival away. Visual `barrier`. |
| `ultimate` | Final Flash | `beam` 175 px thick, 1600 px long, 10 ticks, `cinematicFrames: 170`, visual `finalFlash`; render reads `visuals.vfx.ultimateText = 'FINAL FLASH!!'`. |

### Sasuke — `naruto/sasuke` (Technical, difficulty 4, points `5/6/6/4/4`)

| Slot | Move | How it's built |
|------|------|----------------|
| `airHeavy` | Dive Kick | `selfVelocity: [{ frame: 7, vx: 9, vy: -14 }]` — a negative `vy` in the air turns the jump into a dive. |
| `special1` | Katon: Gōkakyū | big slow `projectile` (`speed: 9`, 96 px, `hits: 2, interval: 9`, `power: 3` → beats ki blasts/kunai), visual `fireball`. |
| `special1Down` | Shuriken | `projectile` `count: 2, speed: 24` (the engine sweeps projectile clash boxes, so very fast projectiles still clash), visual `shuriken`. |
| `airSpecial1` | Shuriken Trampa | `trap` (ground-anchored even when thrown from the air), arms after 18f, 44f stun, visual `wireTrap`. |
| `special2` | Chidori | `dashAttack` `speed: 21` with an `orb` visual entity in the hand, 16f startup so it combos from the heavy. Visual `chidori`. |
| `special2Down` | Sharingan | `counter` `response: 'teleportStrike'`, short window (18f) but 86 damage. Visual `sharingan`. |
| `ultimate` | Kirin | `aoe` `at: 'opponent'`, `delay: 6`, radius 150, 6 ticks with `finalKnockdown` — lightning drops on the rival's position after the cinematic. Visual `kirin`, `ultimateText 'KIRIN!!'`. |

Tips learned while adding them:
* Check that your `special2` (or whatever you cancel into from `heavy`) combos: heavy hitstun (≈22) must exceed the
  special's startup + travel time. Chidori first had 19f startup and dropped the combo by one frame;
  `sim.feel.test.ts` (chain test) catches this for every registered character.
* Give each character a different answer to projectiles (Goku: Instant Transmission, Vegeta: Barrera, Naruto: Kawarimi,
  Sasuke: Gōkakyū beats small projectiles) so matchups differ.
* Run the win-rate matrix (BALANCING.md §8) after adding a character and nudge costs/cooldowns first.

## Minimal example

`src/characters/original/blaze/config.ts`
```ts
import type { CharacterDef } from '../../types';

export const config: Omit<CharacterDef, 'moves' | 'visuals'> = {
  id: 'blaze', name: 'Blaze', franchise: 'original', franchiseName: 'Original',
  archetype: 'Zoner', difficulty: 2,
  description: 'Lanza bolas de fuego y castiga desde lejos.',
  stats: { power: 5, speed: 4, mobility: 4, defense: 5, energy: 7 }, // = 25
  audio: { voicePitch: 1.1 },
};
```

`src/characters/original/blaze/moves.ts`
```ts
import type { CharacterDef } from '../../types';

export const moves: CharacterDef['moves'] = {
  light: {
    id: 'blaze_jab', name: 'Jab', kind: 'normal', anim: 'light',
    startup: 5, active: 3, recovery: 9, damage: 34, knockback: { x: 3, y: 0 }, hitstun: 15, blockstun: 11,
    hitbox: { x: 20, y: 140, w: 70, h: 40 }, range: 125, energyCost: 0, cooldown: 0, cancelInto: ['heavy'],
  },
  heavy: {
    id: 'blaze_kick', name: 'Kick', kind: 'normal', anim: 'heavy',
    startup: 11, active: 4, recovery: 18, damage: 66, knockback: { x: 8, y: 0 }, hitstun: 22, blockstun: 16,
    hitbox: { x: 25, y: 100, w: 90, h: 60 }, range: 140, energyCost: 0, cooldown: 0,
  },
  special1: {
    id: 'blaze_fireball', name: 'Fireball', kind: 'special', anim: 'projectile',
    startup: 12, active: 2, recovery: 18, damage: 45, knockback: { x: 4, y: 0 }, hitstun: 18, blockstun: 12,
    range: 900, energyCost: 120, cooldown: 45, vfx: 'fireball', sfx: 'fire',
    abilities: [{ type: 'projectile', frame: 12, params: { speed: 13, life: 120, w: 46, h: 46, offsetY: 140, power: 2 } }],
  },
  special2: {
    id: 'blaze_pillar', name: 'Flame Pillar', kind: 'special', anim: 'special2',
    startup: 16, active: 2, recovery: 24, damage: 30, knockback: { x: 2, y: 12 }, hitstun: 25, blockstun: 14,
    launcher: true, range: 1200, energyCost: 250, cooldown: 240, vfx: 'explosion',
    abilities: [{ type: 'aoe', frame: 16, params: { at: 'opponent', delay: 20, radius: 70, offsetY: 110, hits: 3, interval: 6 } }],
  },
  ultimate: {
    id: 'blaze_inferno', name: 'Inferno', kind: 'ultimate', anim: 'ultimate',
    startup: 24, active: 4, recovery: 30, damage: 40, knockback: { x: 3, y: 0 }, hitstun: 24, blockstun: 16,
    range: 1300, energyCost: 0, ultCost: 1000, cooldown: 0, invuln: [0, 28], cinematicFrames: 150,
    vfx: 'explosion', sfx: 'ultimate',
    abilities: [{ type: 'beam', frame: 24, params: { duration: 60, maxLength: 1300, growSpeed: 100, thickness: 130, hits: 8, interval: 7, power: 8, finalKnockdown: true } }],
  },
};
```

`src/characters/original/blaze/index.ts`
```ts
import type { CharacterDef } from '../../types';
import { config } from './config';
import { moves } from './moves';
import { visuals } from './visuals';

export const def: CharacterDef = { ...config, moves, visuals };
```

`src/characters/registry.ts`
```ts
import { def as blaze } from './original/blaze';
export const CHARACTERS: CharacterDef[] = [goku, vegeta, naruto, sasuke, blaze];
```

That's it: the select screen, HUD, bots, netcode and tests pick it up from the registry.
