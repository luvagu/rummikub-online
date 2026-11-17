import { useState, useEffect, useLayoutEffect, useRef, useContext } from 'react'
import {
	X,
	CircleCheck,
	TriangleAlert,
	Info,
	Languages,
	Copy,
	Check,
	Link2,
	Share2,
} from 'lucide-react'
import { COLORS, T } from './game.js'
import { useT, tr, LangCtx } from './i18n.js'

export const Tile = ({
	id,
	sel,
	num,
	fresh,
	placed,
	ghost,
	enter,
	hide,
	dnd,
	onClick,
}) => {
	const t = useT(),
		x = T(id)
	// Firefox never starts a native drag from a <button>, so while drag & drop is on the tile is a role=button div
	const Tag = dnd ? 'div' : 'button',
		kb = dnd
			? {
					role: 'button',
					tabIndex: 0,
					onKeyDown: e => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault()
							onClick && onClick(e)
						}
					},
				}
			: null
	return (
		<Tag
			{...kb}
			className={
				'tile' +
				(sel ? ' sel' : '') +
				(fresh ? ' fresh' : '') +
				(placed ? ' placed' : '') +
				(ghost ? ' ghost' : '') +
				(enter ? ' enter' : '') +
				(hide ? ' dealhide' : '') +
				(x.j ? ' joker' : '')
			}
			data-c={x.c}
			data-id={id}
			style={{ '--tc': x.j ? '#7b1fa2' : COLORS[x.c] }}
			aria-pressed={!!sel}
			aria-label={x.j ? t('joker') : `${x.n} ${t('c' + x.c)}`}
			onClick={onClick}
			{...dnd}
		>
			<span className='n'>{x.j ? '☺' : x.n}</span>
			{x.j ? num ? <small>{num}</small> : null : <i className='mk' />}
		</Tag>
	)
}

const AV = ['#ffb300', '#81c784', '#4fc3f7', '#f48fb1']
export const Avatar = ({ name, i, badge }) => (
	<span className='av' style={{ background: AV[i % 4] }} aria-hidden='true'>
		{(name || '?').trim().charAt(0).toUpperCase()}
		{badge != null && <span className='bd'>{badge}</span>}
	</span>
)

export const LangBtn = () => {
	const { lang, setLang } = useContext(LangCtx)
	return (
		<button
			className='lang'
			aria-label='Language / Idioma'
			onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
		>
			<Languages size={16} />
			{lang === 'en' ? 'Español' : 'English'}
		</button>
	)
}

// Modal dialog on the native <dialog> element: it provides the top layer, inert page, focus containment, Escape and
// focus return to the opener. React stays in charge of visibility: every close request (Escape, back gesture,
// click outside) is cancelled and handed to onClose, and dialogs without onClose (e.g. "connecting") cannot be dismissed.
const LIGHT_DISMISS = 'closedBy' in HTMLDialogElement.prototype // not in Safari yet: handled with the pointer fallback below
const outside = (e, d) => {
	// test the pointer position, not e.target: the <dialog> itself is the target for its own padding and gaps
	const r = d.getBoundingClientRect()
	return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
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
		return () => d.close() // runs before React removes the node, so the browser returns focus to the opener
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

export const Toasts = ({ list, t }) => {
	const I = {
		ok: CircleCheck,
		err: TriangleAlert,
		warn: TriangleAlert,
		info: Info,
	}
	// The visible stack is aria-hidden; two always-mounted visually-hidden regions do the announcing (a live region
	// that is display:none until shown is not reliably announced). Errors interrupt (alert), the rest are polite.
	const say = pred => {
		const x = list.findLast(pred)
		return x ? tr(t, x.m) : ''
	}
	return (
		<>
			<div className='sr' role='status'>
				{say(x => x.type !== 'err')}
			</div>
			<div className='sr' role='alert'>
				{say(x => x.type === 'err')}
			</div>
			{list.length > 0 && (
				<TopLayer className='toasts' aria-hidden='true'>
					{list.map(x => {
						const Ic = I[x.type] || Info
						return (
							<div key={x.id} className={'toast ' + x.type}>
								<Ic size={18} />
								<span>{tr(t, x.m)}</span>
							</div>
						)
					})}
				</TopLayer>
			)}
		</>
	)
}

// Room code + copy / share buttons. Used in the lobby and in the round-over dialog (inviting someone between rounds).
export function Invite({ net, copy, share }) {
	const t = useT(),
		[done, setDone] = useState('')
	const doCopy = async w => {
		if (await copy(w)) {
			setDone(w)
			setTimeout(() => setDone(''), 1800)
		}
	}
	return (
		<>
			<div className='codechip'>
				<span className='codetxt' aria-label={net.code}>
					{net.code}
				</span>
				<button
					className='icon'
					aria-label={t('copyCode')}
					title={t('copyCode')}
					onClick={() => doCopy('code')}
				>
					{done === 'code' ? <Check size={20} /> : <Copy size={20} />}
				</button>
			</div>
			<div className='row'>
				<button className='primary' onClick={() => doCopy('link')}>
					{done === 'link' ? <Check size={18} /> : <Link2 size={18} />}
					{done === 'link' ? t('copied') : t('copy')}
				</button>
				{navigator.share && (
					<button onClick={share}>
						<Share2 size={18} />
						{t('share')}
					</button>
				)}
			</div>
			<p className='sub'>{t('inviteHint')}</p>
		</>
	)
}
