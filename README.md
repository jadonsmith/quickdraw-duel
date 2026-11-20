# Quick-Draw Duel

A tiny web game for two people. Both players get the **same prompt** and the **same clock**,
sketch as fast as they can, then the drawings are shown side by side and you vote on who nailed it.
First to the higher score across rounds wins bragging rights.

Two ways to pair up — both play the same way, each player on their own phone or laptop:

- **Online Duel** – hit *Online Duel* and you're matched with the next person who does the
  same. No codes, just whoever's on the server.
- **Private Duel** – one person taps *Create a room* and reads out the 4-character code; the
  other types it in. Just the two of you. Good for friends in the same room or on a call.

The home screen shows a live count of connected players. Works with mouse, trackpad, and
touch — built to fit on an Android or iPhone screen.

Part of the **play.jadon.me** collection — deployed at `play.jadon.me/quickdraw/`. See
[`../play/`](../play/) for the hub and [`DEPLOY.md`](DEPLOY.md) for hosting.

## Run it

```bash
cd quickdraw-duel
npm install
npm start
```

Then open <http://localhost:3737>. To duel online with someone else, they open the same
address — on the same machine, your LAN IP (e.g. `http://192.168.1.20:3737`), or a tunnel
(ngrok / Cloudflare Tunnel) if you're on different networks.

Change the port with `PORT=8080 npm start`. `HOST=127.0.0.1` binds to localhost only (for
running behind a reverse proxy).

## How it works

- `server.js` – static file server + a `ws` WebSocket server. Holds a random-match queue plus
  a map of open private room codes, pairs players into rooms, picks a shared prompt, relays the
  finished drawings, tallies votes, tracks the running score, and broadcasts the live player
  count. Round timings are enforced server-side so a stalled client can't hang the game.
- `public/` – the whole client: one page, a small screen state machine, and a canvas
  sketchpad (8 colours, 3 brush sizes, eraser, undo, clear) that exports each drawing as a PNG.
- `public/prompts.js` – the shared prompt list, loaded by both server (`require`) and client.

No database, no build step, no framework.
