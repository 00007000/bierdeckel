// Bierdeckel: local-first, peer-to-peer. Data lives in this phone's IndexedDB;
// friends' phones sync directly over WebRTC (PeerJS only introduces them).
"use strict";
const L = window.Ledger;
// ---------- language: German on German phones, switchable in Settings ----------
let LANG = (() => { try { const l = localStorage.getItem("lang"); if (l === "de" || l === "en") return l; } catch { } return "de"; })();
const DE = {
  "You": "Du", "you": "dir", "Friend": "Freund",
  "pending": "offen", "accepted": "angenommen", "refused": "abgelehnt", "withdrawn": "zurückgezogen",
  "That is your own code. Scan your friend's code instead.": "Das ist dein eigener Code. Scanne den Code deines Freundes.",
  "This code does not match the friend you already have.": "Dieser Code passt nicht zu dem Freund, den du schon hast.",
  "{name} added. You sync whenever both apps are open.": "{name} hinzugefügt. Ihr synchronisiert, sobald beide Apps offen sind.",
  "Offline. Your changes are saved and sync later.": "Offline. Deine Änderungen sind gespeichert und werden später synchronisiert.",
  "Bierdeckel is open in another tab or window. Close it to sync here.": "Bierdeckel ist in einem anderen Tab oder Fenster offen. Schließ es, um hier zu synchronisieren.",
  "{name} {status} your change": "{name} hat deine Änderung {status}",
  "{name} sent 1 change for you to check": "{name} hat dir 1 Änderung zum Prüfen geschickt",
  "{name} sent {n} changes for you to check": "{name} hat dir {n} Änderungen zum Prüfen geschickt",
  "Enter an amount above zero.": "Gib einen Betrag über null ein.",
  "Sent to {name}": "An {name} gesendet",
  "Saved. It reaches {name} when both apps are open.": "Gespeichert. Es erreicht {name}, sobald beide Apps offen sind.",
  "Enter the correct amount.": "Gib den richtigen Betrag ein.",
  "That is the same amount as before.": "Das ist derselbe Betrag wie vorher.",
  "Was {old}, should be {new}.": "War {old}, sollte {new} sein.",
  "Add a note saying why you refuse.": "Schreib kurz, warum du ablehnst.",
  "owes you {amount}": "schuldet dir {amount}", "you owe {amount}": "du schuldest {amount}", "settled": "ausgeglichen",
  "Note for {name} (needed if you refuse)": "Notiz für {name} (nötig, wenn du ablehnst)",
  "Proposed by {name} · {date}": "Vorgeschlagen von {name} · {date}",
  "If accepted": "Wenn angenommen", "Effect on balance": "Auswirkung auf den Saldo",
  "{name} owes you +{amount}": "{name} schuldet dir +{amount}", "You owe +{amount}": "Du schuldest +{amount}",
  "Note from {name}": "Notiz von {name}", "Reply from {name} · {date}": "Antwort von {name} · {date}",
  "Accept": "Annehmen", "Refuse": "Ablehnen",
  "Waiting for {name} to answer": "Wartet auf Antwort von {name}",
  "Reaches {name} when both apps are open": "Erreicht {name}, sobald beide Apps offen sind",
  "Withdraw": "Zurückziehen", "Why the amount changes": "Warum sich der Betrag ändert",
  "Correct amount (€)": "Richtiger Betrag (€)", "Note": "Notiz", "Send correction": "Korrektur senden",
  "Propose a different amount": "Anderen Betrag vorschlagen",
  "e.g. Alex": "z. B. Alex", "Enter the name your friends know you by.": "Gib den Namen ein, unter dem deine Freunde dich kennen.",
  "Your tab with friends": "Dein Deckel mit Freunden",
  "Loans between you and your friends, stored only on your phones. Every change needs the other person's OK.":
    "Geliehenes zwischen dir und deinen Freunden, nur auf euren Handys gespeichert. Jede Änderung braucht das OK der anderen Person.",
  "{name} invited you. Enter your name to connect.": "{name} hat dich eingeladen. Gib deinen Namen ein, um dich zu verbinden.",
  "Your name": "Dein Name", "Start my book": "Meinen Deckel starten",
  " wants to connect with you.": " möchte sich mit dir verbinden.", "Ignore": "Ignorieren",
  "Get the Bierdeckel app.": "Hol dir die Bierdeckel-App.",
  " Download it, open the file to install it (allow your browser to install apps if asked), then come back here and tap “Open in app”.":
    " Lade sie herunter, öffne die Datei zum Installieren (erlaube deinem Browser das Installieren von Apps, falls gefragt), komm dann hierher zurück und tippe auf „In App öffnen“.",
  "Your invite comes along into the app.": "Deine Einladung wird in die App mitgenommen.",
  "Download app": "App herunterladen", "Open in app": "In App öffnen",
  "Install Bierdeckel on your home screen so it opens like an app.": "Installiere Bierdeckel auf deinem Startbildschirm, damit es sich wie eine App öffnet.",
  "Install app": "App installieren",
  "To install: tap the Share button in Safari, then “Add to Home Screen”.": "Zum Installieren: Tippe in Safari auf Teilen und dann auf „Zum Home-Bildschirm“.",
  "Settings": "Einstellungen", "Hi {name}": "Hallo {name}",
  "Friends owe you": "Freunde schulden dir", "You owe friends": "Du schuldest Freunden",
  "Needs your answer": "Wartet auf deine Antwort", "{n} open": "{n} offen",
  "Friends": "Freunde", "Add friend": "Freund hinzufügen", "Connected now": "Gerade verbunden",
  "1 change pending": "1 Änderung offen", "{n} changes pending": "{n} Änderungen offen", "Not connected": "Nicht verbunden",
  "No friends yet. Tap “Add friend” and let your friend scan the code with their phone camera.":
    "Noch keine Freunde. Tippe auf „Freund hinzufügen“ und lass deinen Freund den Code mit der Handykamera scannen.",
  "Waiting for friends": "Wartet auf Freunde", "{n} sent": "{n} gesendet",
  "I lent {name} money": "Ich habe {name} Geld geliehen", "{name} lent me money": "{name} hat mir Geld geliehen",
  "{name} paid me back": "{name} hat mir etwas zurückgezahlt", "I paid {name} back": "Ich habe {name} etwas zurückgezahlt",
  "e.g. Concert tickets, 14 Nov": "z. B. Konzertkarten, 14. Nov.",
  "← All friends": "← Alle Freunde", "Last synced {date}": "Zuletzt synchronisiert {date}",
  "Not synced yet. Open the app at the same time.": "Noch nicht synchronisiert. Öffnet die App gleichzeitig.",
  "Settled in full": "Komplett beglichen", "Record full payback": "Komplette Rückzahlung eintragen",
  "History check": "Verlaufsprüfung", "matches": "stimmt", "differs": "weicht ab", "not checked": "nicht geprüft",
  "After the first sync, both phones compare a fingerprint of your shared history.": "Nach der ersten Synchronisierung vergleichen beide Handys einen Fingerabdruck eures gemeinsamen Verlaufs.",
  "1 signed entry, identical on both phones (checked {date}).": "1 signierter Eintrag, auf beiden Handys gleich (geprüft {date}).",
  "{n} signed entries, identical on both phones (checked {date}).": "{n} signierte Einträge, auf beiden Handys gleich (geprüft {date}).",
  "{name}'s phone has a different history. Some entry did not pass the signature check. Talk to {name} before agreeing to new changes.":
    "Das Handy von {name} hat einen anderen Verlauf. Ein Eintrag hat die Signaturprüfung nicht bestanden. Sprich mit {name}, bevor du neuen Änderungen zustimmst.",
  "fingerprint {fp}…": "Fingerabdruck {fp}…",
  "Record a change": "Änderung eintragen", "{name} has to accept it before it counts.": "{name} muss sie annehmen, bevor sie zählt.",
  "What happened": "Was ist passiert", "Amount (€)": "Betrag (€)", "Send to {name}": "An {name} senden",
  "History": "Verlauf", "Nothing recorded with {name} yet.": "Mit {name} ist noch nichts eingetragen.",
  "Paste your friend's link": "Link deines Freundes einfügen", "← Back": "← Zurück", "Add a friend": "Freund hinzufügen",
  "Your friend scans this with their normal phone camera. If they don't have Bierdeckel yet, the code opens it, they install it, and you're connected.":
    "Dein Freund scannt das mit der normalen Handykamera. Wenn er Bierdeckel noch nicht hat, öffnet der Code es, er installiert es und ihr seid verbunden.",
  "Scan friend's code": "Code des Freundes scannen", "Link copied. Send it on WhatsApp.": "Link kopiert. Schick ihn per WhatsApp.",
  "Copy my link": "Meinen Link kopieren", "Got a link from a friend instead?": "Stattdessen einen Link von einem Freund bekommen?",
  "That link is not a Bierdeckel invite.": "Das ist keine Bierdeckel-Einladung.", "Connect": "Verbinden",
  "That file is not a Bierdeckel backup.": "Diese Datei ist kein Bierdeckel-Backup.",
  "Your name (friends see it after the next sync)": "Dein Name (Freunde sehen ihn nach der nächsten Synchronisierung)",
  "Name saved": "Name gespeichert", "Save name": "Name speichern", "Backup": "Backup",
  "Your book only exists on this phone and on your friends' phones. Save a backup now and then. The file contains your secret key, so keep it private.":
    "Dein Deckel existiert nur auf diesem Handy und auf den Handys deiner Freunde. Speichere ab und zu ein Backup. Die Datei enthält deinen geheimen Schlüssel, also halte sie privat.",
  "Save backup file": "Backup-Datei speichern", "Restore from a backup file": "Aus einer Backup-Datei wiederherstellen",
  "Replace this phone's book with the backup of {name}: {f} friends, {e} entries?": "Den Deckel auf diesem Handy durch das Backup von {name} ersetzen: {f} Freunde, {e} Einträge?",
  "Replace": "Ersetzen", "Cancel": "Abbrechen", "Share the app": "App teilen",
  "Opens Bierdeckel without connecting to you.": "Öffnet Bierdeckel, ohne sich mit dir zu verbinden.",
  "Your ID {id}": "Deine ID {id}",
  "Friend doesn't have the app yet?": "Dein Freund hat die App noch nicht?",
  "Let them scan this code first. It opens the download page. Once the app is installed, they tap “Add friend” → “Scan friend's code” and scan your code above.":
    "Lass ihn zuerst diesen Code scannen. Er öffnet die Download-Seite. Sobald die App installiert ist, tippt er auf „Freund hinzufügen“ → „Code des Freundes scannen“ und scannt deinen Code oben.",
  "Your code": "Dein Code",
  "{name} is now connected with you.": "{name} ist jetzt mit dir verbunden.",
  "{name} invites you to Bierdeckel": "{name} lädt dich zu Bierdeckel ein",
  "Your shared tab: who lent whom what. Stored only on your phones.": "Euer gemeinsamer Deckel: wer wem was geliehen hat. Nur auf euren Handys gespeichert.",
  "Install Bierdeckel": "Bierdeckel installieren",
  "Now open the downloaded file and tap “Install”, then “Open”. The app connects you with {name} by itself.":
    "Jetzt die heruntergeladene Datei öffnen, auf „Installieren“ und dann „Öffnen“ tippen. Die App verbindet dich von selbst mit {name}.",
  "Already have the app? Open it": "App schon installiert? Öffnen",
  "Use in the browser instead": "Lieber im Browser nutzen",
  "Your friend scans this code with their phone camera. Without the app, they tap “Install Bierdeckel” and are connected with you automatically.":
    "Dein Freund scannt diesen Code mit der Handykamera. Ohne App tippt er auf „Bierdeckel installieren“ und ist danach automatisch mit dir verbunden.",
  "Your friend scans this inside their Bierdeckel app (“Add friend” → “Scan friend's code”).": "Dein Freund scannt ihn in seiner Bierdeckel-App („Freund hinzufügen“ → „Code des Freundes scannen“).",
  "Opens the download page. No connection to you.": "Öffnet die Download-Seite, ohne Verbindung zu dir.", "Language": "Sprache",
  "Camera not available. Use your phone camera app or paste the link.": "Kamera nicht verfügbar. Nutze die Kamera-App deines Handys oder füge den Link ein.",
  "Point at your friend's code": "Auf den Code deines Freundes richten",
  "That invite link is broken.": "Dieser Einladungslink ist kaputt.",
  "This browser blocks storage. Open Bierdeckel in your normal browser, not a private window.":
    "Dieser Browser blockiert den Speicher. Öffne Bierdeckel in deinem normalen Browser, nicht im privaten Fenster.",
};
const t = (k, v) => { let x = LANG === "de" && DE[k] != null ? DE[k] : k; for (const n in v || {}) x = x.split("{" + n + "}").join(v[n]); return x; };
const LOCALE = () => LANG === "de" ? "de-DE" : undefined;
document.documentElement.lang = LANG;
let EUR = new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "EUR" });
function setLang(l) { LANG = l; try { localStorage.setItem("lang", l); } catch { } document.documentElement.lang = l; EUR = new Intl.NumberFormat(LOCALE(), { style: "currency", currency: "EUR" }); render(); }
const money = c => EUR.format((c / 100) || 0);
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
const nameOf = id => id === S.me.id ? t("You") : (S.contacts[id] && S.contacts[id].name) || (S.requests[id] && S.requests[id].name) || t("Friend");
const nameLc = id => id === S.me.id ? t("you") : nameOf(id);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const otherOf = r => r.p.a === S.me.id ? r.p.b : r.p.a;
const recordsWith = id => Object.values(S.records).filter(r => otherOf(r) === id && (r.p.a === S.me.id || r.p.b === S.me.id));
const when = t => t ? new Date(t).toLocaleDateString(LOCALE(), { day: "numeric", month: "short", year: "numeric" }) : "";
const cents = s => Math.round(parseFloat(String(s).replace(",", ".")) * 100);
const initial = id => h("div", { class: "initial", "aria-hidden": "true" }, (nameOf(id)[0] || "?").toUpperCase(), conns.has(id) ? h("span", { class: "dot" }) : null);
const go = (view, friend) => { V.view = view; V.friend = friend || null; V.err = ""; render(); window.scrollTo(0, 0); };

