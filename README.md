# VoxCraft

A mobile-friendly voxel sandbox with procedural settlements, survival and creative modes, character customization, player homes, chat, friends, emotes, and an experimental shared overworld.

This is an independent fan-made voxel game. It is not affiliated with, endorsed by or sponsored by Mojang or Microsoft; Minecraft is a trademark of Mojang Synergies AB. It does not implement all Minecraft features.

## Run locally

Requirements: Node.js 20 or newer, npm, Python 3, and a modern WebGL-capable browser.

Install and start the multiplayer server:

```sh
npm ci
npm start
```

In a separate terminal, serve the client from this repository:

```sh
python3 -m http.server 8765 --bind 0.0.0.0
```

Open `http://localhost:8765/`. For a phone on the same local network, use `http://YOUR_COMPUTER_LAN_IP:8765/` and allow ports 8765 and 8000 through your firewall.

The server listens on port 8000 by default and exposes the WebSocket endpoint `/ws`. Set `PORT` to change its listening port; update the client endpoint correspondingly if changing it. The client downloads Three.js and its font from external CDNs, so an internet connection is required.

## Multiplayer data and deployment

- Single-player worlds are saved in the browser (name, seed, game mode, inventory, position and every block you change), with autosave every 25 seconds and on Save, quitting, or leaving the page. The title screen offers **Continue** for the saved world.
- The Node server source is included in `server/server.js`. Runtime world edits, profiles, homes, messages, and reports are saved under `server/data/`, which is intentionally excluded from Git.
- The shared overworld is experimental. Nether and End worlds and mob simulation are client-side.
- Identity currently relies on a visitor identifier rather than secure account authentication. Outside the preview environment, the client generates a new visitor identifier on reload, so ownership is not guaranteed to persist across visits.
- The `__PORT_8000__` placeholder in `index.html` is intended for the hosted preview's proxy. Locally it falls back to port 8000 on the client's hostname. Production deployment needs an always-on WebSocket service, secure identity, HTTPS/WSS routing, persistent storage, and further security/load testing.
- Do not treat this prototype as a production-ready public multiplayer service.

## Checks

```sh
npm run check
curl http://localhost:8000/status
```
