import { useState } from 'react'
import { Copy, Check, Link2, Share2 } from 'lucide-react'
import { useT } from '../i18n/index.js'

// Room code + copy / share buttons. Used in the lobby and in the round-over dialog (inviting someone between rounds).
export function Invite({ net, copy, share }) {
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
