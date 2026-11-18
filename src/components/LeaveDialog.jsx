import { Modal } from './Modal.jsx'
import { useT } from '../i18n/index.js'

// Confirmation before leaving (or, for the host, ending) a room, a solo game or the tutorial. The wording depends on the mode.
export function LeaveDialog({ mode, phase, onYes, onNo }) {
	const t = useT(),
		lobby = phase === 'lobby'
	const msg =
		mode === 'tutorial'
			? 'lv.tutorial'
			: mode === 'solo'
				? 'lv.solo'
				: mode === 'host'
					? lobby
						? 'lv.hostLobby'
						: 'lv.hostPlay'
					: lobby
						? 'lv.guestLobby'
						: 'lv.guestPlay'
	return (
		<Modal title={t('leaveT')} onClose={onNo}>
			<h2>{t('leaveT')}</h2>
			<p>{t(msg)}</p>
			<div className='row'>
				<button data-autofocus onClick={onNo}>
					{t('stay')}
				</button>
				<button className='primary danger' onClick={onYes}>
					{mode === 'host' ? t('endAll') : t('confirmLeave')}
				</button>
			</div>
		</Modal>
	)
}
