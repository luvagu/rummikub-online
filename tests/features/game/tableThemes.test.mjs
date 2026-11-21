// Table colours: the CSS seeds, the ids, the labels and the contrast of every theme must agree. The CSS is parsed as text
// (like tablePatterns.test.mjs), so this runs without a browser; it replaces re-checking each theme by eye.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TABLES, DEFAULT_TABLE, parseTable } from '../../../src/features/game/tableTheme.js'
import { en } from '../../../src/i18n/en.js'
import { es } from '../../../src/i18n/es.js'

const read = f => readFileSync(new URL('../../../src/styles/' + f, import.meta.url), 'utf8')
const tokens = read('tokens.css')
const tables = read('tables.css')

// ---- parse: theme seeds and the felt roles ----
const seeds = {}
for (const m of tables.matchAll(/:is\(:root\[data-table='(\w+)'\], \.tdot\[data-t='\1'\]\) \{([^}]*)\}/g)) {
	const v = n => Number(new RegExp(`--table-${n}:\\s*(-?[\\d.]+)`).exec(m[2])[1])
	seeds[m[1]] = { h: v('h'), c: v('c'), l: v('l') }
}
// --felt: oklch(calc(L + var(--table-l)) calc(C * var(--table-c)) <hue>)  with hue = var(--table-h) or calc(var(--table-h) +/- n)
const ROLE = /--(felt[\w-]*):\s*oklch\(calc\(([\d.]+) \+ var\(--table-l\)\) calc\(([\d.]+) \* var\(--table-c\)\) (?:var\(--table-h\)|calc\(var\(--table-h\) ([+-]) (\d+)\))\)/g
const roles = {}
for (const m of tokens.matchAll(ROLE)) roles[m[1]] = { L: +m[2], C: +m[3], off: m[4] ? (m[4] === '-' ? -1 : 1) * +m[5] : 0 }

