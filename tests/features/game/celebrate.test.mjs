// Winner celebration: the decision (when to celebrate) and the confetti plan. node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celebrationFor, confettiPieces, pieceCount, CELEBRATE_MS } from '../../../src/features/game/celebrate.js'
import { Game } from '../../../src/engine/game.js'

const view = (phase, result, players = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' }], me = 0) => ({ phase, result, players, me })
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) // small deterministic generator

test('a round that just ended with a winner is celebrated', () => {
	assert.deepEqual(celebrationFor('play', view('over', { winner: 1, delta: {} })), { id: 'b', name: 'Beto', index: 1, blocked: false, mine: false })
})

test('the pool-ran-out ending is celebrated too and says so', () => {
	assert.equal(celebrationFor('play', view('over', { winner: 0, blocked: true }))?.blocked, true)
})

test('a round the host cancelled is not celebrated', () => {
	assert.equal(celebrationFor('play', view('over', { cancelled: true, delta: {} })), null)
})

test('never replayed: mounting already over, a repeat of the same state, or leaving over', () => {
	const over = view('over', { winner: 0 })
	assert.equal(celebrationFor('over', over), null) // reload / late join / reconnect re-push
	assert.equal(celebrationFor('lobby', over), null)
	assert.equal(celebrationFor('over', view('play', null)), null)
	assert.equal(celebrationFor('play', view('play', null)), null)
})

test('every new round celebrates again, and starting the next round clears the previous one', () => {
	// the phases one mounted Game sees over a session: lobby, play, over, (host starts the next round) play, over
	const seq = ['lobby', 'play', 'over', 'play', 'over']
	const hits = []
	for (let i = 1; i < seq.length; i++) hits.push(celebrationFor(seq[i - 1], view(seq[i], seq[i] === 'over' ? { winner: 0 } : null)) !== null)
	assert.deepEqual(hits, [false, true, false, true])
})

test('a winner seat that no longer exists is not celebrated', () => {
	assert.equal(celebrationFor('play', view('over', { winner: 5 })), null)
	assert.equal(celebrationFor('play', view('over', null)), null)
})

test('the winner\'s own client is told so (it says "You win!"), the others are not', () => {
	const r = { winner: 1, delta: {} }
	assert.equal(celebrationFor('play', view('over', r, undefined, 1))?.mine, true)
	assert.equal(celebrationFor('play', view('over', r, undefined, 0))?.mine, false)
})

test('works on a real finished game (winner by emptying the rack)', () => {
	const g = new Game()
	g.join('a', 'Ana')
	g.join('b', 'Beto')
	g.deal()
	const before = g.view('a').phase
	g.finish(0) // what the engine does when a rack empties
	const c = celebrationFor(before, g.view('a'))
	assert.equal(c?.name, 'Ana')
	assert.equal(c?.index, 0)
	assert.equal(c?.mine, true) // Ana's own view
	assert.equal(celebrationFor(before, g.view('b'))?.mine, false) // Beto's view of the same round
})

test('confetti count scales with width between 45 and 110', () => {
	assert.equal(pieceCount(320), 45)
	assert.equal(pieceCount(1440), 110)
	assert.ok(pieceCount(800) > 45 && pieceCount(800) < 110)
	assert.equal(confettiPieces(390, 844, seeded(1)).length, 45)
	assert.equal(confettiPieces(1440, 900, seeded(1)).length, 110)
})

test('every piece finishes before the summary dialog can open', () => {
	for (const [w, h] of [[390, 844], [844, 390], [1440, 900]]) {
		for (const p of confettiPieces(w, h, seeded(w))) {
			assert.ok(p.delay >= 0 && p.delay + p.dur <= 2800, `delay ${p.delay} + dur ${p.dur}`)
			assert.ok(p.dur >= 1500)
		}
	}
	assert.ok(2800 < CELEBRATE_MS)
})

test('pieces start inside the viewport width, rain from the top, burst from the middle', () => {
	const ps = confettiPieces(390, 844, seeded(7))
	for (const p of ps) {
		assert.ok(p.x >= 0 && p.x <= 390 + 20, `x ${p.x}`)
		assert.ok(p.w > 0 && p.h > 0)
		assert.match(p.color, /^#[0-9a-f]{6}$/i)
		assert.ok(p.end.dy > 0, 'pieces always end below their start')
		if (p.burst) assert.ok(Math.abs(p.x - 195) <= 20 && p.mid.dy < 0, 'burst starts mid-screen and goes up first')
		else assert.equal(p.y, -16)
	}
	assert.equal(ps.filter(p => p.burst).length, Math.round(45 * 0.4))
})

test('the plan is deterministic for a given random source', () => {
	assert.deepEqual(confettiPieces(500, 700, seeded(42)), confettiPieces(500, 700, seeded(42)))
})
