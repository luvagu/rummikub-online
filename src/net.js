// Online play through a free public MQTT relay (over WebSockets). No WebRTC, so no NAT/firewall
// trouble. The host's browser is the authoritative game server; guests talk to it via the relay.
// Room code = 1 letter (which relay) + 4 random characters.
import * as M from 'mqtt'
import { Game } from './game.js'
import { RKEYS, RLEGACY, RCOOL, botReact } from './reactions.js'
import { setupTutorial } from './tutorial.js'
const connect = M.connect || M.default.connect,
	env = import.meta.env || {}
export const TOK =
	sessionStorage.rmkTok ||
	(sessionStorage.rmkTok = Math.random().toString(36).slice(2))
const BROKERS = [
	...(env.VITE_MQTT_URL ? [env.VITE_MQTT_URL] : []),
	...(globalThis.__RMKB_BROKERS || [
		'wss://broker.emqx.io:8084/mqtt',
		'wss://broker.hivemq.com:8884/mqtt',
		'wss://test.mosquitto.org:8081',
	]),
]
const LET = 'ABCDEFGH',
	AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
	ROOT = 'rmkb7/'
const NOBROKER = { k: 'e.nobroker' },
	J = JSON.stringify

const open = (url, will) =>
	new Promise((res, rej) => {
		const c = connect(url, {
			clientId: 'rmkb_' + Math.random().toString(16).slice(2, 10),
			connectTimeout: 6000,
			reconnectPeriod: 3000,
			keepalive: 30,
			will,
		})
		const t = setTimeout(() => {
			c.end(true)
			rej(new Error('timeout'))
		}, 7000)
		c.on('error', () => {})
		c.once('connect', () => {
			clearTimeout(t)
			res(c)
		})
		c.once('error', e => {
			clearTimeout(t)
			c.end(true)
			rej(e)
		})
	})

// Keep the UI's connection flag in sync with the client's real state. Event edges alone can be missed or
// reordered (tab suspended, network switch), which left the "reconnecting" banner stuck, so also poll.
const watch = (c, onConn, closed) => {
	let last
	const sync = () => {
		if (closed()) return // we closed it on purpose (leave): never report that as a lost connection
		const v = !!c.connected
		if (v !== last) onConn((last = v))
	}
	;['connect', 'close', 'offline', 'end', 'message'].forEach(e => c.on(e, sync))
	const iv = setInterval(sync, 2000)
	addEventListener('online', sync)
	document.addEventListener('visibilitychange', sync)
	c.once('end', () => {
		clearInterval(iv)
		removeEventListener('online', sync)
		document.removeEventListener('visibilitychange', sync)
	})
}

// Reactions are ephemeral events (never part of the game state, so they are not saved or replayed on reconnect).
// The host validates (known sender, key in the fixed set, per-sender rate limit) and hands the event to `deliver`.
const reactor = (game, deliver) => {
	const last = {}
	return (from, k) => {
		k = RLEGACY[k] || k // older clients still send oops/sad
		if (!RKEYS.has(k) || !game.s.players.some(p => p.id === from)) return
		const now = Date.now()
		if (now - (last[from] || 0) < RCOOL) return
		last[from] = now
		deliver({
			t: 'react',
			from,
			k,
			id: now.toString(36) + Math.random().toString(36).slice(2, 6),
		})
	}
}

// Host-side clock work: lets bots take their turns after a short "thinking" delay, and enforces the
// turn timer even if the player's own browser is gone (client sends the precise timeout first; this is the fallback).
const runner = (game, push, react) => {
	let bt = 0,
		tt = 0,
		seq = -1
	const quiet = {} // per-bot cooldown so bots never spam
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
			}, 700 + Math.random() * 1100) // varied "thinking" time
		if (s.phase !== 'play' || !s.opts.timer) {
			clearTimeout(tt)
			seq = -1
			return
		}
		if (s.seq !== seq) {
			seq = s.seq
			clearTimeout(tt)
			tt = setTimeout(() => {
				const g = game.s,
					p = g.players[g.turn]
				if (g.seq === seq && g.phase === 'play' && !p.bot) {
					game.act(p.id, { t: 'timeout', dirty: false })
					push()
				}
			}, game.s.opts.timer * 1000 + 3000)
		}
	}
	run.stop = () => {
		clearTimeout(bt)
		clearTimeout(tt)
		bt = tt = 0
	}
	return run
}