// ---------- pairing links ----------
const appUrl = () => location.origin + location.pathname.replace(/[^/]*$/, "");
function myInv() { if (!S.me.inv) { S.me.inv = L.b64u(crypto.getRandomValues(new Uint8Array(9))); save(); } return S.me.inv; }
const pairLink = () => appUrl() + "#pair=" + L.b64u(new TextEncoder().encode(JSON.stringify({ id: S.me.id, name: S.me.name, pub: S.me.pub, inv: myInv() })));
async function parsePair(text) {
  try {
    const m = String(text).match(/pair=([A-Za-z0-9_-]+)/);
    const o = JSON.parse(new TextDecoder().decode(L.unb64u(m ? m[1] : String(text).trim())));
    if (!o.id || !o.pub || (await L.idFromPub(o.pub)) !== o.id) return null;
    return { id: o.id, name: String(o.name || "Friend").slice(0, 40), pub: o.pub, inv: typeof o.inv === "string" ? o.inv.slice(0, 40) : undefined };
  } catch { return null; }
}
async function addContact(c) {
  if (c.id === S.me.id) return toast(t("That is your own code. Scan your friend's code instead."));
  const old = S.contacts[c.id];
  if (old && old.pub !== c.pub) return toast(t("This code does not match the friend you already have."));
  S.contacts[c.id] = { ...(old || {}), name: c.name, pub: c.pub, inv: c.inv || (old && old.inv), addedAt: (old && old.addedAt) || Date.now() };
  delete S.requests[c.id];
  await save();
  connect(c.id);
  toast(t("{name} added. You sync whenever both apps are open.", { name: c.name }));
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
  peer.on("disconnected", () => setNet(t("Offline. Your changes are saved and sync later.")));
  peer.on("error", e => {
    if (e.type === "peer-unavailable") return; // friend's app is closed: normal
    if (e.type === "unavailable-id") setNet(t("Bierdeckel is open in another tab or window. Close it to sync here."));
    else if (["network", "server-error", "socket-error", "socket-closed", "disconnected"].includes(e.type)) setNet(t("Offline. Your changes are saved and sync later."));
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
function hello(c) { const k = S.contacts[String(c.peer).slice(PEER_PREFIX.length)]; c.send({ t: "hello", id: S.me.id, name: S.me.name, pub: S.me.pub, inv: k && k.inv }); }
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
    if (!known && S.me.inv && m.inv === S.me.inv) {
      S.contacts[id] = { name, pub: m.pub, addedAt: Date.now() };
      delete S.requests[id];
      bind(c, id); hello(c); await save();
      toast(t("{name} is now connected with you.", { name }));
      render(); return;
    }
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
        toast(t("{name} {status} your change", { name: nameOf(id), status: t(L.effective(res.rec)) }));
      S.records[rec.p.id] = res.rec; changed = true;
    }
  }
  if (changed) await save();
  if (fresh) toast(t(fresh > 1 ? "{name} sent {n} changes for you to check" : "{name} sent 1 change for you to check", { name: nameOf(id), n: fresh }));
  return changed;
}

