"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const PROMPTS = require("./public/prompts");

const PORT = process.env.PORT || 3737;
const HOST = process.env.HOST || "0.0.0.0"; // set to 127.0.0.1 when behind a reverse proxy
const DRAW_SECONDS = 75;
const VOTE_SECONDS = 25;
const PUBLIC_DIR = path.join(__dirname, "public");

// ---------- static file server ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

// ---------- game state ----------
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 * 1024 });

let queue = [];             // clients waiting for a random match
const clients = new Map();  // ws -> client
const pending = new Map();  // room code -> host client waiting for a friend

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily-confused chars

let seq = 1;
const nextId = () => "c" + (seq++);

function send(client, msg) {
  if (client && client.ws.readyState === 1) client.ws.send(JSON.stringify(msg));
}

function broadcastCount() {
  const payload = JSON.stringify({ type: "count", online: clients.size });
  for (const c of clients.values()) if (c.ws.readyState === 1) c.ws.send(payload);
}

function makeCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  } while (pending.has(code));
  return code;
}

function dropPending(client) {
  if (client.privateCode && pending.get(client.privateCode) === client) {
    pending.delete(client.privateCode);
  }
  client.privateCode = null;
}

function pickPrompt(exclude) {
  let p;
  do { p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; }
  while (p === exclude && PROMPTS.length > 1);
  return p;
}

function makeRoom(a, b) {
  const room = {
    id: "r" + nextId(),
    players: [a, b],
    round: 0,
    prompt: null,
    phase: "idle",
    submissions: new Map(),
    votes: new Map(),
    scores: new Map([[a.id, 0], [b.id, 0]]),
    timer: null,
  };
  a.room = room; b.room = room;
  a.opponentName = b.name; b.opponentName = a.name;
  startRound(room);
}

function opponentOf(room, client) {
  return room.players[0] === client ? room.players[1] : room.players[0];
}

function clearTimer(room) {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
}

function startRound(room) {
  clearTimer(room);
  room.round += 1;
  room.prompt = pickPrompt(room.prompt);
  room.phase = "draw";
  room.submissions = new Map();
  room.votes = new Map();
  room.players.forEach((p) => { p.wantsAgain = false; });

  room.players.forEach((p) => {
    send(p, {
      type: "match",
      round: room.round,
      prompt: room.prompt,
      drawSeconds: DRAW_SECONDS,
      opponent: p.opponentName,
      youId: p.id,
      oppId: opponentOf(room, p).id,
      scores: scoreView(room, p),
    });
  });

  room.timer = setTimeout(() => beginReveal(room), (DRAW_SECONDS + 3) * 1000);
}

function scoreView(room, client) {
  const opp = opponentOf(room, client);
  return { you: room.scores.get(client.id) || 0, them: room.scores.get(opp.id) || 0 };
}

function beginReveal(room) {
  clearTimer(room);
  if (room.phase === "vote" || room.phase === "result") return;
  room.phase = "vote";
  const [p1, p2] = room.players;
  const img1 = room.submissions.get(p1.id) || null;
  const img2 = room.submissions.get(p2.id) || null;

  send(p1, { type: "reveal", prompt: room.prompt, yours: img1, theirs: img2, voteSeconds: VOTE_SECONDS });
  send(p2, { type: "reveal", prompt: room.prompt, yours: img2, theirs: img1, voteSeconds: VOTE_SECONDS });

  room.timer = setTimeout(() => tally(room), (VOTE_SECONDS + 3) * 1000);
}

function tally(room) {
  clearTimer(room);
  if (room.phase === "result") return;
  room.phase = "result";
  const [p1, p2] = room.players;

  // Each vote is the id of the player whose drawing was picked, or "tie".
  let g1 = 0, g2 = 0;
  for (const choice of room.votes.values()) {
    if (choice === p1.id) g1 += 1;
    else if (choice === p2.id) g2 += 1;
  }
  room.scores.set(p1.id, (room.scores.get(p1.id) || 0) + g1);
  room.scores.set(p2.id, (room.scores.get(p2.id) || 0) + g2);

  const detail = (me, them) => ({
    type: "result",
    prompt: room.prompt,
    yourVotes: me === p1 ? g1 : g2,
    theirVotes: me === p1 ? g2 : g1,
    yourChoice: labelChoice(room, room.votes.get(me.id), me),
    theirChoice: labelChoice(room, room.votes.get(them.id), me),
    scores: scoreView(room, me),
  });
  send(p1, detail(p1, p2));
  send(p2, detail(p2, p1));
}

