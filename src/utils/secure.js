// End-to-end encryption for online rooms, on WebCrypto only (no dependency).
//
// Why: the MQTT relays are public and have no access control, so anyone who knows a room code can subscribe to
// everything in it. Each guest therefore talks to the host over its own encrypted, authenticated channel:
//
//   identity   every client has an ECDH P-256 key pair; its public id `kid` is a hash of the public key, so it is
//              safe to show to everyone (it replaces the old secret token as the player id).
//   channel    key = HKDF(ECDH(my private key, their public key), salt = the host's per-run session id).
//              Messages are AES-GCM sealed: confidentiality AND authenticity, because only a holder of one of the
//              two private keys can produce a message that decrypts. The direction is bound in as associated data
//              so a message cannot be reflected back at its sender.
//   replay     a counter inside each sealed message must strictly increase. Every handshake also gets a fresh key
//              (the salt is the host's per-run session id plus the guest's handshake number `gn`), so nothing captured
//              from an earlier handshake or an earlier host run decrypts at all; a replayed hello is rejected because
//              its tag only opens under the guest's key and its `gn` is not newer than the one already accepted.
//
// Not protected (documented in the README): the host is trusted, and anyone with the room code can still join an
// empty seat, exactly as before.
import { cleanName } from '../engine/names.js'

const subtle = globalThis.crypto?.subtle
const enc = new TextEncoder(),
	dec = new TextDecoder()
const CURVE = { name: 'ECDH', namedCurve: 'P-256' }
const INFO = enc.encode('rmkb8')

export const secureOK = () => !!subtle

// ---- base64url ----
const b64u = bytes => {
	let s = ''
	for (const b of bytes) s += String.fromCharCode(b)
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
const unb64u = str => {
	const s = str.replaceAll('-', '+').replaceAll('_', '/')
	const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
	return Uint8Array.from(bin, c => c.charCodeAt(0))
}
export const randomId = (bytes = 16) => b64u(crypto.getRandomValues(new Uint8Array(bytes)))

// ---- identity ----
// Only the fields that define the key take part in the id, so extra JWK members cannot change it.
const canonical = jwk => JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
const validPub = jwk =>
	!!jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string'
// 128 bits of SHA-256 over the public key: stable, public, not guessable.
export const kidOf = async jwk => b64u(new Uint8Array(await subtle.digest('SHA-256', enc.encode(canonical(jwk)))).slice(0, 16))
// A hello is only believable if the id it claims really is the hash of the key it carries.
export const kidMatches = async (kid, pub) => validPub(pub) && typeof kid === 'string' && kid === (await kidOf(pub))

const clean = jwk => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })
export async function newIdentity() {
	const { privateKey, publicKey } = await subtle.generateKey(CURVE, true, ['deriveBits'])
	const pub = clean(await subtle.exportKey('jwk', publicKey))
	return { priv: privateKey, pub, kid: await kidOf(pub), exported: { priv: await subtle.exportKey('jwk', privateKey), pub } }
}
export async function importIdentity({ priv, pub }) {
	if (!validPub(pub)) throw new Error('bad identity')
	const privateKey = await subtle.importKey('jwk', priv, CURVE, true, ['deriveBits'])
	return { priv: privateKey, pub: clean(pub), kid: await kidOf(pub), exported: { priv, pub: clean(pub) } }
}

// ---- channel key ----
export async function deriveKey(priv, theirPub, sid) {
	if (!validPub(theirPub)) throw new Error('bad public key')
	const their = await subtle.importKey('jwk', clean(theirPub), CURVE, false, [])
	const bits = await subtle.deriveBits({ name: 'ECDH', public: their }, priv, 256)
	const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
	return subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(String(sid)), info: INFO },
		hk,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)
}

