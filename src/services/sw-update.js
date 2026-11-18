// Registers the service worker (production builds only; `vite dev` never has one) and tells the UI when a new version is
// installed and waiting. The new worker never takes over on its own: the player chooses when to reload (not mid-game).
import { useSyncExternalStore } from 'react'

let waiting = null
const subs = new Set()
const set = w => {
	waiting = w
	subs.forEach(f => f())
}

export function registerSW() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
	addEventListener(
		'load',
		async () => {
			try {
				// updateViaCache: GitHub Pages serves sw.js with max-age=600; this makes the update check always ask the server
				const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
				// "installed" while a controller exists = an UPDATE (the very first install has no controller and needs no prompt)
				const watch = w =>
					w.addEventListener('statechange', () => w.state === 'installed' && navigator.serviceWorker.controller && set(w))
				if (reg.waiting && navigator.serviceWorker.controller) set(reg.waiting)
				reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing))
				// long-lived tabs and installed apps rarely navigate, so look for a new version whenever the app comes back
				document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}))
			} catch {} // no service worker (private mode, blocked): the app simply stays online-only
		},
		{ once: true },
	)
}

export const useUpdate = () =>
	useSyncExternalStore(
		cb => (subs.add(cb), () => subs.delete(cb)),
		() => waiting,
	)

export function applyUpdate() {
	if (!waiting) return
	navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
	waiting.postMessage({ type: 'SKIP_WAITING' })
}
export const dismissUpdate = () => set(null) // asks again when the next new version arrives
