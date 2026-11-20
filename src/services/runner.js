// Host-side clock work, shared by the online host and solo play: lets bots take their turns after a short "thinking" delay,
// and enforces the turn timer even if the player's own browser is gone (a client sends the precise timeout first; this is
// the fallback).
import { botReact } from '../engine/reactions.js'

export const STALL = 4000 // no beat for this long = the device was asleep / the tab frozen, not just busy
export const FALLBACK = 3000 // the host's own timeout comes this long after the turn's deadline

export const runner = (game, push, react) => {
	let bt = 0,
		tt = 0,
		seq = -1,
		dueAt = 0,
		beat = Date.now(),
		graced = -1
	const quiet = {} // per-bot cooldown so bots never spam
	// A frozen host (phone locked, tab suspended) cannot have taken anyone's move, yet every deadline kept running, so on
	// waking it would draw for whoever's turn it is. When the gap since the last beat says the host was frozen, the current
	// turn gets its clock back (once per turn). Every way in checks this first (the backup timer, the heartbeat, an incoming
	// message, the host's own client), so it does not matter which of them wakes up first.
	const guard = () => {
		const now = Date.now(),
			gap = now - beat,
			s = game.s
		beat = now
		if (gap <= STALL || s.phase !== 'play' || !s.opts.timer || graced === s.seq) return false
		graced = s.seq
		game.grace()
		push() // clients restart their countdown from the new state
		return true
	}
	const fire = () => {
		tt = 0
		if (guard()) return
		const g = game.s,
			p = g.players[g.turn]
		if (g.seq !== seq || g.phase !== 'play' || p.bot) return
		const left = g.t0 + g.opts.timer * 1000 + FALLBACK - Date.now()
		if (left > 0) return (tt = setTimeout(fire, left)) // the clock moved (grace)
		game.act(p.id, { t: 'timeout' })
		push()
	}
	const run = () => {
		const s = game.s
		if (!bt && game.botDue())
			bt = setTimeout(() => {
				bt = 0
				const r = game.botPlay()
				push()
				const k = r && botReact(r),
					now = Date.now()
				if (k && (r.left === 0 || now - (quiet[r.id] || 0) > 20000)) {
					quiet[r.id] = now
					setTimeout(() => react(r.id, k), 350 + Math.random() * 600)
				}
			}, game.hold() + 700 + Math.random() * 1100) // varied "thinking" time, starting once the deal is over
		if (s.phase !== 'play' || !s.opts.timer) {
			clearTimeout(tt)
			seq = -1
			dueAt = 0
			return
		}
		// t0 already includes the deal hold, so the deadline is absolute (not "so long after we noticed")
		const due = s.t0 + s.opts.timer * 1000 + FALLBACK
		if (s.seq !== seq || due !== dueAt) {
			seq = s.seq
			dueAt = due
			clearTimeout(tt)
			tt = setTimeout(fire, Math.max(0, due - Date.now()))
		}
	}
	const hb = setInterval(guard, 1000)
	run.guard = guard
	run.stop = () => {
		clearTimeout(bt)
		clearTimeout(tt)
		clearInterval(hb)
		bt = tt = 0
	}
	return run
}
