// Table colours: which felt the app wears. The colours themselves live in src/styles/tables.css (three seeds per theme);
// this file only knows the ids, the saved choice and how to apply it to the page.
import { local } from '../../utils/store.js'

export const TABLES = ['emerald', 'midnight', 'burgundy', 'slate', 'plum', 'teal'] // keep in step with tables.css and `table.<id>` in i18n
export const DEFAULT_TABLE = TABLES[0]
const KEY = 'rmkFelt' // index.html reads the same key before first paint

export const parseTable = v => (TABLES.includes(v) ? v : DEFAULT_TABLE)
export const loadTable = () => parseTable(local.get(KEY))
export const saveTable = id => (id === DEFAULT_TABLE ? local.remove(KEY) : local.set(KEY, id))

// The header colour of a theme as #rrggbb, for <meta name="theme-color"> (iOS tints the status bar from it). It is read
// from CSS (the `--hud` of the matching .tdot swatch) so the colour has a single source, and converted through a canvas
// because the computed value is an oklch() string that not every browser accepts in a meta tag. Returns null if the
// browser cannot resolve it (the meta then keeps its last value).
let probe
export function hudHex(id) {
	try {
		if (!probe) {
			probe = document.createElement('i')
			probe.className = 'tdot'
			probe.hidden = true
			probe.style.backgroundColor = 'var(--hud)'
		}
		probe.dataset.t = id
		document.body.append(probe) // hidden elements still compute styles; it must be in the document to resolve var()
		const css = getComputedStyle(probe).backgroundColor
		probe.remove()
		const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
		ctx.canvas.width = ctx.canvas.height = 1
		ctx.fillStyle = '#000'
		ctx.fillStyle = css // an unparsable colour is ignored, leaving black: tell it from a real black by the alpha-free check below
		ctx.fillRect(0, 0, 1, 1)
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
		if (r + g + b === 0) return null
		return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
	} catch {
		return null
	}
}

// Put a table colour on the page: the attribute CSS keys off, and the browser chrome (status bar / address bar) colour.
export function applyTable(id) {
	id = parseTable(id)
	const root = document.documentElement
	if (id === DEFAULT_TABLE) delete root.dataset.table
	else root.dataset.table = id
	const hex = hudHex(id)
	const meta = document.querySelector('meta[name="theme-color"]')
	if (meta && hex) meta.content = hex
}
