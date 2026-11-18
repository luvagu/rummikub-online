// Crypto core of the encrypted online channel: node --test tests/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newIdentity, importIdentity, kidOf, kidMatches, deriveKey, Channel, randomId, makeHello, HelloBook } from '../src/secure.js'

// Two parties plus the host's per-run session id, as net.js sets them up.
async function pair(sid = randomId()) {
	const host = await newIdentity(),
		guest = await newIdentity()
	const hk = await deriveKey(host.priv, guest.pub, sid),
		gk = await deriveKey(guest.priv, host.pub, sid)
	return { host, guest, sid, h: new Channel(hk, 'host'), g: new Channel(gk, 'guest') }
}
const flip = s => s.slice(0, 20) + (s[20] === 'A' ? 'B' : 'A') + s.slice(21)

test('identity: the id is a hash of the public key and survives export/import', async () => {
	const a = await newIdentity()
	assert.equal(a.kid, await kidOf(a.pub))
	assert.match(a.kid, /^[A-Za-z0-9_-]{22}$/) // 128 bits, base64url
	const b = await importIdentity(JSON.parse(JSON.stringify(a.exported)))
	assert.equal(b.kid, a.kid)
	assert.notEqual((await newIdentity()).kid, a.kid)
})

test('identity: a hello is only believable if the id is the hash of its own key', async () => {
	const a = await newIdentity(),
		b = await newIdentity()
	assert.equal(await kidMatches(a.kid, a.pub), true)
	assert.equal(await kidMatches(a.kid, b.pub), false) // claiming someone else's id with your own key
	assert.equal(await kidMatches('x', a.pub), false)
	assert.equal(await kidMatches(a.kid, { kty: 'EC', crv: 'P-384', x: 'a', y: 'b' }), false)
	assert.equal(await kidMatches(a.kid, null), false)
})

test('channel: both sides derive a key that works in both directions', async () => {
	const { h, g } = await pair()
	const m1 = { t: 'draw', rack: [1, 2, 3] }
	assert.deepEqual(await h.open(await g.seal(m1)), m1)
	const m2 = { t: 'state', s: { players: [{ id: 'a' }], rack: [4, 5] } }
	assert.deepEqual(await g.open(await h.seal(m2)), m2)
})

test('channel: nothing readable appears in the ciphertext', async () => {
	const { g } = await pair()
	const secret = { t: 'state', rack: [101, 102, 103], tok: 'topsecret' },
		c = await g.seal(secret)
	for (const needle of ['rack', 'topsecret', 'state', '101']) assert.ok(!c.includes(needle) && !Buffer.from(c, 'base64url').includes(needle))
})

test('channel: tampered ciphertext is rejected', async () => {
	const { h, g } = await pair()
	assert.equal(await h.open(flip(await g.seal({ t: 'x' }))), null)
	assert.equal(await h.open('AAAA'), null) // too short
	assert.equal(await h.open(''), null)
	assert.equal(await h.open(undefined), null)
})

test('channel: a third party with its own keys cannot forge or read messages', async () => {
	const { h, g, host } = await pair()
	const attacker = await newIdentity()
	const ak = await deriveKey(attacker.priv, host.pub, 'whatever')
	const forged = await new Channel(ak, 'guest').seal({ t: 'draw' })
	assert.equal(await h.open(forged), null)
	const real = await h.seal({ t: 'state', rack: [1] })
	assert.equal(await new Channel(ak, 'guest').open(real), null)
	assert.deepEqual(await g.open(real), { t: 'state', rack: [1] })
})

test('replay: the same message twice, or an older one, is rejected', async () => {
	const { h, g } = await pair()
	const c1 = await g.seal({ i: 1 }),
		c2 = await g.seal({ i: 2 })
	assert.deepEqual(await h.open(c2), { i: 2 })
	assert.equal(await h.open(c2), null) // replayed
	assert.equal(await h.open(c1), null) // older counter than one already seen
	assert.deepEqual(await h.open(await g.seal({ i: 3 })), { i: 3 }) // the channel keeps working
})

