// Tiles glide between the rack and the table (View Transitions) when the player moves them with a tap or a button.
//
// Only tiles fully visible inside their scroller (board or rack) get a view-transition-name, and only for the duration of
// one move: the snapshots are drawn in an overlay above the page, so a tile scrolled out of view would otherwise flash
// over the header or the action bar while it moved. Names are set here, imperatively, rather than by React, because a tile
// that moves from the rack to the table is a new element and the names must be unique at each moment.
//
// Progressive: without View Transitions, with reduced motion, or during a drag (the drag preview already shows the move),
// the update simply runs.
import { flushSync } from 'react-dom'
import { prefersReducedMotion } from './motion.js'

const supported = () => typeof document.startViewTransition === 'function'

function visibleTiles() {
	const out = []
	for (const el of document.querySelectorAll('.game .tile[data-id]')) {
		const box = el.closest('.board, .rack')
		if (!box) continue
		const r = el.getBoundingClientRect(),
			b = box.getBoundingClientRect()
		if (r.width && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1) out.push(el)
	}
	return out
}
const name = els => els.forEach(el => (el.style.viewTransitionName = 't' + el.dataset.id))
const clear = () => document.querySelectorAll('.game .tile').forEach(el => (el.style.viewTransitionName = ''))

let running = null

// While a move animates, the tiles themselves are not hit-testable (the browser shows their snapshots instead), so a
// click lands on the rack or the set around them: callers then find the tile under the pointer by its position.
export const tilesMoving = () => running != null

export function withTileTransition(update) {
	if (!supported() || prefersReducedMotion() || document.documentElement.classList.contains('dragging')) return update()
	running?.skipTransition() // a quick second move: finish the first one at once rather than queueing animations
	clear()
	name(visibleTiles())
	try {
		const vt = document.startViewTransition(() => {
			clear()
			flushSync(update)
			name(visibleTiles())
		})
		running = vt
		vt.finished.finally(() => {
			if (running === vt) running = null
			clear()
		})
	} catch {
		clear()
		update()
	}
}
