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
export const getPrefs = () => ({ sound: true, vibe: true, ...read() })
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
export function chime() {
	if (!ctx) return
	try {
		const t = ctx.currentTime
		;[
			[660, 0],
			[880, 0.16],
		].forEach(([f, d]) => {
			const o = ctx.createOscillator(),
				g = ctx.createGain()
			o.type = 'sine'
			o.frequency.value = f
			g.gain.setValueAtTime(0, t + d)
			g.gain.linearRampToValueAtTime(0.25, t + d + 0.02)
			g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.3)
			o.connect(g)
			g.connect(ctx.destination)
			o.start(t + d)
			o.stop(t + d + 0.32)
		})
	} catch (e) {}
}
export const buzz = () => {
	try {
		if (canVibrate()) navigator.vibrate([200, 100, 200])
	} catch (e) {}
}
export function notifyTurn() {
	const p = getPrefs()
	if (p.sound) chime()
	if (p.vibe) buzz()
}
