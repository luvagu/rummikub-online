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

Add up to 3 bots in the lobby or between rounds, or press "Play solo" on the home screen and choose "Play against the bot" (works fully offline, no network needed). Bots come in five difficulty levels:

| Level        | How it plays                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Beginner     | Ignores jokers, plays only one set per turn (two if needed to meld), never adds to the table, often misses plays and draws.        |
| Casual       | Plays its best new sets and extends sets on the table, but ignores jokers and sometimes passes.                                    |
| Intermediate | Uses jokers and can rearrange the table a little (search capped at about 60 ms per move).                                          |
| Expert       | Rearranges the whole table, may use jokers in sets missing two tiles and holds jokers back unless they get it out faster (about 300 ms). |
| Master       | Expert with a much larger search budget (about 900 ms per move).                                                                   |

Levels live in the `BOT` table in `src/game.js`. `node scripts/bot-sim.mjs [games] [maxTurns]` plays bots against each other to compare strength (slow: use few games).

- **Solo:** "Play solo" asks whether to play against the bot or take the tutorial. The bot dialog picks the level and has a selector for the turn timer (off, 15, 30, 45, 60 or 90 s); both choices are remembered.
- **Lobby and between rounds:** the host picks the level in the dropdown next to "Add bot"; it applies to the next bot added, and each bot keeps its own level (shown next to its name). Any bot can be removed with its X.
- A bot that takes over the seat of a player who left mid-game plays at Intermediate level (3).
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

## Between rounds

When a round ends in a hosted room, the dialog has the same layout as the lobby: room code, copy/share, and the four seats.

- The host can invite more players (while a seat is free), add bots and remove bots. New players start at 0 points and are dealt in on the next round; guests see the seat list read-only.
- **End round** (host menu, with confirmation) cancels the round early: nobody wins and no points, wins or game count change. Use it to make room for a new player without finishing the round.

## Tutorial

"Play solo" > "Take the tutorial" opens a lesson list. Each lesson is a short scripted offline game against a "Coach" that just draws a tile, with a coach card that highlights what to tap and moves on by itself when you do it (Skip step is always there). The lessons are:

1. **The basics:** selecting tiles, runs and groups, the 30-point first meld, adding to a set, jokers, drawing, timed turns.
2. **Rearrange the table:** borrow a tile from a set on the table to build a new one.
3. **Joker swap:** replace a joker on the table with the real tile and reuse the joker.
4. **Invalid sets:** see how a bad set is flagged and use Undo.
5. **Smart play tips:** extend sets, keep your jokers, watch the table.

Lessons live in `src/tutorial.js` (positions and steps) and `src/Tutorial.jsx` (the overlay); text is in `src/i18n.js` under `tut.*` / `les.*`. Nothing from the tutorial is saved.

## Reconnecting, leaving and resuming

- A dropped connection reconnects automatically (a banner shows while it does and clears itself once the connection is back) and players get their seat back.
- The current room is remembered in the browser: after a refresh or reopened tab the game resumes on its own; if it can't, a "Resume your game" card appears on the home screen.
- A host who refreshes resumes the same room (same code) from a snapshot stored in that browser; guests rejoin automatically.
- Menu > Leave room: guests mid-game hand their seat to a bot (they can reclaim it by rejoining); the host ends the game for everyone.

## Reactions, drawn tiles and drag & drop

- **Reactions:** the smiley button next to the rack sort buttons sends one of nine fixed emoji (including 😱 Scared and 🔥 On fire) + short messages (translated per player). Each one has its own short synthesized sound (no audio files; follows the sound toggle). They pop up over the sender's seat and are never part of the game state (not saved, not replayed on reconnect). The host validates the key and rate-limits each player. Bots react sporadically (beginners chat more, experts rarely) based on what just happened. Menu > Reactions mutes incoming ones. The set lives in `src/reactions.js`.
- **Drawn tiles:** a tile you just drew (including the 3-tile timeout penalty) glows with a "+" tag and scrolls into view in a busy rack.
- **Drag & drop:** on wide screens with a mouse/trackpad (`hover: hover`, `pointer: fine`, min-width 900px) tiles can be dragged onto a set, an empty board area (new set) or the rack. On phones/tablets drag is off and tap-to-select is used (it always works too).

## Turn timer

Optional, in seconds: Off, 15, 30, 45, 60 or 90. The host picks it in the lobby; in solo games it is in the bot level dialog. A bar drains across the top of the table (green, then amber and red as time runs low; thresholds scale with the chosen length). In the last seconds the active player gets one soft chime, a pulse on the Draw button (the only valid move if nothing was changed), a large countdown and a short vibration; optional quiet ticks are in the menu. When time runs out the player draws a tile (3 if they had moved tiles). The host enforces the timer, so an offline player can't stall the game.

## Robustness and fairness

- The deck is shuffled with a Fisher-Yates shuffle driven by `crypto.getRandomValues` (`shuffle` in `src/game.js`).
- Removing a player or bot between rounds re-indexes the turn and winner (`removeSeat`), saved games are sanitized on resume, and an error boundary in `src/main.jsx` clears a corrupt saved game instead of leaving a blank page.
- The host's browser holds the full game state, so a determined host can cheat; this is inherent to the serverless design.

## Small conveniences

- Rack sort (by number or colour) is remembered, re-applied after every draw/turn, and the active option is highlighted. Tap it again to return to manual order.
- Recently used names appear as chips under the name field (tap to reuse, × to forget).
- Opening an invite link shows a minimal join screen (name + Join room, plus "Back to start").
