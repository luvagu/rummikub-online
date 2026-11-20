import { useId } from 'react'
import { BookOpen, LogOut, LoaderCircle } from 'lucide-react'
import { useT } from '../../i18n/index.js'
import { LangButton } from '../../components/LangButton.jsx'
import { LobbyInvite } from './LobbyInvite.jsx'
import { LobbySeats } from './LobbySeats.jsx'
import { LobbyTimer } from './LobbyTimer.jsx'

// Room lobby. Top bar (leave / rules / language), then three panels (invite, players, turn timer) and a sticky
// action bar with the one primary action. Layout is container-driven: see src/styles/lobby.css.
export function Lobby({ s, net, copy, share, whatsappUrl, leave, openRules }) {
	const t = useT(),
		status = useId(),
		host = s.me === 0,
		ready = s.players.length >= 2
	return (
		<main className='lobby'>
			<div className='lb-shell'>
				<h1 className='sr'>Rummikub · {t('room')}</h1>
				<header className='lb-bar'>
					<button className='lb-ghost' onClick={leave}>
						<LogOut size={16} aria-hidden='true' />
						{t('leave')}
					</button>
					<div className='lb-bar-end'>
						<button className='lb-ghost lb-rules' onClick={openRules} aria-label={t('readRules')} title={t('readRules')}>
							<BookOpen size={16} aria-hidden='true' />
							<span>{t('readRules')}</span>
						</button>
						<LangButton />
					</div>
				</header>
				<div className='lb-grid'>
					<LobbyInvite net={net} copy={copy} share={share} whatsappUrl={whatsappUrl} />
					<LobbySeats s={s} net={net} host={host} />
					<LobbyTimer
						value={s.opts.timer}
						host={host}
						onChange={n => net.send({ t: 'opts', timer: n })}
					/>
				</div>
				<footer className='lb-actionbar'>
					<p id={status} className='lb-status'>
						{host ? (
							ready ? (
								t('keep')
							) : (
								t('need2')
							)
						) : (
							<>
								<LoaderCircle className='spin' size={18} aria-hidden='true' />
								{t('waitHost')}
							</>
						)}
					</p>
					{host && (
						<button
							className='primary big lb-start'
							disabled={!ready}
							aria-describedby={status}
							onClick={() => net.send({ t: 'start' })}
						>
							{t('start', { n: s.players.length })}
						</button>
					)}
				</footer>
			</div>
		</main>
	)
}
