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
	ticks: true,
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
	gg: [
		[660, 0, 0.09, 0.08, 'triangle'],
		[880, 0.1, 0.14, 0.08, 'triangle'],
	], // rising double blip
	nice: [
		[523, 0, 0.1, 0.07],
		[659, 0.08, 0.1, 0.07],
		[784, 0.16, 0.18, 0.07],
	], // bright arpeggio
	wow: [
		[400, 0, 0.1, 0.07, 'triangle'],
		[520, 0.07, 0.1, 0.07, 'triangle'],
		[680, 0.14, 0.1, 0.07, 'triangle'],
		[900, 0.21, 0.2, 0.07, 'triangle'],
	], // upward sweep
	haha: [
		[740, 0, 0.06, 0.07, 'square'],
		[740, 0.09, 0.06, 0.07, 'square'],
		[740, 0.18, 0.06, 0.07, 'square'],
	], // staccato triplet
	scared: [
		[880, 0, 0.06, 0.08, 'triangle'],
		[1175, 0.06, 0.06, 0.08, 'triangle'],
		[880, 0.12, 0.06, 0.08, 'triangle'],
		[1175, 0.18, 0.06, 0.08, 'triangle'],
		[660, 0.26, 0.28, 0.08, 'triangle'],
	], // shrill warble then a drop
	hmm: [
		[330, 0, 0.18, 0.08, 'sine'],
		[294, 0.2, 0.26, 0.08, 'sine'],
	], // low two-tone
	hurry: [
		[1000, 0, 0.04, 0.06],
		[1000, 0.15, 0.04, 0.06],
		[1000, 0.3, 0.04, 0.06],
		[1000, 0.45, 0.04, 0.06],
	], // ticking
	fire: [
		[180, 0, 0.05, 0.07, 'sawtooth'],
		[240, 0.04, 0.04, 0.06, 'square'],
		[200, 0.09, 0.05, 0.07, 'sawtooth'],
		[300, 0.13, 0.04, 0.06, 'square'],
		[420, 0.18, 0.1, 0.07, 'sawtooth'],
		[620, 0.26, 0.12, 0.07, 'triangle'],
		[940, 0.34, 0.2, 0.07, 'triangle'],
	], // crackle then a rising whoosh
	rage: [
		[110, 0, 0.3, 0.1, 'sawtooth'],
		[104, 0.04, 0.26, 0.06, 'sawtooth'],
	], // low buzz
}
export function reactPop(k) {
	if (!getPrefs().sound) return
	const c = RSND[k]
	if (c) c.forEach(([f, at, d, g, ty]) => tone(f, at, d, g, ty))
	else tone(780, 0, 0.12, 0.07, 'triangle')
}
// Short filtered noise burst: the "card flick" used for dealing and drawing.
let nbuf
const noise = (at, dur, gain, freq = 3000) => {
	if (!ctx) return
	try {
		if (!nbuf) {
			nbuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate)
			const a = nbuf.getChannelData(0)
			for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1
		}
		const t = ctx.currentTime + at,
			s = ctx.createBufferSource(),
			f = ctx.createBiquadFilter(),
			g = ctx.createGain()
		s.buffer = nbuf
		f.type = 'bandpass'
		f.frequency.value = freq
		f.Q.value = 0.8
		g.gain.setValueAtTime(gain, t)
		g.gain.exponentialRampToValueAtTime(0.001, t + dur)
		s.connect(f)
		f.connect(g)
		g.connect(ctx.destination)
		s.start(t)
		s.stop(t + dur + 0.02)
	} catch (e) {}
}
// Dealer: one card flick when a dealt tile lands (`at` seconds from now); our own tiles get a slightly deeper tap.
export function dealCard(atMs, mine) {
	if (!getPrefs().sound) return
	const at = atMs / 1000
	noise(at, 0.06, mine ? 0.16 : 0.1, mine ? 2200 : 2800 + ((atMs * 7919) % 1200))
	tone(mine ? 200 : 260, at, 0.05, mine ? 0.06 : 0.025, 'triangle')
}
// Reduced motion: the same flicks, just without the flying tiles.
export function dealRound(n, gap = 0.1, fly = 0.5) {
	for (let j = 0; j < n; j++) dealCard((j * gap + fly) * 1000, false)
}
// Another player drew: a soft swish and a tap per tile.
export function drawSlide(n = 1) {
	if (!getPrefs().sound) return
	for (let i = 0; i < Math.min(n, 3); i++) {
		noise(i * 0.12, 0.16, 0.1, 1800)
		tone(260, i * 0.12 + 0.14, 0.06, 0.06, 'triangle')
	}
}
// One cue per action-bar button: [freq, at, dur, gain, type] steps.
const SFX = {
	click: [[700, 0, 0.05, 0.07, 'triangle']],
	toRack: [[500, 0, 0.06, 0.08, 'triangle'], [380, 0.05, 0.08, 0.08, 'triangle']],
	undo: [[620, 0, 0.06, 0.08, 'triangle'], [420, 0.06, 0.06, 0.08, 'triangle'], [300, 0.12, 0.09, 0.08, 'triangle']],
	drawAsk: [[520, 0, 0.07, 0.09, 'square'], [520, 0.1, 0.07, 0.09, 'square']],
	end: [[523, 0, 0.08, 0.1], [659, 0.07, 0.08, 0.1], [784, 0.14, 0.16, 0.1]],
	skip: [[330, 0, 0.07, 0.08, 'square'], [440, 0.07, 0.1, 0.08, 'square']],
	sort: [[900, 0, 0.04, 0.06], [1100, 0.04, 0.04, 0.06], [1350, 0.08, 0.05, 0.06]],
}
export function sfx(k) {
	if (!getPrefs().sound) return
	if (k === 'draw') {
		noise(0, 0.12, 0.12, 2000)
		tone(300, 0.1, 0.07, 0.07, 'triangle')
		return
	}
	const c = SFX[k] || SFX.click
	c.forEach(([f, at, d, g, ty]) => tone(f, at, d, g, ty))
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
