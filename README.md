# Bierdeckel

Private debt book between friends. Peer-to-peer, no server storing data, every change needs the other person's OK.

- `ledger.js`: identities (ECDSA P-256), signed proposals/answers, merge rules, per-friend hash chain, balances
- `app.js`: UI, IndexedDB storage, PeerJS sync, QR pairing and scanning, backup
- `vendor/`: PeerJS 1.5.4, qrcode-generator 1.4.4, jsQR 1.4.0 (bundled, so the app works offline)

## Run / host
Any static HTTPS host works (camera and crypto need HTTPS). GitHub Pages: push this folder, enable Pages.
Locally: `python3 -m http.server 8080` and open http://localhost:8080.

## How sync works
PeerJS's public server only introduces the phones; data goes phone to phone over WebRTC.
Both apps must be open at the same time to sync. Changes made meanwhile wait and sync next time.
PeerJS's bundled TURN relays no longer exist (DNS dead as of 2026-11-19). If two phones on strict
mobile networks cannot connect, add a TURN server to `iceServers` in `app.js` (e.g. coturn on your own server).

## Bump `VERSION` in `sw.js` on every release so phones pick up the update.

## Android app
`bierdeckel.apk` is a small WebView wrapper (source in `android/`, build with `android/build.sh <code> <name>`). It loads this site, so web updates reach it without reinstalling. Android browsers show a "Get the app" card; invite links can open the app through `bierdeckel://open?h=<hash>`.
