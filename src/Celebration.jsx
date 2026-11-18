import { useState, useEffect, useEffectEvent, useRef } from 'react'
import { Trophy } from 'lucide-react'
import { TopLayer } from './ui.jsx'
import { useT } from './i18n.js'
import { CELEBRATE_MS, REDUCED_MS, confettiPieces } from './celebrate.js'

// Winner celebration shown for up to 3 s right before the round summary opens: confetti plus the winner's name on a highlighted
// card. It lives in a top-layer popover, so it stays above any open dialog. `onDone` fires once (timer, tap, Skip or key).
// With reduced motion there is no confetti and no pop-in: a still card for REDUCED_MS.
export default function Celebration({ c, onDone }) {
	const t = useT(),
		layer = useRef(),
		[still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
	const finish = useEffectEvent(onDone) // for the timer and the key listener (effects); click handlers call onDone directly

	useEffect(() => {
		const id = setTimeout(finish, still ? REDUCED_MS : CELEBRATE_MS) // one timer: no reliance on animationend
		const key = e => {
			if (document.querySelector('dialog[open]')) return // Escape belongs to an open dialog
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish()
		}
		addEventListener('keydown', key)
		return () => {
			clearTimeout(id)
			removeEventListener('keydown', key)
		}
	}, [still])

	// Confetti: the pieces are created once and animated with transform + opacity only (compositor, no layout or paint per frame).
	// Removing the elements on cleanup cancels their animations.
	useEffect(() => {
		if (still) return
		const root = layer.current,
			nodes = confettiPieces(innerWidth, innerHeight).map(p => {
				const el = document.createElement('i')
				el.className = p.round ? 'cf r' : 'cf'
				el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background:${p.color}`
				const at = (d, r) => `translate(${d.dx}px,${d.dy}px) rotate(${r}deg)`
				el.animate(
					[
						{ transform: at({ dx: 0, dy: 0 }, 0), opacity: 1, easing: p.burst ? 'ease-out' : 'linear' },
						{ transform: at(p.mid, p.rot * 0.4), opacity: 1, offset: 0.4, easing: p.burst ? 'ease-in' : 'linear' },
						{ transform: at(p.end, p.rot), opacity: 1, offset: 0.85 },
						{ transform: at(p.end, p.rot), opacity: 0 },
					],
					{ duration: p.dur, delay: p.delay, fill: 'both' },
				)
				root.append(el)
				return el
			})
		return () => nodes.forEach(n => n.remove())
	}, [still])

	return (
		<TopLayer className='celebrate' onClick={onDone}>
			<div className='confetti' ref={layer} aria-hidden='true' />
			<div className='cel-card' aria-hidden='true'>
				<Trophy size={44} className='gold' />
				{!c.mine && <small>{t('roundWinner')}</small>}
				<b className='cel-name'>{c.mine ? t('youWin') : c.name}</b>
				<span>{c.blocked ? t('celebPool') : t('celebRummikub')}</span>
			</div>
			<button
				className='cel-skip'
				onClick={e => {
					e.stopPropagation()
					onDone()
				}}
			>
				{t('skipAnim')}
			</button>
		</TopLayer>
	)
}
