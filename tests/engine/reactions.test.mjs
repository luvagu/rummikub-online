// Table emotes: the registry, the legacy map and the pure "what is happening" helpers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
	REACTIONS, GRID, RKEYS, RLEGACY, SUGGEST, MOOD_MS,
	situationFor, suggestionsFor, momentFor, moodsFor, endMoodsFor, botReact, orderByUse, bumpUse,
} from '../../src/engine/reactions.js'
import { en } from '../../src/i18n/en.js'
import { es } from '../../src/i18n/es.js'

const CATS = ['cheer', 'shock', 'laugh', 'sad', 'taunt', 'nudge']
const notify = readFileSync(new URL('../../src/utils/notify.js', import.meta.url), 'utf8')

test('registry: unique keys, 12 in the grid, a category with a sound, a label per language and an animation file', () => {
	assert.equal(new Set(REACTIONS.map(r => r.k)).size, REACTIONS.length)
	assert.equal(GRID.length, 12)
	for (const r of REACTIONS) {
		assert.ok(CATS.includes(r.cat), `${r.k}: category`)
		assert.ok(r.e, `${r.k}: fallback character`)
		assert.ok(new RegExp(`\\b${r.cat}:\\s*\\[`).test(notify), `${r.k}: a "${r.cat}" cue in notify.js`)
		for (const [name, tr] of [['en', en], ['es', es]]) assert.ok(tr['r.' + r.k], `${name}.r.${r.k}`)
		assert.ok(existsSync(new URL(`../../public/emotes/${r.k}.webp`, import.meta.url)), `public/emotes/${r.k}.webp`)
	}
	for (const [name, tr] of [['en', en], ['es', es]]) {
		const stale = Object.keys(tr).filter(k => k.startsWith('r.') && !RKEYS.has(k.slice(2)))
		assert.deepEqual(stale, [], `${name}: stale emote names`)
	}
})

test('legacy keys from older clients map onto the new set, and no legacy key is also a new key', () => {
	for (const [old, now] of Object.entries(RLEGACY)) {
		assert.ok(RKEYS.has(now), `${old} -> ${now}`)
		assert.ok(!RKEYS.has(old), `${old} is still a live key`)
	}
	for (const old of ['gg', 'nice', 'wow', 'haha', 'scared', 'hmm', 'hurry', 'fire', 'rage', 'oops', 'sad']) assert.ok(RKEYS.has(old) || RLEGACY[old], old)
})

test('every suggestion exists, three per situation', () => {
	for (const [sit, keys] of Object.entries(SUGGEST)) {
		assert.equal(keys.length, 3, sit)
		for (const k of keys) assert.ok(RKEYS.has(k), `${sit}: ${k}`)
	}
})

// A client's view of a game (the fields the helpers read).
const view = (n, opts = {}) => ({
	phase: 'play', me: 0, turn: 0, seq: 1, tl: null,
	players: n.map((c, i) => ({ id: 'p' + i, n: c, melded: true, bot: i > 0 })),
	...opts,
})

test('situationFor: leading, trailing, race, even, slow', () => {
	assert.equal(situationFor(view([8, 12])), 'leading')
	assert.equal(situationFor(view([14, 9])), 'trailing')
	assert.equal(situationFor(view([9, 8])), 'even')
	assert.equal(situationFor(view([8, 2])), 'race')
	assert.equal(situationFor(view([2, 2])), 'even', 'tied and low: not a race against me')
	assert.equal(situationFor(view([8, 10], { turn: 1, tl: 6000, players: [{ id: 'p0', n: 8, bot: false }, { id: 'p1', n: 10, bot: false }] })), 'slow')
	assert.equal(situationFor(view([8, 10], { turn: 1, tl: 6000 })), 'leading', 'a bot taking its time is not "slow"')
	assert.equal(situationFor(null), 'even')
})

test('situationFor: the round is over', () => {
	const over = result => view([0, 5], { phase: 'over', result })
	assert.equal(situationFor(over({ winner: 0, blocked: false })), 'roundWon')
	assert.equal(situationFor(over({ winner: 1, blocked: false })), 'roundLost')
	assert.equal(situationFor(over({ winner: 1, blocked: true })), 'roundBlocked')
	assert.equal(situationFor(over({ winner: 0, blocked: true })), 'roundWon')
	assert.equal(situationFor(over({ cancelled: true })), 'even')
	assert.deepEqual(suggestionsFor(over({ winner: 0, blocked: false })), SUGGEST.roundWon)
})

test('momentFor: only a real step of the same running round counts', () => {
	const a = view([10, 10]),
		b = { ...view([6, 10]), seq: 2 }
	assert.deepEqual(momentFor(a, b), { seat: 0, id: 'p0', played: 4, left: 6, first: false })
	assert.equal(momentFor(a, a), null, 'a repeat of the same state')
	assert.equal(momentFor(null, b), null, 'a reload / first state')
	assert.equal(momentFor({ ...a, phase: 'lobby' }, b), null)
	assert.equal(momentFor(a, { ...b, players: b.players.slice(0, 1) }), null, 'someone left')
	const drew = { ...view([10, 11]), seq: 2 }
	assert.equal(momentFor(a, drew).drew, true)
	const first = { ...view([6, 10]), seq: 2 }
	first.players[0].melded = true
	const before = view([10, 10])
	before.players[0].melded = false
	assert.equal(momentFor(before, first).first, true)
})