test('replay: concurrent duplicates cannot both be accepted', async () => {
	const { h, g } = await pair()
	const c = await g.seal({ i: 1 })
	const r = await Promise.all([h.open(c), h.open(c), h.open(c)])
	assert.equal(r.filter(Boolean).length, 1)
})

test('replay: a message from an earlier host run (different session id) no longer decrypts', async () => {
	const host = await newIdentity(),
		guest = await newIdentity()
	const old = new Channel(await deriveKey(guest.priv, host.pub, 'run-1'), 'guest')
	const captured = await old.seal({ t: 'draw' })
	const hostNow = new Channel(await deriveKey(host.priv, guest.pub, 'run-2'), 'host')
	assert.equal(await hostNow.open(captured), null)
})

test('reflection: a message cannot be bounced back to the side that sent it', async () => {
	const { g, h } = await pair()
	const c = await g.seal({ t: 'draw' })
	assert.equal(await g.open(c), null) // guest -> host message fed back to the guest
	const d = await h.seal({ t: 'state' })
	assert.equal(await h.open(d), null)
})

test('counter: a channel recreated after a reload still seals above what the host has seen', async () => {
	const host = await newIdentity(),
		guest = await newIdentity(),
		sid = randomId()
	const hostSide = new Channel(await deriveKey(host.priv, guest.pub, sid), 'host')
	const g1 = new Channel(await deriveKey(guest.priv, host.pub, sid), 'guest')
	for (let i = 0; i < 5; i++) assert.ok(await hostSide.open(await g1.seal({ i })))
	await new Promise(r => setTimeout(r, 5))
	const g2 = new Channel(await deriveKey(guest.priv, host.pub, sid), 'guest') // guest reloaded
	assert.deepEqual(await hostSide.open(await g2.seal({ after: 'reload' })), { after: 'reload' })
})

test('ordering: messages sealed back to back are delivered in the order they were sent', async () => {
	const { h, g } = await pair()
	const sealed = await Promise.all(Array.from({ length: 20 }, (_, i) => g.seal({ i })))
	const got = []
	for (const c of sealed) got.push((await h.open(c))?.i)
	assert.deepEqual(got, Array.from({ length: 20 }, (_, i) => i))
})

test('deriveKey rejects a malformed public key', async () => {
	const a = await newIdentity()
	await assert.rejects(() => deriveKey(a.priv, { kty: 'EC', crv: 'P-256' }, 's'))
	await assert.rejects(() => deriveKey(a.priv, null, 's'))
})

// ---- handshake (hello) ----
async function room() {
	const host = await newIdentity(),
		sid = randomId(),
		book = new HelloBook(host, sid)
	return { host, sid, book, join: async (guest, name = 'Ann', gn = Date.now(), cid = randomId(8)) => makeHello(guest, host.pub, sid, name, gn, cid) }
}

test('hello: the host accepts a genuine hello and both ends get working channels', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const { hello, channel: g } = await join(guest, 'Ann')
	const r = await book.accept(hello)
	assert.equal(r.kid, guest.kid)
	assert.equal(r.name, 'Ann')
	assert.deepEqual(await r.channel.open(await g.seal({ t: 'draw' })), { t: 'draw' })
	assert.deepEqual(await g.open(await r.channel.seal({ t: 'state' })), { t: 'state' })
})

test('hello: the name travels inside the tag, so an outsider cannot rename a player', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const { hello } = await join(guest, 'Ann')
	assert.equal(JSON.stringify(hello).includes('Ann'), false) // sealed, not in the clear
	const tampered = { ...hello, h: hello.h.slice(0, -4) + 'AAAA' }
	assert.equal(await book.accept(tampered), null)
})

test('hello: claiming a victim id with the attacker own key, or changing gn, is rejected', async () => {
	const { book, join } = await room(),
		victim = await newIdentity(),
		attacker = await newIdentity()
	const { hello } = await join(victim, 'Ann', 1000)
	assert.ok(await book.accept(hello))
	const mine = (await join(attacker, 'Evil')).hello
	assert.equal(await book.accept({ ...mine, kid: victim.kid }), null) // id is not the hash of the key
	assert.equal(await book.accept({ ...hello, gn: hello.gn + 1_000_000 }), null) // tag was made for the old gn
	assert.ok(await book.accept(mine)) // an attacker can still join as a NEW player: that is the room-code model
})

