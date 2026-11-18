import { useLayoutEffect, useRef } from 'react'

// A manual popover shown for as long as it is mounted. Modal <dialog>s live in the top layer and paint above any z-index,
// so toasts and the offline banner join the top layer too (later promotion = painted on top) to stay visible over them.
export function TopLayer({ children, ...props }) {
	const ref = useRef()
	useLayoutEffect(() => {
		const el = ref.current
		el.showPopover()
		return () => el.matches(':popover-open') && el.hidePopover()
	}, [])
	return (
		<div ref={ref} popover='manual' {...props}>
			{children}
		</div>
	)
}
