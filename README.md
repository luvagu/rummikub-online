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

- Rules: the in-game Rules button (menu > Rules).

## Credits

The animated emotes are Google's Noto Animated Emoji (CC BY 4.0, https://googlefonts.github.io/noto-emoji-animation/), downscaled and re-encoded for this app (`public/emotes/LICENSE.txt`, `scripts/make-emotes.py`).

## Bots

Add up to 3 bots in the lobby or between rounds, or press "Play solo" on the home screen and choose "Play against the bot" (works fully offline, no network needed). Bots come in five difficulty levels:

| Level        | How it plays                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Beginner     | Ignores jokers, plays only one set per turn (two if needed to meld), never adds to the table, often misses plays and draws.        |
| Casual       | Plays its best new sets and extends sets on the table, but ignores jokers and sometimes passes.                                    |
| Intermediate | Uses jokers and can rearrange the table a little (search capped at about 60 ms per move).                                          |
| Expert       | Rearranges the whole table, may use jokers in runs missing two tiles (groups take at most one joker) and holds jokers back unless they get it out faster (about 300 ms). |
| Master       | Expert with a much larger search budget (about 900 ms per move).                                                                   |

Levels live in the `BOT` table in `src/engine/game.js`. `node scripts/bot-sim.mjs [games] [maxTurns]` plays bots against each other to compare strength (slow: use few games).

- **Solo:** "Play solo" asks whether to play against the bot or take the tutorial. The bot dialog picks the level and has a selector for the turn timer (off, 15, 30, 45, 60 or 90 s); both choices are remembered.
- **Lobby and between rounds:** the host picks the level in the dropdown next to "Add bot"; it applies to the next bot added, and each bot keeps its own level (shown next to its name). Any bot, and any offline human player, can be removed with its X (host only, in the lobby or between rounds).
- A bot that takes over the seat of a player who left mid-game plays at Intermediate level (3).
- The bot AI lives in `botMove()` in `src/engine/game.js`.

## How online play works

Moves are relayed through free public MQTT brokers over WebSockets (EMQX, HiveMQ, Mosquitto: no accounts, no WebRTC, no firewall/NAT issues).
The host's browser runs the game rules; the room code's first letter says which broker the room lives on.
To use your own broker (e.g. a free HiveMQ Cloud cluster), set `VITE_MQTT_URL` (a `wss://` URL) at build time.

### Security of online rooms

Public brokers have no access control, so anyone who knows (or guesses) a room code can subscribe to everything published in it. Each guest therefore talks to the host over its **own end-to-end encrypted, authenticated channel** (`src/utils/secure.js`, WebCrypto only, no dependency):

- Every player has an ECDH P-256 key pair; the player's public id is a hash of its public key, so it is safe to show to everyone.
- The channel key is derived (HKDF) from the two keys, the host's per-run session id and a per-handshake number, and messages are AES-GCM sealed with a replay counter. Racks, moves and private state never appear in the clear, nobody can impersonate another player, and nothing captured from an earlier handshake or an earlier host run can be replayed.
- The guest pins the host's key the first time it sees it, so a forged retained message cannot silently put someone else in the host's place. A broker last-will ("this guest disconnected") is only honoured when it carries the sealed id of the guest's current connection.
- `node scripts/sniff.mjs` is a dev-only check: it joins the real relay as an outsider, reports whether any game data is readable, and replays/forges messages against a running host.

**What it does not protect against:** the host is trusted (it runs the rules and sees every rack); anyone who has the room code can still join an *empty seat*; and a determined attacker who is already in the middle when a guest first connects could still substitute the host key (there is no out-of-band verification of the host). Online play needs a secure context (https or localhost) because WebCrypto only exists there. Old and new versions cannot play together (the topic root is `rmkb8/`).

## Languages

English and Latin American Spanish (auto-detected from the browser, switch with the button on every screen). Add a language by copying `src/i18n/en.js` to a new file (same keys), registering it in `src/i18n/index.js`, and adding a block in `src/features/rules/Rules.jsx`.

## Turn alerts

