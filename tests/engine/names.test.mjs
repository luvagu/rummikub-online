import test from 'node:test'
import assert from 'node:assert/strict'
import { NAME_MAX, cleanName } from '../../src/engine/names.js'
import { Game } from '../../src/engine/game.js'

test('the limit is 14', () => assert.equal(NAME_MAX, 14))

test('cleanName: trims, collapses whitespace, cuts to the limit', () => {
	assert.equal(cleanName('  Luis  '), 'Luis')
	assert.equal(cleanName('Ana   María\t\nPaz'), 'Ana María Paz')
	assert.equal(cleanName('x'.repeat(40)), 'x'.repeat(14))
	assert.equal(cleanName('Henniellys'), 'Henniellys')
	assert.equal(cleanName('1234567890123 5'), '1234567890123', 'no trailing space left by the cut')
})

test('cleanName: never splits an emoji or an accent, counts code points', () => {
	assert.equal(cleanName('😀'.repeat(20)), '😀'.repeat(14))
	assert.equal([...cleanName('é'.repeat(20))].length, 14)
	assert.equal(cleanName('é'.repeat(3)), 'é'.repeat(3), 'combined to one character')
})

test('cleanName: nothing usable gives an empty string', () => {
	for (const v of ['', '   ', null, undefined, 42, {}]) assert.equal(cleanName(v), '')
})

test('Game.join is the authority: a long name arrives cut, a rename too, a blank one is kept as "?"', () => {
	const g = new Game()
	g.join('a', 'A'.repeat(40))
	assert.equal(g.s.players[0].name, 'A'.repeat(14))
	g.join('a', 'B'.repeat(30)) // an existing player's hello again, with a longer name
	assert.equal(g.s.players[0].name, 'B'.repeat(14))
	g.join('a', '   ')
	assert.equal(g.s.players[0].name, 'B'.repeat(14), 'a blank rename changes nothing')
	g.join('b', '')
	assert.equal(g.s.players[1].name, '?')
})

test('bot names keep room for the level word and a number, but are bounded', () => {
	const g = new Game()
	g.join('h', 'Host')
	g.act('h', { t: 'bot', name: 'Intermediate Bot' })
	g.act('h', { t: 'bot', name: 'Intermediate Bot' })
	assert.deepEqual(g.s.players.slice(1).map(p => p.name), ['Intermediate Bot', 'Intermediate Bot 2'])
	g.act('h', { t: 'bot', name: 'Z'.repeat(60) })
	assert.equal(g.s.players[3].name.length, 18)
})
