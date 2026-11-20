import test from 'node:test'
import assert from 'node:assert/strict'
import { makePending } from '../../src/services/pending.js'

const setup = opts => {
	const sent = [],
		gaveUp = []
	const p = makePending(m => sent.push(m), m => gaveUp.push(m), opts)
	return { p, sent, gaveUp }
}

test('a move that is never confirmed is resent, then reported once', t => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const { p, sent, gaveUp } = setup({ every: 1000, max: 3 })
	const m = { t: 'end', q: 7 }
	p.track(m)
	t.mock.timers.tick(1000)
	t.mock.timers.tick(1000)
	t.mock.timers.tick(1000)
	assert.equal(sent.length, 3)
	assert.ok(sent.every(x => x === m), 'the very same move (same turn id) is resent')
	assert.equal(gaveUp.length, 0)
	t.mock.timers.tick(1000)
	assert.deepEqual(gaveUp, [m])
	assert.equal(p.active, false)
	t.mock.timers.tick(10000)
	assert.equal(sent.length, 3, 'nothing more after giving up')
})

test('a state for a later turn confirms the move; a state for the same turn does not', t => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const { p, sent, gaveUp } = setup({ every: 1000, max: 3 })
	p.track({ t: 'draw', q: 4 })
	p.settle(4) // some other event in the same turn
	assert.equal(p.active, true)
	t.mock.timers.tick(1000)
	assert.equal(sent.length, 1)
	p.settle(5) // the host moved on: it got the move
	assert.equal(p.active, false)
	t.mock.timers.tick(10000)
	assert.equal(sent.length, 1)
	assert.equal(gaveUp.length, 0)
})

test('an error from the host, or a reconnect, is handled', t => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const { p, sent } = setup({ every: 1000, max: 3 })
	p.track({ t: 'end', q: 1 })
	p.nudge() // the link came back: say it again right away
	assert.equal(sent.length, 1)
	p.clear() // the host answered with an error, so it did see the move
	p.nudge()
	t.mock.timers.tick(10000)
	assert.equal(sent.length, 1)
})

test('a new move supersedes the pending one', t => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const { p, sent } = setup({ every: 1000, max: 3 })
	p.track({ t: 'draw', q: 1 })
	p.track({ t: 'end', q: 2 })
	t.mock.timers.tick(1000)
	assert.deepEqual(sent, [{ t: 'end', q: 2 }])
})
