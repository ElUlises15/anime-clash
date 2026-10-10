# Balancing guide

Everything gameplay-related is **data** (`src/characters/<franchise>/<id>/{config,moves}.ts`) plus a small set of
universal constants (`src/game/sim/constants.ts`). The engine never special-cases a character.

Units: 60 frames = 1 second. Positions/velocities are fixed-point integers (`FX = 100` units per pixel). In character
data, hitboxes are in **px**, knockback and self velocities in **px/frame** (the engine multiplies by `FX`).
HP is ~1000 per character, energy and ultimate meters are 0..1000.

## 1. Stat budget

Each character has 5 stat points (`StatPoints`, 1..10 each). **Sum ≤ `STAT_BUDGET` = 25** (5 avg). Validated by
`validateCharacter` and the unit tests.

| Stat     | Derived value (`deriveStats`, `src/game/sim/balance.ts`)                       | Range (1 → 10)        |
|----------|---------------------------------------------------------------------------------|-----------------------|
| defense  | `health = 850 + 30*def`; damage taken `defense% = 110 - 2*def`                  | 880..1150 HP; 108%..90% |
| power    | `powerMul% = 80 + 4*power` (all damage dealt)                                  | 84%..120%             |
| speed    | `walk = 380 + 32*speed` FX/f, back walk 78%, `dash = 1150 + 55*speed` FX/f      | 4.1..7.0 px/f walk    |
| mobility | `jumpVelocity = 1820 + 40*mob` (gravity 100 ⇒ apex ≈ v²/2g ≈ 190..240 px); `airActions = mob≥7 ? 2 : mob≥4 ? 1 : 0` | |
| energy   | `energyRegen = 30 + 6*energy` **centi-energy per frame** (60 = 0.6/f = 36 per second) | 21..54 energy/s |

Air actions are shared between double jump (UP in the air) and air dash (DASH in the air).
`statOverrides` can replace any derived number but must stay inside `DERIVED_LIMITS` (validated). Use it sparingly and
document why (it bypasses the budget).

Forms (`CharacterDef.forms[form].statMul`) multiply `powerMul`, `speed` (walk/back/dash) and `defense` in percent while
`fighter.form` is set (transformation ability). Status effects multiply too (see §6).

Current roster (power/speed/mobility/defense/energy):

| Character | Points      | Archetype  | HP   | Power | Walk    | Air actions | Identity |
|-----------|-------------|------------|------|-------|---------|-------------|----------|
| Goku      | `5/5/6/5/4` | Balanced   | 1000 | 100%  | 5.4 px/f | 1 | cheap ki blasts, beam, teleport, Kiai, transformation ultimate |
| Vegeta    | `6/6/5/4/4` | Rushdown   | 970  | 104%  | 5.7 px/f | 1 | normals that step forward, 4-blast barrage, Big Bang, Barrera (shield + burst), takes 102% damage |
| Naruto    | `4/6/7/5/3` | Rushdown   | 1000 | 96%   | 5.7 px/f | 2 | clones, launcher, Rasengan rush, Kawarimi counter, less regen |
| Sasuke    | `5/6/6/4/4` | Technical  | 970  | 100%  | 5.7 px/f | 1 | dive kick, slow 2-hit fireball, fast shuriken, air wire trap, Chidori, short strong counter, Kirin |

## 2. Frame data conventions

```
frame 0 ............ startup-1 | startup ... startup+active-1 | ... startup+active+recovery-1
        (startup)               (active: hitbox live)            (recovery)
```

* `startup` = frames **before** the first active frame (a 5f jab hits on the 6th frame after the press; frame 0 is the
  frame the move starts).
* Total duration = `startup + active + recovery`.
* `AbilityRef.frame` = move frame at which the component triggers (0 = the frame the move starts).
* Frame advantage on hit ≈ `hitstun − (frames left in attacker's move after the hit)`;
  on block use `blockstun`. Hitstop freezes both sides equally, so it does not change advantage.
  Targets: jabs +3..+5 on hit / −1..+1 on block; heavies ≈ +1 on hit / −5 on block; sweeps/launchers clearly unsafe
  (−7 or worse); specials −4..−10 on block unless they are projectiles.
