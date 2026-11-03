// Rummikub rules engine. Runs only on the host; guests send moves and receive views.
export const COLORS = ['#1b1b1b', '#d32f2f', '#1565c0', '#ef8f00']
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
const E = (k, p) => ({ k, p }) // translatable message (see i18n.js)
export const val = ids => ids.reduce((a, i) => a + (T(i).j ? 30 : T(i).n), 0)
export const key = a => [...a].sort((x, y) => x - y).join()
const shuffle = a => {
	for (let i = a.length - 1; i > 0; i--) {
		const j = (Math.random() * (i + 1)) | 0
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
	constructor() {
		this.s = {
			phase: 'lobby',
			players: [],
			board: [],
			pool: [],
			turn: 0,
			seq: 0,
			passes: 0,
			log: '',
			opts: { timer: true },
			scores: {},
			wins: {},
			games: 0,
			result: null,
		}
	}
	join(tok, name) {
		const s = this.s,
			p = s.players.find(p => p.id === tok)
		if (p) {
			if (name) p.name = name
			return true
		}
		if (s.phase !== 'lobby' || s.players.length >= 4) return false
		s.players.push({ id: tok, name, rack: [], melded: false, on: true })
		s.scores[tok] = 0
		s.wins[tok] = 0
		return true
	}
	online(tok, b) {
		const p = this.s.players.find(p => p.id === tok)
		if (p) p.on = b
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
			})),
			board: s.board,
			pool: s.pool.length,
			turn: s.turn,
			seq: s.seq,
			log: s.log,
			opts: s.opts,
			scores: s.scores,
			wins: s.wins,
			result: s.result,
			me,
			rack: me >= 0 ? s.players[me].rack : [],
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
		s.seq++
		s.result = null
		s.log = E('l.starts', { name: s.players[s.turn].name })
	}
	draw(i, k) {
		const s = this.s,
			p = s.players[i]
		let n = 0
		while (n < k && s.pool.length) {
			p.rack.push(s.pool.pop())
			n++
		}
		s.passes = n ? 0 : s.passes + 1
		s.log = n
			? E('l.drew', { name: p.name, n })
			: E('l.passed', { name: p.name })
		this.next()
	}
	next() {
		const s = this.s
		if (s.passes >= s.players.length) {
			const v = s.players.map(p => val(p.rack))
			return this.finish(v.indexOf(Math.min(...v)))
		}
		s.turn = (s.turn + 1) % s.players.length
		s.seq++
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
		s.seq++
		s.result = { winner: w, delta: d, blocked: wv > 0 }
		s.log = E('l.over')
	}
	botDue() {
		const s = this.s
		return s.phase === 'play' && !!s.players[s.turn].bot
	}
	botPlay() {
		const s = this.s,
			i = s.turn,
			p = s.players[i]
		if (!this.botDue()) return
		const mv = botMove(p.rack, s.board, p.melded)
		if (!mv || this.act(p.id, { t: 'end', board: mv.board, rack: mv.rack }))
			this.draw(i, 1)
	}
	// returns an error string, or undefined on success
	act(tok, m) {
		const s = this.s,
			i = s.players.findIndex(p => p.id === tok),
			p = s.players[i]
		if (!p) return E('e.notIn')
		if (m.t === 'opts') {
			if (i === 0 && s.phase === 'lobby') s.opts.timer = !!m.timer
			return
		}
		if (m.t === 'bot') {
			if (i === 0 && s.phase === 'lobby' && s.players.length < 4) {
				const n = s.players.filter(x => x.bot).length + 1,
					id = 'bot' + n
				s.players.push({
					id,
					name: 'Bot ' + n,
					bot: true,
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
			if (i === 0 && s.phase === 'lobby') {
				const k = s.players.map(x => !!x.bot).lastIndexOf(true)
				if (k > 0) s.players.splice(k, 1)
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
		if (m.t === 'timeout') return this.draw(i, m.dirty ? 3 : 1)
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

// Bot: finds the largest set of new sets (groups/runs, jokers allowed) from its rack, then
// tacks leftover tiles onto existing sets. Returns {board,rack} or null (=> draw).
export function botMove(rack, board, melded) {
	const cnt = Array.from({ length: 4 }, () => Array(14).fill(0)),
		ids = {},
		js = []
	rack.forEach(id => {
		const t = T(id)
		if (t.j) js.push(id)
		else {
			cnt[t.c][t.n]++
			;(ids[t.c + '-' + t.n] = ids[t.c + '-' + t.n] || []).push(id)
		}
	})
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
				if (miss > J || miss > 1) continue
				const sl = []
				for (let m = s; m <= e; m++) if (m === n || cnt[c][m]) sl.push([c, m])
				const lo = Math.min(...sl.map(x => x[1])),
					s2 = Math.min(lo, 14 - L) // matches analyze()
				out.push({ sl, j: miss, val: L * s2 + (L * (L - 1)) / 2 })
			}
		return out
	}
	let best = null,
		nodes = 0
	const dfs = (k, J, sets, tiles, pts) => {
		if (++nodes > 40000) return
		while (k < 52 && !cnt[slots[k][0]][slots[k][1]]) k++
		if (k === 52) {
			if ((melded || pts >= 30) && (!best || tiles * 1000 + pts > best.score))
				best = { score: tiles * 1000 + pts, sets: [...sets] }
			return
		}
		const [c, n] = slots[k]
		for (const cd of cands(c, n, J)) {
			cd.sl.forEach(([a, b]) => cnt[a][b]--)
			dfs(k, J - cd.j, [...sets, cd], tiles + cd.sl.length + cd.j, pts + cd.val)
			cd.sl.forEach(([a, b]) => cnt[a][b]++)
		}
		cnt[c][n]--
		dfs(k, J, sets, tiles, pts)
		cnt[c][n]++
	}
	dfs(0, js.length, [], 0, 0)
	if (!best) return null
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
	const b = [...board.map(x => [...x]), ...fresh],
		ext = melded ? b : fresh
	for (let ch = true; ch; ) {
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