test('hello: an old hello replayed after a newer one is rejected, and does not disturb the live channel', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const first = await join(guest, 'Ann', 1000),
		second = await join(guest, 'Ann', 2000)
	assert.ok(await book.accept(first.hello))
	const live = await book.accept(second.hello)
	assert.equal(await book.accept(first.hello), null) // replay of the first hello
	assert.deepEqual(await live.channel.open(await second.channel.seal({ ok: 1 })), { ok: 1 })
})

test('reload: a message captured before the guest reloaded cannot be replayed afterwards', async () => {
	// the hole found by the live test: reloading used to reset the replay counter, re-opening the old messages
	const { book, join } = await room(),
		guest = await newIdentity()
	const before = await join(guest, 'Ann', 1000)
	const hostBefore = (await book.accept(before.hello)).channel
	const captured = await before.channel.seal({ t: 'draw' })
	assert.deepEqual(await hostBefore.open(captured), { t: 'draw' })
	const after = await join(guest, 'Ann', 2000) // guest reloaded: new handshake
	const hostAfter = (await book.accept(after.hello)).channel
	assert.equal(await hostAfter.open(captured), null) // the old key no longer opens anything
	assert.deepEqual(await hostAfter.open(await after.channel.seal({ t: 'draw' })), { t: 'draw' })
})

test('reload: old host messages do not decrypt on the reloaded guest', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const before = await join(guest, 'Ann', 1000)
	const hostBefore = (await book.accept(before.hello)).channel
	const oldState = await hostBefore.seal({ t: 'state', s: 'stale' })
	const after = await join(guest, 'Ann', 2000)
	await book.accept(after.hello)
	assert.equal(await after.channel.open(oldState), null)
})

test('repeat hello (same gn, e.g. after a reconnect) keeps the channel and its replay counter', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const j = await join(guest, 'Ann', 5000)
	const r1 = await book.accept(j.hello)
	const m = await j.channel.seal({ i: 1 })
	assert.ok(await r1.channel.open(m))
	const r2 = await book.accept(j.hello) // the guest re-sent its hello
	assert.equal(r2.channel, null) // existing channel is kept...
	assert.equal(await r1.channel.open(m), null) // ...so the replay counter still blocks the old message
	assert.deepEqual(await r1.channel.open(await j.channel.seal({ i: 2 })), { i: 2 })
})

test('a new host run (new session id) rejects hellos made for the previous run', async () => {
	const host = await newIdentity(),
		guest = await newIdentity()
	const hello = (await makeHello(guest, host.pub, 'run-1', 'Ann', 1000, 'c')).hello
	assert.equal(await new HelloBook(host, 'run-2').accept(hello), null)
})

test('presence: only the current connection\'s last-will is believed', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const old = await join(guest, 'Ann', 1000, 'conn-old'),
		now = await join(guest, 'Ann', 2000, 'conn-new')
	await book.accept(old.hello)
	assert.equal(book.isCurrentCid(guest.kid, 'conn-old'), true)
	await book.accept(now.hello) // the guest reloaded: new connection
	assert.equal(book.isCurrentCid(guest.kid, 'conn-old'), false) // the old connection's late will must be ignored
	assert.equal(book.isCurrentCid(guest.kid, 'conn-new'), true)
	assert.equal(book.isCurrentCid(guest.kid, 'guess'), false) // an outsider cannot know it
	assert.equal(book.isCurrentCid(guest.kid, undefined), false)
	assert.equal(book.isCurrentCid('someone-else', 'conn-new'), false)
})

test('presence: the connection id is sealed in the hello, not readable or editable', async () => {
	const { book, join } = await room(),
		guest = await newIdentity()
	const { hello } = await join(guest, 'Ann', 1000, 'secret-conn-id')
	assert.equal(JSON.stringify(hello).includes('secret-conn-id'), false)
	await book.accept(hello)
	assert.equal(book.isCurrentCid(guest.kid, 'secret-conn-id'), true)
})
