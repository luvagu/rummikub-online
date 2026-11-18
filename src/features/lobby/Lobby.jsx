import { BookOpen, LogOut, LoaderCircle } from 'lucide-react'
import { useT } from '../../i18n/index.js'
import { LangButton } from '../../components/LangButton.jsx'
import { Invite } from '../../components/Invite.jsx'
import { Seats } from '../../components/Seats.jsx'
import { TimerPick } from '../../components/TimerPick.jsx'

export function Lobby({ s, net, copy, share, leave, openRules }) {
	const t = useT(),
		host = s.me === 0
	return (
		<main className='home lobby'>
			<LangButton />
			<p className='sub'>{t('room')}</p>
			<Invite net={net} copy={copy} share={share} />
			<Seats s={s} net={net} host={host} />
			{host ? (
				<>
					<TimerPick
						value={s.opts.timer}
						onChange={n => net.send({ t: 'opts', timer: n })}
					/>
					<button
						className='primary big'
						disabled={s.players.length < 2}
						onClick={() => net.send({ t: 'start' })}
					>
						{t('start', { n: s.players.length })}
					</button>
					<p className='sub'>{s.players.length < 2 ? t('need2') : t('keep')}</p>
				</>
			) : (
				<p className='waitp'>
					<LoaderCircle className='spin' size={18} />
					{t('waitHost')}
				</p>
			)}
			<div className='row'>
				<button className='link' onClick={openRules}>
					<BookOpen size={16} />
					{t('readRules')}
				</button>
				<button className='link' onClick={leave}>
					<LogOut size={16} />
					{t('leave')}
				</button>
			</div>
		</main>
	)
}
