import { useState, useEffect, useRef } from 'react'
import { Bot, ChevronDown, Check, Crown, WifiOff, X, Plus } from 'lucide-react'
import { useT } from './i18n.js'
import { Avatar } from './ui.jsx'

export function LevelMenu({ value, onChange, label, className = '' }) {
	const t = useT(),
		[open, setOpen] = useState(false),
		ref = useRef(null)
	useEffect(() => {
		if (!open) return
		const down = e => ref.current && !ref.current.contains(e.target) && setOpen(false),
			key = e => e.key === 'Escape' && setOpen(false)
		document.addEventListener('pointerdown', down)
		document.addEventListener('keydown', key)
		return () => {
			document.removeEventListener('pointerdown', down)
			document.removeEventListener('keydown', key)
		}
	}, [open])
	return (
		<div className={'menuwrap lvlmenu ' + className} ref={ref}>
			<button
				className='lvlbtn'
				aria-haspopup='listbox'
				aria-expanded={open}
				aria-label={label}
				title={label}
				onClick={() => setOpen(v => !v)}
			>
				<Bot size={16} />
				<span>{t('lvl' + value)}</span>
				<ChevronDown size={16} />
			</button>
			{open && (
				<div className='menu lvlpop' role='listbox' aria-label={label}>
					{[1, 2, 3].map(n => (
						<button
							key={n}
							role='option'
							aria-selected={value === n}
							onClick={() => {
								onChange(n)
								setOpen(false)
							}}
						>
							<span>
								<b>{t('lvl' + n)}</b>
								<small>{t('lvlD' + n)}</small>
							</span>
							{value === n && <Check size={16} />}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

// The four seat rows shared by the lobby and the between-rounds dialog. The host also gets the bot controls:
// an X on every bot, and on the first empty seat the difficulty of the next bot plus "Add bot".
export function Seats({ s, net, host }) {
	const t = useT()
	return (
		<ul className='lseats'>
			{[0, 1, 2, 3].map(i => {
				const p = s.players[i]
				return p ? (
					<li key={p.id} className={'lseat' + (p.on === false ? ' off' : '')}>
						<Avatar name={p.name} i={i} />
						<b>
							{p.name}
							{i === s.me && <em> {t('you')}</em>}
						</b>
						{i === 0 && <Crown size={16} aria-label={t('host')} />}
						{p.bot && <Bot size={16} aria-label={t('bot')} />}
						{p.bot && !p.left && <small className='lvltag'>{t('lvl' + (p.lvl || 2))}</small>}
						{p.on === false && <WifiOff size={16} aria-label={t('off')} />}
						{host && p.bot && (
							<button
								className='icon'
								aria-label={t('rmBot') + ' ' + p.name}
								title={t('rmBot')}
								onClick={() => net.send({ t: 'unbot', id: p.id })}
							>
								<X size={16} />
							</button>
						)}
					</li>
				) : (
					<li key={'e' + i} className='lseat empty'>
						<span className='av ghost' />
						{host && i === s.players.length ? (
							<LevelMenu
								className='inseat'
								value={s.opts.lvl || 2}
								onChange={n => net.send({ t: 'opts', lvl: n })}
								label={t('botLvlNext')}
							/>
						) : (
							<span>{t('waiting')}</span>
						)}
						{host && i === s.players.length && (
							<button onClick={() => net.send({ t: 'bot' })}>
								<Plus size={16} />
								<Bot size={16} />
								{t('addBot')}
							</button>
						)}
					</li>
				)
			})}
		</ul>
	)
}
