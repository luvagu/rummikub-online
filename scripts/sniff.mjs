// Dev-only security check for the encrypted online protocol (not shipped).
//
// It plays an outsider who knows a room code: it joins the same public MQTT relay, records everything published in
// the room, and then tries forgeries and replays. Run it next to a real game:
//
//   node scripts/sniff.mjs listen CODE 90 capture.json     record traffic for 90 seconds, then report what leaked
//   node scripts/sniff.mjs attack CODE capture.json [GOFILE]   replay and forge messages against the host (with GOFILE it
//                                                              connects first and waits for that file to appear, so the
//                                                              attack can be timed to the victim's turn)
//
// "listen" must find no readable game data. After "attack", the game must be unchanged (the host UI is checked by hand
// or with the browser tool), and the victim must still show as online (last-will hints need the sealed connection id).
import mqtt from 'mqtt'
import { readFileSync, writeFileSync } from 'node:fs'

const [mode, CODE, a3, a4] = process.argv.slice(2)
import { existsSync } from 'node:fs'
const RELAYS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081']
const idx = 'ABCDEFGH'.indexOf(CODE?.[0])
if (!mode || !CODE || !RELAYS[idx]) {
	console.error('usage: sniff.mjs listen CODE SECONDS OUT.json | attack CODE CAPTURE.json')
	process.exit(2)
}
const BASE = `rmkb8/${CODE}`
const connect = () =>
	new Promise((res, rej) => {
		const c = mqtt.connect(RELAYS[idx], { clientId: 'sniff_' + Math.random().toString(16).slice(2, 10), connectTimeout: 8000 })
		c.once('connect', () => res(c))
		c.once('error', rej)
	})
const FORBIDDEN = ['"rack"', '"players"', '"board"', '"tok"', '"pool"', '"scores"', '"melded"', '"turn"', '"s":']

if (mode === 'listen') {
	const secs = +a3 || 60,
		out = a4 || 'capture.json'
	const c = await connect()
	const got = []
	c.on('message', (topic, buf, pkt) => got.push({ t: Date.now(), topic, retain: pkt.retain, payload: buf.toString() }))
	await new Promise(r => c.subscribe(`${BASE}/#`, { qos: 1 }, r))
	console.log(`listening on ${BASE}/# for ${secs}s ...`)
	await new Promise(r => setTimeout(r, secs * 1000))
	c.end(true)
	writeFileSync(out, JSON.stringify(got, null, 1))
	const kinds = {}
	const leaks = []
	for (const m of got) {
		let d
		try {
			d = JSON.parse(m.payload)
		} catch {
			leaks.push({ topic: m.topic, why: 'not JSON' })
			continue
		}
		const shape = Object.keys(d).sort().join(',')
		const where = m.topic.replace(CODE, '<code>').replace(/\/to\/.+$/, '/to/<kid>')
		kinds[where + ' {' + shape + '}'] = (kinds[where + ' {' + shape + '}'] || 0) + 1
		for (const f of FORBIDDEN) if (m.payload.includes(f)) leaks.push({ topic: where, why: 'cleartext ' + f })
	}
	console.log(`captured ${got.length} packets. Shapes seen (topic {json keys}):`)
	for (const [k, n] of Object.entries(kinds)) console.log(`  ${String(n).padStart(4)} x ${k}`)
	console.log(leaks.length ? `\nLEAKS (${leaks.length}):\n` + leaks.map(l => '  ' + JSON.stringify(l)).join('\n') : '\nNO readable game data in any packet.')
	process.exit(leaks.length ? 1 : 0)
}

if (mode === 'attack') {
	const cap = JSON.parse(readFileSync(a3, 'utf8'))
	const guestMsgs = cap.filter(m => m.topic === `${BASE}/in`).map(m => JSON.parse(m.payload))
	const sealed = guestMsgs.filter(m => m.kid && m.c),
		hello = guestMsgs.find(m => m.pub)
	if (!sealed.length || !hello) {
		console.error('capture has no guest traffic to replay (play a round with a guest while listening)')
		process.exit(2)
	}
	const victim = hello.kid
	let c
	for (let tries = 0; !c && tries < 4; tries++) c = await connect().catch(() => null) // the free relays are flaky
	if (!c) {
		console.error('could not reach the relay')
		process.exit(2)
	}
	if (a4) {
		console.log(`connected; waiting for ${a4} ...`)
		while (!existsSync(a4)) await new Promise(r => setTimeout(r, 100))
	}
	const send = (label, obj) => {
		console.log('  sending', label)
		return new Promise(r => c.publish(`${BASE}/in`, JSON.stringify(obj), { qos: 1 }, r))
	}
	console.log(`victim guest id ${victim}; ${sealed.length} captured sealed messages`)
	for (const m of sealed) await send(`REPLAY of a captured sealed message (${m.c.slice(0, 8)}...)`, m)
	await send('FORGED sealed message (random bytes) as the victim', { kid: victim, c: Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url') })
	await send('FORGED plaintext move as the victim (old protocol shape)', { tok: victim, m: { t: 'draw' } })
	await send('captured HELLO with its handshake number raised (tag no longer matches)', { v: 8, ...hello, gn: hello.gn + 1_000_000 })
	await send('HELLO claiming the victim id with a different key', { v: 8, ...hello, pub: { kty: 'EC', crv: 'P-256', x: hello.pub.y, y: hello.pub.x } })
	await send('REPLAY of the captured hello (harmless: same handshake, the host just refreshes the guest)', { v: 8, ...hello })
	await send('FORGED last-will hint for the victim (guesses the connection id: must be ignored, victim stays online)', { kid: victim, bye: 'guess' })
	await new Promise(r => setTimeout(r, 1500))
	c.end(true)
	console.log('done. Check the host: the game state must be unchanged (turn, racks, board) and the victim still online.')
}