A chime plays and the phone vibrates (Android/Chrome; iOS Safari has no web vibration) when it becomes your turn; the tab title also shows "● Your turn" while the tab is in the background. Toggle them in the ⋮ menu (Turn sound, Turn vibration). The tab title also shows a countdown (⏱) when the timer is running low. iPhones in silent mode mute web audio.

## Sound and animation

- **Dealing:** at the start of a round, face-down tiles fly from the pool counter to each seat, one at a time round-robin, and your 14 tiles land in your rack one by one with a card-flick sound. Pace is 100 ms per tile with 2 players, 80 ms with 3 and 60 ms with 4 (`dealGap()` in `src/features/game/Game.jsx`). The seat tile counts and the pool counter update as tiles are dealt.
- **Other players drawing:** when someone else draws, tiles fly from the pool to their seat with a swish sound.
- **Action buttons:** To rack, Undo, Draw (and its confirm step), End turn, Skip, the sort buttons and the reactions button each play their own short cue. Selecting or deselecting a tile, New set and adding to a set (the + on a table set) have cues too. Sounds are synthesized with WebAudio (`src/utils/notify.js`), no audio files.
- **Round winner:** when a round ends with a winner (rack emptied, or the pool ran out and the lowest rack wins), a confetti burst and a highlighted winner card play for up to 3 s (the winner's own screen says "You win!", everyone else sees the winner's name), then the summary dialog opens. Tap anywhere, press Skip, Escape, Enter or Space to go straight to the summary. It plays once per round: a reload or late join mid-summary does not replay it, and a round the host cancelled has none. With "reduce motion" there is no confetti, just a still card for 2 s. A short fanfare plays unless Turn sound is off; the winner is also announced to screen readers. The decision and the confetti plan are pure functions in `src/features/game/celebrate.js` (tested); `src/features/game/Celebration.jsx` draws them with the Web Animations API (transform and opacity only).
- The menu's turn sound switch mutes all of these. With "reduce motion" enabled in the OS, tiles don't fly but the sounds still play. A reload or rejoin mid-round does not replay the deal.

## Light and dark theme

The dialogs, text fields, coach and menus follow the system theme (`color-scheme: light dark`, `light-dark()` tokens in `src/styles/tokens.css`). The green table, rack and tiles look the same in both schemes. Menu > Theme cycles System, Light and Dark; "System" removes the saved choice, so the page follows the OS again. A small inline script in `index.html` applies a saved choice before first paint, so there is no flash of the wrong theme. Every dark text/UI colour pair is at least 4.5:1 (text) or 3:1 (borders and controls).

## Table patterns

Menu > Table pattern cycles **Shuffle**, then eight patterns: Baize, Deco, Honeycomb, Cubes, Pinstripe, Chevron, Starfield and Lattice. They are layered light, dark and faint gold overlays on the green felt, drawn in pure CSS or small inline SVGs (`.board.bg0` to `.bg7` in `src/styles/game.css`).

- **Shuffle** is the default: each session (new room, solo game, tutorial, or a reload that resumes a game) starts on a random pattern that differs from the last one shown. Rounds inside a session keep it.
- Picking a pattern pins it. The choice is remembered in the browser (`rmkTable`; `rmkTableLast` is the pattern last shown). The older `rmkBg` key is ignored, so everyone starts on Shuffle.
- The helpers live in `src/features/game/display.js`. Keep `BGS`, the CSS rules and the `bg0`..`bgN` names in both language files in step (`tests/features/game/tablePatterns.test.mjs` checks it).

## Table colours