function labelChoice(room, choice, viewer) {
  if (!choice) return null;
  if (choice === "tie") return "tie";
  return choice === viewer.id ? "yours" : "theirs";
}

function handleAgain(room, client) {
  client.wantsAgain = true;
  const opp = opponentOf(room, client);
  if (!opp || opp.ws.readyState !== 1) {
    send(client, { type: "opponent_left" });
    return;
  }
  send(opp, { type: "opponent_ready" });
  if (opp.wantsAgain) startRound(room);
}

function leaveRoom(client, { requeueOpponent } = {}) {
  const room = client.room;
  if (!room) return;
  clearTimer(room);
  const opp = opponentOf(room, client);
  client.room = null;
  if (opp) {
    opp.room = null;
    if (opp.ws.readyState === 1) {
      send(opp, { type: "opponent_left" });
      if (requeueOpponent) enqueue(opp);
    }
  }
}

function enqueue(client) {
  if (client.room) return;
  if (queue.includes(client)) return;
  queue.push(client);
  send(client, { type: "queued" });
  matchmake();
}

function dequeue(client) {
  queue = queue.filter((c) => c !== client);
}

function matchmake() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (a.ws.readyState !== 1) { if (b.ws.readyState === 1) queue.unshift(b); continue; }
    if (b.ws.readyState !== 1) { if (a.ws.readyState === 1) queue.unshift(a); continue; }
    makeRoom(a, b);
  }
}

// ---------- heartbeat: reap sockets that died without a close frame ----------
// (mobile networks and proxies drop connections silently; without this the
//  player count drifts and ghost players sit in rooms forever)
const HEARTBEAT_MS = 30000;
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  }
}, HEARTBEAT_MS);
wss.on("close", () => clearInterval(heartbeat));

// ---------- connection handling ----------
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  const client = {
    id: nextId(), ws, name: "Player",
    room: null, opponentName: null, wantsAgain: false, privateCode: null,
  };
  clients.set(ws, client);
  send(client, { type: "hello", id: client.id, online: clients.size });
  broadcastCount();

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = client.room;

    switch (msg.type) {
      case "join":
        if (typeof msg.name === "string" && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }
        dropPending(client);
        enqueue(client);
        break;

      case "create": {
        if (typeof msg.name === "string" && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }
        if (client.room) break;
        dequeue(client);
        dropPending(client);
        const code = makeCode();
        client.privateCode = code;
        pending.set(code, client);
        send(client, { type: "room_created", code });
        break;
      }

      case "join_code": {
        if (typeof msg.name === "string" && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }
        if (client.room) break;
        const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
        const host = pending.get(code);
        if (!host || host === client || host.ws.readyState !== 1 || host.room) {
          send(client, { type: "join_failed" });
          break;
        }
        pending.delete(code);
        host.privateCode = null;
        client.privateCode = null;
        dequeue(client);
        makeRoom(host, client);
        break;
      }

      case "cancel":
        dequeue(client);
        dropPending(client);
        send(client, { type: "canceled" });
        break;

      case "submit":
        if (room && room.phase === "draw" && typeof msg.image === "string") {
          room.submissions.set(client.id, msg.image);
          const opp = opponentOf(room, client);
          send(opp, { type: "opponent_submitted" });
          if (room.submissions.size === 2) beginReveal(room);
        }
        break;

      case "vote":
        if (room && room.phase === "vote") {
          const valid = new Set([room.players[0].id, room.players[1].id, "tie"]);
          if (valid.has(msg.choice)) {
            room.votes.set(client.id, msg.choice);
            const opp = opponentOf(room, client);
            send(opp, { type: "opponent_voted" });
            if (room.votes.size === 2) tally(room);
          }
        }
        break;

      case "again":
        if (room) handleAgain(room, client);
        break;

      case "leave":
        leaveRoom(client);
        dequeue(client);
        dropPending(client);
        send(client, { type: "left" });
        break;

      case "ping":
        send(client, { type: "pong" });
        break;
    }
  });

  ws.on("close", () => {
    dequeue(client);
    dropPending(client);
    leaveRoom(client, { requeueOpponent: false });
    clients.delete(ws);
    broadcastCount();
  });

  ws.on("error", () => {});
});

server.listen(PORT, HOST, () => {
  console.log(`Quick-Draw Duel listening on ${HOST}:${PORT}`);
});

// Exit cleanly on the signals systemd / Docker / Ctrl-C send.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n${sig} received — shutting down`);
    for (const c of clients.values()) try { c.ws.close(1001, "server restarting"); } catch (_) {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
