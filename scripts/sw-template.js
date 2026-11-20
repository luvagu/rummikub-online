// Service worker template. The Vite plugin in vite.config.js fills in the version and the precache list (the two
// placeholders below, which must each appear exactly once) and writes dist/sw.js.
// Plain JS with no dependencies. It is only registered in production builds (src/services/sw-update.js).
//
// What it does: keeps the app shell (HTML, hashed JS/CSS, icons, the latin fonts, the lazy Rules/Tutorial chunks) so the
// app opens and solo play, the tutorial and the rules work with no network. Online play needs the network anyway: the MQTT
// connection is a WebSocket, which a service worker never sees, and its library chunk is not cached on purpose.
//
//   assets    cache-first (their names contain a content hash, so a cached copy is always the right one)
//   pages     network-first with a short timeout, falling back to the cached shell, so deploys propagate and the app still opens
//             offline
//   updates   a new worker installs and WAITS; the page asks the player, and only then sends SKIP_WAITING (never mid-game)
//
// VERSION is a hash of this file's text and of every precached file, so a deploy that changes nothing users get (a
// workflow-only change, a re-run) ships the same worker and shows no "new version" notice. To ship a new worker anyway
// (e.g. to test that notice), change any line of this file, a comment included.
const VERSION = '__VERSION__'
const FILES = __FILES__
const CACHE = 'rmk-' + VERSION
const SHELL = new URL('index.html', self.registration.scope).href
// Servers often send `Vary: Origin`, and module scripts are requested with an Origin header that the install-time fetch did not
// have, so a plain match() would miss. Every cached file is addressed by its (hashed) URL, so Vary adds nothing here.
const NOVARY = { ignoreVary: true }

self.addEventListener('install', event => {
	// `reload` bypasses the HTTP cache, so a half-updated CDN cannot put an old file under the new version's name
	event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))))
})

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('rmk-') && k !== CACHE).map(k => caches.delete(k)))),
	)
})

self.addEventListener('message', event => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
	const req = event.request
	if (req.method !== 'GET') return
	const url = new URL(req.url)
	if (url.origin !== self.location.origin) return // never touch third-party requests

	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req, { signal: AbortSignal.timeout(4000) }).catch(async () => (await (await caches.open(CACHE)).match(SHELL, NOVARY)) ?? Response.error()),
		)
		return
	}
	event.respondWith(
		caches.open(CACHE).then(async cache => (await cache.match(req, NOVARY)) ?? fetch(req)),
	)
})
