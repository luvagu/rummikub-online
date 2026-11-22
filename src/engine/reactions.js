// Table emotes. Only the key travels over the wire; each player sees the label in their own language (i18n key `r.<k>`).
// Pure and framework-free: this file also decides which emotes make sense right now (`situationFor`), which moods the seats
// show (`moodsFor`, `endMoodsFor`) and what the bots say (`botReact`). Nothing here is sent except a chosen/bot emote key.
//
//   k    the wire key (and the animation file public/emotes/<k>.webp)
//   e    the Unicode fallback: shown while the animation loads, when it fails, and with reduced motion
//   cat  the sound category (src/utils/notify.js): cheer | shock | laugh | sad | taunt | nudge
export const REACTIONS = [
	{ k: 'gg', e: '🤝', cat: 'cheer' },
	{ k: 'clap', e: '👏', cat: 'cheer' },
	{ k: 'wow', e: '🤯', cat: 'shock' },
	{ k: 'lol', e: '😂', cat: 'laugh' },
	{ k: 'gasp', e: '😱', cat: 'shock' },
	{ k: 'think', e: '🧐', cat: 'nudge' },
	{ k: 'hurry', e: '⏰', cat: 'nudge' },
	{ k: 'fire', e: '🔥', cat: 'cheer' },
	{ k: 'salute', e: '🫡', cat: 'cheer' },
	{ k: 'cry', e: '😭', cat: 'sad' },
	{ k: 'trophy', e: '🏆', cat: 'cheer' },
	{ k: 'evil', e: '😈', cat: 'taunt' },
	// only ever suggested for the moment they fit (never in the fixed grid)
	{ k: 'popcorn', e: '🍿', cat: 'nudge', extra: true },
	{ k: 'party', e: '🥳', cat: 'cheer', extra: true },
	{ k: 'oops', e: '🫠', cat: 'sad', extra: true },
]
export const GRID = REACTIONS.filter(r => !r.extra).map(r => r.k) // the 12 of the picker, 4 x 3
export const RKEYS = new Set(REACTIONS.map(r => r.k))
export const REACTION = Object.fromEntries(REACTIONS.map(r => [r.k, r]))
// Keys sent by older clients (the first nine, and the two before them) map onto the new set so a mixed-version room keeps working.
export const RLEGACY = {
	nice: 'clap',
	haha: 'lol',
	scared: 'gasp',
	hmm: 'think',
	rage: 'oops',
	sad: 'cry',
}
export const RCOOL = 1200 // ms between reactions from the same player (client button + host check)
export const MOOD_MS = 2400 // how long a seat's mood badge stays

const isJoker = id => id >= 104 // DECK ids 104 and 105 (game.js)

// ---------------------------------------------------------------- the situation (what the picker suggests)
// Where `me` stands, from a client's view of the game. One of:
//   roundWon | roundLost | roundBlocked (the round is over)
//   slow (someone else's turn is nearly out of time) | race (an opponent is nearly out) | leading | trailing | even
export function situationFor(s) {
	if (!s || !s.players) return 'even'
	const me = s.me
	if (s.phase === 'over') {
		const r = s.result
		if (!r || r.cancelled) return 'even'
		if (r.winner === me) return 'roundWon'
		return r.blocked ? 'roundBlocked' : 'roundLost'
	}
	if (s.phase !== 'play' || me == null || me < 0 || !s.players[me]) return 'even'
	const mine = s.players[me].n,
		others = s.players.filter((_, i) => i !== me).map(p => p.n),
		min = Math.min(99, ...others)
	if (s.turn !== me && s.tl != null && s.tl > 0 && s.tl <= 10000 && s.players[s.turn] && !s.players[s.turn].bot) return 'slow'
	if (min <= 3 && mine > min) return 'race'
	if (mine < min) return 'leading'
	if (mine >= min + 3) return 'trailing'
	return 'even'
}
// Three suggestions per situation, best first (the picker's "Suggested" strip). Every key exists in REACTIONS.
export const SUGGEST = {
	roundWon: ['trophy', 'party', 'gg'],
	roundLost: ['gg', 'cry', 'salute'],
	roundBlocked: ['oops', 'gg', 'lol'],
	slow: ['hurry', 'think', 'lol'],
	race: ['popcorn', 'gasp', 'think'],
	leading: ['evil', 'fire', 'popcorn'],
	trailing: ['cry', 'gasp', 'think'],
	even: ['gg', 'clap', 'think'],
}
export const suggestionsFor = s => SUGGEST[situationFor(s)]

