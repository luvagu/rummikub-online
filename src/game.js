// Rummikub rules engine. Runs only on the host; guests send moves and receive views.
export const COLORS = ['#1b1b1b', '#d32f2f', '#1565c0', '#d97800']
export const DECK = []
{
	let id = 0
	for (let r = 0; r < 2; r++)
		for (let c = 0; c < 4; c++)
			for (let n = 1; n <= 13; n++) DECK.push({ id: id++, n, c })
	DECK.push(
		{ id: id++, n: 0, c: -1, j: true },
		{ id: id++, n: 0, c: -1, j: true },
	)
}
export const T = i => DECK[i]
export const TIMES = [0, 15, 30, 45, 60, 90] // turn timer choices in seconds (0 = off)
const E = (k, p) => ({ k, p }) // translatable message (see i18n.js)
export const val = ids => ids.reduce((a, i) => a + (T(i).j ? 30 : T(i).n), 0)
export const key = a => [...a].sort((x, y) => x - y).join()
// Uniform integer in [0, n) — crypto-backed with rejection sampling (no modulo bias); falls back to Math.random.
const rnd = n => {
	const c = globalThis.crypto
	if (!c || !c.getRandomValues) return (Math.random() * n) | 0
	const lim = 0x100000000 - (0x100000000 % n),
		b = new Uint32Array(1)
	do c.getRandomValues(b)
	while (b[0] >= lim)
	return b[0] % n
}
export const shuffle = (a, r = rnd) => {
	for (let i = a.length - 1; i > 0; i--) {
		const j = r(i + 1)
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

// Validates a set and returns tiles ordered (jokers placed where they stand) + point value.
export function analyze(ids) {
	const ts = ids.map(T),
		nj = ts.filter(t => !t.j),
		js = ts.filter(t => t.j),
		L = ts.length
	const bad = {
		ok: false,
		order: [...nj]
			.sort((a, b) => a.c - b.c || a.n - b.n)
			.concat(js)
			.map(t => t.id),
		nums: null,
		val: 0,
	}
	if (L < 3 || !nj.length) return bad
	if (nj.every(t => t.n === nj[0].n)) {
		// group
		if (L <= 4 && new Set(nj.map(t => t.c)).size === nj.length) {
			const n = nj[0].n
			return {
				ok: true,
				order: [...nj, ...js].map(t => t.id),
				nums: ts.map(() => n),
				val: n * L,
			}
		}
		return bad
	}
	if (
		L <= 13 &&
		nj.every(t => t.c === nj[0].c) &&
		new Set(nj.map(t => t.n)).size === nj.length
	) {
		// run
		const ns = nj.map(t => t.n),
			m = Math.min(...ns),
			M = Math.max(...ns)
		if (M - m + 1 - nj.length <= js.length) {
			const s = Math.min(m, 14 - L),
				order = [],
				nums = [],
				jp = [...js]
			let v = 0
			for (let i = 0; i < L; i++) {
				const n = s + i,
					t = nj.find(x => x.n === n) || jp.pop()
				order.push(t.id)
				nums.push(n)
				v += n
			}
			return { ok: true, order, nums, val: v }
		}
	}
	return bad
}

export class Game {
	constructor(s) {
		const resumed = !!s
		this.s = s || {
			phase: 'lobby',
			players: [],
			board: [],
			pool: [],
			turn: 0,
			seq: 0,
			t0: 0,
			passes: 0,
			log: '',
			opts: { timer: 60, lvl: 3 },
			v: 2,
			scores: {},
			wins: {},
			games: 0,
			result: null,
		}
		if (resumed) this.sanitize()
	}
	join(tok, name) {
		const s = this.s,
			p = s.players.find(p => p.id === tok)
		if (p) {
			if (name) p.name = name
			if (p.left) {
				p.left = false
				p.bot = false
			}
			return true
		}
		if ((s.phase !== 'lobby' && s.phase !== 'over') || s.players.length >= 4)
			return false // new players may also join between rounds (while there are free seats)
		s.players.push({ id: tok, name, rack: [], melded: false, on: true })
		s.scores[tok] = 0
		s.wins[tok] = 0
		return true
	}
	online(tok, b) {
		const p = this.s.players.find(p => p.id === tok)
		if (p && !p.bot) p.on = b
	}
	view(tok) {
		const s = this.s,
			me = s.players.findIndex(p => p.id === tok)
		return {
			phase: s.phase,
			players: s.players.map(p => ({
				id: p.id,
				name: p.name,
				n: p.rack.length,
				melded: p.melded,
				on: p.on,
				bot: p.bot,
				lvl: p.lvl,
			})),
			board: s.board,
			pool: s.pool.length,
			turn: s.turn,
			seq: s.seq,
			log: s.log,
			opts: s.opts,
			scores: s.scores,
			wins: s.wins,
			games: s.games,
			result: s.result,
			me,
			rack: me >= 0 ? s.players[me].rack : [],
			tl:
				s.phase === 'play' && s.opts.timer
					? Math.max(0, s.opts.timer * 1000 - (Date.now() - (s.t0 || 0)))
					: null,
		}
	}
	deal() {
		const s = this.s,
			d = shuffle(DECK.map(t => t.id))
		s.players.forEach(p => {
			p.rack = d.splice(0, 14)
			p.melded = false
		})
		s.pool = d
		s.board = []
		s.turn = s.games % s.players.length
		s.phase = 'play'
		s.passes = 0
		this.bump()
		s.result = null
		s.log = E('l.starts', { name: s.players[s.turn].name })
	}
	draw(i, k, late) {
		const s = this.s,
			p = s.players[i]
		let n = 0
		while (n < k && s.pool.length) {
			p.rack.push(s.pool.pop())
			n++
		}
		s.passes = n ? 0 : s.passes + 1
		s.log = !n
			? E('l.passed', { name: p.name })
			: late
				? E('l.timeout', { name: p.name, n, id: p.id })
				: E('l.drew', { name: p.name, n })
		this.next()
	}
	next() {
		const s = this.s
		if (s.passes >= s.players.length) {
			const v = s.players.map(p => val(p.rack))
			return this.finish(v.indexOf(Math.min(...v)))
		}
		s.turn = (s.turn + 1) % s.players.length
		this.bump()
	}
	finish(w) {
		const s = this.s,
			wv = val(s.players[w].rack),
			d = {}
		let tot = 0
		s.players.forEach((p, j) => {
			if (j !== w) {
				const v = val(p.rack) - wv
				d[p.id] = -v
				tot += v
			}
		})
		d[s.players[w].id] = tot
		s.players.forEach(p => (s.scores[p.id] += d[p.id]))
		s.wins[s.players[w].id]++
		s.games++
		s.phase = 'over'
		this.bump()
		s.result = { winner: w, delta: d, blocked: wv > 0 }
		s.log = E('l.over')
	}
	// Removes seat k and keeps every stored seat index (turn, result.winner) consistent.
	removeSeat(k) {
		const s = this.s,
			[r] = s.players.splice(k, 1)
		if (!r) return
		delete s.scores[r.id]
		delete s.wins[r.id]
		if (s.turn > k) s.turn--
		if (s.result) {
			delete s.result.delta?.[r.id]
			if (!s.result.cancelled) {
				if (s.result.winner === k) {
					// the round's winner left: keep a neutral result instead of a dangling index
					s.result = { cancelled: true, delta: {} }
				} else if (s.result.winner > k) s.result.winner--
			}
		}
		this.sanitize()
	}
	// Repairs indices that point outside the players array (e.g. a snapshot saved by an older version).
	sanitize() {
		const s = this.s,
			n = s.players.length
		if (s.opts && typeof s.opts.timer !== 'number')
			s.opts.timer = s.opts.timer === false ? 0 : 60 // older snapshots stored a boolean
		if (!s.v) {
			// snapshots from the 3-level era: Intermediate 2 -> 3, Expert 3 -> 4
			const mv = l => (l === 2 ? 3 : l === 3 ? 4 : l)
			if (s.opts) s.opts.lvl = mv(s.opts.lvl)
			s.players.forEach(p => p.bot && (p.lvl = mv(p.lvl)))
			s.v = 2
		}
		s.turn = n ? Math.min(Math.max(0, s.turn | 0), n - 1) : 0
		if (s.result && !s.result.cancelled && !s.players[s.result.winner])
			s.result = { cancelled: true, delta: {} }
		if (s.result && !s.result.delta) s.result.delta = {}
	}
	bump() {
		this.s.seq++
		this.s.t0 = Date.now()
	} // new turn: restart the clock
	resume(hostTok) {
		const s = this.s
		s.t0 = Date.now()
		s.players.forEach(p => {
			if (!p.bot) p.on = p.id === hostTok
		})
	} // host came back: guests must rejoin
	botDue() {
		const s = this.s
		return s.phase === 'play' && !!s.players[s.turn].bot
	}
	botPlay() {
		const s = this.s,
			i = s.turn,
			p = s.players[i]
		if (!this.botDue()) return
		const lvl = p.lvl || 3,
			before = p.rack.length
		// beginners often just draw, even when they could play
		const mv =
			Math.random() < (BOT[lvl] || BOT[3]).skip
				? null
				: botMove(p.rack, s.board, p.melded, lvl)
		if (!mv || this.act(p.id, { t: 'end', board: mv.board, rack: mv.rack }))
			this.draw(i, 1)
		// summary for the host to decide on a (sporadic) reaction
		const left = p.rack.length
		return {
			id: p.id,
			lvl,
			played: Math.max(0, before - left),
			drew: left > before,
			left,
			oppMin: Math.min(
				99,
				...s.players.filter(x => x !== p).map(x => x.rack.length),
			),
		}
	}
	// returns an error string, or undefined on success
	act(tok, m) {
		const s = this.s,
			i = s.players.findIndex(p => p.id === tok),
			p = s.players[i]
		if (!p) return E('e.notIn')
		if (m.t === 'opts') {
			if (i === 0 && (s.phase === 'lobby' || s.phase === 'over')) {
				if ('timer' in m && s.phase === 'lobby')
					s.opts.timer = TIMES.includes(m.timer) ? m.timer : m.timer === true ? 60 : 0
				if (m.lvl in BOT) s.opts.lvl = m.lvl // level of the next bot added
			}
			return
		}
		if (m.t === 'leave') {
			// lobby: seat is freed; in a game a bot takes the seat (the player can reclaim it by rejoining)
			if (s.phase === 'lobby') {
				if (i > 0) this.removeSeat(i)
			} else {
				p.bot = true
				p.left = true
				p.on = true
			}
			return
		}
		if (m.t === 'bot') {
			if (
				i === 0 &&
				(s.phase === 'lobby' || s.phase === 'over') &&
				s.players.length < 4
			) {
				let n = 1 // first unused number: ids stay unique after a middle bot was removed
				while (s.players.some(x => x.id === 'bot' + n)) n++
				const id = 'bot' + n
				s.players.push({
					id,
					name: 'Bot ' + n,
					bot: true,
					lvl: s.opts.lvl || 3,
					rack: [],
					melded: false,
					on: true,
				})
				s.scores[id] = 0
				s.wins[id] = 0
			}
			return
		}
		if (m.t === 'unbot') {
			// lobby or between rounds; `id` removes that bot, otherwise the last one
			if (i === 0 && (s.phase === 'lobby' || s.phase === 'over')) {
				const k = m.id
					? s.players.findIndex(x => x.id === m.id && x.bot)
					: s.players.map(x => !!x.bot).lastIndexOf(true)
				if (k > 0) this.removeSeat(k)
			}
			return
		}
		if (m.t === 'forfeit') {
			// host ends the round early: nobody wins, no points / wins / game count change
			if (i === 0 && s.phase === 'play') {
				s.phase = 'over'
				this.bump()
				s.result = { cancelled: true, delta: {} }
				s.log = E('l.cancelled')
			}
			return
		}
		if (m.t === 'start') {
			if (i !== 0 || s.phase === 'play') return
			if (s.players.length < 2) return E('e.min2')
			return this.deal()
		}
		if (m.t === 'skip') {
			if (i === 0 && s.phase === 'play' && !s.players[s.turn].on)
				this.draw(s.turn, 1)
			return
		}
		if (s.phase !== 'play' || i !== s.turn) return E('e.notTurn')
		if (m.t === 'draw') return this.draw(i, 1)
		if (m.t === 'timeout') return this.draw(i, m.dirty ? 3 : 1, true)
		if (m.t !== 'end') return
		const { board, rack } = m
		if (
			!Array.isArray(board) ||
			!Array.isArray(rack) ||
			!board.every(Array.isArray)
		)
			return E('e.bad')
		const nb = board.filter(x => x.length),
			all = [...nb.flat(), ...rack],
			before = [...s.board.flat(), ...p.rack]
		if (!all.every(Number.isInteger) || key(all) !== key(before))
			return E('e.mismatch')
		const mine = new Set(p.rack)
		if (!rack.every(x => mine.has(x))) return E('e.noTake')
		if (rack.length === p.rack.length) return E('e.playOne')
		const info = nb.map(analyze)
		if (info.some(a => !a.ok)) return E('e.invalid')
		if (!p.melded) {
			const nk = nb.map(key),
				ok = new Set(s.board.map(key))
			if (!s.board.every(o => nk.includes(key(o)))) return E('e.noTouch')
			const pts = nb.reduce(
				(a, x, j) => a + (ok.has(key(x)) ? 0 : info[j].val),
				0,
			)
			if (pts < 30) return E('e.meld', { n: pts })
		}
		const played = p.rack.length - rack.length
		p.rack = rack
		s.board = info.map(a => a.order)
		p.melded = true
		s.passes = 0
		s.log = E('l.played', { name: p.name, n: played })
		if (!rack.length) return this.finish(i)
		this.next()
	}
}

// Bot AI, five levels (config table below). All use the same exhaustive set search (`solve`):
//  1 Beginner:     no jokers, one set (two if needed to meld), never adds to the table, often draws.
//  2 Casual:       no jokers, plays its largest combination of new sets and tacks leftovers onto the table.
//  3 Intermediate: uses jokers, and once melded gets a short budget to rearrange the table.
//  4 Expert:       full table rearrangement with a bigger budget, 2-joker sets, keeps jokers when it costs no tiles.
//  5 Master:       as Expert with a much larger search budget.
// Returns {board,rack} or null (=> draw).
export const BOT = {
	1: { jokers: 0, one: 1, ext: 0, ms: 0, nodes: 0, miss: 1, hold: 0, skip: 0.25 },
	2: { jokers: 0, one: 0, ext: 1, ms: 0, nodes: 0, miss: 1, hold: 0, skip: 0.1 },
	3: { jokers: 1, one: 0, ext: 1, ms: 60, nodes: 60000, miss: 1, hold: 0, skip: 0 },
	4: { jokers: 1, one: 0, ext: 1, ms: 300, nodes: 400000, miss: 2, hold: 25, skip: 0 },
	5: { jokers: 1, one: 0, ext: 1, ms: 900, nodes: 1500000, miss: 2, hold: 25, skip: 0 },
}
export function botMove(rack, board, melded, lvl = 3) {
	const cfg = BOT[lvl] || BOT[3],
		basic = solve(rack, board, melded, cfg)
	if (!cfg.ms || !melded) return basic
	const full = solve(rack, board, melded, cfg, true)
	if (!full) return basic
	return !basic || full.rack.length < basic.rack.length ? full : basic
}

function solve(rack, board, melded, cfg, full) {
	const cnt = Array.from({ length: 4 }, () => Array(14).fill(0)),
		req = Array.from({ length: 4 }, () => Array(14).fill(0)),
		ids = {},
		js = []
	let jReq = 0
	const add = (id, isBoard) => {
		const t = T(id)
		if (t.j) {
			js.push(id)
			if (isBoard) jReq++
		} else {
			cnt[t.c][t.n]++
			if (isBoard) req[t.c][t.n]++
			;(ids[t.c + '-' + t.n] = ids[t.c + '-' + t.n] || []).push(id)
		}
	}
	// board tiles first so they are the ones consumed when sets are built
	if (full) board.flat().forEach(id => add(id, true))
	rack.forEach(id => add(id, false))
	const nJ = cfg.jokers ? js.length : 0, // low levels can't use jokers in sets
		rackJ = nJ - jReq
	const slots = []
	for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) slots.push([c, n])
	const sub = (a, k) =>
		k === 0
			? [[]]
			: a.flatMap((x, i) => sub(a.slice(i + 1), k - 1).map(r => [x, ...r]))
	const cands = (c, n, J) => {
		const out = [],
			oth = [0, 1, 2, 3].filter(x => x !== c && cnt[x][n] > 0)
		for (let k = 1; k <= 3; k++)
			for (const cs of sub(oth, k)) {
				const sl = [[c, n], ...cs.map(x => [x, n])]
				if (sl.length >= 3) out.push({ sl, j: 0, val: n * sl.length })
				if (J > 0 && sl.length < 4)
					out.push({ sl, j: 1, val: n * (sl.length + 1) })
			}
		for (let s = Math.max(1, n - 12); s <= n; s++)
			for (let e = n + 0; e <= 13; e++) {
				const L = e - s + 1
				if (L < 3) continue
				let miss = 0
				for (let m = s; m <= e; m++) if (m !== n && !cnt[c][m]) miss++
				if (miss > J || miss > cfg.miss) continue
				const sl = []
				for (let m = s; m <= e; m++) if (m === n || cnt[c][m]) sl.push([c, m])
				const lo = Math.min(...sl.map(x => x[1])),
					s2 = Math.min(lo, 14 - L) // matches analyze()
				out.push({ sl, j: miss, val: L * s2 + (L * (L - 1)) / 2 })
			}
		return out
	}
	let best = null,
		nodes = 0,
		stop = 0
	const deadline = Date.now() + (full ? cfg.ms : 300)
	const dfs = (k, J, sets, tiles, pts, pen) => {
		if (stop) return
		if (++nodes > (full ? cfg.nodes : 40000)) return
		if (full && nodes % 500 === 0 && Date.now() > deadline)
			return void (stop = 1)
		while (k < 52 && !cnt[slots[k][0]][slots[k][1]]) k++
		if (k === 52) {
			// every board tile (incl. board jokers) must still be on the table
			if (full && J > rackJ) return
			const sc = tiles * 1000 + pts - pen // pen: strong bots prefer keeping a joker when it costs no tiles
			if ((melded || pts >= 30) && (!best || sc > best.score))
				best = { score: sc, sets: [...sets] }
			return
		}
		const [c, n] = slots[k]
		const r = req[c][n]
		for (const cd of cands(c, n, J)) {
			const saved = cd.sl.map(([a, b]) => req[a][b])
			cd.sl.forEach(([a, b]) => {
				cnt[a][b]--
				req[a][b] = Math.max(0, req[a][b] - 1)
			})
			dfs(
				k,
				J - cd.j,
				[...sets, cd],
				tiles + cd.sl.length + cd.j,
				pts + cd.val,
				pen + cd.j * cfg.hold,
			)
			cd.sl.forEach(([a, b], x) => {
				cnt[a][b]++
				req[a][b] = saved[x]
			})
		}
		// leave this tile unused (only rack tiles may stay unused)
		if (cnt[c][n] > r) {
			cnt[c][n]--
			dfs(k, J, sets, tiles, pts, pen)
			cnt[c][n]++
		}
	}
	dfs(0, nJ, [], 0, 0, 0)
	if (!best) return null
	if (cfg.one) {
		// beginner: only the biggest set (plus one more if the first doesn't reach 30 to meld)
		const sorted = [...best.sets].sort((a, b) => b.val - a.val),
			pick = []
		let pts = 0
		for (const cd of sorted) {
			pick.push(cd)
			pts += cd.val
			if (melded || pts >= 30) break
		}
		if (!melded && pts < 30) return null
		best = { sets: pick }
	}
	const pool = {}
	for (const k in ids) pool[k] = [...ids[k]]
	const jp = [...js]
	const fresh = best.sets.map(cd => [
		...cd.sl.map(([c, n]) => pool[c + '-' + n].shift()),
		...Array(cd.j)
			.fill(0)
			.map(() => jp.shift()),
	])
	const left = [...Object.values(pool).flat(), ...jp]
	const b = full ? fresh : [...board.map(x => [...x]), ...fresh],
		ext = melded && cfg.ext ? b : fresh
	for (let ch = !!cfg.ext; ch; ) {
		ch = false
		for (const id of [...left])
			for (const set of ext)
				if (analyze([...set, id]).ok) {
					set.push(id)
					left.splice(left.indexOf(id), 1)
					ch = true
					break
				}
	}
	return left.length < rack.length ? { board: b, rack: left } : null
}
