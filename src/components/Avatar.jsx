import { Bot } from 'lucide-react'

// A seat's avatar: the player's initial on their seat colour (data-seat, tokens.css --seat-*), or a robot for a bot (four
// bots no longer all read "B"). Decorative (aria-hidden): the name next to it, and the badge's own label where it matters,
// carry the meaning.
export const Avatar = ({ name, i, badge, bot }) => (
	<span className='av' data-seat={i % 4} aria-hidden='true'>
		{bot ? <Bot size={18} strokeWidth={2.25} /> : (name || '?').trim().charAt(0).toUpperCase()}
		{badge != null && <span className='bd'>{badge}</span>}
	</span>
)