// ---------------------------------------------------------------- live moods (derived locally, never sent)
// What the move between two consecutive views of a running round tells: who played how many tiles, drew, melded for the first
// time, went out. null when it is not a real step of the same round (a reload, a repeat, a different phase), so
// nothing is ever replayed. The same rule as celebrationFor: only a live transition counts.
export function momentFor(prev, next) {
	if (!prev || !next || prev.phase !== 'play' || next.phase !== 'play' || next.seq === prev.seq) return null
	if (prev.players.length !== next.players.length) return null
	let m = null
	for (let i = 0; i < next.players.length; i++) {
		const a = prev.players[i],
			b = next.players[i]
		if (a.id !== b.id) return null
		if (b.n < a.n) m = { seat: i, id: b.id, played: a.n - b.n, left: b.n, first: !a.melded && b.melded }
		else if (b.n > a.n && !m) m = { seat: i, id: b.id, played: 0, drew: true, left: b.n, first: false }
	}
	return m
}
// The moods that move shows: [{id, k}], at most one per seat.
//  - 3+ tiles in one go: the mover is "on fire"; a first meld earns a clap
//  - someone is down to 3 tiles or fewer: the next player, who has to answer it, gasps (or watches with popcorn if close too).
//    One seat, not all of them: three gasping faces at once is noise, and it hid the avatars on a phone.
export function moodsFor(prev, next) {
	const m = momentFor(prev, next)
	if (!m || m.drew) return []
	const out = []
	if (m.played >= 3) out.push({ id: m.id, k: 'fire' })
	else if (m.first) out.push({ id: m.id, k: 'clap' })
	const was = prev.players[m.seat].n
	if (m.left <= 3 && was > 3 && m.left > 0) {
		const nxt = next.players[(m.seat + 1) % next.players.length]
		if (nxt && nxt.id !== m.id) out.push({ id: nxt.id, k: nxt.n <= 4 ? 'popcorn' : 'gasp' })
	}
	return out
}
// The round-end burst: the winner is "trophy" (a blocked pool: "party"), each loser reacts to how many points they are stuck
// with (few: "so close", some: oops, a lot: gasp). {} for a round that is not over or was cancelled.
export function endMoodsFor(s) {
	const r = s && s.phase === 'over' && s.result
	if (!r || r.cancelled || !s.players[r.winner]) return {}
	const out = {}
	s.players.forEach((p, i) => {
		if (i === r.winner) return void (out[p.id] = r.blocked ? 'party' : 'trophy')
		const stuck = -(r.delta?.[p.id] ?? 0)
		out[p.id] = stuck <= 10 ? 'cry' : stuck <= 30 ? 'oops' : 'gasp'
	})
	return out
}

// ---------------------------------------------------------------- bots
// A rule table by situation, with a persona by level: beginners (1-2) are chatty and silly, experts (4-5) rare and terse.
const PERSONA = lvl => (lvl <= 2 ? 'low' : lvl >= 4 ? 'high' : 'mid')
const SAY = {
	out: { low: ['trophy', 'party', 'lol'], mid: ['trophy', 'gg', 'clap'], high: ['gg', 'salute', 'trophy'] },
	race: { low: ['gasp', 'popcorn', 'cry'], mid: ['popcorn', 'gasp', 'think'], high: ['popcorn', 'think', 'hurry'] },
	joker: { low: ['wow', 'evil'], mid: ['evil', 'wow'], high: ['evil', 'salute'] },
	big: { low: ['fire', 'lol', 'wow'], mid: ['fire', 'clap', 'wow'], high: ['evil', 'salute'] },
	first: { low: ['clap', 'lol'], mid: ['clap', 'think'], high: ['think', 'evil'] },
	play: { low: ['clap', 'think', 'lol'], mid: ['think', 'clap', 'evil'], high: ['think', 'evil'] },
	draw: { low: ['cry', 'gasp', 'oops'], mid: ['oops', 'think', 'hurry'], high: ['think', 'hurry'] },
}
const CHAT = { 1: 0.22, 2: 0.18, 3: 0.14, 4: 0.08, 5: 0.06 } // chance a bot reacts after a turn, by difficulty
// ctx = {lvl, played, drew, left, oppMin, first, joker} (Game.botPlay). `rnd` is injectable for tests. null = say nothing.
export function botReact({ lvl = 3, played = 0, drew = false, left = 99, oppMin = 99, first = false, joker = false } = {}, rnd = Math.random) {
	const pick = a => a[Math.floor(rnd() * a.length) % a.length]
	const who = PERSONA(lvl),
		say = k => pick(SAY[k][who])
	if (left === 0) return say('out') // went out: always celebrates
	if (rnd() > (CHAT[lvl] || 0.15)) return null
	if (oppMin <= 3 && rnd() < 0.6) return say('race')
	if (joker) return say('joker')
	if (played >= 3) return say('big')
	if (first) return say('first')
	if (played > 0) return say('play')
	if (drew) return say('draw')
	return null
}

// ---------------------------------------------------------------- the player's own most-used emotes
// A tiny usage counter ({key: count}) orders the picker so the emotes a player actually sends come first (ties keep the
// default order). `counts` comes from localStorage; nothing about it is shared.
export const orderByUse = (keys, counts = {}) =>
	keys
		.map((k, i) => [k, i])
		.sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0) || a[1] - b[1])
		.map(([k]) => k)
export const bumpUse = (counts, k) => ({ ...counts, [k]: (counts[k] || 0) + 1 })