* `multiHit: n` splits the active window into `n` equal parts; one hit per part.
* `invuln: [a, b]` / `armor: [a, b]` are inclusive move-frame ranges.
* `selfVelocity: [{frame, vx, vy}]` sets the attacker's velocity at that move frame (px/f, +x forward).

Hurtboxes are universal (px): standing 70×225, crouching 80×140, airborne 66×180 (20 px above feet), knocked down
170×45 (and invulnerable). Push boxes are 72 px wide; fighters can cross over when one is ≥185 px higher.

## 3. Hits, damage and combos

```
damage = trunc(base * attackerPowerMul% * scaling% * defenderDefense% / 1e6)   (min 1)
```

* Combo scaling by hit number: `100, 100, 90, 80, 70, 60, 50, 42`, then `35%` floor (`COMBO_SCALING`, `MIN_SCALING`).
  Ultimate hits never scale below `80%` (`ULTIMATE_MIN_SCALING`) so ultimates stay meaningful at the end of combos.
* Hitstun decay: after hit 4 of a combo every hit loses 1 extra frame of hitstun (min 8).
* Juggle: every hit on an airborne opponent adds 1 juggle point; at `JUGGLE_MAX` (7) the victim becomes intangible until
  landing. Airborne hits after the 2nd juggle point always end in a knockdown.
* Hitstop (both fighters + entities freeze): defaults by strength `light 6, heavy 10, special 12, ultimate 16`;
  override per move with `hitstop`. Multi-hit moves/beams should use small values (3..5). KO adds 30 frames.
* Knockdown: `knockdown: true` (or `launcher`) → the victim flies, lands in `knockdown` (36f, invulnerable) then `getup`
  (22f, 30 invulnerable frames total). No OTG.
* Corner: if the victim is within 70 px of a wall, the attacker is pushed back by 60% of the knockback instead.

Combo targets: a 4–6 hit bread-and-butter should do **15–25%** HP (enforced by `tests/unit/balance.test.ts`):
`jab → light2 → heavy → special2` — Goku (Kamehameha) ≈ 19%, Vegeta (Galick Gun) ≈ 21%, Naruto (Rasengan) ≈ 20%,
Sasuke (Chidori) ≈ 22%. `tests/unit/sim.feel.test.ts` checks the same chain comes out for every character with 0/4/8
frames of human delay after each hit (hitstop gives humans that time).
Ultimates ≈ 25–30% on a clean hit (Super Kamehameha / Final Flash 10 beam ticks, Rasenshuriken contact + 8 explosion
ticks, Kirin 6 lightning ticks).

## 4. Blocking

Hold **BLOCK** (no back-to-block). Standing guard blocks `mid`, `high`, `overhead`; crouching guard (DOWN+BLOCK) blocks
`mid`, `high`, `low`. `unblockable` (grabs, traps, counter strikes) ignores guard. Airborne fighters can't block.
Hits from behind (cross-ups on the same frame) can't be blocked. Blocking is instant while idle/walking/crouching.

* Chip: `move.chip`, default 0 for normals and 15% of damage for specials/ultimates; chip can KO.
* Blockstun = `blockstun`; push = 75% of the hit knockback; hitstop 70%.
* Air normals are `overhead` (must be blocked standing), sweeps/lows are `low`.
* Pressure must never be infinite: every ground normal is **at most +3 on block** (`sim.feel.test.ts` measures it by
  simulation for every character), jab → jab is not a cancel, and block push separates the fighters.
* A forward dash can be cancelled into guard from its 4th frame (dash in, then block).

## 5. Meters

| Event                     | Energy (0..1000)                        | Ultimate (0..1000)            |
|---------------------------|-----------------------------------------|-------------------------------|
| Round start               | reset to 300                            | carried over between rounds   |
| Passive                   | `energyRegen` centi/frame               | –                             |
| Normal hits (attacker)    | light 22, heavy 38 (or `energyGain`)    | 70% of damage dealt (not from ultimates) |
| Being hit                 | 25% of damage taken                     | 90% of damage taken           |
| Blocking (defender)       | +18                                     | +6 (attacker also +6)         |

