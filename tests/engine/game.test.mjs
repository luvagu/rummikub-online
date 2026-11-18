// Rules-engine safety net: node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DECK, T, val, key, shuffle, analyze, Game, botMove } from '../../src/engine/game.js'

// Tile id helper: colour c (0-3), number n (1-13), copy r (0-1). Jokers are 104 and 105.
const id = (c, n, r = 0) => r * 52 + c * 13 + (n - 1)
const J1 = 104,
	J2 = 105
const ids = (c, ...ns) => ns.map(n => id(c, n))
const sortNum = a => a.toSorted((x, y) => x - y)

test('deck has 106 unique tiles: 2 x (4 colours x 13 numbers) + 2 jokers', () => {
	assert.equal(DECK.length, 106)
	assert.deepEqual(DECK.map(t => t.id), DECK.map((_, i) => i))
	assert.equal(DECK.filter(t => t.j).length, 2)
	assert.equal(T(id(2, 7, 1)).n, 7)
	assert.equal(T(id(2, 7, 1)).c, 2)
})

test('val counts a joker as 30 and a numbered tile as its number', () => {
	assert.equal(val([]), 0)
	assert.equal(val(ids(0, 5, 6, 7)), 18)
	assert.equal(val([id(0, 10), J1]), 40)
})

test('key is order-independent, numeric and does not mutate its input', () => {
	const a = [10, 2, 33]
	assert.equal(key(a), '2,10,33')
	assert.deepEqual(a, [10, 2, 33])
	assert.equal(key([3, 1, 2]), key([2, 3, 1]))
})

test('shuffle is a permutation and honours an injected random source', () => {
	const a = shuffle(Array.from({ length: 50 }, (_, i) => i))
	assert.deepEqual(sortNum(a), Array.from({ length: 50 }, (_, i) => i))
	assert.deepEqual(shuffle([1, 2, 3, 4], () => 0), [2, 3, 4, 1])
	assert.deepEqual(shuffle([1, 2, 3, 4], n => n - 1), [1, 2, 3, 4])
})

