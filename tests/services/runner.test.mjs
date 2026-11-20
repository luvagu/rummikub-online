import test from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../../src/engine/game.js'
import { runner, STALL, FALLBACK } from '../../src/services/runner.js'

// A started 15s game whose turn is the human's (seat 0), with a controllable clock. Timers are mocked, and Date.now is
// driven by hand so a freeze (the clock jumps while no timer fires) can be simulated.
const setup = t => {
	t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
	let now = 1_000_000
	t.mock.method(Date, 'now', () => now)
	const g = new Game()
	g.join('h', 'Host')
	g.act('h', { t: 'bot' })
	g.s.opts.timer = 15
	g.act('h', { t: 'start' })
	g.s.holdUntil = 0
	g.s.turn = 0
	g.s.t0 = now
	g.s.players[1].bot = false // keep the bot out of the way: only the clock work is under test
	const pushes = []
	const run = runner(g, () => (pushes.push(g.s.seq), run()), () => {})
	run()
	const advance = ms => {
		// time passes normally: second by second, so the heartbeat sees no gap
		for (let i = 0; i < ms / 1000; i++) {
			now += 1000
			t.mock.timers.tick(1000)
		}
	}
	const freeze = ms => {
		now += ms // the device slept: the clock moved but no timer ran
	}
	return { g, run, advance, freeze, tick: ms => t.mock.timers.tick(ms), pushes, now: () => now }
}

test('the host draws for a human who ran out of time, FALLBACK after the deadline', t => {
	const { g, advance, run } = setup(t)
	const seq = g.s.seq
	advance(15000 + FALLBACK - 1000)
	assert.equal(g.s.seq, seq, 'not yet')
	advance(2000)
	assert.notEqual(g.s.seq, seq, 'drawn for')
	run.stop()
})

test('after a freeze the turn gets its clock back instead of being drawn for', t => {
	const { g, advance, freeze, tick, run } = setup(t)
	const seq = g.s.seq
	advance(5000)
	freeze(60000) // phone locked for a minute: far past the deadline
	tick(1000) // the backup timer / heartbeat wake up
	assert.equal(g.s.seq, seq, 'the turn was not drawn for')
	assert.ok(Date.now() - g.s.t0 < 2000, 'the clock was restarted')
	// and the restarted clock is then enforced as usual
	advance(15000 + FALLBACK + 1000)
	assert.notEqual(g.s.seq, seq)
	run.stop()
})

test('the grace is once per turn, and a short stall does not count', t => {
	const { g, advance, freeze, tick, run } = setup(t)
	const seq = g.s.seq
	advance(2000)
	freeze(STALL - 1000) // busy, not frozen
	tick(1000)
	const t0 = g.s.t0
	assert.equal(t0, 1_000_000, 'clock untouched')
	freeze(STALL + 5000)
	tick(1000)
	const t1 = g.s.t0
	assert.ok(t1 > t0, 'first freeze: grace')
	freeze(STALL + 5000)
	tick(1000)
	assert.equal(g.s.t0, t1, 'second freeze in the same turn: no second grace')
	assert.equal(g.s.seq, seq)
	run.stop()
})

test('guard() is what a message or the host\'s own move calls first', t => {
	const { g, freeze, run } = setup(t)
	const seq = g.s.seq
	freeze(30000) // frozen; the first thing to wake is an incoming timeout from a guest
	assert.equal(run.guard(), true)
	g.act(g.s.players[g.s.turn].id, { t: 'timeout' })
	assert.equal(g.s.seq, seq, 'that timeout is early against the restarted clock and is ignored')
	run.stop()
})
