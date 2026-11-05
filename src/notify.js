// "It's your turn" alerts: a short two-note chime (generated with WebAudio, no files) and device
// vibration where supported (Android browsers; iOS Safari has no web vibration API).
let ctx
const read = () => {
	try {
		return JSON.parse(localStorage.rmkNotify || '{}')
	} catch (e) {
		return {}
	}
}
export const getPrefs = () => ({
	sound: true,
	vibe: true,
	ticks: false,
	reacts: true,
	...read(),
})
export const setPref = (k, v) => {
	try {
		localStorage.rmkNotify = JSON.stringify({ ...getPrefs(), [k]: v })
	} catch (e) {}
}
export const canVibrate = () =>
	typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
// Browsers only allow audio after a user gesture, so this is called on the first tap/click/key press.
export function unlockAudio() {
	try {
		const AC = window.AudioContext || window.webkitAudioContext
		if (!AC) return
		ctx = ctx || new AC()
		if (ctx.state === 'suspended') ctx.resume()
	} catch (e) {}
}
const tone = (f, at, dur, gain, type = 'sine') => {
	if (!ctx) return
	try {
		const t = ctx.currentTime + at,
			o = ctx.createOscillator(),
			g = ctx.createGain()
		o.type = type
		o.frequency.value = f
		g.gain.setValueAtTime(0, t)
		g.gain.linearRampToValueAtTime(gain, t + 0.02)
		g.gain.exponentialRampToValueAtTime(0.001, t + dur)
		o.connect(g)
		g.connect(ctx.destination)
		o.start(t)
		o.stop(t + dur + 0.02)
	} catch (e) {}
}
export const chime = () => {
	tone(660, 0, 0.3, 0.25)
	tone(880, 0.16, 0.3, 0.25)
}
export const buzz = (p = [200, 100, 200]) => {
	try {
		if (canVibrate()) navigator.vibrate(p)
	} catch (e) {}
}
export function reactPop() {
	if (getPrefs().sound) tone(780, 0, 0.12, 0.07, 'triangle')
}
export function notifyTurn() {
	const p = getPrefs()
	if (p.sound) chime()
	if (p.vibe) buzz()
}
// Turn timer cues: one soft heads-up at 10s (different from the turn chime), optional quiet ticks in the last 3s, a gentle "time's up".
export function warn() {
	const p = getPrefs()
	if (p.sound) tone(494, 0, 0.6, 0.16, 'triangle')
	if (p.vibe) buzz(70)
}
export function tick() {
	const p = getPrefs()
	if (p.sound && p.ticks) tone(1100, 0, 0.06, 0.05)
}
export function timeUp() {
	const p = getPrefs()
	if (p.sound) {
		tone(440, 0, 0.3, 0.18, 'triangle')
		tone(330, 0.2, 0.4, 0.18, 'triangle')
	}
	if (p.vibe) buzz([60, 50, 60])
}
