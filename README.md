# Rummikub Online

Classic Rummikub (2–4 players) in React. Multiplayer is peer-to-peer (PeerJS/WebRTC): the host's browser runs the game, friends join with a 5-letter room code or invite link. No server to pay for or maintain.

## Run locally

    npm install
    npm run dev

## Deploy free

**Vercel:** push to GitHub, import the repo at vercel.com/new (Vite is auto-detected), deploy.
**GitHub Pages:** push to `main`, then Settings > Pages > Source: "GitHub Actions". The included workflow builds and publishes.

## Notes

- The host must keep their tab open. Guests who drop can rejoin with the same code and keep their seat.

- Rules: `public/rules.pdf` and the in-game Rules button.

## Bots

Add up to 3 bots in the lobby, or press "Play solo vs bot" on the home screen (works fully offline, no network needed).

## How online play works

Moves are relayed through free public MQTT brokers over WebSockets (EMQX, HiveMQ, Mosquitto: no accounts, no WebRTC, no firewall/NAT issues).
The host's browser runs the game rules; the room code's first letter says which broker the room lives on.
Caveats: public brokers are shared, so anyone who guessed your room code could watch it (fine for casual games). To use your own broker
(e.g. a free HiveMQ Cloud cluster), set `VITE_MQTT_URL` (a `wss://` URL) at build time.

## Languages

English and Spanish (auto-detected from the browser, switch with the button on every screen). Add a language by copying a block in `src/i18n.js` and `src/Rules.jsx`.

## Turn alerts

A chime plays and the phone vibrates (Android/Chrome; iOS Safari has no web vibration) when it becomes your turn; the tab title also shows "● Your turn" while the tab is in the background. Toggle with the 🔔 / 📳 buttons in the top bar. iPhones in silent mode mute web audio.

## Reconnecting, leaving and resuming

- A dropped connection reconnects automatically (a banner shows while it does) and players get their seat back.
- The current room is remembered in the browser: after a refresh or reopened tab the game resumes on its own; if it can't, a "Resume your game" card appears on the home screen.
- A host who refreshes resumes the same room (same code) from a snapshot stored in that browser; guests rejoin automatically.
- Menu > Leave room: guests mid-game hand their seat to a bot (they can reclaim it by rejoining); the host ends the game for everyone.

## Turn timer

A bar drains across the top of the table (green, amber at 20 s, red at 10 s). In the last 10 s the active player gets one soft chime, a gentle pulse on End turn, a large countdown and a short vibration; optional quiet ticks are in the menu. The host enforces the timer, so an offline player can't stall the game.

## Small conveniences

- Rack sort (by number or colour) is remembered, re-applied after every draw/turn, and the active option is highlighted. Tap it again to return to manual order.
- Recently used names appear as chips under the name field (tap to reuse, × to forget).
- Opening an invite link shows a minimal join screen (name + Join room, plus "Back to start").
