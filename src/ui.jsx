import { useState, useEffect, useRef, useContext } from 'react'
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

// Accessible dialog: Escape closes, focus moves in and is trapped, and returns to the opener on close.
export function Modal({ title, onClose, children, felt }) {
	const ref = useRef()
	useEffect(() => {
		const prev = document.activeElement,
			el = ref.current
		const foc = () => [
			...el.querySelectorAll(
				'button:not(:disabled),a[href],input,[tabindex="0"]',
			),
		]
		;(el.querySelector('[data-autofocus]') || foc()[0] || el).focus({
			preventScroll: true,
		})
		const k = e => {
			if (e.key === 'Escape' && onClose) {
				e.stopPropagation()
				onClose()
			}
			if (e.key === 'Tab') {
				const f = foc()
				if (!f.length) return
				const a = f[0],
					z = f[f.length - 1]
				if (e.shiftKey && document.activeElement === a) {
					e.preventDefault()
					z.focus()
				} else if (!e.shiftKey && document.activeElement === z) {
					e.preventDefault()
					a.focus()
				}
			}
		}
		document.addEventListener('keydown', k)
		return () => {
			document.removeEventListener('keydown', k)
			prev && prev.focus && prev.focus()
		}
	}, [])
	return (
		<div
			className='modal'
			onMouseDown={e => e.target === e.currentTarget && onClose && onClose()}
		>
			<div
				className={'card' + (felt ? ' felt' : '')}
				role='dialog'
				aria-modal='true'
				aria-label={title}
				ref={ref}
				tabIndex={-1}
			>
				{onClose && (
					<button className='icon xbtn' aria-label='×' onClick={onClose}>
						<X size={18} />
					</button>
				)}
				{children}
			</div>
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
	return (
		<div className='toasts' aria-live='polite'>
			{list.map(x => {
				const Ic = I[x.type] || Info
				return (
					<div key={x.id} className={'toast ' + x.type}>
						<Ic size={18} />
						<span>{tr(t, x.m)}</span>
					</div>
				)
			})}
		</div>
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
