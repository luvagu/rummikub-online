// The player's online identity: an ECDH key pair, created once per browser tab (so two tabs of one browser can still be
// two different players) and kept in sessionStorage. A saved session also keeps a copy in localStorage (see session.js),
// so a game resumed after the browser was closed keeps its seat. The public id (`kid`) is what everyone sees.
import { newIdentity, importIdentity, secureOK } from '../utils/secure.js'
import { session } from '../utils/store.js'

let cached
export const getIdentity = saved =>
	(cached ??= (async () => {
		if (!secureOK()) throw new Error('insecure') // WebCrypto only exists on https and localhost
		for (const stored of [session.getJSON('rmkId'), saved]) {
			if (!stored) continue
			try {
				const id = await importIdentity(stored)
				session.setJSON('rmkId', id.exported)
				return id
			} catch {} // unreadable copy: fall through to a fresh identity
		}
		const id = await newIdentity()
		session.setJSON('rmkId', id.exported)
		return id
	})())
