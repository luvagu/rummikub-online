// Fixed set of table reactions. Only the key travels over the wire; each player sees the label in their own language (i18n key `r.<k>`).
// `a` is the CSS animation class suffix (see .rx-* in styles.css).
export const REACTIONS = [
	{ k: 'gg', e: '👏', a: 'clap' },
	{ k: 'nice', e: '😎', a: 'bounce' },
	{ k: 'wow', e: '😮', a: 'zoom' },
	{ k: 'haha', e: '😂', a: 'shake' },
	{ k: 'oops', e: '😅', a: 'sway' },
	{ k: 'hmm', e: '🤔', a: 'tilt' },
	{ k: 'hurry', e: '⏳', a: 'flip' },
	{ k: 'sad', e: '😢', a: 'drop' },
	{ k: 'rage', e: '😤', a: 'rumble' },
]
export const RKEYS = new Set(REACTIONS.map(r => r.k))
export const RCOOL = 1200 // ms between reactions from the same player (client button + host check)

const pick = a => a[(Math.random() * a.length) | 0]
const CHAT = { 1: 0.22, 2: 0.15, 3: 0.08 } // chance a bot reacts after a turn, by difficulty: beginners chat more, experts stay quiet

// Bots react only sporadically, based on what just happened. ctx = {lvl, played, drew, left, oppMin}
export function botReact({ lvl = 2, played = 0, drew = false, left = 99, oppMin = 99 }) {
	if (left === 0) return pick(['haha', 'nice', 'gg']) // went out: always celebrates
	if (Math.random() > (CHAT[lvl] || 0.15)) return null
	if (oppMin <= 3 && Math.random() < 0.6) return pick(['wow', 'rage', 'hurry'])
	if (played >= 3) return pick(['nice', 'haha', 'wow'])
	if (played > 0) return pick(['nice', 'hmm', 'gg'])
	if (drew) return pick(['sad', 'hmm', 'oops', 'rage'])
	return null
}
