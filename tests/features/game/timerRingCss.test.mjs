// The turn-timer ring drains through stroke-dashoffset. Firefox drops `calc(100 - var(--left))` (a bare number inside calc()
// is not valid there), which left the ring full all turn, while Chrome and Safari accepted it. Keep the value a length.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../../../src/styles/game.css', import.meta.url), 'utf8')

test('the ring drains through a length, not a bare number', () => {
	const decl = [...css.matchAll(/stroke-dashoffset:\s*([^;]+);/g)].map(m => m[1].trim())
	assert.ok(decl.length > 0, 'the ring still sets stroke-dashoffset')
	for (const v of decl) assert.match(v, /\*\s*1px\)?$/, `"${v}" must end in a length unit (x * 1px)`)
})
