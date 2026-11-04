import { useEffect, useRef, useContext } from 'react'
import { X, CircleCheck, TriangleAlert, Info, Languages } from 'lucide-react'
import { COLORS, T } from './game.js'
import { useT, tr, LangCtx } from './i18n.js'

export const Tile = ({ id, sel, num, onClick }) => {
	const t = useT(),
		x = T(id)
	return (
		<button
			className={'tile' + (sel ? ' sel' : '') + (x.j ? ' joker' : '')}
			data-c={x.c}
			style={{ '--tc': x.j ? '#7b1fa2' : COLORS[x.c] }}
			aria-pressed={!!sel}
			aria-label={x.j ? t('joker') : `${x.n} ${t('c' + x.c)}`}
			onClick={onClick}
		>
			<span className='n'>{x.j ? '☺' : x.n}</span>
			{x.j ? num ? <small>{num}</small> : null : <i className='mk' />}
		</button>
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
export function Modal({ title, onClose, children }) {
	const ref = useRef()
	useEffect(() => {
		const prev = document.activeElement,
			el = ref.current
		const foc = () => [
			...el.querySelectorAll(
				'button:not(:disabled),a[href],input,[tabindex="0"]',
			),
		]
		;(el.querySelector('[data-autofocus]') || foc()[0] || el).focus()
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
				className='card'
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
