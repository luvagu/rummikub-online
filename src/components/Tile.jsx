import { memo } from 'react'
import { COLORS, T } from '../engine/game.js'
import { useT } from '../i18n/index.js'

// A tile is a plain <button> with only primitive props and no handlers, so React.memo can skip it unless its own state
// changed. Clicks and drags are handled once, by delegation, on the game root (see Game.jsx).
export const Tile = memo(function Tile({ id, sel, num, fresh, placed, ghost, enter, hide, rove }) {
	const t = useT(),
		x = T(id)
	return (
		<button
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
			tabIndex={rove ? 0 : -1}
			aria-pressed={!!sel}
			aria-label={x.j ? (num ? `${t('joker')} ${num}` : t('joker')) : `${x.n} ${t('c' + x.c)}`}
		>
			<span className='n'>{x.j ? '☺' : x.n}</span>
			{x.j ? num ? <small>{num}</small> : null : <i className='mk' />}
		</button>
	)
})
