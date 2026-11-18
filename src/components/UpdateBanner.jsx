import { TopLayer } from './TopLayer.jsx'
import { useT } from '../i18n/index.js'
import { useUpdate, applyUpdate, dismissUpdate } from '../services/sw-update.js'

// "A new version is ready": shown only while a new service worker is waiting. Reloading is the player's call, so a game is
// never interrupted; `hidden` keeps it out of the way while the connection banner is up.
export function UpdateBanner({ hidden }) {
	const t = useT(),
		update = useUpdate()
	if (!update || hidden) return null
	return (
		<TopLayer className='banner update' role='status'>
			{t('updateReady')}
			<button className='primary' onClick={applyUpdate}>
				{t('updateNow')}
			</button>
			<button onClick={dismissUpdate}>{t('updateLater')}</button>
		</TopLayer>
	)
}
