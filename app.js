// Bierdeckel: local-first, peer-to-peer. Data lives in this phone's IndexedDB;
// friends' phones sync directly over WebRTC (PeerJS only introduces them).
"use strict";
const L = window.Ledger;
const EUR = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });
const money = c => EUR.format(c / 100);
const app = document.getElementById("app");
const PEER_PREFIX = "fdb-";

// ---------- storage: one IndexedDB key holds the whole book ----------
const store = {
  open() {
    return this.p || (this.p = new Promise((res, rej) => {
      const r = indexedDB.open("debtbook", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
};
let S = null; // { me, contacts, requests, records }
const V = { view: "home", friend: null, err: "", install: null, importing: null };
const save = () => store.set("state", S);

// ---------- helpers ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
function toast(msg) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(t); setTimeout(() => t.remove(), 3200);
}
function setNet(msg) { const n = document.getElementById("net"); n.textContent = msg; n.hidden = !msg; }
const nameOf = id => id === S.me.id ? "You" : (S.contacts[id] && S.contacts[id].name) || (S.requests[id] && S.requests[id].name) || "Friend";
const nameLc = id => id === S.me.id ? "you" : nameOf(id);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const otherOf = r => r.p.a === S.me.id ? r.p.b : r.p.a;
const recordsWith = id => Object.values(S.records).filter(r => otherOf(r) === id && (r.p.a === S.me.id || r.p.b === S.me.id));
const when = t => t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
const cents = s => Math.round(parseFloat(String(s).replace(",", ".")) * 100);
const initial = id => h("div", { class: "initial", "aria-hidden": "true" }, (nameOf(id)[0] || "?").toUpperCase(), conns.has(id) ? h("span", { class: "dot" }) : null);
const go = (view, friend) => { V.view = view; V.friend = friend || null; V.err = ""; render(); window.scrollTo(0, 0); };

// ---------- pairing links ----------
const appUrl = () => location.origin + location.pathname;
const pairLink = () => appUrl() + "#pair=" + L.b64u(new TextEncoder().encode(JSON.stringify({ id: S.me.id, name: S.me.name, pub: S.me.pub })));
async function parsePair(text) {
  try {
    const m = String(text).match(/pair=([A-Za-z0-9_-]+)/);
    const o = JSON.parse(new TextDecoder().decode(L.unb64u(m ? m[1] : String(text).trim())));
    if (!o.id || !o.pub || (await L.idFromPub(o.pub)) !== o.id) return null;
    return { id: o.id, name: String(o.name || "Friend").slice(0, 40), pub: o.pub };
  } catch { return null; }
}
async function addContact(c) {
  if (c.id === S.me.id) return toast("That is your own code. Scan your friend's code instead.");
  const old = S.contacts[c.id];
  if (old && old.pub !== c.pub) return toast("This code does not match the friend you already have.");
  S.contacts[c.id] = { ...(old || {}), name: c.name, pub: c.pub, addedAt: (old && old.addedAt) || Date.now() };
  delete S.requests[c.id];
  await save();
  connect(c.id);
  toast(`${c.name} added. You sync whenever both apps are open.`);
  go("friend", c.id);
}
qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
function qrSvg(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const box = h("div", { class: "qr" }); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  return box;
}

// ---------- peer-to-peer sync ----------
let peer = null;
const conns = new Map();   // friend id -> open, verified connection
const dialing = new Set();
const pendingReq = new Map(); // id -> connection waiting for the user to accept a new friend

function startPeer() {
  if (peer && !peer.destroyed) return;
  // PeerJS's bundled TURN relays (eu-0/us-0.turn.peerjs.com) no longer resolve, so list working STUN servers only.
  // Add a TURN relay here if some phone pairs (strict mobile networks) cannot connect.
  peer = new Peer(PEER_PREFIX + S.me.id, { debug: 0, config: { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }] } });
  peer.on("open", () => { setNet(""); connectAll(); });
  peer.on("connection", c => setupConn(c));
  peer.on("disconnected", () => setNet("Offline. Your changes are saved and sync later."));
  peer.on("error", e => {
    if (e.type === "peer-unavailable") return; // friend's app is closed: normal
    if (e.type === "unavailable-id") setNet("Bierdeckel is open in another tab or window. Close it to sync here.");
    else if (["network", "server-error", "socket-error", "socket-closed", "disconnected"].includes(e.type)) setNet("Offline. Your changes are saved and sync later.");
  });
}
function keepAlive() {
  if (!S || document.visibilityState !== "visible") return;
  if (!peer || peer.destroyed) return startPeer();
  if (peer.disconnected) { try { peer.reconnect(); } catch { } return; }
  connectAll();
}
function connect(id) {
  if (!peer || !peer.open || conns.has(id) || dialing.has(id)) return;
  dialing.add(id);
  setupConn(peer.connect(PEER_PREFIX + id, { reliable: true, serialization: "json" }));
  setTimeout(() => dialing.delete(id), 15000);
}
const connectAll = () => Object.keys(S.contacts).forEach(connect);
function hello(c) { c.send({ t: "hello", id: S.me.id, name: S.me.name, pub: S.me.pub }); }
function sendSync(id) { const c = conns.get(id); if (c) c.send({ t: "sync", recs: recordsWith(id) }); }
function push(rec) { const c = conns.get(otherOf(rec)); if (c) c.send({ t: "sync", recs: [rec] }); }

function setupConn(c) {
  const ctx = { who: null, resent: false, q: Promise.resolve() };
  c._ctx = ctx;
  c.on("open", () => hello(c));
  c.on("data", m => { ctx.q = ctx.q.then(() => onMessage(c, ctx, m)).catch(e => console.warn("sync", e)); });
  c.on("close", () => {
    if (ctx.who) { dialing.delete(ctx.who); if (conns.get(ctx.who) === c) { conns.delete(ctx.who); render(); } }
  });
  c.on("error", () => { });
}
function bind(c, id) {
  c._ctx.who = id; dialing.delete(id); conns.set(id, c);
  S.contacts[id].lastSeen = Date.now();
  sendSync(id);
}

async function onMessage(c, ctx, m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "hello") {
    const id = String(m.id || "");
    if (c.peer !== PEER_PREFIX + id || (await L.idFromPub(String(m.pub))) !== id) return c.close();
    const name = String(m.name || "Friend").slice(0, 40);
    const known = S.contacts[id];
    if (known && known.pub !== m.pub) return c.close();
    if (!known) {
      S.requests[id] = { name, pub: m.pub, at: Date.now() };
      pendingReq.set(id, c);
      await save(); render(); return;
    }
    known.name = name;
    bind(c, id); await save(); render(); return;
  }
  const id = ctx.who;
  if (!id) return;
  if (m.t === "sync") {
    const changed = await absorb(id, m.recs);
    const ch = await L.chain(recordsWith(id));
    c.send({ t: "head", head: ch.head, n: ch.length });
    if (changed) render();
  } else if (m.t === "head") {
    const ch = await L.chain(recordsWith(id));
    const ok = ch.head === m.head;
    if (!ok && !ctx.resent) { ctx.resent = true; sendSync(id); return; }
    if (!m.reply) c.send({ t: "head", head: ch.head, n: ch.length, reply: true }); // so both phones record the check
    S.contacts[id].check = { ok, at: Date.now(), n: ch.length, head: ch.head };
    S.contacts[id].lastSeen = Date.now();
    await save(); render();
  }
}

async function absorb(id, recs) {
  if (!Array.isArray(recs)) return false;
  const pubs = { [S.me.id]: S.me.pub, [id]: S.contacts[id].pub };
  let changed = false, fresh = 0;
  for (const raw of recs.slice(0, 5000)) {
    if (!raw || !raw.p) continue;
    const rec = { p: raw.p, ps: raw.ps, r: raw.r, rs: raw.rs, w: raw.w, ws: raw.ws };
    const pair = [rec.p.a, rec.p.b];
    if (!pair.includes(S.me.id) || !pair.includes(id)) continue;
    if (!(await L.verifyRecord(rec, pubs))) { console.warn("Rejected a record with a bad signature", rec.p.id); continue; }
    const before = S.records[rec.p.id];
    const res = L.merge(before, rec);
    if (res.changed) {
      if (!before && rec.p.b === S.me.id && L.effective(rec) === "pending") fresh++;
      if (before && rec.p.a === S.me.id && L.effective(before) === "pending" && L.effective(res.rec) !== "pending")
        toast(`${nameOf(id)} ${L.effective(res.rec)} your change`);
      S.records[rec.p.id] = res.rec; changed = true;
    }
  }
  if (changed) await save();
  if (fresh) toast(`${nameOf(id)} sent ${fresh} change${fresh > 1 ? "s" : ""} for you to check`);
  return changed;
}

// ---------- actions ----------
async function store1(rec) { S.records[rec.p.id] = rec; await save(); push(rec); render(); }
async function propose(f, kind, amount, note) {
  const a = cents(amount);
  if (!(a > 0)) { V.err = "Enter an amount above zero."; return render(); }
  V.err = "";
  await store1(await L.propose(S.me, f, kind, a, note.trim()));
  ["new-amt", "new-note"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  toast(conns.has(f) ? `Sent to ${nameOf(f)}` : `Saved. It reaches ${nameOf(f)} when both apps are open.`);
}
async function proposeCorrection(rec, amount, note) {
  const n = cents(amount), diff = n - rec.p.amount;
  if (isNaN(n) || n < 0) { V.err = "Enter the correct amount."; return render(); }
  if (diff === 0) { V.err = "That is the same amount as before."; return render(); }
  V.err = "";
  const extra = { corrects: rec.p.id, cred: diff > 0 ? rec.p.cred : rec.p.debt, debt: diff > 0 ? rec.p.debt : rec.p.cred };
  await store1(await L.propose(S.me, otherOf(rec), "correction", Math.abs(diff), `Was ${money(rec.p.amount)}, should be ${money(n)}. ${note.trim()}`, extra));
}
async function answer(rec, status, note) {
  if (status === "refused" && !note.trim()) { V.err = "Add a note saying why you refuse."; return render(); }
  V.err = "";
  await store1(await L.respond(S.me, rec, status, note.trim()));
}
async function withdraw(rec) { await store1(await L.withdraw(S.me, rec)); }
async function acceptRequest(id) {
  const r = S.requests[id];
  S.contacts[id] = { name: r.name, pub: r.pub, addedAt: Date.now() };
  delete S.requests[id];
  const c = pendingReq.get(id); pendingReq.delete(id);
  if (c && c.open) { bind(c, id); hello(c); } else connect(id);
  await save(); go("friend", id);
}
async function ignoreRequest(id) { delete S.requests[id]; const c = pendingReq.get(id); pendingReq.delete(id); if (c) c.close(); await save(); render(); }

// ---------- views ----------
function describe(r) {
  const p = r.p, P = nameLc(p.a), C = nameLc(p.b), A = money(p.amount);
  switch (p.kind) {
    case "lent": return `${cap(P)} lent ${C} ${A}`;
    case "borrowed": return `${cap(C)} lent ${P} ${A}`;
    case "theyPaid": return `${cap(C)} paid ${P} back ${A}`;
    case "iPaid": return `${cap(P)} paid ${C} back ${A}`;
    default: return `Correction: ${nameLc(p.debt)} ${p.debt === S.me.id ? "owe" : "owes"} ${nameLc(p.cred)} ${A} more`;
  }
}
function balanceLabel(v) {
  if (v > 0) return h("span", { class: "num plus" }, `owes you ${money(v)}`);
  if (v < 0) return h("span", { class: "num minus" }, `you owe ${money(-v)}`);
  return h("span", { class: "num zero" }, "settled");
}

function entryCard(r) {
  const st = L.effective(r), mine = st === "pending" && r.p.b === S.me.id, sent = st === "pending" && r.p.a === S.me.id;
  const f = otherOf(r);
  const reply = h("textarea", { id: "reply-" + r.p.id, placeholder: `Note for ${nameOf(r.p.a)} (needed if you refuse)` });
  const toMe = r.p.cred === S.me.id;
  return h("div", { class: "card" + (mine ? " attn" : "") },
    h("div", { class: "row" }, initial(f),
      h("div", { class: "grow" }, h("div", { class: "who" }, describe(r)),
        h("div", { class: "sub" }, `Proposed by ${nameLc(r.p.a)} · ${when(r.p.at)}`)),
      h("span", { class: "pill " + st }, st)),
    st === "refused" || st === "withdrawn" ? null : h("div", { class: "row" }, h("span", { class: "sub grow" }, st === "pending" ? "If accepted" : "Effect on balance"),
      h("span", { class: "num " + (toMe ? "plus" : "minus") }, toMe ? `${nameOf(f)} owes you +${money(r.p.amount)}` : `You owe +${money(r.p.amount)}`)),
    r.p.note ? h("div", { class: "note" }, h("b", {}, `Note from ${nameLc(r.p.a)}`), r.p.note) : null,
    r.r && r.r.note ? h("div", { class: "note" }, h("b", {}, `Reply from ${nameLc(r.p.b)} · ${when(r.r.at)}`), r.r.note) : null,
    mine ? reply : null,
    mine ? h("div", { class: "actions" },
      h("button", { class: "primary", onclick: () => answer(r, "accepted", reply.value) }, "Accept"),
      h("button", { class: "danger", onclick: () => answer(r, "refused", reply.value) }, "Refuse")) : null,
    sent ? h("div", { class: "row" }, h("span", { class: "sub grow" }, conns.has(f) ? `Waiting for ${nameOf(f)} to answer` : `Reaches ${nameOf(f)} when both apps are open`),
      h("button", { onclick: () => withdraw(r) }, "Withdraw")) : null,
    st === "accepted" && r.p.kind !== "correction" ? correctionBox(r) : null);
}
function correctionBox(r) {
  const box = h("div", { class: "form", hidden: true });
  const amt = h("input", { id: "corr-amt-" + r.p.id, type: "number", min: "0", step: "0.01", inputmode: "decimal", value: (r.p.amount / 100).toFixed(2) });
  const note = h("textarea", { id: "corr-note-" + r.p.id, placeholder: "Why the amount changes" });
  box.append(h("label", {}, "Correct amount (€)", amt), h("label", { class: "full" }, "Note", note),
    h("div", { class: "actions full" }, h("button", { class: "primary", onclick: () => proposeCorrection(r, amt.value, note.value) }, "Send correction")));
  return h("div", { class: "actions", style: "flex-direction:column;align-items:flex-start" },
    h("button", { class: "link", onclick: () => { box.hidden = !box.hidden; } }, "Propose a different amount"), box);
}

function setupView() {
  const name = h("input", { id: "setup-name", autocomplete: "given-name", placeholder: "e.g. Alex", maxlength: "40" });
  const create = async () => {
    if (!name.value.trim()) { V.err = "Enter the name your friends know you by."; return render(); }
    S = { me: await L.createIdentity(name.value.trim()), contacts: {}, requests: {}, records: {} };
    await save(); startPeer();
    if (V.pendingPair) { const p = V.pendingPair; V.pendingPair = null; return addContact(p); }
    go("add");
  };
  return [
    h("header", {}, h("div", { class: "eyebrow" }, "Bierdeckel"), h("h1", {}, "Your tab with friends"),
      h("p", { class: "sub" }, "Loans between you and your friends, stored only on your phones. Every change needs the other person's OK.")),
    V.pendingPair ? h("p", { class: "card" }, `${V.pendingPair.name} invited you. Enter your name to connect.`) : null,
    installHint(),
    V.err ? h("p", { class: "err" }, V.err) : null,
    h("section", { class: "card" }, h("label", {}, "Your name", name), h("button", { class: "primary", onclick: create }, "Start my book")),
  ];
}

// Friend requests show on every screen: the person is usually still on "Add a friend" while their friend scans.
function requestCards() {
  return Object.entries(S.requests).map(([id, r]) => h("div", { class: "card attn" }, h("p", {}, h("b", {}, r.name), " wants to connect with you."),
    h("div", { class: "actions" }, h("button", { class: "primary", onclick: () => acceptRequest(id) }, "Accept"), h("button", { onclick: () => ignoreRequest(id) }, "Ignore"))));
}
const IN_APP = /BierdeckelApp/.test(navigator.userAgent);
const FIRST_HASH = location.hash.slice(1);
function installHint() {
  if (IN_APP) return null;
  if (/android/i.test(navigator.userAgent)) {
    const apk = appUrl() + "bierdeckel.apk";
    const open = "intent://open" + (FIRST_HASH ? "?h=" + encodeURIComponent(FIRST_HASH) : "") +
      "#Intent;scheme=bierdeckel;package=dev.bierdeckel.app;S.browser_fallback_url=" + encodeURIComponent(apk) + ";end";
    return h("div", { class: "card attn" },
      h("p", {}, h("b", {}, "Get the Bierdeckel app."), " Download it, open the file to install it (allow your browser to install apps if asked), then come back here and tap “Open in app”."),
      FIRST_HASH ? h("p", { class: "sub" }, "Your invite comes along into the app.") : null,
      h("div", { class: "actions" }, h("a", { class: "button primary", href: apk, download: "Bierdeckel.apk" }, "Download app"), h("a", { class: "button", href: open }, "Open in app")));
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return null;
  if (V.install) return h("div", { class: "card attn" }, h("p", {}, "Install Bierdeckel on your home screen so it opens like an app."),
    h("div", { class: "actions" }, h("button", { class: "primary", onclick: async () => { V.install.prompt(); await V.install.userChoice; V.install = null; render(); } }, "Install app")));
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return h("p", { class: "card sub" }, "To install: tap the Share button in Safari, then “Add to Home Screen”.");
  return null;
}

function homeView() {
  const ids = Object.keys(S.contacts);
  const bal = Object.fromEntries(ids.map(id => [id, L.balance(recordsWith(id), S.me.id)]));
  const owed = Object.values(bal).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const owe = -Object.values(bal).filter(v => v < 0).reduce((a, b) => a + b, 0);
  const all = Object.values(S.records);
  const forMe = all.filter(r => L.effective(r) === "pending" && r.p.b === S.me.id).sort((a, b) => a.p.at - b.p.at);
  const waiting = all.filter(r => L.effective(r) === "pending" && r.p.a === S.me.id).sort((a, b) => b.p.at - a.p.at);
  ids.sort((a, b) => Math.abs(bal[b]) - Math.abs(bal[a]) || nameOf(a).localeCompare(nameOf(b)));
  return [
    h("header", {}, h("div", { class: "topbar" }, h("div", { class: "eyebrow" }, "Bierdeckel"), h("button", { class: "link", onclick: () => go("settings") }, "Settings")),
      h("h1", {}, `Hi ${S.me.name}`)),
    installHint(),
    h("div", { class: "totals" },
      h("div", { class: "total" }, h("span", { class: "eyebrow" }, "Friends owe you"), h("span", { class: "num plus" }, money(owed))),
      h("div", { class: "total" }, h("span", { class: "eyebrow" }, "You owe friends"), h("span", { class: "num minus" }, money(owe)))),
    V.err ? h("p", { class: "err" }, V.err) : null,
    forMe.length ? h("section", {}, h("div", { class: "sec-head" }, h("h2", {}, "Needs your answer"), h("span", { class: "sub" }, `${forMe.length} open`)),
      h("div", { class: "list" }, forMe.map(entryCard))) : null,
    h("section", {},
      h("div", { class: "sec-head" }, h("h2", {}, "Friends"), h("button", { class: "primary", onclick: () => go("add") }, "Add friend")),
      ids.length ? h("div", { class: "list" }, ids.map(id => {
        const pend = recordsWith(id).filter(r => L.effective(r) === "pending").length;
        return h("button", { class: "card friend", onclick: () => go("friend", id) },
          h("div", { class: "row" }, initial(id),
            h("div", { class: "grow" }, h("div", { class: "who" }, nameOf(id)),
              h("div", { class: "sub" }, conns.has(id) ? "Connected now" : pend ? `${pend} change${pend > 1 ? "s" : ""} pending` : "Not connected")),
            balanceLabel(bal[id])));
      })) : h("p", { class: "empty" }, "No friends yet. Tap “Add friend” and let your friend scan the code with their phone camera.")),
    waiting.length ? h("section", {}, h("div", { class: "sec-head" }, h("h2", {}, "Waiting for friends"), h("span", { class: "sub" }, `${waiting.length} sent`)),
      h("div", { class: "list" }, waiting.map(entryCard))) : null,
  ];
}

function friendView() {
  const f = V.friend, c = S.contacts[f];
  if (!c) { V.view = "home"; return homeView(); }
  const recs = recordsWith(f), v = L.balance(recs, S.me.id);
  const hist = recs.sort((a, b) => b.p.at - a.p.at);
  const fn = c.name;
  const kind = h("select", { id: "new-kind" },
    h("option", { value: "lent" }, `I lent ${fn} money`), h("option", { value: "borrowed" }, `${fn} lent me money`),
    h("option", { value: "theyPaid" }, `${fn} paid me back`), h("option", { value: "iPaid" }, `I paid ${fn} back`));
  const amt = h("input", { id: "new-amt", type: "number", min: "0.01", step: "0.01", inputmode: "decimal", placeholder: "50.00" });
  const note = h("textarea", { id: "new-note", placeholder: "e.g. Concert tickets, 14 Nov" });
  const chk = c.check;
  return [
    h("div", {}, h("button", { class: "link", onclick: () => go("home") }, "← All friends")),
    h("header", {},
      h("div", { class: "row" }, initial(f), h("div", { class: "grow" }, h("h1", {}, fn),
        h("div", { class: "sub" }, conns.has(f) ? "Connected now" : c.lastSeen ? `Last synced ${when(c.lastSeen)}` : "Not synced yet. Open the app at the same time."))),
      h("div", { class: "big" }, balanceLabel(v)),
      v !== 0 ? h("div", {}, h("button", { onclick: () => { kind.value = v > 0 ? "theyPaid" : "iPaid"; amt.value = (Math.abs(v) / 100).toFixed(2); note.value = "Settled in full"; amt.focus(); } }, "Record full payback")) : null),
    h("div", { class: "card" }, h("div", { class: "row" }, h("span", { class: "grow" }, h("b", {}, "History check")),
      chk ? h("span", { class: "pill " + (chk.ok ? "ok" : "bad") }, chk.ok ? "matches" : "differs") : h("span", { class: "pill pending" }, "not checked")),
      h("p", { class: "sub" }, !chk ? `After the first sync, both phones compare a fingerprint of your shared history.`
        : chk.ok ? `${chk.n} signed entr${chk.n === 1 ? "y" : "ies"}, identical on both phones (checked ${when(chk.at)}).`
          : `${fn}'s phone has a different history. Some entry did not pass the signature check. Talk to ${fn} before agreeing to new changes.`),
      chk ? h("p", { class: "chain sub" }, `fingerprint ${chk.head.slice(0, 16)}…`) : null),
    V.err ? h("p", { class: "err" }, V.err) : null,
    h("section", { class: "card" }, h("h2", {}, "Record a change"), h("p", { class: "sub" }, `${fn} has to accept it before it counts.`),
      h("div", { class: "form" }, h("label", {}, "What happened", kind), h("label", {}, "Amount (€)", amt), h("label", { class: "full" }, "Note", note),
        h("div", { class: "actions full" }, h("button", { class: "primary", onclick: () => propose(f, kind.value, amt.value, note.value) }, `Send to ${fn}`)))),
    h("section", {}, h("h2", {}, "History"),
      hist.length ? h("div", { class: "list" }, hist.map(entryCard)) : h("p", { class: "empty" }, `Nothing recorded with ${fn} yet.`)),
  ];
}

function addView() {
  const link = pairLink();
  const paste = h("input", { id: "paste-link", placeholder: "Paste your friend's link" });
  return [
    h("div", {}, h("button", { class: "link", onclick: () => go("home") }, "← Back")),
    h("header", {}, h("h1", {}, "Add a friend"),
      h("p", { class: "sub" }, "Your friend scans this with their normal phone camera. If they don't have Bierdeckel yet, the code opens it, they install it, and you're connected.")),
    qrSvg(link),
    h("div", { class: "actions", style: "justify-content:center" },
      h("button", { class: "primary", onclick: startScan }, "Scan friend's code"),
      h("button", { onclick: async () => { try { await navigator.clipboard.writeText(link); toast("Link copied. Send it on WhatsApp."); } catch { paste.value = link; paste.select(); } } }, "Copy my link")),
    h("section", { class: "card" }, h("label", {}, "Got a link from a friend instead?", paste),
      h("button", { onclick: async () => { const c = await parsePair(paste.value); c ? addContact(c) : toast("That link is not a Bierdeckel invite."); } }, "Connect")),
  ];
}

function settingsView() {
  const name = h("input", { id: "set-name", value: S.me.name, maxlength: "40" });
  const file = h("input", { id: "import-file", type: "file", accept: "application/json,.json" });
  file.addEventListener("change", async () => {
    try {
      const data = JSON.parse(await file.files[0].text());
      if (!data.me || !data.me.privJwk || !data.records || !data.contacts) throw 0;
      V.importing = data; render();
    } catch { toast("That file is not a Bierdeckel backup."); }
  });
  const imp = V.importing;
  return [
    h("div", {}, h("button", { class: "link", onclick: () => { V.importing = null; go("home"); } }, "← Back")),
    h("header", {}, h("h1", {}, "Settings")),
    h("section", { class: "card" }, h("label", {}, "Your name (friends see it after the next sync)", name),
      h("button", { onclick: async () => { if (name.value.trim()) { S.me.name = name.value.trim().slice(0, 40); await save(); conns.forEach(hello); toast("Name saved"); } } }, "Save name")),
    h("section", { class: "card" }, h("h2", {}, "Backup"),
      h("p", { class: "sub" }, "Your book only exists on this phone and on your friends' phones. Save a backup now and then. The file contains your secret key, so keep it private."),
      h("div", { class: "actions" }, h("button", { onclick: exportBackup }, "Save backup file")),
      h("label", {}, "Restore from a backup file", file),
      imp ? h("div", { class: "card attn" },
        h("p", {}, `Replace this phone's book with the backup of ${imp.me.name}: ${Object.keys(imp.contacts).length} friends, ${Object.keys(imp.records).length} entries?`),
        h("div", { class: "actions" }, h("button", { class: "danger", onclick: async () => { S = imp; await save(); location.reload(); } }, "Replace"),
          h("button", { onclick: () => { V.importing = null; render(); } }, "Cancel"))) : null),
    h("section", { class: "card" }, h("h2", {}, "Share the app"), h("p", { class: "sub" }, "Opens Bierdeckel without connecting to you."), qrSvg(appUrl())),
    h("p", { class: "sub chain" }, `Your ID ${S.me.id}`),
  ];
}
function exportBackup() {
  const blob = new Blob([JSON.stringify({ ...S, exportedAt: Date.now() }, null, 1)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `bierdeckel-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
}

// ---------- QR scanner (overlay, outside the re-rendered app) ----------
async function startScan() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch { return toast("Camera not available. Use your phone camera app or paste the link."); }
  const video = h("video", { class: "scan", playsinline: true, muted: true });
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  let done = false;
  const stop = () => { done = true; stream.getTracks().forEach(t => t.stop()); overlay.remove(); };
  const overlay = h("div", { style: "position:fixed;inset:0;z-index:10;background:var(--bg);padding:max(20px,env(safe-area-inset-top)) 16px 20px;display:flex;flex-direction:column;gap:14px" },
    h("h2", {}, "Point at your friend's code"), video, h("button", { onclick: stop }, "Cancel"));
  document.body.append(overlay);
  video.srcObject = stream; await video.play().catch(() => { });
  const tick = async () => {
    if (done) return;
    if (video.readyState >= 2) {
      const w = video.videoWidth, hgt = video.videoHeight, s = Math.min(1, 640 / Math.max(w, hgt));
      canvas.width = w * s; canvas.height = hgt * s;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      if (code) {
        const c = await parsePair(code.data);
        if (c) { stop(); return addContact(c); }
      }
    }
    setTimeout(tick, 200);
  };
  tick();
}

// ---------- render, keeping what the user is typing ----------
function render() {
  const kept = {};
  app.querySelectorAll("input[id]:not([type=file]), textarea[id], select[id]").forEach(el => { kept[el.id] = el.value; });
  const focused = document.activeElement && document.activeElement.id;
  const nodes = !S ? setupView() : [requestCards(), ({ friend: friendView, add: addView, settings: settingsView }[V.view] || homeView)()];
  app.replaceChildren(...nodes.flat().filter(Boolean));
  for (const [id, v] of Object.entries(kept)) { const el = document.getElementById(id); if (el && el.type !== "file") el.value = v; }
  if (focused) { const el = document.getElementById(focused); if (el) el.focus({ preventScroll: true }); }
}

// ---------- boot ----------
async function handleHash() {
  if (!location.hash.startsWith("#pair=")) return;
  const c = await parsePair(location.hash);
  history.replaceState(null, "", appUrl());
  if (!c) return toast("That invite link is broken.");
  if (S) addContact(c); else { V.pendingPair = c; render(); }
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); V.install = e; render(); });
addEventListener("hashchange", handleHash);
document.addEventListener("visibilitychange", keepAlive);
setInterval(keepAlive, 25000);
(async () => {
  try { S = (await store.get("state")) || null; } catch { app.replaceChildren(h("p", { class: "err" }, "This browser blocks storage. Open Bierdeckel in your normal browser, not a private window.")); return; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  render();
  await handleHash();
  if (S) startPeer();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
})();
