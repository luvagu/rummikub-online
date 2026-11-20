// Online play through a free public MQTT relay (over WebSockets). No WebRTC, so no NAT/firewall
// trouble. The host's browser is the authoritative game server; guests talk to it via the relay.
// Room code = 1 letter (which relay) + 4 random characters.
import { Game } from '../engine/game.js'
import { RKEYS, RLEGACY, RCOOL } from '../engine/reactions.js'
import { runner } from './runner.js'
import { makePending } from './pending.js'
import { setupTutorial } from '../engine/tutorial.js'
import { local, session } from '../utils/store.js'
import { HelloBook, kidOf, makeHello, randomId } from '../utils/secure.js'
const env = import.meta.env || {}
// Id for offline games only (solo / tutorial). Online play uses the public id of the player's key pair (identity.js).
let tok0 = session.get('rmkTok')
if (!tok0) session.set('rmkTok', (tok0 = randomId(12)))
export const TOK = tok0
const PROTO = 8 // v8 = end-to-end encrypted channel; the topic root below changes with it, so old clients cannot join
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
	ROOT = 'rmkb' + PROTO + '/'
const TURN_MOVES = new Set(['draw', 'end', 'timeout']) // see Game.act
const NOBROKER = { k: 'e.nobroker' },
	J = JSON.stringify

