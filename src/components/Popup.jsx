import { useEffect, useRef } from 'react'

// Native popover for menus and pickers: light dismiss, Escape, top layer and focus return to the trigger come from the
// browser; the trigger opens it declaratively (command="toggle-popover" commandfor=id) and anchor positioning places it.
// React only mirrors open/closed (for aria-expanded) and adds what the platform does not: arrow keys between items.
const ITEM = 'button:not(:disabled)'
const STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
export function Popup({ id, className, role = 'menu', label, onOpenChange, children }) {
	const ref = useRef()
	useEffect(() => {
		const el = ref.current,
			on = e => {
				onOpenChange?.(e.newState === 'open')
				if (e.newState === 'open') el.querySelector(ITEM)?.focus({ preventScroll: true }) // land on the first item
			}
		el.addEventListener('toggle', on)
		return () => el.removeEventListener('toggle', on)
	}, [onOpenChange])
	const onKeyDown = e => {
		const items = [...ref.current.querySelectorAll(ITEM)]
		if (!items.length) return
		const i = items.indexOf(document.activeElement)
		let n
		if (e.key in STEP) n = (i + STEP[e.key] + items.length) % items.length
		else if (e.key === 'Home') n = 0
		else if (e.key === 'End') n = items.length - 1
		else return
		e.preventDefault()
		items[n].focus()
	}
	return (
		<div ref={ref} id={id} popover='auto' className={className} role={role} aria-label={label} onKeyDown={onKeyDown}>
			{children}
		</div>
	)
}
export const hidePopup = id => document.getElementById(id)?.hidePopover?.()
