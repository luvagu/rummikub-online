# Rummikub Online

Classic Rummikub (2–4 players) in React. Multiplayer goes through free public MQTT relays (see below): the host's browser runs the game, friends join with a 5-character room code or invite link. No server to pay for or maintain.

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

Add up to 3 bots in the lobby, or press "Play solo vs bot" on the home screen (works fully offline, no network needed). Bots come in three difficulty levels:

| Level | How it plays |
| --- | --- |
| Beginner | Ignores jokers, plays only one set per turn (two if needed to meld), never adds to sets already on the table, and often draws instead of playing. |
| Intermediate | Plays the best combination of new sets from its rack, then tacks leftover tiles onto existing sets. |
| Expert | Like Intermediate, but once it has melded it also rearranges the whole table (splits, merges and borrows tiles from sets) to empty its rack as fast as possible. The search is capped at roughly 300 ms per move. |

- **Solo:** tapping "Play solo vs bot" opens a dialog to pick the level; your last choice is remembered.
- **Lobby:** the host picks the level in the dropdown next to "Add bot"; it applies to the next bot added, and each bot keeps its own level (shown next to its name).
- A bot that takes over the seat of a player who left mid-game plays at Intermediate level.
- The bot AI lives in `botMove()` in `src/game.js`.

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

- A dropped connection reconnects automatically (a banner shows while it does and clears itself once the connection is back) and players get their seat back.
- The current room is remembered in the browser: after a refresh or reopened tab the game resumes on its own; if it can't, a "Resume your game" card appears on the home screen.
- A host who refreshes resumes the same room (same code) from a snapshot stored in that browser; guests rejoin automatically.
- Menu > Leave room: guests mid-game hand their seat to a bot (they can reclaim it by rejoining); the host ends the game for everyone.

## Reactions, drawn tiles and drag & drop

- **Reactions:** the smiley button next to the rack sort buttons sends one of nine fixed emoji + short messages (translated per player). They pop up over the sender's seat and are never part of the game state (not saved, not replayed on reconnect). The host validates the key and rate-limits each player. Bots react sporadically (beginners chat more, experts rarely) based on what just happened. Menu > Reactions mutes incoming ones. The set lives in `src/reactions.js`.
- **Drawn tiles:** a tile you just drew (including the 3-tile timeout penalty) glows with a "+" tag and scrolls into view in a busy rack.
- **Drag & drop:** on wide screens with a mouse/trackpad (`hover: hover`, `pointer: fine`, min-width 900px) tiles can be dragged onto a set, an empty board area (new set) or the rack. On phones/tablets drag is off and tap-to-select is used (it always works too).

## Turn timer

A bar drains across the top of the table (green, amber at 20 s, red at 10 s). In the last 10 s the active player gets one soft chime, a gentle pulse on End turn, a large countdown and a short vibration; optional quiet ticks are in the menu. The host enforces the timer, so an offline player can't stall the game.

## Small conveniences

- Rack sort (by number or colour) is remembered, re-applied after every draw/turn, and the active option is highlighted. Tap it again to return to manual order.
- Recently used names appear as chips under the name field (tap to reuse, × to forget).
- Opening an invite link shows a minimal join screen (name + Join room, plus "Back to start").