Menu > Table colour picks the felt: **Emerald** (default), **Midnight**, **Burgundy**, **Slate**, **Plum** or **Teal**. It is independent of the pattern and applies app-wide (Home, Lobby, the table, dialogs, the browser's `theme-color`); the choice is remembered (`rmkFelt`) and applied by a tiny script in `index.html` before first paint, so a reload never flashes green.

- A theme is just three numbers in `src/styles/tables.css` (hue, chroma multiplier, lightness offset). Every felt role in `src/styles/tokens.css` (`--felt`, `--felt2`, `--felt-deep`, `--felt-edge`, the dark dialog/field/coach surfaces and the green-tinted light-scheme neutrals) is an `oklch()` derived from those seeds, which are registered with `@property`, so switching cross-fades the whole table (not under reduced motion). Emerald reproduces the original palette.
- Per-theme fine-tuning uses a style query (`@container style(--table: burgundy)`, invalid sets get a light edge on the red felt).
- `src/features/game/tableTheme.js` holds the ids, the saved choice and `applyTable()`, which also sets `<meta name="theme-color">` from the theme's header colour. Keep `TABLES`, the blocks in `tables.css` and the `table.<id>` names in both language files in step.
- `tests/features/game/tableThemes.test.mjs` checks that every theme stays inside sRGB, that white text is at least 4.5:1 on every felt role, that tiles, the amber action colour, timer ring and seat chips are at least 3:1, that emerald still matches the old hex palette, and that no felt colour is hard-coded or used in a `repeating-*-gradient` (Firefox).

## Between rounds

When a round ends in a hosted room, the dialog has the same layout as the lobby: room code, copy/share, and the four seats.

- The host can invite more players (while a seat is free), add bots, and remove bots or offline players. New players start at 0 points and are dealt in on the next round; guests see the seat list read-only.
- **End round** (host menu, with confirmation) cancels the round early: nobody wins and no points, wins or game count change. Use it to make room for a new player without finishing the round.

## Tutorial

"Play solo" > "Take the tutorial" opens a lesson list. Each lesson is a short scripted offline game against a "Coach" that just draws a tile, with a coach card that highlights what to tap and moves on by itself when you do it (Skip step is always there). The lessons are:

1. **The basics:** selecting tiles, runs and groups, the 30-point first meld, adding to a set, jokers, drawing, timed turns.
2. **Rearrange the table:** borrow a tile from a set on the table to build a new one.
3. **Joker swap:** replace a joker on the table with the real tile and reuse the joker.
4. **Invalid sets:** see how a bad set is flagged and use Undo.
5. **Smart play tips:** extend sets, keep your jokers, watch the table.

Lessons live in `src/engine/tutorial.js` (positions and steps) and `src/features/tutorial/Tutorial.jsx` (the overlay); text is in `src/i18n/en.js` and `es.js` under `tut.*` / `les.*`. Nothing from the tutorial is saved.

## Reconnecting, leaving and resuming

- A dropped connection reconnects automatically (a banner shows while it does and clears itself once the connection is back) and players get their seat back.
- The current room is remembered in the browser: after a refresh or reopened tab the game resumes on its own; if it can't, a "Resume your game" card appears on the home screen.
- A host who refreshes resumes the same room (same code) from a snapshot stored in that browser; guests rejoin automatically.
- Menu > Leave room: guests mid-game hand their seat to a bot (they can reclaim it by rejoining); the host ends the game for everyone.

While a guest's connection is down, Draw, End turn and reactions are disabled with a "Waiting for connection…" hint (moves are never queued, because a replayed move could land on a different turn); tiles can still be arranged locally. If a move still cannot go out you get a "Not sent" message. The host's own moves are never lost: they change the authoritative state and are re-published when the connection returns.


## Offline use and updates

A small service worker (`scripts/sw-template.js`, emitted by a plugin in `vite.config.js`, production builds only) keeps the app shell, so the app opens and solo play, the tutorial and the rules work with no network. Online play needs the network and shows its usual "can't reach the relay" message. Pages are network-first (short timeout, then the cached shell) so deploys propagate; hashed assets are cache-first. A new version installs in the background and a banner offers "Reload"; it never takes over by itself, so a game is not interrupted (saved games resume after the reload). Not cached on purpose: the MQTT library chunk, `og.png` and the fonts for scripts the app does not use. To test: `npm run build && npm run preview`, open it once, reload, then stop the server (browser "Offline" emulation does not stop the worker's own requests).

## Reactions, drawn tiles and drag & drop

- **Emotes:** the smiley button next to the rack sort buttons opens the emote picker: a **Suggested** strip of three that fit the moment (leading, trailing, an opponent nearly out, someone slow, round won / lost / blocked) and a fixed 4 × 3 grid of twelve (Good game, Well played, Mind blown, LOL, No way, Hmm, Hurry up, On fire, Respect, So close, Rummikub, Mine now), most-used first for you (a counter in this browser, `rmkEmoteUse`). Three more (tense endgame, party, oops) only appear as suggestions. Each is an animated emote (Noto Animated Emoji, CC BY 4.0, `public/emotes/*.webp`, rebuilt by `scripts/make-emotes.py`; the emoji character shows while it loads, offline-first-time, and with reduced motion). A sent emote pops up under the sender's seat in their seat colour, with one short synthesized sound per category (cheer, shock, laugh, sad, taunt, nudge; follows the sound toggle). Only the key goes over the wire; it is never part of the game state (not saved, not replayed on reconnect), the host validates it and rate-limits each player, and keys from older clients are mapped onto the new set (`RLEGACY`). Menu > Reactions mutes incoming ones and the seat moods below.
- **Seat moods:** every client derives, from the same public state, a small emote badge on each seat for a few seconds (nothing is sent): 3+ tiles in one turn is "on fire", a first meld a clap, an opponent dropping to 3 tiles or fewer makes the others gasp, and in the round-end celebration the winner gets a trophy and each loser reacts to the points they are stuck with (few: so close, some: oops, a lot: gasp). The rules are the pure functions `situationFor`, `momentFor`, `moodsFor` and `endMoodsFor` in `src/engine/reactions.js` (tested), and like the confetti they only fire on a live transition, never on a reload or late join.
- **Bots** react from the same situations (a rule table with a persona by level: beginners chatty and silly, experts rare and terse; they always celebrate going out), at most once per 20 s each. `botPlay()` reports `{played, drew, first, joker, left, oppMin}` for it.
- The animations are not precached by the service worker (about half a megabyte): each is kept in its own cache the first time it is shown.
- **Drawn tiles:** a tile you just drew (including the 3-tile timeout penalty) glows with a "+" tag and scrolls into view in a busy rack.
- **Drag & drop:** on wide screens with a mouse/trackpad (`hover: hover`, `pointer: fine`, min-width 900px) tiles can be dragged onto a set, an empty board area (new set) or the rack. On phones/tablets drag is off and tap-to-select is used (it always works too).

## Turn timer

Optional, in seconds: Off, 15, 30, 45, 60 or 90 (45 by default, remembered per browser for solo games). The host picks it in the lobby; in solo games it is in the bot level dialog. A bar drains across the top of the table (green, then amber and red as time runs low; thresholds scale with the chosen length). In the last seconds the active player gets one soft chime, a pulse on the Draw button (the only valid move if nothing was changed), a large countdown and a short vibration; ticks in the last 5 seconds (the last one a little higher) are on by default and can be switched off in the menu (they need Turn sound on). When time runs out the player draws a tile (3 if they had moved tiles). The host decides which from the player's last reported working state (their browser sends the tile count after each change), not from the timeout message itself. The host enforces the timer, so an offline player can't stall the game.

## Robustness and fairness

- The deck is shuffled with a Fisher-Yates shuffle driven by `crypto.getRandomValues` (`shuffle` in `src/engine/game.js`).
- Removing a player or bot between rounds re-indexes the turn and winner (`removeSeat`), saved games are sanitized on resume, and an error boundary in `src/main.jsx` clears a corrupt saved game instead of leaving a blank page.
- The host's browser holds the full game state, so a determined host can cheat; this is inherent to the serverless design. Likewise a modified guest client could withhold its working-state updates and so dodge the 3-tile timeout penalty.

## Scoring and games

Scores and wins add up across games in the same room (the round-end dialog shows each player's delta, total and wins). The player who starts rotates every game. If the pool runs out and nobody can play, the lowest rack wins and the others lose the difference; on a tie the first seat at the table wins. Drawing from an empty pool counts as a pass.

## Small conveniences

- All menu switches (turn sound, vibration, countdown ticks, reactions) default to ON.
- Tiles show a small shape (circle, triangle, square, diamond) next to the number so colours can be told apart.
- **Skip offline player:** when it is an offline player's turn the host gets a button that makes them draw a tile and moves on.
- **Share:** where the browser supports it, the invite panel has a Share button next to Copy link.

- Rack sort (by number or colour) is remembered, re-applied after every draw/turn, and the active option is highlighted. Tap it again to return to manual order.
- Recently used names appear as chips under the name field (tap to reuse, × to forget).
- Opening an invite link shows a minimal join screen (name + Join room, plus "Back to start").

## Project structure

```
src/
  main.jsx            entry: styles, service worker registration, error boundary
  App.jsx             root: session lifecycle, which screen is showing, toasts and global dialogs
  components/         shared UI building blocks (Modal, Popup, TopLayer, Toasts, Tile, Avatar, Seats, Invite, ...)
  features/           one folder per screen or feature
    home/             start screen (name, solo / create / join) and its form pieces
    lobby/            waiting room before a round
    game/             the table: Game, RoundSummary, EndRoundDialog, Celebration + their helpers (rack, deal animation, ...)
    rules/            rules screen (lazy loaded)
    tutorial/         guided lessons overlay (lazy loaded)
  engine/             framework-free game logic: rules engine and bots (game.js), reactions, tutorial lessons. No DOM, no React
  services/           I/O and persistence: net.js (MQTT / local transports), identity, saved sessions, service worker registration
  i18n/               en.js, es.js (messages), index.js (fmt, useT, language detection)
  utils/              small helpers with no UI of their own: store (guarded storage), notify (sound / vibration), theme, motion, secure (crypto)
  styles/             index.css (cascade order) + tokens, base, components, motion, overrides
tests/                node:test suites, mirroring src/ (engine, utils, features/game)
scripts/              dev tools (bot simulation, icon generation, sniffing, service worker template)
```

Dependencies point one way: `features` and `components` may use `services`, `engine`, `i18n` and `utils`; `services` use `engine`, `utils` (never `components` or `features`); `engine` imports nothing from the app. Each component file exports one component, and a feature keeps its own helpers next to it.

## Development

- **Node 22:** `.nvmrc` pins the Node version (`nvm use` / `fnm use`); CI reads the same file, and `package.json` declares `engines`. Vite 8 needs Node 20.19+ / 22.12+.
- `npm run dev` / `npm run build` / `npm test`. The tests (`tests/**/*.test.mjs`, Node's built-in runner, no dependencies) cover the rules engine and the bots.
- **Browser support:** the app targets Baseline "newly available" web features (native `<dialog>`, Popover API with anchor positioning, `@layer`, `color-mix()`, `toSorted()`, `Promise.withResolvers()`), with no polyfills. `closedby` on dialogs is progressive enhancement; a pointer-position fallback covers Safari.
- **CSS** is an entry file (`src/styles/index.css`) that imports the other files in `src/styles/` into an explicit cascade: `tokens` (custom properties), then the layers `base`, `components`, `motion`, `overrides`. Later layers win regardless of specificity, so there is no `!important`. Decorative motion is opt-in (`prefers-reduced-motion: no-preference`) and lives in `motion.css`.
- **Modals** use `<dialog>` (`Modal` in `src/components/Modal.jsx`); menus and pickers use the Popover API (`Popup`); toasts and the offline banner are top-layer popovers (`TopLayer`) so they stay above open dialogs.
- **Drag and drop** (mouse/pen on large screens) uses Pointer Events with delegation from the game root; touch uses tap-to-select. Each tile group is a single tab stop with arrow-key navigation.
- Browser storage goes through `src/utils/store.js` (guarded, same keys as before).
- **Icons and share image:** `npm run icons` (`scripts/make-icons.mjs`, uses the dev dependency `@resvg/resvg-js` and system Arial fonts) renders `apple-touch-icon.png`, `icons/*.png` and `og.png` into `public/`. The PNGs are committed; re-run only when the artwork changes. `og:image` and `og:url` must be absolute, so `.env` sets `VITE_SITE_URL` (the public URL with a trailing slash): change it for a custom domain. Social previews can only be checked after deploying.