Specials cost `energyCost` and start their `cooldown` (frames) when used. Ultimates need a full meter (`ultCost`,
default 1000) and consume it. Typical costs: cheap projectile 60–110, beam/rush 250–300, counter/teleport 200–250.
Expect roughly one ultimate per character per round.

## 6. Status effects (generic, by `kind`)

`powerUp` / `weakenAtk` (damage dealt %), `speedUp` / `slow` (movement %), `defenseUp` / `weaken` (damage taken %),
`armor` (no flinch, damage taken %), `burn` (magnitude damage every 30f, never KOs), `regen` (hp per second),
`energyRegen` (%), `stun` (marker; the stun itself is hitstun), plus internal `counter` and `transform`.
`frames = -1` lasts until the round ends.

## 7. Rounds

Intro 100f → fight (75 s timer) → KO pause 90f (1.5 s, the first 30f are the KO hitstop freeze) / time-up 60f →
round end 80f (victory pose) → next round or match end.
Best of 3 (`roundsToWin`). Time-out: higher HP% wins, equal = draw round (no point). After `2*roundsToWin+1` rounds
the match ends by rounds won (possibly a draw, `winner = -1`).

## 7b. Input feel (universal)

* Buffer: presses of LIGHT/HEAVY/SP1/SP2/ULT/DASH are remembered for `BUFFER_FRAMES` = 8 frames (not aged during
  hitstop), so a one-frame tap during recovery, blockstun or hitstop always comes out.
* An air normal/air special pressed so late that the fighter lands before it goes active (≤ 8 frames, nothing fired
  yet) is refunded and re-buffered: the ground version comes out instead of nothing.
* Jumps: airtime 39–42 frames, apex 200–220 px (asserted 38–50 f / 170–260 px for every character).
* Dash ≈ 14 frames / ~190 px; backdash 18 frames with 10 i-frames.
* Projectiles clash against opposing projectiles/beams by `power` using swept boxes (fast projectiles can't tunnel).
* Beams: `EntityState.w` / `data.length` is the visible + colliding length, clamped to the stage edge and stopped at
  the first opposing shield or at the opponent while it can be hit (`data.reach` = unobstructed length).

## 8. How to tune

1. Edit numbers in `moves.ts` / `config.ts`. Keep stat points within budget.
2. `npx vitest run` — validation, frame-data sanity, BnB damage range and determinism must stay green.
3. **Win-rate matrix** (bot vs bot, ~1 min for 300 matches per pair with 4 characters):
   `BALANCE_REPORT=1 BALANCE_N=300 npx vitest run tests/unit/balance.report.test.ts`
   Method (`winMatrix` in `tests/unit/helpers.ts`): for every unordered pair of *different* characters (mirrors
   excluded — they are 50% by definition) play N matches with seeds 1..N; sides alternate every seed (P1/P2) and the
   QA bot level cycles 1→2→3 (both bots on the same level), so side and skill bias cancel out. The report prints the
   matrix (row's win % vs column), wins/draws, average round length, longest match, and the damage share per move.
   Goals: every cell within 40–60% (ideally 45–55%), average round 30–60 s, no single move > ~20% of a character's
   damage. The always-on test `ai.botMatch.test.ts` runs a smaller matrix (18 per pair) and fails if any character wins
   **more than 80%** of a matchup, plus all 16 ordered matchups (mirrors included) must end with a winner.

   Current matrix (300 matches per pair):

   | vs     | goku | vegeta | naruto | sasuke | overall |
   |--------|------|--------|--------|--------|---------|
   | goku   |  –   |  46%   |  53%   |  45%   |  48%    |
   | vegeta | 54%  |   –    |  46%   |  53%   |  51%    |
   | naruto | 47%  |  54%   |   –    |  46%   |  49%    |
   | sasuke | 55%  |  47%   |  54%   |   –    |  52%    |

   Average round 37–42 s. Biggest damage share per move ≈ 16–19% (ultimates, heavies, the main projectile).
   Caveat: bots are not humans — level-3 bots block lows/overheads perfectly and never whiff-punish on purpose, so
   use the matrix to catch outliers, then playtest.
4. Prefer tuning in this order: frame data/hitboxes → damage → costs/cooldowns → stat points. Small steps (±5%).
