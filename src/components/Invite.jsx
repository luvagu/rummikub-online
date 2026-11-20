import { useState } from 'react'
import { Copy, Check, Link2, Share2 } from 'lucide-react'
import { useT } from '../i18n/index.js'

// Room code + copy / share buttons. Used in the lobby and in the round-over dialog (inviting someone between rounds).
// lucide-react ships no brand icons, so the WhatsApp glyph is inline.
const WhatsApp = ({ size = 18 }) => (
	<svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
		<path d='M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.36A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.13 15.07l-.3-.18-3.08.8.82-3-.2-.31A8.1 8.1 0 0 1 12.04 3.8zM8.6 7.5c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.07 3.3 5.1 4.5 2.52 1 3.03.8 3.57.75.55-.05 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35s-1.77-.87-2.04-.97c-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.65-1.62-.92-2.2-.22-.5-.45-.5-.65-.51z' />
	</svg>
)

export function Invite({ net, copy, share, whatsappUrl }) {
	const t = useT(),
		[done, setDone] = useState('')
	const doCopy = async w => {
		if (await copy(w)) {
			setDone(w)
			setTimeout(() => setDone(''), 1800)
		}
	}
	return (
		<>
			<div className='codechip'>
				<span className='codetxt' aria-label={net.code}>
					{net.code}
				</span>
				<button
					className='icon'
					aria-label={t('copyCode')}
					title={t('copyCode')}
					onClick={() => doCopy('code')}
				>
					{done === 'code' ? <Check size={20} /> : <Copy size={20} />}
				</button>
			</div>
			<div className='row'>
				<button className='primary' onClick={() => doCopy('link')}>
					{done === 'link' ? <Check size={18} /> : <Link2 size={18} />}
					{done === 'link' ? t('copied') : t('copy')}
				</button>
				{whatsappUrl && (
					<a
						className='btn wa'
						href={whatsappUrl}
						target='_blank'
						rel='noopener noreferrer'
					>
						<WhatsApp />
						{t('whatsapp')}
					</a>
				)}
				{navigator.share && (
					<button onClick={share}>
						<Share2 size={18} />
						{t('share')}
					</button>
				)}
			</div>
			<p className='sub'>{t('inviteHint')}</p>
		</>
	)
}
