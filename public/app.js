"use strict";

const DRAW_SECONDS = 75;
const COLORS = ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#78350f"];
const SIZES = [4, 10, 22];
const BLANK =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="3"%3E%3Crect width="4" height="3" fill="white"/%3E%3C/svg%3E';

const $ = (id) => document.getElementById(id);
const el = {
  nameInput: $("name-input"),
  btnOnline: $("btn-online"),
  btnPrivate: $("btn-private"),
  onlineCount: $("online-count"),
  searchNote: $("search-note"),
  btnCancelSearch: $("btn-cancel-search"),
  btnCreateRoom: $("btn-create-room"),
  joinForm: $("join-form"),
  codeInput: $("code-input"),
  privateError: $("private-error"),
  btnPrivateBack: $("btn-private-back"),
  roomCode: $("room-code"),
  btnCancelRoom: $("btn-cancel-room"),
  turnLabel: $("draw-turn-label"),
  drawPrompt: $("draw-prompt"),
  timer: $("draw-timer"),
  pad: $("pad"),
  stageFlash: $("stage-flash"),
  swatches: $("swatches"),
  sizes: $("sizes"),
  toolEraser: $("tool-eraser"),
  toolUndo: $("tool-undo"),
  toolClear: $("tool-clear"),
  btnDone: $("btn-done"),
  drawHint: $("draw-hint"),
  waitNote: $("wait-note"),
  votePromptText: $("vote-prompt-text"),
  artA: $("art-a"),
  artB: $("art-b"),
  capA: $("cap-a"),
  capB: $("cap-b"),
  cardA: document.querySelector('.duel-card[data-side="a"]'),
  cardB: document.querySelector('.duel-card[data-side="b"]'),
  voteActions: $("vote-actions"),
  voteStatus: $("vote-status"),
  resultBadge: $("result-badge"),
  resultHeadline: $("result-headline"),
  resultDetail: $("result-detail"),
  scoreNameYou: $("score-name-you"),
  scoreNameThem: $("score-name-them"),
  scoreYou: $("score-you"),
  scoreThem: $("score-them"),
  btnAgain: $("btn-again"),
  btnHome: $("btn-home"),
  resultStatus: $("result-status"),
  toast: $("toast"),
};

/* ---------------- screen switching ---------------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("is-active", s.id === "screen-" + name);
  });
}

let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove("show");
    setTimeout(() => (el.toast.hidden = true), 250);
  }, 2600);
}

function flashStage() {
  const f = el.stageFlash;
  f.classList.remove("go");
  void f.offsetWidth;
  f.classList.add("go");
}

/* ---------------- sketchpad ---------------- */
class Sketchpad {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.color = COLORS[0];
    this.size = SIZES[1];
    this.erasing = false;
    this.strokes = [];
    this.current = null;
    this.drawing = false;
    this._bind();
    this.reset();
  }
  reset() {
    this.strokes = [];
    this.current = null;
    this.drawing = false;
    this._redraw();
  }
  setColor(c) {
    this.color = c;
    this.erasing = false;
  }
  setSize(s) {
    this.size = s;
  }
  setEraser(on) {
    this.erasing = on;
  }
  undo() {
    this.strokes.pop();
    this._redraw();
  }
  isBlank() {
    return this.strokes.length === 0;
  }
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.canvas.width,
      y: ((e.clientY - r.top) / r.height) * this.canvas.height,
    };
  }
  _bind() {
    const c = this.canvas;
    const start = (e) => {
      if (e.button != null && e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
      this.drawing = true;
      this.current = {
        color: this.color,
        size: this.size,
        erase: this.erasing,
        points: [this._pos(e)],
      };
      this.strokes.push(this.current);
      this._redraw();
    };
    const move = (e) => {
      if (!this.drawing) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) this.current.points.push(this._pos(ev));
      this._redraw();
    };
    const end = () => {
      this.drawing = false;
      this.current = null;
    };
    c.addEventListener("pointerdown", start);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("lostpointercapture", end);
  }
  _redraw() {
    const ctx = this.ctx;
    const { width: w, height: h } = this.canvas;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (const s of this.strokes) this._paint(s);
  }
  _paint(s) {
    const ctx = this.ctx;
    const p = s.points;
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (p.length < 2) {
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, s.size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i].x + p[i + 1].x) / 2;
      const my = (p[i].y + p[i + 1].y) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    ctx.stroke();
  }
  toImage() {
    const t = document.createElement("canvas");
    t.width = this.canvas.width;
    t.height = this.canvas.height;
    const tc = t.getContext("2d");
    tc.fillStyle = "#ffffff";
    tc.fillRect(0, 0, t.width, t.height);
    tc.drawImage(this.canvas, 0, 0);
    return t.toDataURL("image/png");
  }
}

