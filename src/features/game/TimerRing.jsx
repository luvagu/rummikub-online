import { useLayoutEffect, useRef, useState } from 'react'

// The turn timer, drawn along the active seat's pill outline (the amber border): a dim track plus a coloured stroke that
// drains clockwise. Colour (--ring-c) and time left (--left, 0-100) come from the parent .seat; see .tring in game.css.
// SVG rx/ry clamp per axis (a huge rx gives an ellipse, not a pill), so the radius is the pill's measured half-height.
export default function TimerRing() {
	const ref = useRef(null)
	const [r, setR] = useState(0)
	useLayoutEffect(() => {
		const seat = ref.current?.parentElement
		if (!seat) return
		const measure = () => setR(Math.max(0, (seat.offsetHeight - 1) / 2)) // the svg sits 0.5px outside the padding box
		measure()
		if (typeof ResizeObserver === 'undefined') return
		const ro = new ResizeObserver(measure)
		ro.observe(seat)
		return () => ro.disconnect()
	}, [])
	return (
		<svg ref={ref} className='tring' aria-hidden='true' focusable='false'>
			<rect className='tr-track' width='100%' height='100%' rx={r} ry={r} />
			<rect className='tr-fill' width='100%' height='100%' rx={r} ry={r} pathLength='100' />
		</svg>
	)
}
