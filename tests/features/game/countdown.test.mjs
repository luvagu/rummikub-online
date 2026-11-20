import test from 'node:test'
import assert from 'node:assert/strict'
import { timeoutDue } from '../../../src/features/game/countdown.js'

const base = { my: true, secs: 0, dl: 1000, now: 1000, sent: false }

test('sends once the turn clock has really run out', () => {
	assert.equal(timeoutDue(base), true)
	assert.equal(timeoutDue({ ...base, now: 1500 }), true)
})

test('a stale 0 from the previous turn does not send: the new deadline is still in the future', () => {
	assert.equal(timeoutDue({ ...base, dl: 46000, now: 1000 }), false)
})

test('never sends when it is not my turn, already sent, untimed or not yet 0', () => {
	assert.equal(timeoutDue({ ...base, my: false }), false)
	assert.equal(timeoutDue({ ...base, sent: true }), false)
	assert.equal(timeoutDue({ ...base, dl: null }), false)
	assert.equal(timeoutDue({ ...base, secs: 3 }), false)
})
