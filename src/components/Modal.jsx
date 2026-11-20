import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { useT } from '../i18n/index.js'
import { focusForInput } from '../utils/modality.js'

// Modal dialog on the native <dialog> element: it provides the top layer, inert page, focus containment, Escape and
// focus return to the opener. React stays in charge of visibility: every close request (Escape, back gesture,
// click outside, the close button) is cancelled and handed to onClose, and dialogs without onClose (e.g. "connecting")
// cannot be dismissed.
//
// Anatomy (surfaces.css): a header (optional icon badge, the title, Back, close), a body that alone scrolls, and an
// optional footer for the actions. `bare` drops the header for dialogs that draw their own (the round summary). On phones
// the same dialog is a bottom sheet. Closing animates: the dialog plays its exit, then onClose unmounts it. Buttons inside
// close the same way through useModal().close(then).
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

// Toasts wait while a modal is open, and the connection banner lifts itself above it (TopLayer.jsx): they listen for this.
export const TOP_LAYER_EVENT = 'toplayerchange'
const announce = () => dispatchEvent(new Event(TOP_LAYER_EVENT))
export const modalOpen = () => !!document.querySelector('dialog:modal')

// Wait for the dialog's exit transition (and its backdrop's), at most 400 ms; none under reduced motion is fine too.
async function playExit(d) {
	d.dataset.closing = ''
	// only time-based ones: the header/footer shadows are scroll-driven and never "finish"
	const anims = d.getAnimations({ subtree: true }).filter(a => a.timeline === document.timeline)
	if (anims.length)
		await Promise.race([Promise.allSettled(anims.map(a => a.finished)), new Promise(r => setTimeout(r, 400))])
}

const ModalCtx = createContext({ close: then => then?.() })
export const useModal = () => useContext(ModalCtx)

export function Modal({ title, onClose, children, felt, icon: Icon, tone, size = 'md', footer, bare, onBack, closeButton = true }) {
	const t = useT(),
		ref = useRef(),
		hid = useId(),
		pressedOutside = useRef(false),
		closing = useRef(false)
	// play the exit, then run `then` (by default onClose, which unmounts the dialog)
	const close = useCallback(
		async (then = onClose) => {
			const d = ref.current
			if (!d || closing.current) return
			closing.current = true
			await playExit(d)
			then?.()
			// still mounted (the action kept the dialog open): show it again
			requestAnimationFrame(() => {
				if (ref.current?.isConnected) {
					delete ref.current.dataset.closing
					closing.current = false
				}
			})
		},
		[onClose],
	)
	useLayoutEffect(() => {
		const d = ref.current
		if (!d.open) d.showModal()
		announce()
		// the first focusable element (the close button) is focused by default; a dialog can name a safer/primary target.
		// Either way the focus ring shows only when the dialog was opened from the keyboard.
		focusForInput(d.querySelector('[data-autofocus]') || (d.contains(document.activeElement) && document.activeElement))
		const untrap = trapTouchScroll(d)
		return () => {
			untrap()
			d.close() // runs before React removes the node, so the browser returns focus to the opener
			queueMicrotask(announce)
		}
	}, [])
	return (
		<dialog
			ref={ref}
			className={'card' + (felt ? ' felt' : '')}
			data-size={size}
			data-tone={tone}
			aria-labelledby={bare ? undefined : hid}
			aria-label={bare ? title : undefined}
			closedby={onClose ? 'any' : 'none'}
			onCancel={e => {
				e.preventDefault()
				if (onClose) close()
			}}
			onPointerDown={e => {
				pressedOutside.current = !LIGHT_DISMISS && !!onClose && outside(e, ref.current)
			}}
			onPointerUp={e => {
				// require press AND release outside, so a text-selection drag that ends on the backdrop does not dismiss
				if (pressedOutside.current && outside(e, ref.current)) close()
				pressedOutside.current = false
			}}
		>
			<ModalCtx.Provider value={{ close }}>
				{!bare && (
					<header className='sf-head'>
						{onBack && (
							<button className='icon sf-back' aria-label={t('back')} onClick={onBack}>
								<ChevronLeft size={20} />
							</button>
						)}
						{Icon && (
							<span className='sf-ico' aria-hidden='true'>
								<Icon size={22} />
							</span>
						)}
						<h2 id={hid}>{title}</h2>
						{onClose && closeButton && (
							<button className='icon xbtn' aria-label={t('close')} onClick={() => close()}>
								<X size={18} />
							</button>
						)}
					</header>
				)}
				<div className='sf-body'>{children}</div>
				{footer && <footer className='sf-foot'>{footer}</footer>}
			</ModalCtx.Provider>
		</dialog>
	)
}