// ---- colour maths: oklch -> linear sRGB, WCAG contrast ----
const oklch = (L, C, H) => {
	const h = (H * Math.PI) / 180,
		a = C * Math.cos(h),
		b = C * Math.sin(h)
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
		m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
		s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	]
}
const hexLin = h => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
const inGamut = v => v.every(x => x >= -0.002 && x <= 1.002)
const lum = v => { const c = v.map(x => Math.min(1, Math.max(0, x))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const toHex = v => '#' + v.map(x => { const c = Math.min(1, Math.max(0, x)); const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(g * 255).toString(16).padStart(2, '0') }).join('')
const role = (name, t) => { const r = roles[name], s = seeds[t]; return oklch(r.L + s.l, r.C * s.c, s.h + r.off) }
const WHITE = [1, 1, 1]
const token = n => hexLin(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)[1])

test('the parser found every felt role and every theme', () => {
	assert.deepEqual(Object.keys(roles).sort(), ['felt', 'felt-card', 'felt-card-hi', 'felt-coach', 'felt-deep', 'felt-edge', 'felt-field', 'felt2'])
	assert.deepEqual(Object.keys(seeds), TABLES)
})

test('one CSS theme, one swatch, one English and one Spanish name per id, and nothing stale', () => {
	for (const id of TABLES) {
		assert.ok(tables.includes(`.tdot[data-t='${id}']`), `${id}: swatch seeds`)
		for (const [name, tr] of [['en', en], ['es', es]]) assert.ok(tr['table.' + id], `${name}.table.${id}`)
	}
	for (const [name, tr] of [['en', en], ['es', es]]) {
		assert.ok(tr.table, `${name}.table`)
		const stale = Object.keys(tr).filter(k => k.startsWith('table.') && !TABLES.includes(k.slice(6)))
		assert.deepEqual(stale, [], `${name}: stale table names`)
	}
})

test('emerald is the default and its seeds equal the registered initial values, so the default needs no attribute', () => {
	assert.equal(DEFAULT_TABLE, 'emerald')
	const init = n => Number(new RegExp(`@property --table-${n} \\{[^}]*initial-value:\\s*(-?[\\d.]+)`).exec(tokens)[1])
	assert.deepEqual(seeds.emerald, { h: init('h'), c: init('c'), l: init('l') })
})

test('emerald still reproduces the original palette (within 2/255 per channel)', () => {
	const was = { felt: '#1b5e20', felt2: '#2e7d32', 'felt-deep': '#12361a', 'felt-edge': '#14471a', 'felt-card': '#1f5f24', 'felt-card-hi': '#3b7f3f', 'felt-field': '#0d2a12', 'felt-coach': '#14301a' }
	for (const [n, hex] of Object.entries(was)) {
		const got = toHex(role(n, 'emerald'))
		for (let i = 1; i < 7; i += 2) assert.ok(Math.abs(parseInt(got.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)) <= 2, `${n}: ${got} vs ${hex}`)
	}
})

test('every role of every theme stays inside sRGB (no silent clipping)', () => {
	for (const t of TABLES) for (const n of Object.keys(roles)) assert.ok(inGamut(role(n, t)), `${t} ${n} is out of gamut`)
})

test('contrast: white text, tiles, buttons, seat chips and timer ring on every felt', () => {
	for (const t of TABLES) {
		const f = n => role(n, t)
		// text (4.5:1): the header, menus and dialogs are white on these
		for (const n of ['felt2', 'felt-edge', 'felt-deep', 'felt-card', 'felt-field', 'felt-coach']) assert.ok(ratio(WHITE, f(n)) >= 4.5, `${t}: white on ${n} = ${ratio(WHITE, f(n)).toFixed(2)}`)
		// non-text (3:1): tiles, the amber action colour, the timer ring and the seat chips against the header / board
		assert.ok(ratio(token('paper'), f('felt')) >= 3, `${t}: tile face on the felt`)
		assert.ok(ratio(token('amber'), f('felt-edge')) >= 3, `${t}: amber on the header`)
		for (const c of ['ring-ok', 'ring-red']) assert.ok(ratio(hexLin(new RegExp(`--${c}:\\s*(#[0-9a-f]{6})`).exec(tokens)[1]), f('felt-edge')) >= 3, `${t}: ${c} on the header`)
		for (const i of [0, 1, 2, 3]) assert.ok(ratio(token('seat-' + i), f('felt-edge')) >= 3, `${t}: seat chip ${i} on the header`)
		// an invalid set's red border is only a hint (it also carries a "!" mark, and emerald itself is 2.5:1): never worse than that
		assert.ok(ratio(token('danger'), f('felt')) >= 2.4, `${t}: red border on the felt`)
	}
})

test('the menu swatch reads the same header colour as the felt-edge token', () => {
	const hud = /--hud:\s*oklch\(calc\(([\d.]+) \+ var\(--table-l\)\) calc\(([\d.]+) \* var\(--table-c\)\) var\(--table-h\)\)/.exec(tables)
	assert.ok(hud, '--hud in tables.css')
	assert.deepEqual([+hud[1], +hud[2], 0], [roles['felt-edge'].L, roles['felt-edge'].C, roles['felt-edge'].off])
})

test('felt colours never sit inside repeating-*-gradient stops (Firefox drops the whole gradient)', () => {
	for (const f of ['game.css', 'base.css', 'home.css', 'lobby.css', 'surfaces.css', 'components.css'])
		assert.doesNotMatch(read(f), /repeating-(linear|radial|conic)-gradient\([^;]*var\(--felt/, f)
})

test('no hard-coded felt greens are left outside the tokens', () => {
	for (const f of ['game.css', 'base.css', 'home.css', 'lobby.css', 'surfaces.css', 'components.css'])
		assert.doesNotMatch(read(f), /#(1f5f24|3b7f3f|2e7d32|14471a|1b5e20|12361a|0d2a12|14301a)\b/i, f)
})

test('parseTable: ids pass through, anything else means the default', () => {
	for (const id of TABLES) assert.equal(parseTable(id), id)
	for (const v of [null, undefined, '', 'banana', 'Midnight', '0']) assert.equal(parseTable(v), DEFAULT_TABLE)
})
