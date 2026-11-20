import { LogOut } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { useT } from '../i18n/index.js'

// Confirmation before leaving (or, for the host, ending) a room, a solo game or the tutorial. The wording depends on the
// mode: a solo game or a lesson is not a "room".
export function LeaveDialog({ mode, phase, onYes, onNo }) {
	const t = useT(),
		lobby = phase === 'lobby',
		offline = mode === 'solo' || mode === 'tutorial'
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
		<ConfirmDialog
			title={offline ? t('leaveGameT') : t('leaveT')}
			body={t(msg)}
			icon={LogOut}
			cancel={t('stay')}
			confirm={mode === 'host' ? t('endAll') : t('confirmLeave')}
			onCancel={onNo}
			onConfirm={onYes}
		/>
	)
}