test('moodsFor: a big play, a first meld and "someone is nearly out"', () => {
	const prev = view([10, 10, 10]),
		big = { ...view([6, 10, 10]), seq: 2 }
	assert.deepEqual(moodsFor(prev, big), [{ id: 'p0', k: 'fire' }])
	const small = { ...view([9, 10, 10]), seq: 2 }
	assert.deepEqual(moodsFor(prev, small), [])
	// p1 drops from 6 to 2 tiles (4 played: on fire); only the NEXT player (p2) reacts, not everyone
	const nearly = { ...view([10, 2, 10]), seq: 2 }
	const before = view([10, 6, 10])
	assert.deepEqual(moodsFor(before, nearly), [{ id: 'p1', k: 'fire' }, { id: 'p2', k: 'gasp' }])
	// ...and it wraps around the table, and the next player being close too turns the gasp into popcorn
	const last = { ...view([10, 10, 2]), seq: 2 },
		lastBefore = view([10, 10, 6])
	assert.deepEqual(moodsFor(lastBefore, last), [{ id: 'p2', k: 'fire' }, { id: 'p0', k: 'gasp' }])
	const close = { ...view([4, 2, 10]), seq: 2 }
	assert.deepEqual(moodsFor(view([4, 6, 10]), close), [{ id: 'p1', k: 'fire' }, { id: 'p2', k: 'gasp' }])
	assert.deepEqual(moodsFor(view([10, 6, 4]), { ...view([10, 2, 4]), seq: 2 }), [{ id: 'p1', k: 'fire' }, { id: 'p2', k: 'popcorn' }])
	assert.deepEqual(moodsFor(prev, { ...view([11, 10, 10]), seq: 2 }), [], 'drawing says nothing')
	assert.deepEqual(moodsFor(prev, prev), [])
	assert.ok(MOOD_MS > 1000)
})

test('endMoodsFor: winner and losers react to the points they are stuck with', () => {
	const s = {
		phase: 'over',
		players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
		result: { winner: 0, blocked: false, delta: { a: 60, b: -8, c: -22, d: -30 } },
	}
	assert.deepEqual(endMoodsFor(s), { a: 'trophy', b: 'cry', c: 'oops', d: 'oops' })
	s.result.delta.d = -31
	assert.equal(endMoodsFor(s).d, 'gasp')
	assert.equal(endMoodsFor({ ...s, result: { ...s.result, blocked: true } }).a, 'party')
	assert.deepEqual(endMoodsFor({ ...s, phase: 'play' }), {})
	assert.deepEqual(endMoodsFor({ ...s, result: { cancelled: true } }), {})
})

test('botReact: always celebrates going out, is deterministic with an injected RNG, and experts are quieter than beginners', () => {
	for (const lvl of [1, 3, 5]) assert.ok(RKEYS.has(botReact({ lvl, left: 0 }, () => 0.99)), `lvl ${lvl} going out`)
	const quiet = () => 0.9 // above every chat chance
	assert.equal(botReact({ lvl: 1, played: 4, left: 5 }, quiet), null)
	const chatty = () => 0 // under every chat chance, picks the first of each list
	assert.equal(botReact({ lvl: 1, played: 4, left: 5, oppMin: 9 }, chatty), 'fire')
	assert.equal(botReact({ lvl: 5, played: 4, left: 5, oppMin: 9 }, chatty), 'evil')
	assert.equal(botReact({ lvl: 3, joker: true, left: 5 }, chatty), 'evil')
	assert.equal(botReact({ lvl: 1, oppMin: 2, left: 5 }, chatty), 'gasp')
	assert.equal(botReact({ lvl: 3, drew: true, left: 5 }, chatty), 'oops')
	assert.equal(botReact({ lvl: 3, left: 5 }, chatty), null, 'nothing happened')
	const rate = lvl => { let n = 0; for (let i = 0; i < 1000; i++) if (botReact({ lvl, played: 1, left: 5 }, (() => { let x = (i * 7919 % 1000) / 1000; return () => (x = (x * 9301 + 0.49297) % 1) })())) n++; return n }
	assert.ok(rate(1) > rate(5), 'beginners chat more')
})

test('orderByUse: most-used first, ties keep the default order; bumpUse counts without mutating', () => {
	assert.deepEqual(orderByUse(['a', 'b', 'c', 'd'], { c: 5, b: 1 }), ['c', 'b', 'a', 'd'])
	assert.deepEqual(orderByUse(['a', 'b', 'c']), ['a', 'b', 'c'])
	const u = { a: 1 },
		n = bumpUse(u, 'a')
	assert.equal(n.a, 2)
	assert.equal(u.a, 1)
	assert.equal(bumpUse({}, 'z').z, 1)
})
