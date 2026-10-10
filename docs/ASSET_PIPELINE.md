# Procedural art pipeline

All art is generated at runtime from original canvas paths and Phaser Graphics. There are no downloaded sprites or image assets. Simulation state is read only; visual interpolation, particles and render caches never enter serialized state.

## Character content

Each character exports `visuals: CharacterVisuals` from its own `visuals.ts`. Choose `standard`, `slim`, `heavy` or `petite`, a height around 235–245 logical pixels, and a complete palette. Use contrasting skin, costume and hair shade colors: shades are baked into part textures alongside dark ink outlines, fabric creases and facial details. Optional `undershirt`, `belt`, `wrist`, `bootsShade` and `hairHighlight` refine costume accents.

`hair.locks` holds silhouette polygons in head-local units (head radius 1, positive Y downward). Use large readable spikes; `hair.bangs` supplies the front layer. Forms override palette and/or polygons through `forms[formId]`. Goku's `ssj` override produces taller gold spikes and teal eyes without changing sim data.

The current accessory vocabulary renders headband/metal plate, original chest symbol, shoulder swirl, whiskers and wristbands. Headband selects the jacket/sandal costume treatment. Accessory params `openShirt`, `rope`, `armor`, `gloves`, and `whiskers` select additional original costume details without character-id checks. Naruto uses dark sleeve/chest panels over orange; Sasuke uses an open high collar and rope apron; Vegeta uses armor, gloves and boot tips. New clothing styles should extend `textures.ts` with data-driven accessory treatment. Other accessory kinds in the contract remain available for future content but currently have no specialized drawing.

## Rig and animation

`textureParts` caches 576×576 CanvasTextures (3× supersampling, displayed at one third scale) per character, form and part. `Rig` assembles head, neck, front/back hair, torso, pelvis, tapered upper/lower limbs, fists/open palms and boots into a container. Joint origins are baked at (96,80). Forward kinematics places children from parent angles; back limbs use a darker tint. Face expressions are a reusable Graphics layer.

Family modules export proportions and a complete animation map. All 34 `AnimKey`s have clips; shared combat poses use anticipation, extension, hold and recovery. `samplePose` merges sparse keyframes over the neutral pose, interpolates numeric fields with smoothstep and switches discrete expressions/hands halfway between keys. `animOverrides` replaces a clip for one character. `animFrame` is interpreted at 60 Hz; active move durations scale the clip to startup + active + recovery. Optional pose offsets are in logical pixels and angles are degrees. Positive limb angle rotates the downward segment toward screen left before facing is applied.

`FighterView(scene, def, index)` owns the rig, ground shadow, three preallocated afterimage rigs and aura Graphics. `update(f,state)` handles fixed-point coordinates, facing, forms, hit flashes, invulnerability and poses. `container`, `setDepth(depth)` and `destroy()` are integration APIs. Construction registers render content for clone/cinematic lookup and pre-generates the cut-in portrait.

## World and effects

`StageView(scene)` creates a 2400-pixel arena with cached sky, mountains, towers, pillars and floor layers. Call `update(dtMs,camera)` for subtle parallax and airborne embers. `CameraRig(scene).update(state,dtMs)` follows fighter midpoint, adjusts distance zoom and clamps horizontally; `shake`, `punch` and `cinematicFocus(owner|null)` provide impact/cinematic controls.

`EntityView(scene, optionalDefsOrFighterViews)` has 32 reusable Graphics slots. Call `update(state)` or `update(entities,state)`. Hints include `kiBlast`, `kamehameha`, `superKamehameha`, `rasengan`, `clone`, `kunai`, `rasenshuriken`, `explosion`, `shield`, `trap`; every entity kind has a fallback. Beams extend from their origin in facing direction and use the smaller of `w` and `data.length` when both are supplied, so clipping at a target also moves the impact flare. Shield origins are box centers; trap/summon origins remain bottom centers. Rasengan accepts `data.attached` or `data.attachToOwner` to follow the owner's hand. Clones resolve owner content from constructor definitions or the FighterView render cache.

