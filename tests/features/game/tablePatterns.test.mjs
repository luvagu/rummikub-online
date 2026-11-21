// Table patterns: the CSS rules, the labels and the Shuffle helpers must agree on how many patterns there are.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BGS, SHUFFLE, parseBgMode, nextBgMode, pickBg } from '../../../src/features/game/display.js'
import { en } from '../../../src/i18n/en.js'
import { es } from '../../../src/i18n/es.js'

const css = readFileSync(new URL('../../../src/styles/game.css', import.meta.url), 'utf8')

test('one .board.bgN rule per pattern, ids contiguous', () => {
	const ids = [...css.matchAll(/\.board\.bg(\d+)\s*\{/g)].map(m => +m[1])
	assert.deepEqual(ids, [...Array(BGS).keys()])
})

test('every pattern has an English and Spanish name, and no stale ones remain', () => {
	for (const [name, tr] of [['en', en], ['es', es]]) {
		for (let i = 0; i < BGS; i++) assert.ok(tr['bg' + i], `${name}.bg${i}`)
		assert.ok(tr.bgShuffle, `${name}.bgShuffle`)
		assert.equal(tr['bg' + BGS], undefined, `${name}.bg${BGS} is stale`)
	}
})

test('parseBgMode: ids pass through, anything else (missing, junk, legacy out-of-range) means Shuffle', () => {
	assert.equal(parseBgMode(null), SHUFFLE)
	assert.equal(parseBgMode('s'), SHUFFLE)
	assert.equal(parseBgMode('banana'), SHUFFLE)
	assert.equal(parseBgMode(String(BGS)), SHUFFLE)
	assert.equal(parseBgMode('-1'), SHUFFLE)
	assert.equal(parseBgMode('0'), 0)
	assert.equal(parseBgMode(String(BGS - 1)), BGS - 1)
})

test('nextBgMode walks Shuffle, 0 .. BGS-1 and back to Shuffle', () => {
	let m = SHUFFLE
	const seen = []
	for (let i = 0; i <= BGS; i++) {
		seen.push(m)
		m = nextBgMode(m)
	}
	assert.deepEqual(seen, [SHUFFLE, ...Array(BGS).keys()])
	assert.equal(m, SHUFFLE)
})

test('pickBg is in range, never repeats the last pattern, and can reach every other one', () => {
	for (let last = -1; last < BGS; last++) {
		const got = new Set()
		for (let k = 0; k < 200; k++) {
			const v = pickBg(last, () => k / 200)
			assert.ok(Number.isInteger(v) && v >= 0 && v < BGS, `in range (${v})`)
			assert.notEqual(v, last)
			got.add(v)
		}
		assert.equal(got.size, last < 0 ? BGS : BGS - 1)
	}
	assert.ok(pickBg(3) !== 3, 'default random source works')
})

test('repeating gradients in the patterns use rgb(), not oklch() (Firefox drops them otherwise)', () => {
	const last = css.indexOf(`.board.bg${BGS - 1} {`)
	const block = css.slice(css.indexOf('.board.bg0 {'), css.indexOf('\n\t}\n', last))
	const repeating = block.match(/repeating-(?:linear|radial)-gradient\((?:[^()]|\([^()]*\))*\)/g) ?? []
	assert.ok(repeating.length > 0, 'the patterns still use repeating gradients')
	for (const g of repeating) assert.doesNotMatch(g, /oklch\(/, g)
})
