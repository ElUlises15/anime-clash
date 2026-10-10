# ANIME CLASH

Browser 2D 1v1 fighter (TypeScript + Vite + Phaser 3) with a deterministic fixed-point sim, Local VS, Training and
**online P2P rooms** (WebRTC, rollback netcode). Fan project — all art/audio is original/procedural.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run build        # type-check + production build into dist/
npm run test:e2e     # Playwright (builds must exist: npm run build first). PW_PORT=4199 to change the preview port.
```

## Controls
Default keys (P1 is one-handed around WASD; P1 and P2 share no keys, so local VS works on one keyboard):

| Action | P1 (left hand) | P2 (numpad) | P2 laptop (no numpad) |
|---|---|---|---|
| Move / jump / crouch | A D / W / S | ← → / ↑ / ↓ | ← → / ↑ / ↓ |
| Light | Q (or 1) | Num1 | , |
| Heavy | E (or 2) | Num2 | . |
| Special 1 | R (or 3) | Num4 | ; |
| Special 2 | F (or 4) | Num5 | ' |
| Block | Space | Num0 | / |
| Ultimate | C — or R+F together | Num3 — or Num4+Num5 | ] — or ; + ' |
| Dash (+ direction) | Left Shift | Num6 / Num. / Right Ctrl | Right Shift |

- **Dash**: hold the dash key with a direction, or double-tap ← / →.
- **Ultimate chord**: Special 1 + Special 2 pressed together (same frame or within 3 frames) = Ultimate.
  A lone special press is delayed by at most 3 frames while the game waits for its partner.
- **Gamepad** (pad 1 = P1, pad 2 = P2): A light, B heavy, X sp1, Y sp2, LB/LT block, RB ultimate, RT/L3 dash.
- **H** during a fight: controls overlay (also **CONTROLES** in the pause menu). **Esc / P** pauses.
  Training: F1 dummy mode, F2 regen, F3 / Backspace reset.
- Menus: arrows/WASD move, Enter / Space / J confirm, Esc / Backspace back, mouse hover + click.

**Remapping**: SETTINGS → CONTROLES. Click a key cell (or focus it and press Enter) → *Pulsa una tecla...* → press the
new key (Esc cancels). If the key was used by another action it is taken from it (same player: the actions swap keys).
**RESTABLECER P1 / P2** restore the defaults. Bindings are saved in `localStorage['anime-clash-bindings']`;
Esc, Backspace, P, H, Tab and F1–F3 are reserved and can't be bound.

**Audio**: defaults are master 40% / music 16% / SFX 42% (saved in `localStorage['anime-clash-settings']`, applied at
boot). Saves from older versions get the new volumes once. The master bus has a compressor + limiter and identical
sounds are capped at 3 simultaneous voices, so stacked hits don't clip.

## Online (P2P)
1. **ONLINE → CREATE ROOM**. You get a 6-character code and a link like
   `https://elulises15.github.io/anime-clash/#/room/ABC234` — use **COPIAR LINK** and send it to a friend.
2. Your friend opens the link (or **ONLINE → JOIN ROOM** and types/pastes the code or link).
3. Both see each other's status and ping in the lobby → **ELEGIR LUCHADOR** → pick with WASD + J (or Enter), press it again for **READY**.
   When both are READY a 3-second countdown starts and the fight begins. Each player uses the P1 keys.
4. After the match: **REMATCH** (both press it), **CHANGE FIGHTER**, **RETURN TO ROOM**, **SHARE RESULT**.
5. If the guest's connection drops, there is a 15 s window to reconnect (automatically, or by reopening the link) and the
   match resumes from the host's state.

No accounts and no server of ours: the public PeerJS broker (`0.peerjs.com`) only introduces the two browsers; game traffic is
direct WebRTC. Some networks (symmetric NAT, strict corporate firewalls, some mobile carriers) need a **TURN** relay — set
`VITE_TURN_URL/USER/PASS` (see `.env.example`). Details: [docs/NETWORKING.md](docs/NETWORKING.md).

## Deploy to GitHub Pages (https://elulises15.github.io/anime-clash/)
The build uses relative asset paths (`base: './'`), so it works under `/anime-clash/` and room links are hash routes
(no SPA rewrites needed).

**Option A — GitHub Actions (recommended, workflow included at `.github/workflows/pages.yml`)**
```bash
git remote add origin https://github.com/elulises15/anime-clash.git   # once
git push -u origin master:main
```
Then on GitHub: Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs tests, builds and deploys.
Optional TURN: Settings → Secrets and variables → Actions → variables `VITE_TURN_URL`, `VITE_TURN_USER`, secret `VITE_TURN_PASS`.

**Option B — manual `gh-pages` branch**
```bash
npm run build
npx gh-pages -d dist -t      # pushes dist/ to the gh-pages branch (-t includes dotfiles)
```
Then Settings → Pages → Source: Deploy from branch → `gh-pages` / root.

## Docs
`docs/ARCHITECTURE.md`, `docs/NETWORKING.md`, `docs/ADDING_A_CHARACTER.md`, `docs/BALANCING.md`, `docs/ASSET_PIPELINE.md`.