const pad = new Sketchpad(el.pad);

/* ---------------- toolbar ---------------- */
function buildToolbar() {
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "swatch" + (i === 0 ? " active" : "");
    b.style.background = c;
    b.style.color = c;
    b.setAttribute("aria-label", "Colour " + (i + 1));
    b.addEventListener("click", () => {
      pad.setColor(c);
      document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      b.classList.add("active");
      el.toolEraser.classList.remove("active");
    });
    el.swatches.appendChild(b);
  });
  SIZES.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "size-dot" + (i === 1 ? " active" : "");
    const dot = document.createElement("i");
    const px = Math.max(6, Math.min(s, 20));
    dot.style.width = px + "px";
    dot.style.height = px + "px";
    b.appendChild(dot);
    b.setAttribute("aria-label", "Brush size " + (i + 1));
    b.addEventListener("click", () => {
      pad.setSize(s);
      document.querySelectorAll(".size-dot").forEach((d) => d.classList.remove("active"));
      b.classList.add("active");
    });
    el.sizes.appendChild(b);
  });
  el.toolEraser.addEventListener("click", () => {
    const on = !el.toolEraser.classList.contains("active");
    pad.setEraser(on);
    el.toolEraser.classList.toggle("active", on);
    if (on) document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
  });
  el.toolUndo.addEventListener("click", () => pad.undo());
  el.toolClear.addEventListener("click", () => pad.reset());
}
buildToolbar();

/* ---------------- timer ---------------- */
let timerHandle = null;
function runTimer(seconds, onEnd) {
  clearInterval(timerHandle);
  let t = seconds;
  const tick = () => {
    el.timer.textContent = Math.max(t, 0);
    el.timer.classList.toggle("warn", t <= 20 && t > 10);
    el.timer.classList.toggle("danger", t <= 10);
    if (t <= 0) {
      clearInterval(timerHandle);
      onEnd();
      return;
    }
    t -= 1;
  };
  tick();
  timerHandle = setInterval(tick, 1000);
}
function stopTimer() {
  clearInterval(timerHandle);
}

/* ---------------- shared state ---------------- */
let mode = null; // null on menu, 'online' or 'private' once in a duel
let privateGame = false; // true when the current/next duel came from a room code
let submitted = false;

/* ---------------- names ---------------- */
function myName() {
  const v = (el.nameInput.value || "").trim();
  return v || "doodler";
}
try {
  const saved = localStorage.getItem("qdd:name");
  if (saved) el.nameInput.value = saved;
} catch (_) {}
el.nameInput.addEventListener("input", () => {
  try { localStorage.setItem("qdd:name", el.nameInput.value.trim()); } catch (_) {}
});

/* =====================================================================
   ONLINE MODE
   ===================================================================== */
let ws = null;
let myId = null;
let oppId = null;
let keepAlive = null;
let reconnectTimer = null;
let reconnectDelay = 0;
let wantConnection = false; // true once something has asked us to be online
const online = { opponent: "Opponent", round: 1, scores: { you: 0, them: 0 } };
let oppSubmitted = false;
let voted = false;

function wsSend(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function connect(then) {
  wantConnection = true;
  clearTimeout(reconnectTimer);
  if (ws && ws.readyState === 1) return then && then();
  if (ws && ws.readyState === 0) {
    if (then) ws.addEventListener("open", then, { once: true });
    return;
  }
  // Connect at the path this page was served from, so it works both at the
  // domain root (local dev) and mounted under a subpath (e.g. /quickdraw/ on
  // play.jadon.me, where the reverse proxy strips the prefix).
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  const base = location.pathname.replace(/[^/]*$/, "");
  ws = new WebSocket(proto + location.host + base);
  ws.addEventListener("open", () => {
    reconnectDelay = 0;
    clearInterval(keepAlive);
    keepAlive = setInterval(() => wsSend({ type: "ping" }), 25000);
    then && then();
  });
  ws.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    handleServer(msg);
  });
  ws.addEventListener("close", () => {
    clearInterval(keepAlive);
    ws = null;
    const onHome = document.querySelector(".screen.is-active").id === "screen-home";
    if (mode || !onHome) {
      toast("Lost connection to the server");
      backToHome(true);
    }
    if (!wantConnection) return;
    el.onlineCount.textContent = "reconnecting…";
    scheduleReconnect();
  });
  ws.addEventListener("error", () => {});
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  if (!wantConnection || document.hidden) return; // resume on visibilitychange
  reconnectDelay = Math.min(reconnectDelay ? reconnectDelay * 2 : 2000, 30000);
  reconnectTimer = setTimeout(() => connect(), reconnectDelay);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && wantConnection && (!ws || ws.readyState > 1)) {
    reconnectDelay = 0;
    connect();
  }
});