export function hostGame(
	name,
	{ onState, onErr, onReact = () => {}, onConn = () => {} },
	tok = TOK,
	resume,
) {
	const game = new Game(resume && resume.s),
		api = { code: '' }
	let c,
		base,
		dead = 0
	if (resume) game.resume(tok)
	const out = (t, o) =>
		c && c.connected && c.publish(`${base}/to/${t}`, J(o), { qos: 1 })
	const react = reactor(game, r => {
		game.s.players.forEach(p => {
			if (!p.bot && p.id !== tok) out(p.id, r)
		})
		onReact(r)
	})
	const sched = runner(game, () => push(), react)
	const save = () => {
		if (dead) return
		try {
			localStorage.rmkHost = J({ code: api.code, s: game.s })
		} catch (e) {}
	}
	const push = () => {
		if (dead) return
		game.s.players.forEach(p => {
			if (!p.bot && p.id !== tok) out(p.id, { t: 'state', s: game.view(p.id) })
		})
		save()
		onState(game.view(tok))
		sched()
	}
	const status = up =>
		c.publish(`${base}/host`, J({ up }), { qos: 1, retain: true })
	api.send = m => {
		if (m.t === 'react') return react(tok, m.k)
		const e = game.act(tok, m)
		if (e) onErr(e)
		push()
	}
	api.close = () => {
		dead = 1
		sched.stop()
		if (c) {
			status(false)
			setTimeout(() => c.end(true), 200)
		}
	}
	// End the room for everyone (explicit "leave" by the host). A plain refresh/close does NOT do this, so the host can resume.
	api.endRoom = () => {
		dead = 1
		sched.stop()
		try {
			localStorage.removeItem('rmkHost')
		} catch (e) {}
		if (c) {
			game.s.players.forEach(p => {
				if (!p.bot && p.id !== tok)
					out(p.id, { t: 'err', msg: { k: 'e.closed' }, fatal: true })
			})
			status(false)
			setTimeout(() => c.end(true), 300)
		}
	}
	;(async () => {
		const tries = resume
			? [[LET.indexOf(resume.code[0]), resume.code]]
			: BROKERS.map((_, i) => [
					i,
					LET[i] +
						Array.from(
							{ length: 4 },
							() => AL[(Math.random() * AL.length) | 0],
						).join(''),
				])
		for (const [i, code] of tries) {
			if (c || !BROKERS[i]) continue
			try {
				c = await open(BROKERS[i], {
					topic: `${ROOT}${code}/host`,
					payload: J({ up: false }),
					qos: 1,
					retain: true,
				})
				api.code = code
				base = ROOT + code
			} catch (e) {}
		}
		if (!c) return onErr(NOBROKER, true)
		if (dead) {
			c.end(true)
			return
		}
		c.on('connect', () => !dead && status(true)) // after an automatic reconnect
		watch(c, onConn, () => dead)
		c.on('message', (_, buf) => {
			if (dead) return
			let d
			try {
				d = JSON.parse(buf.toString())
			} catch (e) {
				return
			}
			const { tok: t, m } = d || {}
			if (!t || !m) return
			if (m.t === 'join') {
				if (!game.join(t, String(m.name || 'Player').slice(0, 16))) {
					out(t, { t: 'err', msg: { k: 'e.full' }, fatal: true })
					return
				}
				game.online(t, true)
				push()
				return
			}
			if (m.t === 'bye') {
				game.online(t, false)
				push()
				return
			}
			if (m.t === 'react') return react(t, m.k)
			const e = game.act(t, m)
			if (e) out(t, { t: 'err', msg: e })
			push()
		})
		c.subscribe(`${base}/in`, { qos: 1 })
		status(true)
		game.join(tok, name)
		push()
	})()
	return api
}

