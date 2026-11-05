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
// One short synthesized cue per reaction key (see REACTIONS in reactions.js). Steps are [freq, at, dur, gain, type].
const RSND = {
	gg: [[660, 0, 0.09, 0.08, 'triangle'], [880, 0.1, 0.14, 0.08, 'triangle']], // rising double blip
	nice: [[523, 0, 0.1, 0.07], [659, 0.08, 0.1, 0.07], [784, 0.16, 0.18, 0.07]], // bright arpeggio
	wow: [[400, 0, 0.1, 0.07, 'triangle'], [520, 0.07, 0.1, 0.07, 'triangle'], [680, 0.14, 0.1, 0.07, 'triangle'], [900, 0.21, 0.2, 0.07, 'triangle']], // upward sweep
	haha: [[740, 0, 0.06, 0.07, 'square'], [740, 0.09, 0.06, 0.07, 'square'], [740, 0.18, 0.06, 0.07, 'square']], // staccato triplet
	oops: [[440, 0, 0.1, 0.08, 'triangle'], [415, 0.1, 0.1, 0.08, 'triangle'], [370, 0.2, 0.2, 0.08, 'triangle']], // wobbly down-step
	hmm: [[330, 0, 0.18, 0.08, 'sine'], [294, 0.2, 0.26, 0.08, 'sine']], // low two-tone
	hurry: [[1000, 0, 0.04, 0.06], [1000, 0.15, 0.04, 0.06], [1000, 0.3, 0.04, 0.06], [1000, 0.45, 0.04, 0.06]], // ticking
	sad: [[520, 0, 0.14, 0.08, 'sine'], [440, 0.14, 0.14, 0.08, 'sine'], [350, 0.28, 0.14, 0.08, 'sine'], [260, 0.42, 0.28, 0.08, 'sine']], // descending slide
	rage: [[110, 0, 0.3, 0.1, 'sawtooth'], [104, 0.04, 0.26, 0.06, 'sawtooth']], // low buzz
}
export function reactPop(k) {
	if (!getPrefs().sound) return
	const c = RSND[k]
	if (c) c.forEach(([f, at, d, g, ty]) => tone(f, at, d, g, ty))
	else tone(780, 0, 0.12, 0.07, 'triangle')
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
