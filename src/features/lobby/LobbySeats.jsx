import { useId } from 'react'
import { Bot, Crown, WifiOff, X, Plus } from 'lucide-react'
import { useT } from '../../i18n/index.js'
import { Avatar } from '../../components/Avatar.jsx'
import { LevelMenu } from '../../components/LevelMenu.jsx'

// Players panel: the four seats with role pills. Only the first open seat carries the host's bot controls
// (difficulty of the next bot + "Add bot" as one split control); the other open seats stay quiet.
// The lobby shows it as a panel; between rounds it sits `bare` inside the summary's Room section, whose summary line
// already gives the count, so the panel chrome and header drop away.
export function LobbySeats({ s, net, host, bare }) {
	const t = useT(),
		h = useId(),
		n = s.players.length
	return (
		<section
			className={'lb-panel lb-players' + (bare ? ' bare' : '')}
			aria-labelledby={bare ? undefined : h}
			aria-label={bare ? t('players') : undefined}
		>
			{!bare && (
				<header className='lb-panelhead'>
					<h2 id={h} className='lb-eyebrow'>
						{t('players')}
					</h2>
					<span className='lb-count'>
						<span className='lb-dots' aria-hidden='true'>
							{[0, 1, 2, 3].map(i => (
								<i key={i} data-on={i < n || undefined} />
							))}
						</span>
						{n}/4
					</span>
				</header>
			)}
			<ul className='lb-seats'>
				{[0, 1, 2, 3].map(i => {
					const p = s.players[i]
					if (p)
						return (
							<li key={p.id} className='lb-seat' data-off={p.on === false || undefined}>
								<Avatar name={p.name} i={i} bot={p.bot} />
								<span className='lb-name'>
									{p.name}
									{i === s.me && <em> {t('you')}</em>}
								</span>
								<span className='lb-pills'>
									{i === 0 && (
										<span className='lb-pill host'>
											<Crown size={14} aria-hidden='true' />
											{t('roleHost')}
										</span>
									)}
									{p.bot && !p.left && (
										<span className='lb-pill'>
											<Bot size={14} aria-hidden='true' />
											{t('lvl' + (p.lvl || 3))}
										</span>
									)}
									{p.on === false && (
										<span className='lb-pill off'>
											<WifiOff size={14} aria-hidden='true' />
											{t('roleOff')}
										</span>
									)}
								</span>
								{host && i > 0 && (p.bot || p.on === false) && (
									<button
										className='icon lb-rm'
										aria-label={t(p.bot ? 'rmBot' : 'rmPlayer') + ' ' + p.name}
										title={t(p.bot ? 'rmBot' : 'rmPlayer')}
										onClick={() => net.send({ t: 'unbot', id: p.id })}
									>
										<X size={16} />
									</button>
								)}
							</li>
						)
					const adder = host && i === n
					return (
						<li key={'e' + i} className='lb-seat empty' data-add={adder || undefined}>
							<span className='av ghost' />
							{adder ? (
								<span className='lb-split'>
									<LevelMenu
										className='inseat'
										value={s.opts.lvl || 3}
										onChange={l => net.send({ t: 'opts', lvl: l })}
										label={t('botLvlNext')}
									/>
									<button
										className='lb-addbot'
										onClick={() =>
											net.send({ t: 'bot', name: t('botName', { lvl: t('lvl' + (s.opts.lvl || 3)) }) })
										}
									>
										<Plus size={16} aria-hidden='true' />
										{t('addBot')}
									</button>
								</span>
							) : (
								<span className='lb-open'>{t('waiting')}</span>
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}