// ---------- actions ----------
async function store1(rec) { S.records[rec.p.id] = rec; await save(); push(rec); render(); }
async function propose(f, kind, amount, note) {
  const a = cents(amount);
  if (!(a > 0)) { V.err = t("Enter an amount above zero."); return render(); }
  V.err = "";
  await store1(await L.propose(S.me, f, kind, a, note.trim()));
  ["new-amt", "new-note"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  toast(conns.has(f) ? t("Sent to {name}", { name: nameOf(f) }) : t("Saved. It reaches {name} when both apps are open.", { name: nameOf(f) }));
}
async function proposeCorrection(rec, amount, note) {
  const n = cents(amount), diff = n - rec.p.amount;
  if (isNaN(n) || n < 0) { V.err = t("Enter the correct amount."); return render(); }
  if (diff === 0) { V.err = t("That is the same amount as before."); return render(); }
  V.err = "";
  const extra = { corrects: rec.p.id, cred: diff > 0 ? rec.p.cred : rec.p.debt, debt: diff > 0 ? rec.p.debt : rec.p.cred };
  await store1(await L.propose(S.me, otherOf(rec), "correction", Math.abs(diff), t("Was {old}, should be {new}.", { old: money(rec.p.amount), new: money(n) }) + " " + note.trim(), extra));
}
async function answer(rec, status, note) {
  if (status === "refused" && !note.trim()) { V.err = t("Add a note saying why you refuse."); return render(); }
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
function describeDe(p) {
  const A = money(p.amount), me = S.me.id, n = id => nameOf(id);
  const lend = (x, y) => x === me ? `Du hast ${n(y)} ${A} geliehen` : `${n(x)} hat dir ${A} geliehen`;
  const pay = (x, y) => x === me ? `Du hast ${n(y)} ${A} zurückgezahlt` : `${n(x)} hat dir ${A} zurückgezahlt`;
  switch (p.kind) {
    case "lent": return lend(p.a, p.b);
    case "borrowed": return lend(p.b, p.a);
    case "theyPaid": return pay(p.b, p.a);
    case "iPaid": return pay(p.a, p.b);
    default: return p.debt === me ? `Korrektur: Du schuldest ${n(p.cred)} ${A} mehr` : `Korrektur: ${n(p.debt)} schuldet dir ${A} mehr`;
  }
}
function describe(r) {
  if (LANG === "de") return describeDe(r.p);
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
  if (v > 0) return h("span", { class: "num plus" }, t("owes you {amount}", { amount: money(v) }));
  if (v < 0) return h("span", { class: "num minus" }, t("you owe {amount}", { amount: money(-v) }));
  return h("span", { class: "num zero" }, t("settled"));
}

function entryCard(r) {
  const st = L.effective(r), mine = st === "pending" && r.p.b === S.me.id, sent = st === "pending" && r.p.a === S.me.id;
  const f = otherOf(r);
  const reply = h("textarea", { id: "reply-" + r.p.id, placeholder: t("Note for {name} (needed if you refuse)", { name: nameOf(r.p.a) }) });
  const toMe = r.p.cred === S.me.id;
  return h("div", { class: "card" + (mine ? " attn" : "") },
    h("div", { class: "row" }, initial(f),
      h("div", { class: "grow" }, h("div", { class: "who" }, describe(r)),
        h("div", { class: "sub" }, t("Proposed by {name} · {date}", { name: nameLc(r.p.a), date: when(r.p.at) }))),
      h("span", { class: "pill " + st }, t(st))),
    st === "refused" || st === "withdrawn" ? null : h("div", { class: "row" }, h("span", { class: "sub grow" }, st === "pending" ? t("If accepted") : t("Effect on balance")),
      h("span", { class: "num " + (toMe ? "plus" : "minus") }, toMe ? t("{name} owes you +{amount}", { name: nameOf(f), amount: money(r.p.amount) }) : t("You owe +{amount}", { amount: money(r.p.amount) }))),
    r.p.note ? h("div", { class: "note" }, h("b", {}, t("Note from {name}", { name: nameLc(r.p.a) })), r.p.note) : null,
    r.r && r.r.note ? h("div", { class: "note" }, h("b", {}, t("Reply from {name} · {date}", { name: nameLc(r.p.b), date: when(r.r.at) })), r.r.note) : null,
    mine ? reply : null,
    mine ? h("div", { class: "actions" },
      h("button", { class: "primary", onclick: () => answer(r, "accepted", reply.value) }, t("Accept")),
      h("button", { class: "danger", onclick: () => answer(r, "refused", reply.value) }, t("Refuse"))) : null,
    sent ? h("div", { class: "row" }, h("span", { class: "sub grow" }, conns.has(f) ? t("Waiting for {name} to answer", { name: nameOf(f) }) : t("Reaches {name} when both apps are open", { name: nameOf(f) })),
      h("button", { onclick: () => withdraw(r) }, t("Withdraw"))) : null,
    st === "accepted" && r.p.kind !== "correction" ? correctionBox(r) : null);
}
function correctionBox(r) {
  const box = h("div", { class: "form", hidden: true });
  const amt = h("input", { id: "corr-amt-" + r.p.id, type: "number", min: "0", step: "0.01", inputmode: "decimal", value: (r.p.amount / 100).toFixed(2) });
  const note = h("textarea", { id: "corr-note-" + r.p.id, placeholder: t("Why the amount changes") });
  box.append(h("label", {}, t("Correct amount (€)"), amt), h("label", { class: "full" }, t("Note"), note),
    h("div", { class: "actions full" }, h("button", { class: "primary", onclick: () => proposeCorrection(r, amt.value, note.value) }, t("Send correction"))));
  return h("div", { class: "actions", style: "flex-direction:column;align-items:flex-start" },
    h("button", { class: "link", onclick: () => { box.hidden = !box.hidden; } }, t("Propose a different amount")), box);
}

function inviteLanding() {
  const apk = appUrl() + "bierdeckel.apk", inviteLink = appUrl() + "#" + FIRST_HASH;
  const open = "intent://open?h=" + encodeURIComponent(FIRST_HASH) + "#Intent;scheme=bierdeckel;package=dev.bierdeckel.app;S.browser_fallback_url=" + encodeURIComponent(apk) + ";end";
  const install = async () => {
    try { await navigator.clipboard.writeText(inviteLink); } catch { }
    V.started = true; render();
    location.href = apk;
  };
  return [
    h("img", { class: "mat big", src: "mat.svg", alt: "" }),
    h("header", {}, h("div", { class: "eyebrow" }, "Bierdeckel"), h("h1", {}, t("{name} invites you to Bierdeckel", { name: V.pendingPair.name })),
      h("p", { class: "sub" }, t("Your shared tab: who lent whom what. Stored only on your phones."))),
    h("section", { class: "card" }, h("button", { class: "primary dl", onclick: install }, t("Install Bierdeckel")),
      V.started ? h("p", { class: "sub" }, t("Now open the downloaded file and tap “Install”, then “Open”. The app connects you with {name} by itself.", { name: V.pendingPair.name })) : null),
    h("p", { class: "sub" }, h("a", { href: open }, t("Already have the app? Open it")), " · ",
      h("a", { href: "#", onclick: e => { e.preventDefault(); V.web = true; render(); } }, t("Use in the browser instead"))),
  ];
}
function setupView() {
  if (!IN_APP && !V.web && V.pendingPair && /android/i.test(navigator.userAgent)) return inviteLanding();
  const name = h("input", { id: "setup-name", autocomplete: "given-name", placeholder: t("e.g. Alex"), maxlength: "40" });
  const create = async () => {
    if (!name.value.trim()) { V.err = t("Enter the name your friends know you by."); return render(); }
    S = { me: await L.createIdentity(name.value.trim()), contacts: {}, requests: {}, records: {} };
    await save(); startPeer();
    if (V.pendingPair) { const p = V.pendingPair; V.pendingPair = null; return addContact(p); }
    go("add");
  };
  return [
    h("img", { class: "mat big", src: "mat.svg", alt: "" }),
    h("header", {}, h("div", { class: "eyebrow" }, "Bierdeckel"), h("h1", {}, t("Your tab with friends")),
      h("p", { class: "sub" }, t("Loans between you and your friends, stored only on your phones. Every change needs the other person's OK."))),
    V.pendingPair ? h("p", { class: "card" }, t("{name} invited you. Enter your name to connect.", { name: V.pendingPair.name })) : null,
    installHint(),
    V.err ? h("p", { class: "err" }, V.err) : null,
    h("section", { class: "card" }, h("label", {}, t("Your name"), name), h("button", { class: "primary", onclick: create }, t("Start my book"))),
  ];
}

// Friend requests show on every screen: the person is usually still on t("Add a friend") while their friend scans.
function requestCards() {
  return Object.entries(S.requests).map(([id, r]) => h("div", { class: "card attn" }, h("p", {}, h("b", {}, r.name), t(" wants to connect with you.")),
    h("div", { class: "actions" }, h("button", { class: "primary", onclick: () => acceptRequest(id) }, t("Accept")), h("button", { onclick: () => ignoreRequest(id) }, t("Ignore")))));
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
      h("p", {}, h("b", {}, t("Get the Bierdeckel app.")), t(" Download it, open the file to install it (allow your browser to install apps if asked), then come back here and tap “Open in app”.")),
      FIRST_HASH ? h("p", { class: "sub" }, t("Your invite comes along into the app.")) : null,
      h("div", { class: "actions" }, h("a", { class: "button primary", href: apk, download: "Bierdeckel.apk" }, t("Download app")), h("a", { class: "button", href: open }, t("Open in app"))));
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return null;
  if (V.install) return h("div", { class: "card attn" }, h("p", {}, t("Install Bierdeckel on your home screen so it opens like an app.")),
    h("div", { class: "actions" }, h("button", { class: "primary", onclick: async () => { V.install.prompt(); await V.install.userChoice; V.install = null; render(); } }, t("Install app"))));
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return h("p", { class: "card sub" }, t("To install: tap the Share button in Safari, then “Add to Home Screen”."));
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
    h("header", {}, h("div", { class: "topbar" }, h("div", { class: "eyebrow" }, "Bierdeckel"), h("button", { class: "link", onclick: () => go("settings") }, t("Settings"))),
      h("div", { class: "row" }, h("h1", { class: "grow" }, t("Hi {name}", { name: S.me.name })), h("img", { class: "mat small", src: "mat.svg", alt: "" }))),
    installHint(),
    h("div", { class: "totals" },
      h("div", { class: "total" }, h("span", { class: "eyebrow" }, t("Friends owe you")), h("span", { class: "num plus" }, money(owed))),
      h("div", { class: "total" }, h("span", { class: "eyebrow" }, t("You owe friends")), h("span", { class: "num minus" }, money(owe)))),
    V.err ? h("p", { class: "err" }, V.err) : null,
    forMe.length ? h("section", {}, h("div", { class: "sec-head" }, h("h2", {}, t("Needs your answer")), h("span", { class: "sub" }, t("{n} open", { n: forMe.length }))),
      h("div", { class: "list" }, forMe.map(entryCard))) : null,
    h("section", {},
      h("div", { class: "sec-head" }, h("h2", {}, t("Friends")), h("button", { class: "primary", onclick: () => go("add") }, t("Add friend"))),
      ids.length ? h("div", { class: "list" }, ids.map(id => {
        const pend = recordsWith(id).filter(r => L.effective(r) === "pending").length;
        return h("button", { class: "card friend", onclick: () => go("friend", id) },
          h("div", { class: "row" }, initial(id),
            h("div", { class: "grow" }, h("div", { class: "who" }, nameOf(id)),
              h("div", { class: "sub" }, conns.has(id) ? t("Connected now") : pend ? t(pend > 1 ? "{n} changes pending" : "1 change pending", { n: pend }) : t("Not connected"))),
            balanceLabel(bal[id])));
      })) : h("p", { class: "empty" }, t("No friends yet. Tap “Add friend” and let your friend scan the code with their phone camera."))),
    waiting.length ? h("section", {}, h("div", { class: "sec-head" }, h("h2", {}, t("Waiting for friends")), h("span", { class: "sub" }, t("{n} sent", { n: waiting.length }))),
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
    h("option", { value: "lent" }, t("I lent {name} money", { name: fn })), h("option", { value: "borrowed" }, t("{name} lent me money", { name: fn })),
    h("option", { value: "theyPaid" }, t("{name} paid me back", { name: fn })), h("option", { value: "iPaid" }, t("I paid {name} back", { name: fn })));
  const amt = h("input", { id: "new-amt", type: "number", min: "0.01", step: "0.01", inputmode: "decimal", placeholder: "50.00" });
  const note = h("textarea", { id: "new-note", placeholder: t("e.g. Concert tickets, 14 Nov") });
  const chk = c.check;
  return [
    h("div", {}, h("button", { class: "link", onclick: () => go("home") }, t("← All friends"))),
    h("header", {},
      h("div", { class: "row" }, initial(f), h("div", { class: "grow" }, h("h1", {}, fn),
        h("div", { class: "sub" }, conns.has(f) ? t("Connected now") : c.lastSeen ? t("Last synced {date}", { date: when(c.lastSeen) }) : t("Not synced yet. Open the app at the same time.")))),
      h("div", { class: "big" }, balanceLabel(v)),
      v !== 0 ? h("div", {}, h("button", { onclick: () => { kind.value = v > 0 ? "theyPaid" : "iPaid"; amt.value = (Math.abs(v) / 100).toFixed(2); note.value = t("Settled in full"); amt.focus(); } }, t("Record full payback"))) : null),
    h("div", { class: "card" }, h("div", { class: "row" }, h("span", { class: "grow" }, h("b", {}, t("History check"))),
      chk ? h("span", { class: "pill " + (chk.ok ? "ok" : "bad") }, chk.ok ? t("matches") : t("differs")) : h("span", { class: "pill pending" }, t("not checked"))),
      h("p", { class: "sub" }, !chk ? t("After the first sync, both phones compare a fingerprint of your shared history.")
        : chk.ok ? t(chk.n === 1 ? "1 signed entry, identical on both phones (checked {date})." : "{n} signed entries, identical on both phones (checked {date}).", { n: chk.n, date: when(chk.at) })
          : t("{name}'s phone has a different history. Some entry did not pass the signature check. Talk to {name} before agreeing to new changes.", { name: fn })),
      chk ? h("p", { class: "chain sub" }, t("fingerprint {fp}…", { fp: chk.head.slice(0, 16) })) : null),
    V.err ? h("p", { class: "err" }, V.err) : null,
    h("section", { class: "card" }, h("h2", {}, t("Record a change")), h("p", { class: "sub" }, t("{name} has to accept it before it counts.", { name: fn })),
      h("div", { class: "form" }, h("label", {}, t("What happened"), kind), h("label", {}, t("Amount (€)"), amt), h("label", { class: "full" }, t("Note"), note),
        h("div", { class: "actions full" }, h("button", { class: "primary", onclick: () => propose(f, kind.value, amt.value, note.value) }, t("Send to {name}", { name: fn }))))),
    h("section", {}, h("h2", {}, t("History")),
      hist.length ? h("div", { class: "list" }, hist.map(entryCard)) : h("p", { class: "empty" }, t("Nothing recorded with {name} yet.", { name: fn }))),
  ];
}

function addView() {
  const link = pairLink();
  const paste = h("input", { id: "paste-link", placeholder: t("Paste your friend's link") });
  return [
    h("div", {}, h("button", { class: "link", onclick: () => go("home") }, t("← Back"))),
    h("header", {}, h("h1", {}, t("Add a friend")),
      h("p", { class: "sub" }, t("Your friend scans this code with their phone camera. Without the app, they tap “Install Bierdeckel” and are connected with you automatically."))),
    h("h2", {}, t("Your code")),
    qrSvg(link),
    h("div", { class: "actions", style: "justify-content:center" },
      h("button", { class: "primary", onclick: startScan }, t("Scan friend's code")),
      h("button", { onclick: async () => { try { await navigator.clipboard.writeText(link); toast(t("Link copied. Send it on WhatsApp.")); } catch { paste.value = link; paste.select(); } } }, t("Copy my link"))),
    h("section", { class: "card" }, h("label", {}, t("Got a link from a friend instead?"), paste),
      h("button", { onclick: async () => { const c = await parsePair(paste.value); c ? addContact(c) : toast(t("That link is not a Bierdeckel invite.")); } }, t("Connect"))),
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
    } catch { toast(t("That file is not a Bierdeckel backup.")); }
  });
  const imp = V.importing;
  return [
    h("div", {}, h("button", { class: "link", onclick: () => { V.importing = null; go("home"); } }, t("← Back"))),
    h("header", {}, h("h1", {}, t("Settings"))),
    h("section", { class: "card" }, h("h2", {}, "Sprache / Language"),
      h("div", { class: "actions" }, [["de", "Deutsch"], ["en", "English"]].map(([l, label]) =>
        h("button", { class: LANG === l ? "primary" : "", "aria-pressed": String(LANG === l), onclick: () => setLang(l) }, label)))),
    h("section", { class: "card" }, h("label", {}, t("Your name (friends see it after the next sync)"), name),
      h("button", { onclick: async () => { if (name.value.trim()) { S.me.name = name.value.trim().slice(0, 40); await save(); conns.forEach(hello); toast(t("Name saved")); } } }, t("Save name"))),
    h("section", { class: "card" }, h("h2", {}, t("Backup")),
      h("p", { class: "sub" }, t("Your book only exists on this phone and on your friends' phones. Save a backup now and then. The file contains your secret key, so keep it private.")),
      h("div", { class: "actions" }, h("button", { onclick: exportBackup }, t("Save backup file"))),
      h("label", {}, t("Restore from a backup file"), file),
      imp ? h("div", { class: "card attn" },
        h("p", {}, t("Replace this phone's book with the backup of {name}: {f} friends, {e} entries?", { name: imp.me.name, f: Object.keys(imp.contacts).length, e: Object.keys(imp.records).length })),
        h("div", { class: "actions" }, h("button", { class: "danger", onclick: async () => { S = imp; await save(); location.reload(); } }, t("Replace")),
          h("button", { onclick: () => { V.importing = null; render(); } }, t("Cancel")))) : null),
    h("section", { class: "card" }, h("h2", {}, t("Share the app")), h("p", { class: "sub" }, t("Opens the download page. No connection to you.")), qrSvg(appUrl() + "download.html")),
    h("p", { class: "sub chain" }, t("Your ID {id}", { id: S.me.id })),
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
  catch { return toast(t("Camera not available. Use your phone camera app or paste the link.")); }
  const video = h("video", { class: "scan", playsinline: true, muted: true });
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  let done = false;
  const stop = () => { done = true; stream.getTracks().forEach(t => t.stop()); overlay.remove(); };
  const overlay = h("div", { style: "position:fixed;inset:0;z-index:10;background:var(--bg);padding:max(20px,env(safe-area-inset-top)) 16px 20px;display:flex;flex-direction:column;gap:14px" },
    h("h2", {}, t("Point at your friend's code")), video, h("button", { onclick: stop }, t("Cancel")));
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
  if (!c) return toast(t("That invite link is broken."));
  if (S) addContact(c); else { V.pendingPair = c; render(); }
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); V.install = e; render(); });
addEventListener("hashchange", handleHash);
document.addEventListener("visibilitychange", keepAlive);
setInterval(keepAlive, 25000);
(async () => {
  try { S = (await store.get("state")) || null; } catch { app.replaceChildren(h("p", { class: "err" }, t("This browser blocks storage. Open Bierdeckel in your normal browser, not a private window."))); return; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  render();
  await handleHash();
  if (S) startPeer();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
})();