// mqtt is only needed for online rooms, so it is a separate chunk loaded on demand (solo/tutorial never pay for it)
const open = async (url, will) => {
	const M = await import('mqtt')
	const connect = M.connect || M.default.connect
	const { promise, resolve, reject } = Promise.withResolvers()
	const c = connect(url, {
		clientId: 'rmkb_' + Math.random().toString(16).slice(2, 10),
		connectTimeout: 6000,
		reconnectPeriod: 3000,
		keepalive: 30,
		will,
	})
	// Backstop deadline for a stalled handshake. Bound to `settled` so it can never fire after we connected.
	const settled = new AbortController(),
		deadline = AbortSignal.timeout(7000)
	const fail = e => {
		settled.abort()
		c.end(true)
		reject(e)
	}
	deadline.addEventListener('abort', () => fail(new Error('timeout', { cause: deadline.reason })), {
		signal: settled.signal,
	})
	c.on('error', () => {})
	c.once('connect', () => {
		settled.abort()
		resolve(c)
	})
	c.once('error', fail)
	return promise
}

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
	const iv = setInterval(() => document.hidden || sync(), 2000), // a hidden tab is throttled anyway; visibilitychange below syncs on return
		ac = new AbortController()
	addEventListener('online', sync, { signal: ac.signal })
	document.addEventListener('visibilitychange', sync, { signal: ac.signal })
	c.once('end', () => {
		clearInterval(iv)
		ac.abort() // removes both listeners
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

// Host: the authoritative game server. Every guest has its own encrypted channel (see secure.js): the host derives it
// from the guest's public key in its hello, and only ever acts on messages that decrypt with that channel's key.
export function hostGame(
	name,
	{ onState, onErr, onReact = () => {}, onConn = () => {} },
	identP,
	resume,
) {
	const game = new Game(resume && resume.s),
		api = { code: '' },
		sid = randomId(), // new for every run: keys are bound to it, so anything captured from an earlier run is useless
		chans = new Map() // guest id -> Channel
	let c,
		base,
		dead = 0,
		ident,
		book, // remembers each guest's newest accepted handshake (HelloBook)
		tok = '',
		inbox = Promise.resolve() // inbound messages decrypt asynchronously but must be applied in arrival order
	const out = (kid, o) => {
		const ch = chans.get(kid)
		if (!ch) return
		ch.seal(o)
			.then(cipher => c && c.connected && c.publish(`${base}/to/${kid}`, J({ c: cipher }), { qos: 1 }))
			.catch(() => {})
	}
	const react = reactor(game, r => {
		game.s.players.forEach(p => {
			if (!p.bot && p.id !== tok) out(p.id, r)
		})
		onReact(r)
	})
	const sched = runner(game, () => push(), react)
	const save = () => {
		if (dead) return
		local.setJSON('rmkHost', { code: api.code, proto: PROTO, s: game.s })
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
	// The retained "host is up" message carries the host's public key and this run's session id; guests derive their key from them.
	const status = up =>
		c.publish(`${base}/host`, J(up ? { up: true, v: PROTO, hpub: ident.pub, sid } : { up: false }), { qos: 1, retain: true })
	api.send = m => {
		if (m.t === 'react') return react(tok, m.k)
		if (m.t === 'draft') return game.draft(tok, m.n)
		sched.guard() // the host's own client can be the first thing to wake up after a freeze
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
		local.remove('rmkHost')
		if (c) {
			game.s.players.forEach(p => {
				if (!p.bot && p.id !== tok) out(p.id, { t: 'err', msg: { k: 'e.closed' }, fatal: true })
			})
			status(false)
			setTimeout(() => c.end(true), 300)
		}
	}
	// One inbound packet. The only unencrypted ones are a guest's hello (public data) and the broker's last-will hint.
	const handle = async d => {
		if (dead || !d || typeof d !== 'object' || typeof d.kid !== 'string') return
		sched.guard() // woke from a freeze? then every deadline is restarted before this message is looked at
		const kid = d.kid
		if (d.pub) {
			// hello: the tag inside it only opens under the guest's own key, and its handshake number must be newer than
			// the last one accepted, so a forged or replayed hello changes nothing (see HelloBook)
			if (d.v !== PROTO) return
			const r = await book.accept(d)
			if (!r) return
			if (r.channel) chans.set(r.kid, r.channel) // null = a repeat of the current handshake: keep the channel and its replay counter
			if (!game.join(r.kid, r.name)) {
				out(r.kid, { t: 'err', msg: { k: 'e.full' }, fatal: true })
				chans.delete(r.kid) // out() has already taken the channel it needs
				book.gns.delete(r.kid)
				return
			}
			game.online(r.kid, true)
			push()
			return
		}
		if (d.bye) {
			// The broker publishes this when a guest's connection drops. The will is fixed before any key exists, so it carries
			// the connection id that the guest also sealed into its hello: only the CURRENT connection's will is believed
			// (a late will from before a reload, or one forged by an outsider, does not match).
			if (book.isCurrentCid(kid, d.bye)) {
				game.online(kid, false)
				push()
			}
			return
		}
		const ch = chans.get(kid)
		if (!ch || typeof d.c !== 'string') return
		const m = await ch.open(d.c)
		if (!m) return // forged, corrupted, replayed or from another handshake / run
		const p = game.s.players.find(x => x.id === kid)
		if (p && p.on === false && m.t !== 'bye') {
			game.online(kid, true) // a valid message proves the guest is here
			push()
		}
		if (m.t === 'bye') {
			game.online(kid, false)
			push()
			return
		}
		if (m.t === 'react') return react(kid, m.k)
		if (m.t === 'draft') return game.draft(kid, m.n)
		if (TURN_MOVES.has(m.t) && m.q != null && m.q !== game.s.seq) {
			// a resend of a move that already went through, or one for a turn that is over: not applied, but the guest
			// evidently has not seen the newer state, so hand it over
			out(kid, { t: 'state', s: game.view(kid) })
			return
		}
		const e = game.act(kid, m)
		if (e) out(kid, { t: 'err', msg: e })
		push()
	}
	;(async () => {
		try {
			ident = await identP
		} catch {
			return onErr({ k: 'e.insecure' }, true) // WebCrypto exists only on https / localhost
		}
		tok = ident.kid
		book = new HelloBook(ident, sid)
		if (resume) game.resume(tok)
		const tries = resume
			? [[LET.indexOf(resume.code[0]), resume.code]]
			: BROKERS.map((_, i) => [
					i,
					LET[i] + Array.from({ length: 4 }, () => AL[(Math.random() * AL.length) | 0]).join(''),
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
		c.on('connect', () => {
			// after an automatic reconnect: guests that stayed connected may have missed state while we were away
			if (dead) return
			status(true)
			push()
		})
		watch(c, onConn, () => dead)
		c.on('message', (_, buf) => {
			if (dead) return
			let d
			try {
				d = JSON.parse(buf.toString())
			} catch (e) {
				return
			}
			inbox = inbox.then(() => handle(d)).catch(() => {})
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
	identP,
) {
	code = code.trim().toUpperCase()
	const idx = LET.indexOf(code[0]),
		base = ROOT + code,
		api = { code }
	let c,
		got = 0,
		dead = 0,
		t,
		seen = 0,
		ident,
		chan, // our encrypted channel to the host; replaced when the host restarts (new session id)
		helloMsg, // the matching hello (its tag proves it came from our key)
		sid,
		cid = randomId(8), // identifies this MQTT connection: in the will, and sealed into the hello
		inbox = Promise.resolve()
	const rseen = [] // QoS 1 can redeliver: drop reaction ids we already showed
	let seq = -1 // the turn id of the newest state we have; committing moves are stamped with it
	// A committing move is resent until the host's next state shows it went through (see pending.js).
	const pend = makePending(
		m => pub(m),
		() => onErr({ k: 'e.noSync' }),
	)
	// Returns false when the message cannot go out (no channel yet, or the connection is down), so the UI can say so instead
	// of letting a move vanish. Moves are never queued: a replayed move could land on a different turn.
	const pub = m => {
		if (!chan || !c || !c.connected) return false
		chan
			.seal(m)
			.then(cipher => c && c.connected && c.publish(`${base}/in`, J({ kid: ident.kid, c: cipher }), { qos: 1 }))
			.catch(() => {})
		return true
	}
	// The hello is the one message sent in the clear: the public key the host needs to derive the same channel key.
	const hello = () =>
		!dead && chan && helloMsg && c && c.connected && c.publish(`${base}/in`, J({ v: PROTO, ...helloMsg }), { qos: 1 })
	const fail = m => {
		if (dead) return
		dead = 1
		clearTimeout(t)
		c && c.end(true)
		onErr(m, true)
	}
	api.send = m => {
		if (!TURN_MOVES.has(m.t)) return pub(m)
		m = { ...m, q: m.q ?? seq }
		const ok = pub(m)
		if (ok) pend.track(m)
		return ok
	}
	api.close = () => {
		if (dead) return
		dead = 1
		clearTimeout(t)
		pend.clear()
		if (c) {
			pub({ t: 'bye' })
			setTimeout(() => c.end(true), 300)
		}
	}
	if (code.length !== 5 || idx < 0 || idx >= BROKERS.length) {
		Promise.resolve().then(() => fail({ k: 'e.badCode' }))
		return api
	}
	t = setTimeout(() => fail({ k: 'e.noAnswer' }), 10000)
	// A guest message, already decrypted (state / reaction / error from the host).
	const onHost = d => {
		if (d.t === 'state') {
			got = 1
			clearTimeout(t)
			seq = d.s.seq
			pend.settle(seq)
			onState(d.s)
		} else if (d.t === 'react') {
			d.k = RLEGACY[d.k] || d.k
			if (got && RKEYS.has(d.k) && !rseen.includes(d.id)) {
				rseen.push(d.id)
				if (rseen.length > 30) rseen.shift()
				onReact(d)
			}
		} else if (d.t === 'err') {
			pend.clear()
			d.fatal ? fail(d.msg) : onErr(d.msg)
		}
	}
	const onPacket = async (topic, d) => {
		if (dead || !d || typeof d !== 'object') return
		if (topic.endsWith('/host')) {
			seen = 1
			if (d.up === false) return got ? onErr({ k: 'e.hostOff' }) : fail({ k: 'e.noRoom' })
			if (d.v !== PROTO || !d.hpub || typeof d.sid !== 'string') return fail({ k: 'e.noRoom' }) // not a host of this protocol
			let fp
			try {
				fp = await kidOf(d.hpub)
			} catch {
				return fail({ k: 'e.noRoom' })
			}
			// Trust on first use: once this tab has seen a host key for the room, a different one is refused, so a
			// forged retained message cannot silently put someone else in the host's place.
			const pin = 'rmkHpub:' + code,
				pinned = session.get(pin)
			if (pinned && pinned !== fp) return fail({ k: 'e.hostKey' })
			session.set(pin, fp)
			if (!chan || sid !== d.sid) {
				// A new handshake (page load, or the host restarted). Its number only ever increases, even if the clock
				// moved back, and it salts the key: nothing from an earlier handshake decrypts under this one.
				const mark = 'rmkGn:' + code,
					gn = Math.max((+session.get(mark) || 0) + 1, Date.now())
				session.set(mark, gn)
				try {
					;({ channel: chan, hello: helloMsg } = await makeHello(ident, d.hpub, d.sid, name, gn, cid))
					sid = d.sid
				} catch {
					return fail({ k: 'e.noRoom' })
				}
			}
			hello() // first time, after the host restarted, or after it reconnected: (re)take the seat
			return
		}
		if (!chan || typeof d.c !== 'string') return
		const m = await chan.open(d.c)
		if (m) onHost(m)
	}
	;(async () => {
		try {
			ident = await identP
		} catch {
			return fail({ k: 'e.insecure' })
		}
		let cl
		try {
			cl = await open(BROKERS[idx], { topic: `${base}/in`, payload: J({ kid: ident.kid, bye: cid }), qos: 1 })
		} catch {
			return fail(NOBROKER)
		}
		c = cl
		if (dead) {
			c.end(true)
			return
		}
		c.on('connect', () => {
			hello() // after an automatic reconnect: take the seat back
			pend.nudge() // and say again what the host may have missed while the link was down
		})
		watch(c, onConn, () => dead)
		c.on('message', (topic, buf) => {
			if (dead) return
			let d
			try {
				d = JSON.parse(buf.toString())
			} catch (e) {
				return
			}
			inbox = inbox.then(() => onPacket(topic, d)).catch(() => {})
		})
		c.subscribe([`${base}/host`, `${base}/to/${ident.kid}`], { qos: 1 }, e => {
			if (e) return fail({ k: 'e.refused' })
			setTimeout(() => {
				if (!seen) fail({ k: 'e.noRoom' })
			}, 3000)
		})
	})()
	return api
}

// Solo game against a bot: no network at all. The game is snapshotted so a closed tab can resume it.
export function localGame(
	name,
	{ onState, onErr, onReact = () => {} },
	tok = TOK,
	resume,
	botName = () => 'Bot', // lvl -> the bot's display name, e.g. "Expert Bot"
) {
	const game = new Game(resume && resume.s),
		react = reactor(game, onReact),
		sched = runner(game, () => push(), react)
	const push = () => {
		local.setJSON('rmkSolo', { s: game.s })
		onState(game.view(tok))
		sched()
	}
	if (!resume) {
		game.join(tok, name)
		const lvl = +local.get('rmkLvl5') || 3,
			v = local.get('rmkTimer'),
			timer = v == null ? 45 : +v === 1 ? 60 : +v || 0
		game.act(tok, { t: 'opts', lvl, timer })
		game.act(tok, { t: 'bot', name: botName(lvl) })
		game.act(tok, { t: 'start' })
	}
	push()
	return {
		code: 'SOLO',
		send: m => {
			if (m.t === 'react') return react(tok, m.k)
			if (m.t === 'draft') return game.draft(tok, m.n)
			sched.guard() // a locked phone freezes the clock work too
			const e = game.act(tok, m)
			if (e) onErr(e)
			push()
		},
		close: () => sched.stop(),
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
			if (m.t === 'react' || m.t === 'draft') return
			const e = game.act(tok, m)
			if (e) onErr(e)
			push()
		},
		close: () => clearTimeout(bt),
	}
}
