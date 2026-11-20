// A guest's committing move (draw / end turn / timeout) is only known to have worked once the host's next state shows the
// turn moved on. The relay can drop a message the host never saw (host frozen or reconnecting, clean MQTT sessions), so the
// move is resent until that state arrives. This is safe because every move carries the turn it was made for (`q`): the
// host drops a copy that arrives after the first one (or after the turn moved on) without applying it twice.
export function makePending(resend, giveUp, { every = 2500, max = 3 } = {}) {
	let cur = null,
		t = 0
	const stop = () => {
		clearTimeout(t)
		t = 0
		cur = null
	}
	const tick = () => {
		t = 0
		if (!cur) return
		if (cur.n >= max) {
			const m = cur.m
			stop()
			return giveUp(m)
		}
		cur.n++
		resend(cur.m)
		t = setTimeout(tick, every)
	}
	return {
		// start waiting for the host to confirm `m` (replaces whatever was pending: a new move supersedes the old)
		track(m) {
			stop()
			cur = { m, n: 0 }
			t = setTimeout(tick, every)
		},
		// a state arrived: if its turn id differs from the move's, the host applied it (or the turn moved on): done
		settle(seq) {
			if (cur && seq !== cur.m.q) stop()
		},
		// the host answered the move with an error: it did see it
		clear: stop,
		// the connection came back: the host may have missed it, resend now (does not use up a retry)
		nudge() {
			if (cur) resend(cur.m)
		},
		get active() {
			return !!cur
		},
	}
}