test('analyze: valid runs', () => {
	const r = analyze(ids(1, 4, 5, 6))
	assert.equal(r.ok, true)
	assert.equal(r.val, 15)
	assert.deepEqual(r.nums, [4, 5, 6])
	const full = ids(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
	assert.equal(analyze(full).ok, true) // 1..13 is the longest possible run
	assert.equal(analyze([...full, J1]).ok, false) // 14 tiles cannot be a run
	// order of the input does not matter
	assert.equal(analyze(ids(2, 9, 7, 8)).ok, true)
})

test('analyze: jokers fill gaps and extend runs', () => {
	const gap = analyze([id(0, 3), J1, id(0, 5)])
	assert.equal(gap.ok, true)
	assert.equal(gap.val, 12)
	assert.deepEqual(gap.nums, [3, 4, 5])
	// A joker with no gap extends the run; at the top it extends downwards.
	const top = analyze([id(0, 12), id(0, 13), J1])
	assert.equal(top.ok, true)
	assert.deepEqual(top.nums, [11, 12, 13])
	const two = analyze([id(3, 6), J1, J2])
	assert.equal(two.ok, true)
	assert.equal(two.order.length, 3)
	// Not enough jokers for the gap
	assert.equal(analyze([id(0, 3), J1, id(0, 8)]).ok, false)
})

test('analyze: groups', () => {
	const g = analyze([id(0, 7), id(1, 7), id(2, 7)])
	assert.equal(g.ok, true)
	assert.equal(g.val, 21)
	assert.equal(analyze([id(0, 7), id(1, 7), id(2, 7), id(3, 7)]).val, 28)
	assert.equal(analyze([id(0, 7), id(1, 7), J1]).val, 21)
	assert.equal(analyze([id(0, 7), id(1, 7), J1, J2]).ok, true)
	// duplicate colour, five tiles, and two-tile groups are invalid
	assert.equal(analyze([id(0, 7), id(0, 7, 1), id(2, 7)]).ok, false)
	assert.equal(analyze([id(0, 7), id(1, 7), id(2, 7), id(3, 7), J1]).ok, false)
	assert.equal(analyze([id(0, 7), id(1, 7)]).ok, false)
})

test('analyze: rejects invalid sets and still returns a stable order', () => {
	for (const bad of [
		[],
		[J1],
		[J1, J2],
		[J1, J2, id(0, 4)].slice(0, 2),
		[id(0, 12), id(0, 13), id(0, 1)], // no wrap-around
		[id(0, 4), id(0, 4, 1), id(0, 5)], // repeated number in a run
		[id(0, 4), id(1, 5), id(0, 6)], // mixed colours, mixed numbers
	]) {
		const r = analyze(bad)
		assert.equal(r.ok, false)
		assert.equal(r.val, 0)
		assert.deepEqual(sortNum(r.order), sortNum(bad))
	}
	// invalid sets are ordered by colour, then number, with jokers last
	assert.deepEqual(analyze([id(1, 2), J1, id(0, 9), id(0, 3)]).order, [id(0, 3), id(0, 9), id(1, 2), J1])
})

test('botMove opens with a 30-point run and conserves every tile', () => {
	const rack = [...ids(0, 10, 11, 12), id(1, 2), id(2, 5)],
		out = botMove(rack, [], false, 3)
	assert.ok(out, 'bot should find a move')
	assert.ok(out.board.some(s => key(s) === key(ids(0, 10, 11, 12))))
	assert.deepEqual(sortNum([...out.board.flat(), ...out.rack]), sortNum(rack))
	for (const s of out.board) assert.equal(analyze(s).ok, true)
})

test('botMove cannot open below 30 points and returns null (draw)', () => {
	assert.equal(botMove([...ids(0, 1, 2, 3), id(1, 9), id(2, 12)], [], false, 3), null)
})

test('botMove can extend a melded table and never breaks a set', () => {
	const board = [ids(0, 4, 5, 6)],
		rack = [id(0, 7), id(1, 11), id(3, 2)],
		out = botMove(rack, board, true, 3)
	assert.ok(out)
	assert.deepEqual(sortNum([...out.board.flat(), ...out.rack]), sortNum([...board.flat(), ...rack]))
	for (const s of out.board) assert.equal(analyze(s).ok, true)
	assert.ok(out.rack.length < rack.length)
})

test('a bot-only game deals 14 tiles each and finishes without losing tiles', () => {
	const g = new Game()
	g.join('h', 'Host')
	g.s.players = []
	g.s.scores = {}
	g.s.wins = {}
	g.s.opts.timer = 0
	for (const l of [2, 3]) {
		g.s.players.push({ id: 'b' + l, name: 'L' + l, bot: true, lvl: l, rack: [], melded: false, on: true })
		g.s.scores['b' + l] = 0
		g.s.wins['b' + l] = 0
	}
	g.deal()
	assert.equal(g.s.phase, 'play')
	for (const p of g.s.players) assert.equal(p.rack.length, 14)
	assert.equal(g.s.pool.length, 106 - 28)
	for (let turns = 0; g.s.phase === 'play' && turns < 600; turns++) g.botPlay()
	const all = [...g.s.pool, ...g.s.board.flat(), ...g.s.players.flatMap(p => p.rack)]
	assert.deepEqual(sortNum(all), Array.from({ length: 106 }, (_, i) => i))
	for (const s of g.s.board) assert.equal(analyze(s).ok, true)
})

test('a started round is on hold while the tiles are dealt: nobody plays, bots included', () => {
	const g = new Game()
	g.join('h', 'Host')
	g.act('h', { t: 'bot' })
	g.act('h', { t: 'start' })
	const s = g.s
	assert.equal(s.phase, 'play')
	assert.ok(g.hold() > 0)
	assert.ok(g.view('h').hold > 0)
	assert.equal(g.view('h').tl, s.opts.timer * 1000, 'the turn clock has not started yet')
	// neither a draw nor a bot move gets through
	const cur = s.players[s.turn]
	const before = JSON.stringify(s.players.map(p => p.rack))
	assert.ok(g.act(cur.id, { t: 'draw' }), 'draw is refused')
	assert.equal(g.botPlay(), undefined)
	assert.equal(JSON.stringify(s.players.map(p => p.rack)), before)
	// once the deal is over play opens, and the clock only then starts
	s.holdUntil = Date.now() - 1
	assert.equal(g.hold(), 0)
	assert.equal(g.act(cur.id, { t: 'draw' }), undefined)
})

test('the hold also applies to the next round', () => {
	const g = new Game()
	g.join('h', 'Host')
	g.act('h', { t: 'bot' })
	g.act('h', { t: 'start' })
	g.s.holdUntil = 0
	g.finish(0)
	assert.equal(g.s.phase, 'over')
	assert.equal(g.hold(), 0)
	g.act('h', { t: 'start' })
	assert.ok(g.hold() > 0)
})
