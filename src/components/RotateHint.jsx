import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { TopLayer } from './TopLayer.jsx'
import { useT } from '../i18n/index.js'

// Portrait-only on phones and tablets. Installed Android apps are locked by the manifest's "orientation"; iOS/iPadOS ignore
// that field and have no screen.orientation.lock(), so the installed app covers itself with this notice while sideways.
// It only covers the page: the game keeps running underneath and nothing is lost. Mounted on the change (not just hidden by
// CSS) so it joins the top layer after any open <dialog> and paints above it.
const MQ = '(display-mode: standalone) and (orientation: landscape) and (hover: none) and (pointer: coarse)'

export function RotateHint() {
	const t = useT(),
		[on, setOn] = useState(() => matchMedia(MQ).matches)
	useEffect(() => {
		const m = matchMedia(MQ),
			f = () => setOn(m.matches)
		m.addEventListener('change', f)
		return () => m.removeEventListener('change', f)
	}, [])
	if (!on) return null
	return (
		<TopLayer className='rotate-hint' role='alert' keepOnTop>
			<RotateCw size={48} aria-hidden='true' />
			<p>{t('rotate')}</p>
		</TopLayer>
	)
}