// ---- sealed messages ----
// `role` is who owns this end: 'guest' or 'host'. Direction labels are the associated data.
export class Channel {
	constructor(key, role) {
		this.key = key
		this.aadOut = enc.encode(role === 'host' ? 'h2g' : 'g2h')
		this.aadIn = enc.encode(role === 'host' ? 'g2h' : 'h2g')
		this.out = Date.now() // seeded from the clock so a reloading guest never restarts below what the host has seen
		this.last = 0
		this.q = Promise.resolve() // sealing is async: keep messages in the order they were sent
	}
	seal(obj) {
		const n = (this.out = Math.max(this.out + 1, Date.now()))
		const run = async () => {
			const iv = crypto.getRandomValues(new Uint8Array(12))
			const ct = new Uint8Array(
				await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.aadOut }, this.key, enc.encode(JSON.stringify({ n, m: obj }))),
			)
			const out = new Uint8Array(12 + ct.length)
			out.set(iv)
			out.set(ct, 12)
			return b64u(out)
		}
		const p = this.q.then(run, run)
		this.q = p.catch(() => {})
		return p
	}
	// Returns the message, or null if it is forged, corrupted, from the wrong direction or a replay.
	async open(str) {
		try {
			const raw = unb64u(String(str))
			if (raw.length < 12 + 16) return null
			const pt = await subtle.decrypt(
				{ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: this.aadIn },
				this.key,
				raw.slice(12),
			)
			const { n, m } = JSON.parse(dec.decode(pt))
			if (!Number.isSafeInteger(n) || n <= this.last) return null
			this.last = n
			return m
		} catch {
			return null
		}
	}
}

// ---- handshake ----
// A hello is the one packet that is not fully sealed (the host needs the public key to derive anything), so it carries a
// tag sealed under the handshake-independent key K0 = f(ECDH, sid): only the holder of the guest's private key can make
// it. The tag holds the guest's name, its handshake number and the id of its current MQTT connection (`cid`), so none
// of them can be changed or replayed by an outsider. The connection id is also what makes a broker last-will hint
// believable: the will carries the same cid, and only the hello's tag (sealed) tells the host which cid is current.
export const saltFor = (sid, gn) => `${sid}:${gn}`

// Guest side. Returns the hello to publish and the channel to use once the host answers.
export async function makeHello(ident, hostPub, sid, name, gn, cid) {
	const k0 = await deriveKey(ident.priv, hostPub, sid)
	const h = await new Channel(k0, 'guest').seal({ gn, name, cid })
	const key = await deriveKey(ident.priv, hostPub, saltFor(sid, gn))
	return { hello: { kid: ident.kid, pub: ident.pub, gn, h }, channel: new Channel(key, 'guest') }
}

// Host side: remembers, per guest id, the newest handshake it has accepted.
export class HelloBook {
	constructor(hostIdent, sid) {
		this.id = hostIdent
		this.sid = sid
		this.gns = new Map()
		this.cids = new Map() // guest id -> connection id from its newest accepted hello
	}
	// A broker last-will says "the connection with this cid died". Only the guest's CURRENT connection counts: a late will
	// from an old connection (a reload) has a different cid, and an outsider cannot know the current one.
	isCurrentCid(kid, cid) {
		return typeof cid === 'string' && this.cids.get(kid) === cid
	}
	// -> null (reject) | { kid, name, channel }  (channel is null when it is a repeat of the current handshake: the
	// existing channel stays, so its replay counter is not reset)
	async accept(d) {
		if (!d || typeof d.kid !== 'string' || !Number.isSafeInteger(d.gn) || typeof d.h !== 'string') return null
		if (!(await kidMatches(d.kid, d.pub))) return null // the id must be the hash of the key it carries
		let k0, tag
		try {
			k0 = await deriveKey(this.id.priv, d.pub, this.sid)
			tag = await new Channel(k0, 'host').open(d.h)
		} catch {
			return null
		}
		if (!tag || tag.gn !== d.gn || typeof tag.name !== 'string' || typeof tag.cid !== 'string') return null // not made by the key holder
		const prev = this.gns.get(d.kid)
		if (prev !== undefined && d.gn < prev) return null // an old hello being replayed
		const name = cleanName(tag.name)
		this.cids.set(d.kid, tag.cid)
		if (prev === d.gn) return { kid: d.kid, name, channel: null }
		const key = await deriveKey(this.id.priv, d.pub, saltFor(this.sid, d.gn))
		this.gns.set(d.kid, d.gn)
		return { kid: d.kid, name, channel: new Channel(key, 'host') }
	}
}
