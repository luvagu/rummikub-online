// Online play through a free public MQTT relay (over WebSockets). No WebRTC, so no NAT/firewall
// trouble. The host's browser is still the authoritative game server; guests talk to it via the relay.
// Room code = 1 letter (which relay) + 4 random characters.
import * as M from 'mqtt'
import { Game } from './game.js'
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
const NOBROKER = { k: 'e.nobroker' }

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
const J = o => JSON.stringify(o)
// Lets bots take their turns (after a short "thinking" delay) whenever it becomes their turn.
const botRunner = (game, push) => {
	let bt = 0
	return () => {
		if (!bt && game.botDue())
			bt = setTimeout(() => {
				bt = 0
				game.botPlay()
				push()
			}, 1100)
	}
}

export function hostGame(name, { onState, onErr }, tok = TOK) {
	const game = new Game(),
		api = { code: '' }
	let c,
		base,
		dead = 0
	const out = (t, o) =>
		c && c.connected && c.publish(`${base}/to/${t}`, J(o), { qos: 1 })
	const sched = botRunner(game, () => push())
	const push = () => {
		game.s.players.forEach(p => {
			if (!p.bot && p.id !== tok) out(p.id, { t: 'state', s: game.view(p.id) })
		})
		onState(game.view(tok))
		sched()
	}
	const status = up =>
		c.publish(`${base}/host`, J({ up }), { qos: 1, retain: true })
	api.send = m => {
		const e = game.act(tok, m)
		if (e) onErr(e)
		push()
	}
	api.close = () => {
		dead = 1
		if (c) {
			status(false)
			setTimeout(() => c.end(true), 200)
		}
	}
	;(async () => {
		for (let i = 0; i < BROKERS.length && !c; i++) {
			const code =
				LET[i] +
				Array.from(
					{ length: 4 },
					() => AL[(Math.random() * AL.length) | 0],
				).join('')
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
		c.on('connect', () => status(true)) // after an automatic reconnect
		c.on('message', (_, buf) => {
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

export function joinGame(code, name, { onState, onErr }, tok = TOK) {
	code = code.trim().toUpperCase()
	const idx = LET.indexOf(code[0]),
		base = ROOT + code,
		api = { code }
	let c,
		got = 0,
		dead = 0,
		t,
		seen = 0
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
			const hello = () => pub({ t: 'join', name })
			c.on('connect', hello) // after an automatic reconnect
			c.on('message', (topic, buf) => {
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

// Solo game against a bot: no network at all.
export function localGame(name, { onState, onErr }) {
	const game = new Game(),
		sched = botRunner(game, () => push())
	const push = () => {
		onState(game.view(TOK))
		sched()
	}
	game.s.opts.timer = false
	game.join(TOK, name)
	game.act(TOK, { t: 'bot' })
	game.act(TOK, { t: 'start' })
	push()
	return {
		code: 'SOLO',
		send: m => {
			const e = game.act(TOK, m)
			if (e) onErr(e)
			push()
		},
		close: () => {},
	}
}
