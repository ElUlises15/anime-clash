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
   test checks that every move of every character gets used in bot matches. Then run the balance report
   (`BALANCE_REPORT=1 npx vitest run tests/unit/balance.report.test.ts`).

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
export const CHARACTERS: CharacterDef[] = [goku, naruto, blaze];
```

That's it: the select screen, HUD, bots, netcode and tests pick it up from the registry.
