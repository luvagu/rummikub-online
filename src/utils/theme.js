// Colour scheme: follow the system by default, with an optional override (System / Light / Dark) kept in localStorage.
// The override is applied through <meta name="color-scheme">: tokens.css maps that meta back onto the CSS `color-scheme`
// property, and every `light-dark()` colour follows it. index.html applies the stored value before first paint.
import { useSyncExternalStore } from 'react'
import { local } from './store.js'

const KEY = 'rmkTheme'
const mq = matchMedia('(prefers-color-scheme: dark)')
const subs = new Set()
const emit = () => subs.forEach(f => f())

export const getTheme = () => {
	const v = local.get(KEY)
	return v === 'light' || v === 'dark' ? v : 'system'
}
// What is actually shown right now: the override, else the system setting.
export const resolvedTheme = () => {
	const t = getTheme()
	return t === 'system' ? (mq.matches ? 'dark' : 'light') : t
}
const apply = () => {
	const meta = document.querySelector('meta[name="color-scheme"]')
	if (meta) meta.content = getTheme() === 'system' ? 'light dark' : getTheme()
	emit()
}
export const setTheme = t => {
	if (t === 'system') local.remove(KEY) // never auto-removed later, even if the OS happens to match the pinned value
	else local.set(KEY, t)
	apply()
}
export const cycleTheme = () => setTheme({ system: 'light', light: 'dark', dark: 'system' }[getTheme()])

addEventListener('storage', e => {
	if (e.key === KEY || e.key === null) apply() // changed in another tab
})
mq.addEventListener('change', emit) // only the "System (light)" label depends on it: CSS follows the system by itself

export const useTheme = () => {
	const k = useSyncExternalStore(
		cb => (subs.add(cb), () => subs.delete(cb)),
		() => getTheme() + '/' + resolvedTheme(),
	)
	const [theme, shown] = k.split('/')
	return { theme, shown }
}
