// Fixed set of table reactions. Only the key travels over the wire; each player sees the label in their own language (i18n key `r.<k>`).
// `a` is the CSS animation class suffix (see .rx-* in styles.css).
export const REACTIONS = [
	{ k: 'gg', e: '👏', a: 'clap' },
	{ k: 'nice', e: '😎', a: 'bounce' },
	{ k: 'wow', e: '😮', a: 'zoom' },
	{ k: 'haha', e: '😂', a: 'shake' },
	{ k: 'scared', e: '😱', a: 'shake' },
	{ k: 'hmm', e: '🤔', a: 'tilt' },
	{ k: 'hurry', e: '⏳', a: 'flip' },
	{ k: 'fire', e: '🔥', a: 'bounce' },
	{ k: 'rage', e: '😤', a: 'rumble' },
]
export const RKEYS = new Set(REACTIONS.map(r => r.k))
export const RLEGACY = { oops: 'scared', sad: 'fire' } // keys sent by older clients
export const RCOOL = 1200 // ms between reactions from the same player (client button + host check)

const pick = a => a[(Math.random() * a.length) | 0]
const CHAT = { 1: 0.22, 2: 0.18, 3: 0.14, 4: 0.08, 5: 0.06 } // chance a bot reacts after a turn, by difficulty: beginners chat more, experts stay quiet

// Bots react only sporadically, based on what just happened. ctx = {lvl, played, drew, left, oppMin}
export function botReact({
	lvl = 3,
	played = 0,
	drew = false,
	left = 99,
	oppMin = 99,
}) {
	if (left === 0) return pick(['haha', 'nice', 'gg']) // went out: always celebrates
	if (Math.random() > (CHAT[lvl] || 0.15)) return null
	if (oppMin <= 3 && Math.random() < 0.6)
		return pick(['scared', 'wow', 'rage', 'hurry'])
	if (played >= 3) return pick(['fire', 'nice', 'haha', 'wow'])
	if (played > 0) return pick(['nice', 'hmm', 'gg'])
	if (drew) return pick(['scared', 'hmm', 'rage'])
	return null
}
