// Round-winner celebration: the pure parts (no DOM), so they can be unit-tested. src/Celebration.jsx draws them.

export const CELEBRATE_MS = 3000 // confetti + winner card, then the summary dialog opens
export const REDUCED_MS = 2000 // with reduced motion: a still winner card, no confetti
const END_BY = 2800 // every piece has finished (and faded out) before the summary dialog opens

// Who to celebrate, or null. Only a LIVE transition counts: the round was running (`prevPhase === 'play'`) and is now over
// with a winner. A mount that is already in 'over' (reload, late join), a repeat of the same state (reconnect re-push) and a
// round the host cancelled all return null, so nothing is ever replayed.
export function celebrationFor(prevPhase, s) {
	if (prevPhase !== 'play' || s.phase !== 'over') return null
	const r = s.result
	if (!r || r.cancelled) return null
	const p = s.players?.[r.winner]
	// `mine`: this client's player is the winner (view.me is the viewer's own seat), so the card can say "You win!"
	return p ? { id: p.id, name: p.name, index: r.winner, blocked: !!r.blocked, mine: s.me === r.winner } : null
}

// Phones get fewer pieces than a wide desktop (about 45 to 110).
export const pieceCount = width => Math.round(Math.min(110, Math.max(45, width / 12)))

// Light colours only: tile black would vanish on the felt. The first four match the avatar palette.
const PALETTE = ['#ffb300', '#81c784', '#4fc3f7', '#f48fb1', '#fffdf6', '#ff7043']

// Piece specs in px, relative to the viewport. Each piece travels from (x, y) by `mid` then by `end` (offsets from its start).
// 60% rain from the top edge, 40% burst from just above the winner card. `rand` is injectable for deterministic tests.
export function confettiPieces(width, height, rand = Math.random) {
	const n = pieceCount(width),
		bursts = Math.round(n * 0.4),
		out = []
	for (let i = 0; i < n; i++) {
		const burst = i < bursts,
			size = 6 + rand() * 6,
			round = rand() < 0.3,
			delay = Math.round(rand() * (burst ? 150 : 400)),
			dur = Math.round(1500 + rand() * (END_BY - delay - 1500)) // so delay + dur <= END_BY
		let x, y, mid, end
		if (burst) {
			const a = (-160 + rand() * 140) * (Math.PI / 180), // an upward fan
				v = 260 + rand() * 380
			x = width / 2 + (rand() - 0.5) * 40
			y = height * 0.42
			mid = { dx: Math.cos(a) * v * 0.8, dy: Math.sin(a) * v * 0.8 }
			end = { dx: Math.cos(a) * v * 1.4, dy: height - y + 60 } // gravity takes it below the screen
		} else {
			x = rand() * width
			y = -16
			end = { dx: (rand() - 0.5) * 160, dy: height + 40 }
			mid = { dx: end.dx * 0.45, dy: end.dy * 0.4 }
		}
		out.push({
			x: Math.round(x),
			y: Math.round(y),
			mid,
			end,
			rot: Math.round((rand() - 0.5) * 1440),
			w: round ? Math.round(size * 0.8) : Math.round(size),
			h: round ? Math.round(size * 0.8) : Math.round(size * 0.45),
			round,
			burst,
			color: PALETTE[Math.floor(rand() * PALETTE.length)],
			delay,
			dur,
		})
	}
	return out
}