export function joinGame(
	code,
	name,
	{ onState, onErr, onReact = () => {}, onConn = () => {} },
	tok = TOK,
) {
	code = code.trim().toUpperCase()
	const idx = LET.indexOf(code[0]),
		base = ROOT + code,
		api = { code }
	let c,
		got = 0,
		dead = 0,
		t,
		seen = 0
	const rseen = [] // QoS 1 can redeliver: drop reaction ids we already showed
	const pub = m =>
		c && c.connected && c.publish(`${base}/in`, J({ tok, m }), { qos: 1 })
	const fail = m => {
		if (dead) return
		dead = 1
		clearTimeout(t)
		c && c.end(true)
		onErr(m, true)
	}
	api.send = pub
	api.close = () => {
		if (dead) return
		dead = 1
		clearTimeout(t)
		if (c) {
			pub({ t: 'bye' })
			setTimeout(() => c.end(true), 200)
		}
	}
	if (code.length !== 5 || idx < 0 || idx >= BROKERS.length) {
		Promise.resolve().then(() => fail({ k: 'e.badCode' }))
		return api
	}
	t = setTimeout(() => fail({ k: 'e.noAnswer' }), 10000)
	open(BROKERS[idx], {
		topic: `${base}/in`,
		payload: J({ tok, m: { t: 'bye' } }),
		qos: 1,
	})
		.then(cl => {
			c = cl
			if (dead) {
				c.end(true)
				return
			}
			const hello = () => !dead && pub({ t: 'join', name })
			c.on('connect', hello) // after an automatic reconnect: take the seat back
			watch(c, onConn, () => dead)
			c.on('message', (topic, buf) => {
				if (dead) return
				let d
				try {
					d = JSON.parse(buf.toString())
				} catch (e) {
					return
				}
				if (topic.endsWith('/host')) {
					seen = 1
					if (d.up === false)
						return got ? onErr({ k: 'e.hostOff' }) : fail({ k: 'e.noRoom' })
					if (got) hello()
					return
				}
				if (d.t === 'state') {
					got = 1
					clearTimeout(t)
					onState(d.s)
				} else if (d.t === 'react') {
					d.k = RLEGACY[d.k] || d.k
					if (got && RKEYS.has(d.k) && !rseen.includes(d.id)) {
						rseen.push(d.id)
						if (rseen.length > 30) rseen.shift()
						onReact(d)
					}
				} else if (d.t === 'err') {
					d.fatal ? fail(d.msg) : onErr(d.msg)
				}
			})
			c.subscribe([`${base}/host`, `${base}/to/${tok}`], { qos: 1 }, e => {
				if (e) return fail({ k: 'e.refused' })
				hello()
				setTimeout(() => {
					if (!seen) fail({ k: 'e.noRoom' })
				}, 3000)
			})
		})
		.catch(() => fail(NOBROKER))
	return api
}

// Solo game against a bot: no network at all. The game is snapshotted so a closed tab can resume it.
export function localGame(
	name,
	{ onState, onErr, onReact = () => {} },
	tok = TOK,
	resume,
) {
	const game = new Game(resume && resume.s),
		react = reactor(game, onReact),
		sched = runner(game, () => push(), react)
	const push = () => {
		try {
			localStorage.rmkSolo = J({ s: game.s })
		} catch (e) {}
		onState(game.view(tok))
		sched()
	}
	if (!resume) {
		game.join(tok, name)
		let lvl = 3,
			timer = 0
		try {
			lvl = +localStorage.rmkLvl5 || 3
			timer = +localStorage.rmkTimer === 1 ? 60 : +localStorage.rmkTimer || 0
		} catch (e) {}
		game.act(tok, { t: 'opts', lvl, timer })
		game.act(tok, { t: 'bot' })
		game.act(tok, { t: 'start' })
	}
	push()
	return {
		code: 'SOLO',
		send: m => {
			if (m.t === 'react') return react(tok, m.k)
			const e = game.act(tok, m)
			if (e) onErr(e)
			push()
		},
		close: () => {},
	}
}

// Guided tutorial: an offline game from a fixed, scripted position. Nothing is saved; the "coach" opponent
// just draws a tile on its turn so the lesson stays predictable.
export function tutorialGame(
	name,
	{ onState, onErr },
	tok = TOK,
	botName = 'Coach',
	lesson = 'basics',
) {
	const game = new Game()
	let bt = 0
	const push = () => {
		onState(game.view(tok))
		const s = game.s
		if (!bt && s.phase === 'play' && s.turn === 1)
			bt = setTimeout(() => {
				bt = 0
				if (game.s.phase === 'play' && game.s.turn === 1) {
					game.draw(1, 1)
					push()
				}
			}, 1300)
	}
	game.s.opts.timer = 0
	game.join(tok, name)
	game.act(tok, { t: 'bot' })
	setupTutorial(game, botName, lesson)
	push()
	return {
		code: 'TUTORIAL',
		send: m => {
			if (m.t === 'react') return
			const e = game.act(tok, m)
			if (e) onErr(e)
			push()
		},
		close: () => clearTimeout(bt),
	}
}
