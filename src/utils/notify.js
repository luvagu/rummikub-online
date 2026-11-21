// "It's your turn" alerts: a short two-note chime (generated with WebAudio, no files) and device
// vibration where supported (Android browsers; iOS Safari has no web vibration API).
import { local } from './store.js'

let ctx
// Prefs are read on every tone (including each card of the 56-tile deal), so keep them in memory and
// only re-read storage when another tab changes them.
const DEFAULTS = { sound: true, vibe: true, ticks: true, reacts: true }
let prefs
export const getPrefs = () => (prefs ??= { ...DEFAULTS, ...local.getJSON('rmkNotify', {}) })
export const setPref = (k, v) => {
	prefs = { ...getPrefs(), [k]: v }
	local.setJSON('rmkNotify', prefs)
}
if (typeof addEventListener === 'function') {
	addEventListener('storage', e => {
		if (e.key === 'rmkNotify' || e.key === null) prefs = undefined
	})
	// iOS suspends/interrupts audio when the tab is backgrounded; bring it back when the player returns
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
	})
}
export const canVibrate = () =>
	typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
// Browsers only allow audio after a user gesture, so this is called on the first tap/click/key press.
export function unlockAudio() {
	try {
		const AC = window.AudioContext
		if (!AC) return
		ctx ??= new AC()
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
	// Browsers block vibration until the player has tapped the page (and log an intervention error), e.g. when a saved
	// game resumes on load, so skip it until then.
	if (navigator.userActivation?.hasBeenActive === false) return
	try {
		if (canVibrate()) navigator.vibrate(p)
	} catch {}
}
// One short synthesized cue per emote category (see `cat` in REACTIONS, reactions.js). Steps are [freq, at, dur, gain, type].
const RSND = {
	cheer: [
		[523, 0, 0.1, 0.07],
		[659, 0.08, 0.1, 0.07],
		[784, 0.16, 0.18, 0.07],
	], // bright arpeggio
	shock: [
		[400, 0, 0.1, 0.07, 'triangle'],
		[520, 0.07, 0.1, 0.07, 'triangle'],
		[680, 0.14, 0.1, 0.07, 'triangle'],
		[900, 0.21, 0.2, 0.07, 'triangle'],
	], // upward sweep
	laugh: [
		[740, 0, 0.06, 0.07, 'square'],
		[740, 0.09, 0.06, 0.07, 'square'],
		[740, 0.18, 0.06, 0.07, 'square'],
	], // staccato triplet
	sad: [
		[392, 0, 0.16, 0.08, 'sine'],
		[330, 0.18, 0.16, 0.08, 'sine'],
		[262, 0.36, 0.3, 0.08, 'sine'],
	], // slow falling thirds
	taunt: [
		[220, 0, 0.12, 0.08, 'sawtooth'],
		[233, 0.12, 0.2, 0.08, 'sawtooth'],
	], // low sly wobble
	nudge: [
		[1000, 0, 0.04, 0.06],
		[1000, 0.15, 0.04, 0.06],
		[1000, 0.3, 0.04, 0.06],
	], // ticking
}
export function reactPop(cat) {
	if (!getPrefs().sound) return
	const c = RSND[cat]
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
	select: [[820, 0, 0.03, 0.05, 'triangle']],
	deselect: [[560, 0, 0.03, 0.05, 'triangle']],
	newSet: [[330, 0, 0.04, 0.08, 'square'], [494, 0.04, 0.07, 0.08, 'triangle']],
	addTo: [[440, 0, 0.04, 0.07, 'triangle'], [587, 0.04, 0.06, 0.07, 'triangle']],
	win: [[523, 0, 0.1, 0.1], [659, 0.09, 0.1, 0.1], [784, 0.18, 0.1, 0.1], [1047, 0.27, 0.18, 0.11], [784, 0.45, 0.08, 0.08, 'triangle'], [1047, 0.52, 0.08, 0.08, 'triangle'], [1319, 0.6, 0.4, 0.1]],
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
// Turn timer cues: one soft heads-up at the warning threshold (different from the turn chime), optional ticks in the
// last 5s (the final one a little higher), a gentle "time's up".
export function warn() {
	const p = getPrefs()
	if (p.sound) tone(494, 0, 0.6, 0.16, 'triangle')
	if (p.vibe) buzz(70)
}
export function tick(last = false) {
	const p = getPrefs()
	if (p.sound && p.ticks) tone(last ? 1320 : 1100, 0, 0.09, 0.12, 'triangle')
}
export function timeUp() {
	const p = getPrefs()
	if (p.sound) {
		tone(440, 0, 0.3, 0.18, 'triangle')
		tone(330, 0.2, 0.4, 0.18, 'triangle')
	}
	if (p.vibe) buzz([60, 50, 60])
}
