// Ledger core: identities, signed records, merge rules and the per-friend hash chain.
// Pure logic, no UI. Runs in the browser (window.Ledger) and in Node 20+ (require) for tests.
(function (root) {
  const subtle = (root.crypto || require("crypto").webcrypto).subtle;
  const getRandom = n => (root.crypto || require("crypto").webcrypto).getRandomValues(new Uint8Array(n));
  const ALG = { name: "ECDSA", namedCurve: "P-256" };
  const SIG = { name: "ECDSA", hash: "SHA-256" };
  const enc = new TextEncoder();

  // ---------- encoding ----------
  function b64u(bytes) {
    let s = "";
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64u(str) {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  }
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  // Canonical JSON: sorted keys, no undefined. Both phones must produce identical bytes.
  function canon(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    return "{" + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  async function sha256hex(str) { return hex(await subtle.digest("SHA-256", enc.encode(str))); }
  const randomId = () => hex(getRandom(8));

  // ---------- identity ----------
  async function idFromPub(pub) { return (await sha256hex(pub)).slice(0, 20); }
  async function createIdentity(name) {
    const kp = await subtle.generateKey(ALG, true, ["sign", "verify"]);
    const pub = b64u(await subtle.exportKey("raw", kp.publicKey));
    const privJwk = await subtle.exportKey("jwk", kp.privateKey);
    return { id: await idFromPub(pub), name, pub, privJwk };
  }
  const keyCache = new Map();
  async function privKey(me) {
    if (!keyCache.has(me.pub + ":priv")) keyCache.set(me.pub + ":priv", await subtle.importKey("jwk", me.privJwk, ALG, false, ["sign"]));
    return keyCache.get(me.pub + ":priv");
  }
  async function pubKey(pub) {
    if (!keyCache.has(pub)) keyCache.set(pub, await subtle.importKey("raw", unb64u(pub), ALG, false, ["verify"]));
    return keyCache.get(pub);
  }
  async function sign(me, obj) { return b64u(await subtle.sign(SIG, await privKey(me), enc.encode(canon(obj)))); }
  async function verify(pub, obj, sig) {
    try { return await subtle.verify(SIG, await pubKey(pub), unb64u(sig), enc.encode(canon(obj))); }
    catch { return false; }
  }

  // ---------- records ----------
  // kind is told from the proposer's side: lent | borrowed | theyPaid | iPaid | correction
  const KINDS = ["lent", "borrowed", "theyPaid", "iPaid", "correction"];
  function validAmount(c) { return Number.isInteger(c) && c > 0 && c < 1e10; }

  async function propose(me, friendId, kind, amount, note, extra) {
    if (!KINDS.includes(kind) || !validAmount(amount)) throw new Error("bad proposal");
    let cred, debt;
    if (kind === "correction") { cred = extra.cred; debt = extra.debt; }
    else { const proposerIsCreditor = kind === "lent" || kind === "iPaid"; cred = proposerIsCreditor ? me.id : friendId; debt = proposerIsCreditor ? friendId : me.id; }
    const p = { id: randomId(), a: me.id, b: friendId, kind, amount, cred, debt, note: String(note || "").slice(0, 500), at: Date.now() };
    if (extra && extra.corrects) p.corrects = extra.corrects;
    return { p, ps: await sign(me, p) };
  }
  async function respond(me, rec, status, note) {
    if (rec.p.b !== me.id || effective(rec) !== "pending") throw new Error("cannot answer");
    const r = { status, note: String(note || "").slice(0, 500), at: Date.now() };
    return { ...rec, r, rs: await sign(me, { id: rec.p.id, ...r }) };
  }
  async function withdraw(me, rec) {
    if (rec.p.a !== me.id || effective(rec) !== "pending") throw new Error("cannot withdraw");
    const w = { at: Date.now() };
    return { ...rec, w, ws: await sign(me, { id: rec.p.id, withdrawn: w.at }) };
  }

  // Which decision counts: a reply and a withdrawal can cross in the post. The earlier one wins.
  function decision(rec) {
    if (rec.r && rec.w) return rec.r.at <= rec.w.at ? "r" : "w";
    return rec.r ? "r" : rec.w ? "w" : null;
  }
  function effective(rec) {
    const d = decision(rec);
    return d === "r" ? rec.r.status : d === "w" ? "withdrawn" : "pending";
  }
  function decidedAt(rec) { const d = decision(rec); return d === "r" ? rec.r.at : d === "w" ? rec.w.at : null; }

  // Checks every signature on a record. pubs maps person id -> public key.
  async function verifyRecord(rec, pubs) {
    const p = rec && rec.p;
    if (!p || !KINDS.includes(p.kind) || !validAmount(p.amount) || !pubs[p.a] || !pubs[p.b]) return false;
    if (new Set([p.cred, p.debt]).size !== 2 || ![p.a, p.b].includes(p.cred) || ![p.a, p.b].includes(p.debt)) return false;
    if (!(await verify(pubs[p.a], p, rec.ps))) return false;
    if (rec.r && (!["accepted", "refused"].includes(rec.r.status) || !(await verify(pubs[p.b], { id: p.id, ...rec.r }, rec.rs)))) return false;
    if (rec.w && !(await verify(pubs[p.a], { id: p.id, withdrawn: rec.w.at }, rec.ws))) return false;
    return true;
  }

  // Merge a verified incoming copy into the local one. Returns { rec, changed }.
  function merge(local, incoming) {
    if (!local) return { rec: incoming, changed: true };
    if (local.ps !== incoming.ps) return { rec: local, changed: false }; // same id, different content: keep ours
    const out = { ...local };
    let changed = false;
    if (incoming.r && (!out.r || incoming.r.at < out.r.at)) { out.r = incoming.r; out.rs = incoming.rs; changed = true; }
    if (incoming.w && (!out.w || incoming.w.at < out.w.at)) { out.w = incoming.w; out.ws = incoming.ws; changed = true; }
    return { rec: out, changed };
  }

  // The chain: every decided record between two people, in decision order, each block hashing the one before.
  // Both phones compute it from the same records, so equal heads mean identical histories.
  async function chain(records) {
    const decided = records.filter(r => decision(r)).sort((x, y) => decidedAt(x) - decidedAt(y) || (x.p.id < y.p.id ? -1 : 1));
    let head = "0".repeat(64);
    for (const rec of decided) {
      const d = decision(rec);
      const block = { prev: head, p: rec.p, ps: rec.ps, ...(d === "r" ? { r: rec.r, rs: rec.rs } : { w: rec.w, ws: rec.ws }) };
      head = await sha256hex(canon(block));
    }
    return { head, length: decided.length };
  }

  // Positive: friend owes me. Only accepted records count.
  function balance(records, myId) {
    return records.reduce((s, r) => effective(r) !== "accepted" ? s : s + (r.p.cred === myId ? r.p.amount : -r.p.amount), 0);
  }

  const L = { b64u, unb64u, canon, sha256hex, idFromPub, createIdentity, sign, verify, propose, respond, withdraw,
    effective, decidedAt, verifyRecord, merge, chain, balance, KINDS };
  if (typeof module !== "undefined" && module.exports) module.exports = L; else root.Ledger = L;
})(typeof globalThis !== "undefined" ? globalThis : this);
