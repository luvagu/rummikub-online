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
