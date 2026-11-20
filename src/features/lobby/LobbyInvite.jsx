import { useState, useId } from 'react'
import { Copy, Check, Link2, Share2 } from 'lucide-react'
import { useT } from '../../i18n/index.js'
import { WhatsApp } from '../../components/Invite.jsx'
import { CopyBubble, useAnchorName } from '../../components/CopyBubble.jsx'

// Invite panel: the room code as one big copy target (each character on a paper tile, like the game pieces),
// then the share actions. Copy feedback is a bubble on the button (CopyBubble.jsx); the app's live region announces it.
export function LobbyInvite({ net, copy, share, whatsappUrl }) {
	const t = useT(),
		h = useId(),
		aCode = useAnchorName(),
		aLink = useAnchorName(),
		[done, setDone] = useState('') // 'code' | 'link' (copied), 'code!' | 'link!' (failed)
	const doCopy = async w => {
		setDone((await copy(w)) ? w : w + '!')
		setTimeout(() => setDone(''), 1800)
	}
	return (
		<section className='lb-panel lb-invite' aria-labelledby={h}>
			<h2 id={h} className='lb-eyebrow'>
				{t('roomCode')}
			</h2>
			<button
				className='lb-code'
				aria-label={`${t('copyCode')}: ${net.code}`}
				title={t('copyCode')}
				style={{ anchorName: aCode }}
				onClick={() => doCopy('code')}
			>
				<span className='lb-tiles' aria-hidden='true'>
					{[...net.code].map((c, i) => (
						<span key={i} className='lb-tile'>
							{c}
						</span>
					))}
				</span>
				<span className='lb-codeicon' aria-hidden='true'>
					{done === 'code' ? <Check size={20} /> : <Copy size={20} />}
				</span>
			</button>
			<div className='lb-actions'>
				<button className='primary' style={{ anchorName: aLink }} onClick={() => doCopy('link')}>
					{done === 'link' ? <Check size={18} /> : <Link2 size={18} />}
					{done === 'link' ? t('copied') : t('copy')}
				</button>
				{whatsappUrl && (
					<a
						className='btn wa'
						href={whatsappUrl}
						target='_blank'
						rel='noopener noreferrer'
						aria-label={t('whatsapp')}
						title={t('whatsapp')}
					>
						<WhatsApp />
						<span className='lb-lbl'>{t('whatsapp')}</span>
					</a>
				)}
				{navigator.share && (
					<button onClick={share} aria-label={t('share')} title={t('share')}>
						<Share2 size={18} />
						<span className='lb-lbl'>{t('share')}</span>
					</button>
				)}
			</div>
			<p className='lb-hint'>{t('inviteHint')}</p>
			<CopyBubble anchor={aCode} state={done === 'code' ? 'ok' : done === 'code!' ? 'err' : ''} t={t} />
			{/* the link button already says "Copied"; its bubble only reports a failure */}
			<CopyBubble anchor={aLink} state={done === 'link!' ? 'err' : ''} t={t} />
		</section>
	)
}
