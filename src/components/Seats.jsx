import { useState, useId } from 'react'
import { Bot, ChevronDown, Check, Crown, WifiOff, X, Plus } from 'lucide-react'
import { useT } from '../i18n/index.js'
import { Avatar } from './Avatar.jsx'
import { Popup, hidePopup } from './Popup.jsx'

export function LevelMenu({ value, onChange, label, className = '' }) {
	const t = useT(),
		id = useId(),
		[open, setOpen] = useState(false)
	return (
		<div className={'menuwrap lvlmenu ' + className}>
			<button
				className='lvlbtn'
				aria-haspopup='listbox'
				aria-expanded={open}
				aria-label={label}
				title={label}
				command='toggle-popover'
				commandfor={id}
			>
				<Bot size={16} />
				<span>{t('lvl' + value)}</span>
				<ChevronDown size={16} />
			</button>
			<Popup id={id} className='menu lvlpop' role='listbox' label={label} onOpenChange={setOpen}>
				{[1, 2, 3, 4, 5].map(n => (
					<button
						key={n}
						role='option'
						aria-selected={value === n}
						onClick={() => {
							onChange(n)
							hidePopup(id)
						}}
					>
						<span>
							<b>{t('lvl' + n)}</b>
							<small>{t('lvlD' + n)}</small>
						</span>
						{value === n && <Check size={16} />}
					</button>
				))}
			</Popup>
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
						{p.bot && !p.left && (
							<small className='lvltag'>{t('lvl' + (p.lvl || 3))}</small>
						)}
						{p.on === false && <WifiOff size={16} aria-label={t('off')} />}
						{host && i > 0 && (p.bot || p.on === false) && (
							<button
								className='icon'
								aria-label={t(p.bot ? 'rmBot' : 'rmPlayer') + ' ' + p.name}
								title={t(p.bot ? 'rmBot' : 'rmPlayer')}
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
								value={s.opts.lvl || 3}
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