function setOnlineCount(n) {
  el.onlineCount.innerHTML = "<b>" + n + "</b> " + (n === 1 ? "player" : "players") + " connected";
}

function handleServer(msg) {
  switch (msg.type) {
    case "hello":
      myId = msg.id;
      setOnlineCount(msg.online);
      break;
    case "count":
      setOnlineCount(msg.online);
      break;
    case "queued":
      el.searchNote.textContent = "You're in the queue — you'll be paired with the next player who joins.";
      break;
    case "room_created":
      showRoomWait(msg.code);
      break;
    case "join_failed":
      el.privateError.textContent = "No room with that code. Double-check the letters and try again.";
      el.codeInput.focus();
      el.codeInput.select();
      break;
    case "match":
      beginOnlineDraw(msg);
      break;
    case "opponent_submitted":
      oppSubmitted = true;
      if (!submitted) el.drawHint.textContent = "✓ " + online.opponent + " is done — clock's ticking!";
      else el.waitNote.textContent = online.opponent + " finished too — revealing…";
      break;
    case "reveal":
      showOnlineVote(msg);
      break;
    case "opponent_voted":
      if (voted) el.voteStatus.textContent = "Both votes are in…";
      else el.voteStatus.textContent = online.opponent + " has voted — your turn!";
      break;
    case "result":
      showOnlineResult(msg);
      break;
    case "opponent_ready":
      el.resultStatus.textContent = online.opponent + " wants a rematch — waiting on you!";
      break;
    case "opponent_left":
      handleOpponentLeft();
      break;
    case "canceled":
    case "left":
      backToHome(false);
      break;
  }
}

function beginOnlineDraw(msg) {
  mode = privateGame ? "private" : "online";
  myId = msg.youId;
  oppId = msg.oppId;
  online.opponent = msg.opponent || "Opponent";
  online.round = msg.round;
  online.scores = msg.scores || online.scores;
  submitted = false;
  oppSubmitted = false;
  voted = false;
  showScreen("draw");
  el.turnLabel.textContent = "Draw";
  el.drawPrompt.textContent = msg.prompt;
  el.drawHint.textContent = "Round " + msg.round + " · vs " + online.opponent;
  pad.reset();
  flashStage();
  runTimer(msg.drawSeconds || DRAW_SECONDS, submitOnline);
  el.btnDone.onclick = submitOnline;
}

function submitOnline() {
  if (submitted) return;
  submitted = true;
  stopTimer();
  wsSend({ type: "submit", image: pad.toImage() });
  showScreen("wait");
  el.waitNote.textContent = oppSubmitted
    ? online.opponent + " already finished — revealing…"
    : "Waiting for " + online.opponent + " to finish…";
}

function showOnlineVote(msg) {
  voted = false;
  showScreen("vote");
  el.votePromptText.textContent = msg.prompt;
  el.artA.src = msg.yours || BLANK;
  el.artB.src = msg.theirs || BLANK;
  el.capA.textContent = "You";
  el.capB.textContent = online.opponent;
  el.cardA.classList.remove("pick", "win");
  el.cardB.classList.remove("pick", "win");
  el.voteActions.innerHTML = "";
  const opts = [
    ["Mine nailed it", myId, "btn-primary"],
    ["Tie", "tie", "btn-ghost"],
    [online.opponent + " won it", oppId, "btn-primary"],
  ];
  opts.forEach(([label, choice, cls]) => {
    const b = document.createElement("button");
    b.className = "btn " + cls;
    b.textContent = label;
    b.onclick = () => castVote(choice, b);
    el.voteActions.appendChild(b);
  });
  el.voteStatus.textContent = "Who nailed the prompt?";
}

function castVote(choice, btn) {
  if (voted) return;
  voted = true;
  wsSend({ type: "vote", choice });
  Array.from(el.voteActions.children).forEach((c) => (c.disabled = true));
  btn.classList.add("active");
  if (choice === myId) el.cardA.classList.add("pick");
  else if (choice === oppId) el.cardB.classList.add("pick");
  el.voteStatus.textContent = "Vote locked — waiting for " + online.opponent + "…";
}

