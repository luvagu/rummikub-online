import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-react'
import { tr } from '../i18n/index.js'
import { TOP_LAYER_EVENT, modalOpen } from './Modal.jsx'

const ICON = { ok: CircleCheck, err: TriangleAlert, warn: TriangleAlert, info: Info }
const NOTIFY = typeof document !== 'undefined' && 'ariaNotify' in document

// The toaster: an always-mounted manual popover at the bottom of the screen (above the action dock in a game). Each toast
// has a tone chip, its message (×N when it repeats), a dismiss button and a draining line: the line is a CSS animation
// whose end dismisses the toast, so hovering or focusing the stack pauses it (surfaces.css). Toasts wait while a modal
// dialog is open (the stack is hidden, its countdowns frozen) and appear once it closes.
//
// Announcing: ariaNotify() where supported; otherwise two always-mounted visually-hidden live regions (a live region that
// is display:none until shown is not reliably announced). Errors interrupt, the rest are polite. `quiet` entries are only
// announced, never drawn (feedback already shown elsewhere, like the copy bubble).
export function Toasts({ list, t, onDismiss, onGone }) {
	const ref = useRef(),
		seen = useRef(new Set()),
		[blocked, setBlocked] = useState(modalOpen)
	useEffect(() => {
		const f = () => setBlocked(modalOpen())
		addEventListener(TOP_LAYER_EVENT, f)
		return () => removeEventListener(TOP_LAYER_EVENT, f)
	}, [])
	const shown = list.filter(x => !x.quiet),
		visible = shown.length > 0 && !blocked
	useLayoutEffect(() => {
		const el = ref.current,
			open = el.matches(':popover-open')
		if (visible && !open) el.showPopover()
		else if (!visible && open) el.hidePopover()
	}, [visible])
	// a leaving toast collapses (about 200 ms), then goes
	useEffect(() => {
		const gone = list.filter(x => x.leaving).map(x => x.id)
		if (!gone.length) return
		const id = setTimeout(() => onGone(gone), 260)
		return () => clearTimeout(id)
	}, [list])
	useEffect(() => {
		if (!NOTIFY) return
		for (const x of list) {
			const k = x.id + ':' + x.n
			if (x.leaving || seen.current.has(k)) continue
			seen.current.add(k)
			document.ariaNotify(tr(t, x.m), { priority: x.type === 'err' ? 'high' : 'normal' })
		}
	}, [list])
	const say = pred => {
		if (NOTIFY) return ''
		const x = list.findLast(y => !y.leaving && pred(y))
		return x ? tr(t, x.m) : ''
	}
	// dismissing a focused toast moves focus to the next one, rather than dropping it on the page
	const dismiss = (id, e) => {
		const li = e?.currentTarget.closest('li'),
			next = li && (li.nextElementSibling || li.previousElementSibling)
		if (li?.contains(document.activeElement)) next?.querySelector('button')?.focus()
		onDismiss(id)
	}
	return (
		<>
			<div className='sr' role='status'>
				{say(x => x.type !== 'err')}
			</div>
			<div className='sr' role='alert'>
				{say(x => x.type === 'err')}
			</div>
			<section ref={ref} popover='manual' className='toaster' aria-label={t('notifs')}>
				<ol>
					{shown.map(x => {
						const Ic = ICON[x.type] || Info
						return (
							<li key={x.id} className={'toast ' + x.type} data-leaving={x.leaving || undefined}>
								<span className='tchip' aria-hidden='true'>
									<Ic size={17} />
								</span>
								<span className='tmsg'>
									{tr(t, x.m)}
									{x.n > 1 && <span className='tn'>×{x.n}</span>}
								</span>
								<button className='icon tclose' aria-label={t('dismiss')} onClick={e => dismiss(x.id, e)}>
									<X size={16} />
								</button>
								{!x.leaving && (
									<i
										key={x.n}
										className='tbar'
										aria-hidden='true'
										style={{ '--life': x.life + 'ms' }}
										onAnimationEnd={() => onDismiss(x.id)}
									/>
								)}
							</li>
						)
					})}
				</ol>
			</section>
		</>
	)
}
