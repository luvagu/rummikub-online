import { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useT } from '../i18n/index.js'

// Modal dialog on the native <dialog> element: it provides the top layer, inert page, focus containment, Escape and
// focus return to the opener. React stays in charge of visibility: every close request (Escape, back gesture,
// click outside) is cancelled and handed to onClose, and dialogs without onClose (e.g. "connecting") cannot be dismissed.
const LIGHT_DISMISS = 'closedBy' in HTMLDialogElement.prototype // not in Safari yet: handled with the pointer fallback below
const outside = (e, d) => {
	// test the pointer position, not e.target: the <dialog> itself is the target for its own padding and gaps
	const r = d.getBoundingClientRect()
	return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
}
// iOS (notably the installed PWA) lets a drag on the backdrop or on a short dialog scroll whatever lies behind it, whatever
// overscroll-behavior says. So a touch drag is only let through when it scrolls something inside the dialog that still has
// room to move in that direction; everything else is swallowed.
function trapTouchScroll(d) {
	let y0 = 0
	const start = e => {
		y0 = e.touches[0].clientY
	}
	const canScroll = (el, dy) => {
		// dy > 0: finger moves down (content scrolls up); dy < 0: finger moves up
		const { overflowY } = getComputedStyle(el)
		if (!/auto|scroll/.test(overflowY) || el.scrollHeight <= el.clientHeight) return false
		return dy > 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1
	}
	const move = e => {
		if (e.touches.length > 1) return // pinch
		const dy = e.touches[0].clientY - y0
		for (let el = e.target; el instanceof Element; el = el.parentElement) {
			if (canScroll(el, dy)) return
			if (el === d) break
		}
		if (e.cancelable) e.preventDefault()
	}
	d.addEventListener('touchstart', start, { passive: true })
	d.addEventListener('touchmove', move, { passive: false })
	return () => {
		d.removeEventListener('touchstart', start)
		d.removeEventListener('touchmove', move)
	}
}
export function Modal({ title, onClose, children, felt }) {
	const t = useT(),
		ref = useRef(),
		pressedOutside = useRef(false)
	useLayoutEffect(() => {
		const d = ref.current
		if (!d.open) d.showModal()
		// the first focusable element (the close button) is focused by default; a dialog can name a safer/primary target
		d.querySelector('[data-autofocus]')?.focus({ preventScroll: true })
		const untrap = trapTouchScroll(d)
		return () => {
			untrap()
			d.close() // runs before React removes the node, so the browser returns focus to the opener
		}
	}, [])
	return (
		<dialog
			ref={ref}
			className={'card' + (felt ? ' felt' : '')}
			aria-label={title}
			closedby={onClose ? 'any' : 'none'}
			onCancel={e => {
				e.preventDefault()
				onClose?.()
			}}
			onPointerDown={e => {
				pressedOutside.current = !LIGHT_DISMISS && !!onClose && outside(e, ref.current)
			}}
			onPointerUp={e => {
				// require press AND release outside, so a text-selection drag that ends on the backdrop does not dismiss
				if (pressedOutside.current && outside(e, ref.current)) onClose()
				pressedOutside.current = false
			}}
		>
			{onClose && (
				<button className='icon xbtn' aria-label={t('close')} onClick={onClose}>
					<X size={18} />
				</button>
			)}
			{children}
		</dialog>
	)
}