function showOnlineResult(msg) {
  stopTimer();
  showScreen("result");
  const diff = (msg.yourVotes || 0) - (msg.theirVotes || 0);
  el.resultBadge.textContent = diff > 0 ? "🏆" : diff < 0 ? "😤" : "🤝";
  el.resultHeadline.textContent =
    diff > 0 ? "You won the round!" : diff < 0 ? online.opponent + " won the round" : "Round tied!";
  const say = (c) =>
    c === "yours" ? "your drawing" : c === "theirs" ? "their drawing" : c === "tie" ? "a tie" : "nothing";
  el.resultDetail.textContent =
    "You picked " + say(msg.yourChoice) + " · " + online.opponent + " picked " + say(msg.theirChoice);
  el.scoreNameYou.textContent = "You";
  el.scoreNameThem.textContent = online.opponent;
  el.scoreYou.textContent = msg.scores ? msg.scores.you : online.scores.you;
  el.scoreThem.textContent = msg.scores ? msg.scores.them : online.scores.them;
  online.scores = msg.scores || online.scores;
  el.resultStatus.textContent = "";
  el.btnAgain.disabled = false;
  el.btnAgain.textContent = "Play again";
  el.btnAgain.onclick = () => {
    wsSend({ type: "again" });
    el.btnAgain.disabled = true;
    el.resultStatus.textContent = "Waiting for " + online.opponent + "…";
  };
}

function handleOpponentLeft() {
  stopTimer();
  toast(online.opponent + " left the duel");
  showScreen("result");
  el.resultBadge.textContent = "👋";
  el.resultHeadline.textContent = online.opponent + " left";
  el.scoreNameYou.textContent = "You";
  el.scoreNameThem.textContent = online.opponent;
  el.scoreYou.textContent = online.scores.you;
  el.scoreThem.textContent = online.scores.them;
  el.resultStatus.textContent = "";
  el.btnAgain.disabled = false;
  if (privateGame) {
    el.resultDetail.textContent = "They disconnected. Start a new room to play again.";
    el.btnAgain.textContent = "Back to menu";
    el.btnAgain.onclick = () => backToHome(false);
  } else {
    el.resultDetail.textContent = "They disconnected. Jump back in for a fresh opponent.";
    el.btnAgain.textContent = "Find new opponent";
    el.btnAgain.onclick = () => {
      wsSend({ type: "join", name: myName() });
      showScreen("search");
      el.searchNote.textContent = "Looking for a new opponent…";
    };
  }
}

/* =====================================================================
   PRIVATE MODE (play a friend with a room code)
   ===================================================================== */
function openPrivate() {
  privateGame = true;
  el.privateError.textContent = "";
  el.codeInput.value = "";
  showScreen("private");
  connect();
}

function showRoomWait(code) {
  privateGame = true;
  el.roomCode.textContent = code;
  showScreen("room-wait");
}

/* =====================================================================
   NAV
   ===================================================================== */
function backToHome(fromDisconnect) {
  stopTimer();
  if (!fromDisconnect && ws && ws.readyState === 1 && (mode || privateGame)) {
    wsSend({ type: "leave" });
  }
  mode = null;
  privateGame = false;
  showScreen("home");
}

el.btnOnline.addEventListener("click", () => {
  privateGame = false;
  showScreen("search");
  el.searchNote.textContent = "Connecting…";
  connect(() => {
    el.searchNote.textContent = "Hang tight — you'll be matched with the next player who joins.";
    wsSend({ type: "join", name: myName() });
  });
});

el.btnPrivate.addEventListener("click", openPrivate);
el.btnPrivateBack.addEventListener("click", () => backToHome(false));

el.btnCreateRoom.addEventListener("click", () => {
  el.privateError.textContent = "";
  connect(() => wsSend({ type: "create", name: myName() }));
});

el.joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = (el.codeInput.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) {
    el.privateError.textContent = "Room codes are 4 characters.";
    return;
  }
  el.privateError.textContent = "";
  el.codeInput.value = code;
  connect(() => wsSend({ type: "join_code", code, name: myName() }));
});

el.codeInput.addEventListener("input", () => {
  el.codeInput.value = el.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  el.privateError.textContent = "";
});

el.btnCancelSearch.addEventListener("click", () => {
  wsSend({ type: "cancel" });
  backToHome(false);
});

el.btnCancelRoom.addEventListener("click", () => {
  wsSend({ type: "cancel" });
  backToHome(false);
});

el.btnHome.addEventListener("click", () => backToHome(false));

// Close the socket for good when the tab goes away, so a navigating page
// doesn't leave an orphan (or a pending reconnect) behind.
window.addEventListener("pagehide", () => {
  wantConnection = false;
  clearTimeout(reconnectTimer);
  clearInterval(keepAlive);
  if (ws) { try { ws.onclose = null; ws.close(); } catch (_) {} ws = null; }
});

// connect on load just to show the live player count
connect();
