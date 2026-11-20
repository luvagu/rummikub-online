import { useEffect, useLayoutEffect, useRef } from 'react'
import { TOP_LAYER_EVENT } from './Modal.jsx'

// A manual popover in the top layer, shown while `open` (default: for as long as it is mounted). Modal <dialog>s live in
// the top layer too and paint above any z-index, so a later promotion is painted on top.
// - Staying mounted with open={false} lets it animate out (surfaces.css: display/overlay transitions).
// - `keepOnTop`: something that must stay visible (the connection pill, the rotate notice) re-promotes itself when a
//   dialog opens after it, instead of disappearing under that dialog's backdrop.
export function TopLayer({ children, open = true, keepOnTop, ...props }) {
	const ref = useRef()
	useLayoutEffect(() => {
		const el = ref.current,
			shown = el.matches(':popover-open')
		if (open && !shown) el.showPopover()
		else if (!open && shown) el.hidePopover()
	}, [open])
	useLayoutEffect(() => {
		const el = ref.current
		return () => el.matches(':popover-open') && el.hidePopover()
	}, [])
	useEffect(() => {
		if (!keepOnTop) return
		const lift = () => {
			const el = ref.current
			if (!el?.matches(':popover-open') || !document.querySelector('dialog:modal')) return
			el.hidePopover() // hide + show in the same task: no paint in between, just a newer place in the top layer
			el.showPopover()
		}
		addEventListener(TOP_LAYER_EVENT, lift)
		return () => removeEventListener(TOP_LAYER_EVENT, lift)
	}, [keepOnTop])
	return (
		<div ref={ref} popover='manual' {...props}>
			{children}
		</div>
	)
}