`VfxSystem(scene,camera)` has 64 reusable event slots. Call `handleEvents(events,state)` after simulation steps and `update(dtMs,state)` each render. Repeated event frames are ignored. It renders hit/block bursts, smoke/dust, flashes and moderate shake; `state.cinematic` drives focus, dark tint, radial lines, portrait band and character `vfx.ultimateText`. Hide and restore happen when cinematic becomes inactive. Do not also trigger a separate cinematic timer.

`makePortraitTexture(scene,def,key,size=256)` and `makeFullBodyTexture(scene,def,key,height,anim='idle',frame=0)` return the cached texture key. Temporary render targets/rigs are destroyed after saving textures. Every view/system exposes `destroy()`; texture caches belong to the Phaser texture manager.

## Preview and verification

Run `npx vite --port 5199`, then open `/preview.html`. Left/right advances the animation cycle, Space triggers the ultimate, and T toggles SSJ. `?anim=heavy&frame=14` freezes a pose. The preview owns fake JSON state and imports no simulation engine or unfinished registry. `node src/render/dev/screenshot.mjs` captures Chromium at 1366×768 into `/workspace/anime-clash/shots/render-dev/`. It includes all 18 requested pose, SSJ, cinematic, and entity captures. Query flags `form=ssj`, `cinematic=1`, and `effect=clone|rasengan|rasenshuriken` isolate art variants. Stop Vite after inspecting captures.

Known limits: current families share the animation language with width differences; bespoke accessory kinds and character-specific hand gestures can be expanded. Event/entity Graphics are pooled with fixed caps; saturation skips surplus effects. Part textures are deliberately crisp cutout art rather than frame-drawn animation. Body parts do not deform between keyframes.


## Art polish pass

Fighters use 242/238 logical height hints with a 190-unit rig reference and camera distance zoom 0.95–1.25. The height hint includes the hair silhouette, which differs by form. Baggy pants overlap the knee, rounded arm caps sit under the gi/jacket sleeves, and palm textures include a thumb. Large hair canvases prevent clipping SSJ spikes. Cut-in keys (`cutin:*`) omit the portrait card background for a transparent bust over the diagonal band. All part textures remain cached once per character/form. Only transforms and hand texture selection animate cutout parts; pooled effects and the small expression overlay draw dynamically.

Three visual passes were reviewed at 1366×768: joint overlap/scale, hair/stance/knockdown, and torso/cut-in/strike contours. Shared rigs remain stylized cutout animation: no perspective mesh deformation or finger articulation. Cinematic graphics and portrait/text use inverse zoom around the camera viewport center, including the backdrop. The backdrop renders below fighters; only the defender fades. The owner keeps full costume colors and gains brighter flame outlines and converging energy motes. Camera bounds release vertically for cinematic floor placement at 73% of the viewport. Hit flashes use `state.frame - lastHitFrame < 4`; restoring tint explicitly clears Phaser fill mode.


## Round 3 verification

All four character folders export the unchanged `visuals: CharacterVisuals` API. Vegeta includes an `ssj` palette/hair form. No contract additions or assets from external sources were needed. Portraits now use original curved shoulder paths with supersampled head/hair parts; transparent cut-ins taper along a diagonal edge.

Entity hints additionally support `kiBlastPurple`, `galickGun`, `bigBang`, `barrier`, `finalFlash`, `fireball`, `chidori`, `shuriken`, `sharingan`, `wireTrap`, and `kirin`. Unknown visual/event hints retain generic rendering or are safely ignored. Kirin events produce a short screen flash; beams carry endpoint flares and radial impact sparks. Graphics slots remain pooled.

The preview accepts `p1=goku|naruto|vegeta|sasuke`, `p2=…`, `effect=…`, and `zoom=…`. `src/render/dev/round3.mjs` verifies the real production game on port 5402 and previews on 5403, writes captures to `/tmp/anime-clash-round3`, checks four-frame tint restoration, and exercises cinematic zooms 0.85, 1.25, and 1.6. Set `REAL_ONLY=1` to skip preview captures. Build with `npx vite build --outDir /tmp/codexdist --emptyOutDir` before serving the snapshot. The standard `tools/fightshot.mjs` autoplay capture remains compatible.

Limits: the shared rig remains cutout animation rather than deforming meshes. Screen compensation assumes the full logical viewport used by FightScene; a future split-screen camera needs its own viewport origin. Pool caps skip excess particles/entities gracefully.
