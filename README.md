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
P1: A/D move, W jump, S crouch, J light, K heavy, L special 1, U special 2, I block, O ultimate, Shift (or double tap) dash.
P2 (local): arrows, numpad 1-6 / 0 (or `, . / ; ' ] [`). Esc pauses. Training: F1 dummy mode, F2 regen, F3 reset.

## Online (P2P)
1. **ONLINE → CREATE ROOM**. You get a 6-character code and a link like
   `https://elulises15.github.io/anime-clash/#/room/ABC234` — use **COPIAR LINK** and send it to a friend.
2. Your friend opens the link (or **ONLINE → JOIN ROOM** and types/pastes the code or link).
3. Both see each other's status and ping in the lobby → **ELEGIR LUCHADOR** → pick with WASD + J, press J again for **READY**.
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
